//! CircleCode Rust/WebAssembly Full Scanner Engine
//! V1 checksum scanner and V2/V2.1 Reed-Solomon + CRC32 scanner.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
pub mod v2;

#[wasm_bindgen]
pub fn decode_v2_frame_wasm(frame: &[u8]) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(&v2::decode_frame(frame)).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn scan_v2_wasm(rgba: &[u8], width: usize, height: usize, rings: usize) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(&v2::scan_rgba(rgba, width, height, rings)).map_err(|e| JsValue::from_str(&e.to_string()))
}

pub const CENTER_R: f32 = 42.0;
pub const R_START: f32 = 55.0;
pub const R_END: f32 = 157.0;

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

#[derive(Clone, Debug)]
struct ParsedBits {
    text: String,
    bytes: Vec<u8>,
    len: usize,
    chk: u8,
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

    // 1-bit flip matching mathematical delta
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

    // 2-bit flip if aggressive
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

    // Try error correction
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

                // Fast 4-point check on outer badge rim (0.80 * r)
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

    // Centroid refinement via annulus (ring) search
    // Symmetrical outer ring between 0.55*r and 1.05*r provides the exact center
    // completely immune to white logos/text ("Pay", custom logos, icons) in the center
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

#[wasm_bindgen]
pub fn scan_frame_wasm(
    rgba: &[u8],
    width: usize,
    height: usize,
    aggressive: bool,
) -> Result<JsValue, JsValue> {
    let total_pixels = width * height;
    if rgba.len() < total_pixels * 4 {
        return Err(JsValue::from_str("Invalid buffer size"));
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
                // Find candidate rotations
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

                // Fine sweep around best rotation
                for off in [-1.2, -0.6, 0.0, 0.6, 1.2] {
                    let rot = best_rot + (off as f32) * std::f32::consts::PI / 180.0;
                    if let Some(res) = try_config(&g, width, height, cx, cy, sc, k, d, rot, aggressive, 1.0, 0.0) {
                        return serde_wasm_bindgen::to_value(&res)
                            .map_err(|e| JsValue::from_str(&e.to_string()));
                    }
                }
            }
        }
    }

    let fail = ScanResult {
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
    };

    serde_wasm_bindgen::to_value(&fail).map_err(|e| JsValue::from_str(&e.to_string()))
}
