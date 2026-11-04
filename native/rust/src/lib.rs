//! CircleCode Rust Core — WebAssembly, C/C++ FFI, Flutter Dart FFI, Swift, & Android JNI Engine
//! High-performance circular barcode encoder & decoder with subpixel sampling and checksum error recovery.

use serde::{Deserialize, Serialize};
use std::ffi::{c_char, CStr, CString};
use std::ptr;
use std::slice;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

pub const DISC_R: f32 = 190.0;
pub const CENTER_R: f32 = 42.0;
pub const R_START: f32 = 55.0;
pub const R_END: f32 = 157.0;
pub const DASH_OFF: f32 = 0.28;
pub const DASH_LEN: f32 = 0.44;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScanResult {
    pub ok: bool,
    pub text: Option<String>,
    pub bytes: Option<Vec<u8>>,
    pub len: usize,
    pub chk: u8,
    pub rings: usize,
    pub density: f32,
    pub rot: f32,
    pub sep: f32,
    pub fixed: usize,
    pub reason: Option<String>,
}

/// C-compatible result struct for direct FFI consumers (C, C++, Swift, Flutter dart:ffi)
#[repr(C)]
pub struct CircleCodeResultC {
    pub ok: i32,
    pub len: i32,
    pub chk: u8,
    pub rings: i32,
    pub density: f32,
    pub rot: f32,
    pub sep: f32,
    pub fixed: i32,
}

#[derive(Clone, Debug)]
struct ParsedBits {
    text: String,
    bytes: Vec<u8>,
    len: usize,
    chk: u8,
}

// =============================================================================
// Deterministic PRNG & Encoder (100% bit-identical to circle-code.js)
// =============================================================================

fn xmur3_seed(s: &str) -> u32 {
    let utf16: Vec<u16> = s.encode_utf16().collect();
    let mut h: u32 = 1779033703u32 ^ (utf16.len() as u32);
    for &ch in &utf16 {
        h = (h ^ (ch as u32)).wrapping_mul(3432918353);
        h = h.rotate_left(13);
    }
    h = (h ^ (h >> 16)).wrapping_mul(2246822507);
    h = (h ^ (h >> 13)).wrapping_mul(3266489909);
    h ^ (h >> 16)
}

struct Mulberry32 {
    a: u32,
}

impl Mulberry32 {
    fn new(seed: u32) -> Self {
        Self { a: seed }
    }

    fn next_f64(&mut self) -> f64 {
        self.a = self.a.wrapping_add(0x6D2B79F5);
        let mut t = (self.a ^ (self.a >> 15)).wrapping_mul(1 | self.a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

fn escape_xml(val: &str) -> String {
    let mut out = String::with_capacity(val.len());
    for c in val.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            '\u{0000}'..='\u{0008}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{000E}'..='\u{001F}'
            | '\u{FFFE}'
            | '\u{FFFF}' => out.push('\u{FFFD}'),
            _ => out.push(c),
        }
    }
    out
}

#[derive(Clone, Debug)]
pub struct ArcRun {
    pub start: usize,
    pub len: usize,
    pub full: bool,
}

pub fn get_runs(bits: &[u8]) -> Vec<ArcRun> {
    let n = bits.len();
    if bits.iter().all(|&b| b == 1) {
        return vec![ArcRun { start: 0, len: n, full: true }];
    }
    let mut first_zero = 0;
    while first_zero < n && bits[first_zero] == 1 {
        first_zero += 1;
    }
    let mut runs = Vec::new();
    let mut i = 0;
    while i < n {
        let idx = (first_zero + i) % n;
        if bits[idx] == 1 {
            let run_start = idx;
            let mut len = 0;
            while i < n && bits[(first_zero + i) % n] == 1 {
                len += 1;
                i += 1;
            }
            runs.push(ArcRun { start: run_start, len, full: false });
        } else {
            i += 1;
        }
    }
    runs
}

/// Encodes a UTF-8 payload into a scalable CircleCode SVG string (Circle or LonCle mode).
pub fn encode_svg(
    payload: &str,
    rings_count: usize,
    density: f32,
    loncle: bool,
    center_text: &str,
) -> Result<String, String> {
    let k = if rings_count == 0 { 5 } else { rings_count };
    let d = if density <= 0.0 { 0.35 } else { density };
    let bytes = payload.as_bytes();
    let rs = radii(k);
    let ns: Vec<usize> = rs.iter().map(|&r| slot_count(r, d)).collect();
    let cap: usize = ns.iter().map(|&n| n.saturating_sub(1)).sum();
    let need = 16 + bytes.len() * 8 + 8;
    if need > cap {
        return Err(format!(
            "Payload too long: need {} bits, capacity {}. Shorten text or add rings.",
            need, cap
        ));
    }

    let mut checksum: u8 = 0;
    for &b in bytes {
        checksum = checksum.wrapping_add(b);
    }

    let mut seq: Vec<u8> = Vec::with_capacity(cap);
    for i in (0..16).rev() {
        seq.push(((bytes.len() >> i) & 1) as u8);
    }
    for &b in bytes {
        for i in (0..8).rev() {
            seq.push(((b >> i) & 1) as u8);
        }
    }
    for i in (0..8).rev() {
        seq.push(((checksum >> i) & 1) as u8);
    }

    let mut rng = Mulberry32::new(xmur3_seed(&format!("{}#pad", payload)));
    while seq.len() < cap {
        seq.push(if rng.next_f64() > 0.5 { 1 } else { 0 });
    }

    let safe_payload = escape_xml(payload);
    let safe_center = escape_xml(if center_text.is_empty() { "Pay" } else { center_text });
    let mode_label = if loncle { "LonCle" } else { "Circle" };

    let mut h = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-label=\"CircleCode barcode: {}\" viewBox=\"0 0 400 400\">",
        safe_payload
    );
    h.push_str(&format!("<title>CircleCode Barcode: {}</title>", safe_payload));
    h.push_str(&format!(
        "<desc>Circular barcode in {} mode containing {} data rings encoding {} bytes of UTF-8 payload.</desc>",
        mode_label,
        k,
        bytes.len()
    ));
    h.push_str("<circle cx=\"200\" cy=\"200\" r=\"190\" fill=\"#ffffff\"/>");

    let cx = 200.0f32;
    let cy = 200.0f32;
    let mut bit_idx = 0usize;

    for (ri, &r) in rs.iter().enumerate() {
        let n = ns[ri];
        let slot = (std::f32::consts::PI * 2.0) / (n as f32);
        let mut ring_bits = Vec::with_capacity(n);
        for j in 0..n {
            if j == 0 {
                ring_bits.push(1u8);
            } else {
                ring_bits.push(seq[bit_idx]);
                bit_idx += 1;
            }
        }

        if loncle {
            for run in get_runs(&ring_bits) {
                if run.full {
                    h.push_str(&format!(
                        "<circle cx=\"200\" cy=\"200\" r=\"{}\" stroke=\"#000000\" stroke-width=\"7.5\" fill=\"none\"/>",
                        r
                    ));
                } else {
                    let a0 = (run.start as f32 / n as f32) * std::f32::consts::PI * 2.0 + slot * DASH_OFF;
                    let a1 = a0 + ((run.len - 1) as f32) * slot + slot * DASH_LEN;
                    let p0 = (cx + r * a0.cos(), cy + r * a0.sin());
                    let p1 = (cx + r * a1.cos(), cy + r * a1.sin());
                    let large_arc = if (a1 - a0) > std::f32::consts::PI { 1 } else { 0 };
                    h.push_str(&format!(
                        "<path d=\"M {:.2} {:.2} A {} {} 0 {} 1 {:.2} {:.2}\" stroke=\"#000000\" stroke-width=\"7.5\" stroke-linecap=\"round\" fill=\"none\"/>",
                        p0.0, p0.1, r, r, large_arc, p1.0, p1.1
                    ));
                }
            }
        } else {
            for (j, &bit) in ring_bits.iter().enumerate() {
                let col = if bit == 1 { "#000000" } else { "#8e8e93" };
                let a0 = (j as f32 / n as f32) * std::f32::consts::PI * 2.0 + slot * DASH_OFF;
                let a1 = a0 + slot * DASH_LEN;
                let p0 = (cx + r * a0.cos(), cy + r * a0.sin());
                let p1 = (cx + r * a1.cos(), cy + r * a1.sin());
                h.push_str(&format!(
                    "<path d=\"M {:.2} {:.2} A {} {} 0 0 1 {:.2} {:.2}\" stroke=\"{}\" stroke-width=\"7.5\" stroke-linecap=\"round\" fill=\"none\"/>",
                    p0.0, p0.1, r, r, p1.0, p1.1, col
                ));
            }
        }
    }

    h.push_str("<circle cx=\"200\" cy=\"200\" r=\"42\" fill=\"#000000\"/>");
    h.push_str(&format!(
        "<text x=\"200\" y=\"200\" fill=\"#ffffff\" font-family=\"system-ui,Segoe UI,Arial,sans-serif\" font-size=\"19\" font-weight=\"bold\" text-anchor=\"middle\" dominant-baseline=\"central\">{}</text></svg>",
        safe_center
    ));

    Ok(h)
}

#[inline(always)]
pub fn radii(k: usize) -> Vec<f32> {
    if k == 1 {
        return vec![110.0];
    }
    let mut out = Vec::with_capacity(k);
    for i in 0..k {
        out.push(R_START + (R_END - R_START) * (i as f32) / ((k - 1) as f32));
    }
    out
}

#[inline(always)]
pub fn slot_count(r: f32, density: f32) -> usize {
    12.max((r * density).floor() as usize)
}

#[inline(always)]
pub fn sample(
    g: &[f32],
    w: usize,
    h: usize,
    cx: f32,
    cy: f32,
    r: f32,
    ang: f32,
    aspect: f32,
    tilt: f32,
) -> f32 {
    let mut xr = r * ang.cos();
    let mut yr = r * ang.sin();

    if aspect != 1.0 {
        let cos_t = tilt.cos();
        let sin_t = tilt.sin();
        let u = xr * cos_t + yr * sin_t;
        let v = (-xr * sin_t + yr * cos_t) * aspect;
        xr = u * cos_t - v * sin_t;
        yr = u * sin_t + v * cos_t;
    }

    let x = (cx + xr).round() as isize;
    let y = (cy + yr).round() as isize;

    let mut sum = 0.0;
    let mut count = 0;

    for dy in -1..=1 {
        for dx in -1..=1 {
            let xi = x + dx;
            let yi = y + dy;
            if xi >= 0 && yi >= 0 && (xi as usize) < w && (yi as usize) < h {
                sum += g[(yi as usize) * w + (xi as usize)];
                count += 1;
            }
        }
    }

    if count > 0 {
        sum / (count as f32)
    } else {
        255.0
    }
}

#[inline(always)]
pub fn sample_radial_min(
    g: &[f32],
    w: usize,
    h: usize,
    cx: f32,
    cy: f32,
    r: f32,
    ang: f32,
    scale: f32,
    aspect: f32,
    tilt: f32,
) -> f32 {
    let dr = 2.2 * 0.6f32.max(scale);
    let s0 = sample(g, w, h, cx, cy, r, ang, aspect, tilt);
    let s1 = sample(g, w, h, cx, cy, r - dr, ang, aspect, tilt);
    let s2 = sample(g, w, h, cx, cy, r + dr, ang, aspect, tilt);
    s0.min(s1).min(s2)
}

#[inline(always)]
pub fn median3(
    g: &[f32],
    w: usize,
    h: usize,
    cx: f32,
    cy: f32,
    r: f32,
    ang: f32,
    slot: f32,
    scale: f32,
    aspect: f32,
    tilt: f32,
) -> f32 {
    let off = slot * 0.14;
    let mut a = [
        sample_radial_min(g, w, h, cx, cy, r, ang - off, scale, aspect, tilt),
        sample_radial_min(g, w, h, cx, cy, r, ang, scale, aspect, tilt),
        sample_radial_min(g, w, h, cx, cy, r, ang + off, scale, aspect, tilt),
    ];
    a.sort_by(|x, y| x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal));
    a[1]
}

pub fn otsu_thr(vals: &[f32]) -> (f32, f32) {
    let mut hist = [0usize; 256];
    for &v in vals {
        let bin = (v.round() as usize).min(255);
        hist[bin] += 1;
    }
    let total = vals.len();
    let mut sum = 0.0f32;
    for (i, &count) in hist.iter().enumerate() {
        sum += (i as f32) * (count as f32);
    }

    let mut sum_b = 0.0f32;
    let mut w_b = 0usize;
    let mut best = -1.0f32;
    let mut thr = 128usize;

    for t in 0..256 {
        w_b += hist[t];
        if w_b == 0 {
            continue;
        }
        let w_f = total - w_b;
        if w_f == 0 {
            break;
        }
        sum_b += (t as f32) * (hist[t] as f32);
        let m_b = sum_b / (w_b as f32);
        let m_f = (sum - sum_b) / (w_f as f32);
        let between = (w_b as f32) * (w_f as f32) * (m_b - m_f) * (m_b - m_f);
        if between > best {
            best = between;
            thr = t;
        }
    }

    let mut s0 = 0.0;
    let mut n0 = 0;
    let mut s1 = 0.0;
    let mut n1 = 0;

    for &v in vals {
        if v <= (thr as f32) {
            s0 += v;
            n0 += 1;
        } else {
            s1 += v;
            n1 += 1;
        }
    }

    if n0 == 0 || n1 == 0 {
        return (thr as f32 + 0.5, 0.0);
    }

    let m0 = s0 / (n0 as f32);
    let m1 = s1 / (n1 as f32);
    ((m0 + m1) / 2.0, (m1 - m0).abs())
}

pub fn kmeans2(vals: &[f32]) -> (f32, f32) {
    if vals.is_empty() {
        return (128.0, 0.0);
    }
    let mut lo = vals[0];
    let mut hi = vals[0];
    for &v in vals {
        if v < lo {
            lo = v;
        }
        if v > hi {
            hi = v;
        }
    }
    if hi - lo < 8.0 {
        return ((lo + hi) / 2.0, hi - lo);
    }

    let mut c0 = lo;
    let mut c1 = hi;
    for _ in 0..12 {
        let mut s0 = 0.0;
        let mut n0 = 0;
        let mut s1 = 0.0;
        let mut n1 = 0;
        for &v in vals {
            if (v - c0).abs() < (v - c1).abs() {
                s0 += v;
                n0 += 1;
            } else {
                s1 += v;
                n1 += 1;
            }
        }
        if n0 == 0 || n1 == 0 {
            break;
        }
        let nc0 = s0 / (n0 as f32);
        let nc1 = s1 / (n1 as f32);
        if (nc0 - c0).abs() < 0.5 && (nc1 - c1).abs() < 0.5 {
            break;
        }
        c0 = nc0;
        c1 = nc1;
    }
    ((c0 + c1) / 2.0, (c1 - c0).abs())
}

fn parse_bits_at(bits: &[u8], len: usize) -> Option<ParsedBits> {
    let max_len = (bits.len().saturating_sub(24)) / 8;
    if len < 1 || len > max_len || 16 + len * 8 + 8 > bits.len() {
        return None;
    }

    let mut bytes = Vec::with_capacity(len);
    for q in 0..len {
        let mut b = 0u8;
        for i in 0..8 {
            b = (b << 1) | bits[16 + q * 8 + i];
        }
        if (b < 32 && b != 9 && b != 10 && b != 13) || b == 127 {
            return None;
        }
        bytes.push(b);
    }

    let mut chk = 0u8;
    for i in 0..8 {
        chk = (chk << 1) | bits[16 + len * 8 + i];
    }

    let mut sum = 0u8;
    for &b in &bytes {
        sum = sum.wrapping_add(b);
    }

    if sum != chk {
        return None;
    }

    if let Ok(text) = String::from_utf8(bytes.clone()) {
        if !text.is_empty() {
            return Some(ParsedBits {
                text,
                bytes,
                len,
                chk,
            });
        }
    }
    None
}

fn parse_bits(bits: &[u8]) -> Option<ParsedBits> {
    if bits.len() < 24 {
        return None;
    }
    let mut len = 0usize;
    for i in 0..16 {
        len = (len << 1) | (bits[i] as usize);
    }
    parse_bits_at(bits, len)
}

fn correct_bits(
    bits: &[u8],
    conf: &[f32],
    len: usize,
    aggressive: bool,
    sep: f32,
    f_mean: f32,
) -> Option<(ParsedBits, usize)> {
    let max_len = (bits.len().saturating_sub(24)) / 8;
    if len < 2 || len > max_len || 16 + len * 8 + 8 > bits.len() || f_mean > 155.0 || sep < 8.0 {
        return None;
    }

    let end = 16 + len * 8 + 8;
    let mut order: Vec<usize> = (16..end.min(bits.len())).collect();
    order.sort_by(|&a, &b| conf[a].partial_cmp(&conf[b]).unwrap_or(std::cmp::Ordering::Equal));

    let mut bytes = Vec::with_capacity(len);
    for q in 0..len {
        let mut b = 0u8;
        for i in 0..8 {
            b = (b << 1) | bits[16 + q * 8 + i];
        }
        bytes.push(b);
    }

    let mut chk = 0u8;
    for i in 0..8 {
        chk = (chk << 1) | bits[16 + len * 8 + i];
    }

    let mut sum = 0u8;
    for &b in &bytes {
        sum = sum.wrapping_add(b);
    }

    let diff_plus = sum.wrapping_sub(chk);
    let diff_minus = chk.wrapping_sub(sum);
    let weak = &order[..16.min(order.len())];

    for &i in weak {
        let bit_pos = 7 - ((i - 16) % 8);
        let weight = 1u8 << bit_pos;
        let cur_bit = bits[i];
        if (cur_bit == 1 && diff_plus == weight) || (cur_bit == 0 && diff_minus == weight) {
            let mut t = bits.to_vec();
            t[i] ^= 1;
            if let Some(r) = parse_bits_at(&t, len) {
                return Some((r, 1));
            }
        }
    }

    if aggressive && len >= 4 && sep > 12.0 && f_mean < 145.0 {
        let target_delta = (chk.wrapping_sub(sum)) as i32;
        let pool = &order[..8.min(order.len())];
        for a in 0..pool.len() {
            let ia = pool[a];
            let wa = (1i32 << (7 - ((ia - 16) % 8))) * (if bits[ia] == 0 { 1 } else { -1 });
            for b in (a + 1)..pool.len() {
                let ib = pool[b];
                let wb = (1i32 << (7 - ((ib - 16) % 8))) * (if bits[ib] == 0 { 1 } else { -1 });
                if ((wa + wb) as u8) == (target_delta as u8) {
                    let mut t = bits.to_vec();
                    t[ia] ^= 1;
                    t[ib] ^= 1;
                    if let Some(r) = parse_bits_at(&t, len) {
                        return Some((r, 2));
                    }
                }
            }
        }
    }

    None
}

pub fn finder_score(
    g: &[f32],
    w: usize,
    h: usize,
    cx: f32,
    cy: f32,
    scale: f32,
    k: usize,
    density: f32,
    rot: f32,
    aspect: f32,
    tilt: f32,
) -> f32 {
    let rs = radii(k);
    let mut s = 0.0;
    for &r in &rs {
        let n = slot_count(r, density);
        let mid = (std::f32::consts::PI * 2.0 / (n as f32)) * 0.5 + rot;
        s += sample(g, w, h, cx, cy, r * scale, mid, aspect, tilt);
    }
    s / (rs.len() as f32)
}

pub fn try_config(
    g: &[f32],
    w: usize,
    h: usize,
    cx: f32,
    cy: f32,
    scale: f32,
    k: usize,
    density: f32,
    rot: f32,
    aggressive: bool,
    aspect: f32,
    tilt: f32,
) -> Option<ScanResult> {
    let rs = radii(k);
    let ns: Vec<usize> = rs.iter().map(|&r| slot_count(r, density)).collect();
    let mut finder_lum = Vec::with_capacity(k);
    let mut ring_lums = Vec::with_capacity(k);
    let mut flat = Vec::new();

    for (ri, &r) in rs.iter().enumerate() {
        let n = ns[ri];
        let slot = std::f32::consts::PI * 2.0 / (n as f32);
        let mut lums = Vec::with_capacity(n - 1);
        for j in 1..n {
            let mid = (j as f32 / n as f32) * std::f32::consts::PI * 2.0 + slot * 0.5 + rot;
            let val = median3(g, w, h, cx, cy, r * scale, mid, slot, scale, aspect, tilt);
            lums.push(val);
            flat.push(val);
        }
        let fmid = slot * 0.5 + rot;
        let fval = median3(g, w, h, cx, cy, r * scale, fmid, slot, scale, aspect, tilt);
        finder_lum.push(fval);
        flat.push(fval);
        ring_lums.push(lums);
    }

    let (km_thr, km_sep) = kmeans2(&flat);
    if km_sep < 10.0 {
        return None;
    }

    let f_mean = finder_lum.iter().sum::<f32>() / (finder_lum.len() as f32);
    if f_mean > 215.0 || f_mean > km_thr + 15.0 {
        return None;
    }

    let ring_thr: Vec<f32> = ring_lums
        .iter()
        .map(|lums| {
            let (othr, osep) = otsu_thr(lums);
            if osep >= 16.0 {
                othr * 0.7 + km_thr * 0.3
            } else {
                km_thr
            }
        })
        .collect();

    let mut bits = Vec::new();
    let mut conf = Vec::new();

    for (ri, lums) in ring_lums.iter().enumerate() {
        let thr = ring_thr[ri];
        for &v in lums {
            bits.push(if v < thr { 1u8 } else { 0u8 });
            conf.push((v - thr).abs());
        }
    }

    if let Some(parsed) = parse_bits(&bits) {
        return Some(ScanResult {
            ok: true,
            text: Some(parsed.text),
            bytes: Some(parsed.bytes),
            len: parsed.len,
            chk: parsed.chk,
            rings: k,
            density,
            rot,
            sep: km_sep,
            fixed: 0,
            reason: None,
        });
    }

    if bits.len() >= 24 {
        let mut len = 0usize;
        for i in 0..16 {
            len = (len << 1) | (bits[i] as usize);
        }
        if let Some((corrected, fixed)) = correct_bits(&bits, &conf, len, aggressive, km_sep, f_mean) {
            return Some(ScanResult {
                ok: true,
                text: Some(corrected.text),
                bytes: Some(corrected.bytes),
                len: corrected.len,
                chk: corrected.chk,
                rings: k,
                density,
                rot,
                sep: km_sep,
                fixed,
                reason: None,
            });
        }
    }

    None
}

pub fn to_grayscale(rgba: &[u8], len: usize) -> Vec<f32> {
    let mut g = Vec::with_capacity(len);
    for i in 0..len {
        let idx = i * 4;
        let a = rgba[idx + 3] as f32;
        if a == 0.0 {
            g.push(255.0);
        } else {
            let lum = rgba[idx] as f32 * 0.299 + rgba[idx + 1] as f32 * 0.587 + rgba[idx + 2] as f32 * 0.114;
            if a < 255.0 {
                g.push((lum * a + 255.0 * (255.0 - a)) / 255.0);
            } else {
                g.push(lum);
            }
        }
    }
    g
}

pub fn find_center(g: &[f32], w: usize, h: usize) -> Option<(f32, f32, f32)> {
    let mut best_score = 0.0f32;
    let mut best_in_mean = 0.0f32;
    let mut best_out_mean = 0.0f32;
    let mut best = None;

    let step = 6;
    let min_dim = w.min(h);

    for y in (24..h.saturating_sub(24)).step_by(step) {
        for x in (24..w.saturating_sub(24)).step_by(step) {
            for r_int in (12..min_dim / 3).step_by(4) {
                let r = r_int as f32;
                let gap_r = 1.15 * r;
                let x_f = x as f32;
                let y_f = y as f32;
                if x_f - gap_r < 2.0 || y_f - gap_r < 2.0 || x_f + gap_r >= (w as f32) - 2.0 || y_f + gap_r >= (h as f32) - 2.0 {
                    continue;
                }

                let in4 = sample(g, w, h, x_f, y_f, 0.80 * r, 0.0, 1.0, 0.0) +
                          sample(g, w, h, x_f, y_f, 0.80 * r, std::f32::consts::FRAC_PI_2, 1.0, 0.0) +
                          sample(g, w, h, x_f, y_f, 0.80 * r, std::f32::consts::PI, 1.0, 0.0) +
                          sample(g, w, h, x_f, y_f, 0.80 * r, std::f32::consts::PI * 1.5, 1.0, 0.0);
                if in4 > 4.0 * 165.0 {
                    continue;
                }

                let mut in_sum = in4;
                for a in [1, 3, 5, 7] {
                    let th = (a as f32) * std::f32::consts::PI / 4.0;
                    in_sum += sample(g, w, h, x_f, y_f, 0.80 * r, th, 1.0, 0.0);
                }

                let mut out_sum = 0.0;
                for a in 0..8 {
                    let th = (a as f32) * std::f32::consts::PI / 4.0;
                    out_sum += sample(g, w, h, x_f, y_f, 1.12 * r, th, 1.0, 0.0);
                }

                let in_mean = in_sum / 8.0;
                let out_mean = out_sum / 8.0;
                let diff = out_mean - in_mean;

                if diff > best_score && diff > 18.0 && out_mean > in_mean * 1.15 && in_mean < 165.0 {
                    best_score = diff;
                    best_in_mean = in_mean;
                    best_out_mean = out_mean;
                    best = Some((x_f, y_f, r));
                }
            }
        }
    }

    if let Some((rough_x, rough_y, rough_r)) = best {
        let mut sum_x = 0.0;
        let mut sum_y = 0.0;
        let mut count = 0;
        let thr = best_in_mean + (best_out_mean - best_in_mean) * 0.45;
        let r_min = rough_r * 0.55;
        let r_max = rough_r * 1.05;
        let r_min2 = r_min * r_min;
        let r_max2 = r_max * r_max;

        let r_limit = r_max.ceil() as isize;
        for dy in -r_limit..=r_limit {
            for dx in -r_limit..=r_limit {
                let d2 = (dx * dx + dy * dy) as f32;
                if d2 >= r_min2 && d2 <= r_max2 {
                    let xi = (rough_x.round() as isize) + dx;
                    let yi = (rough_y.round() as isize) + dy;
                    if xi >= 0 && yi >= 0 && (xi as usize) < w && (yi as usize) < h {
                        if g[(yi as usize) * w + (xi as usize)] < thr {
                            sum_x += xi as f32;
                            sum_y += yi as f32;
                            count += 1;
                        }
                    }
                }
            }
        }

        if count > 20 {
            let ref_cx = sum_x / (count as f32);
            let ref_cy = sum_y / (count as f32);
            return Some((ref_cx, ref_cy, rough_r));
        }
    }

    best
}

/// Pure Rust scanner entrypoint shared by WebAssembly, C FFI, Swift, Flutter, and Android JNI.
pub fn scan_frame(rgba: &[u8], width: usize, height: usize, aggressive: bool) -> ScanResult {
    let total_pixels = width.saturating_mul(height);
    if total_pixels == 0 || rgba.len() < total_pixels * 4 {
        return ScanResult {
            ok: false,
            text: None,
            bytes: None,
            len: 0,
            chk: 0,
            rings: 0,
            density: 0.0,
            rot: 0.0,
            sep: 0.0,
            fixed: 0,
            reason: Some("Invalid buffer size".to_string()),
        };
    }

    let g = to_grayscale(rgba, total_pixels);

    let (cx, cy, scale) = if let Some((bx, by, br)) = find_center(&g, width, height) {
        (bx, by, br / CENTER_R)
    } else {
        (width as f32 / 2.0, height as f32 / 2.0, (width.min(height) as f32) / 400.0)
    };

    let scales = [1.0, 0.98, 1.02, 0.95, 1.05].map(|f| scale * f);
    let rings_to_try = [5, 6, 7, 8, 9, 10, 4, 11, 12, 13, 14];

    for &sc in &scales {
        for &k in &rings_to_try {
            for &d in &[0.35f32, 0.37f32] {
                let mut best_rot = 0.0f32;
                let mut best_s = 999.0f32;

                for deg in (0..360).step_by(3) {
                    let rot = (deg as f32) * std::f32::consts::PI / 180.0;
                    let s = finder_score(&g, width, height, cx, cy, sc, k, d, rot, 1.0, 0.0);
                    if s < best_s {
                        best_s = s;
                        best_rot = rot;
                    }
                }

                if best_s > 225.0 {
                    continue;
                }

                for off in [-1.2, -0.6, 0.0, 0.6, 1.2] {
                    let rot = best_rot + (off as f32) * std::f32::consts::PI / 180.0;
                    if let Some(res) = try_config(&g, width, height, cx, cy, sc, k, d, rot, aggressive, 1.0, 0.0) {
                        return res;
                    }
                }
            }
        }
    }

    ScanResult {
        ok: false,
        text: None,
        bytes: None,
        len: 0,
        chk: 0,
        rings: 0,
        density: 0.0,
        rot: 0.0,
        sep: 0.0,
        fixed: 0,
        reason: Some("No valid circular barcode detected".to_string()),
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn scan_frame_wasm(
    rgba: &[u8],
    width: usize,
    height: usize,
    aggressive: bool,
) -> Result<JsValue, JsValue> {
    let total_pixels = width.saturating_mul(height);
    if rgba.len() < total_pixels * 4 {
        return Err(JsValue::from_str("Invalid buffer size"));
    }
    let res = scan_frame(rgba, width, height, aggressive);
    serde_wasm_bindgen::to_value(&res).map_err(|e| JsValue::from_str(&e.to_string()))
}

// =============================================================================
// Universal C ABI / FFI Exports (C, C++, Swift, Flutter dart:ffi, JNA/JNI)
// =============================================================================

/// Encodes a null-terminated UTF-8 `payload` string into a heap-allocated SVG string.
/// Caller MUST free the returned pointer with `circlecode_free_string(ptr)`.
#[no_mangle]
pub unsafe extern "C" fn circlecode_encode_svg(
    payload_ptr: *const c_char,
    rings: usize,
    density: f32,
    loncle: i32,
    center_text_ptr: *const c_char,
) -> *mut c_char {
    if payload_ptr.is_null() {
        return ptr::null_mut();
    }
    let payload = match CStr::from_ptr(payload_ptr).to_str() {
        Ok(s) => s,
        Err(_) => return ptr::null_mut(),
    };
    let center = if center_text_ptr.is_null() {
        "Pay"
    } else {
        CStr::from_ptr(center_text_ptr).to_str().unwrap_or("Pay")
    };

    match encode_svg(payload, rings, density, loncle != 0, center) {
        Ok(svg) => CString::new(svg).unwrap_or_default().into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

/// Scans an RGBA frame buffer and writes the decoded UTF-8 payload into `out_text_buf`.
/// Optionally writes metadata into `out_meta`.
#[no_mangle]
pub unsafe extern "C" fn circlecode_scan_rgba(
    rgba_ptr: *const u8,
    rgba_len: usize,
    width: usize,
    height: usize,
    aggressive: i32,
    out_text_buf: *mut u8,
    out_text_cap: usize,
    out_meta: *mut CircleCodeResultC,
) -> i32 {
    if rgba_ptr.is_null() || width == 0 || height == 0 || rgba_len < width.saturating_mul(height).saturating_mul(4) {
        return -1;
    }

    let rgba = slice::from_raw_parts(rgba_ptr, rgba_len);
    let res = scan_frame(rgba, width, height, aggressive != 0);

    if !out_meta.is_null() {
        (*out_meta) = CircleCodeResultC {
            ok: if res.ok { 1 } else { 0 },
            len: res.len as i32,
            chk: res.chk,
            rings: res.rings as i32,
            density: res.density,
            rot: res.rot,
            sep: res.sep,
            fixed: res.fixed as i32,
        };
    }

    if !res.ok {
        return 0;
    }

    if let Some(text) = res.text {
        let bytes = text.as_bytes();
        if !out_text_buf.is_null() && out_text_cap > 0 {
            let copy_len = bytes.len().min(out_text_cap.saturating_sub(1));
            ptr::copy_nonoverlapping(bytes.as_ptr(), out_text_buf, copy_len);
            *out_text_buf.add(copy_len) = 0;
        }
        return bytes.len() as i32;
    }

    0
}

/// Scans an RGBA frame buffer and returns a heap-allocated null-terminated JSON string.
/// Caller MUST free the returned pointer with `circlecode_free_string(ptr)`.
#[no_mangle]
pub unsafe extern "C" fn circlecode_scan_rgba_json(
    rgba_ptr: *const u8,
    rgba_len: usize,
    width: usize,
    height: usize,
    aggressive: i32,
) -> *mut c_char {
    if rgba_ptr.is_null() || width == 0 || height == 0 || rgba_len < width.saturating_mul(height).saturating_mul(4) {
        let err_json = r#"{"ok":false,"reason":"Invalid buffer size"}"#;
        return CString::new(err_json).unwrap().into_raw();
    }

    let rgba = slice::from_raw_parts(rgba_ptr, rgba_len);
    let res = scan_frame(rgba, width, height, aggressive != 0);
    let json = serde_json::to_string(&res).unwrap_or_else(|_| r#"{"ok":false,"reason":"Serialization error"}"#.to_string());
    CString::new(json).unwrap_or_default().into_raw()
}

/// Frees a C string previously returned by `circlecode_scan_rgba_json` or `circlecode_encode_svg`.
#[no_mangle]
pub unsafe extern "C" fn circlecode_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        let _ = CString::from_raw(ptr);
    }
}
