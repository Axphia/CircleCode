//! CircleCode V2/V2.1 wire decoder, usable natively and through WebAssembly.
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct V2Result {
    pub ok: bool,
    pub text: Option<String>,
    pub bytes: Vec<u8>,
    pub mode: Option<String>,
    pub format: Option<String>,
    pub corrected_bytes: usize,
    pub payload_length: usize,
    pub packed_bits: usize,
    pub codeword: Vec<u8>,
    pub rings: usize,
    pub inverted: bool,
    pub mirrored: bool,
    pub reason: Option<String>,
}

impl V2Result {
    fn failure(reason: &str) -> Self {
        Self {
            ok: false,
            text: None,
            bytes: vec![],
            mode: None,
            format: None,
            corrected_bytes: 0,
            payload_length: 0,
            packed_bits: 0,
            codeword: vec![],
            rings: 0,
            inverted: false,
            mirrored: false,
            reason: Some(reason.into()),
        }
    }
}

struct Field {
    exp: [u8; 510],
    log: [usize; 256],
}
impl Field {
    fn get() -> &'static Self {
        static FIELD: OnceLock<Field> = OnceLock::new();
        FIELD.get_or_init(|| {
            let mut field = Field {
                exp: [0; 510],
                log: [0; 256],
            };
            let mut value = 1usize;
            for i in 0..255 {
                field.exp[i] = value as u8;
                field.exp[i + 255] = value as u8;
                field.log[value] = i;
                value <<= 1;
                if value & 256 != 0 {
                    value ^= 0x11d;
                }
            }
            field
        })
    }
    fn mul(&self, a: u8, b: u8) -> u8 {
        if a == 0 || b == 0 {
            0
        } else {
            self.exp[self.log[a as usize] + self.log[b as usize]]
        }
    }
    fn div(&self, a: u8, b: u8) -> Option<u8> {
        if b == 0 {
            None
        } else if a == 0 {
            Some(0)
        } else {
            Some(self.exp[(self.log[a as usize] + 255 - self.log[b as usize]) % 255])
        }
    }
    fn syndromes(&self, input: &[u8]) -> [u8; 8] {
        std::array::from_fn(|i| {
            input
                .iter()
                .fold(0, |value, &byte| self.mul(value, self.exp[i]) ^ byte)
        })
    }
}

fn repair(input: &[u8]) -> Option<(Vec<u8>, usize)> {
    let gf = Field::get();
    let errors = gf.syndromes(input);
    let mut output = input.to_vec();
    if errors == [0; 8] {
        return Some((output, 0));
    }
    let mut locator = [0u8; 9];
    let mut previous = [0u8; 9];
    locator[0] = 1;
    previous[0] = 1;
    let (mut degree, mut shift, mut last) = (0usize, 1usize, 1u8);
    for n in 0..8 {
        let mut discrepancy = errors[n];
        for i in 1..=degree {
            discrepancy ^= gf.mul(locator[i], errors[n - i]);
        }
        if discrepancy == 0 {
            shift += 1;
            continue;
        }
        let saved = locator;
        let factor = gf.div(discrepancy, last)?;
        for i in 0..9usize.saturating_sub(shift) {
            locator[i + shift] ^= gf.mul(factor, previous[i]);
        }
        if 2 * degree <= n {
            degree = n + 1 - degree;
            previous = saved;
            last = discrepancy;
            shift = 1;
        } else {
            shift += 1;
        }
    }
    if degree == 0 || degree > 4 {
        return None;
    }
    let mut positions = Vec::new();
    let mut locations = Vec::new();
    for position in 0..output.len() {
        let power = output.len() - 1 - position;
        let inverse = gf.exp[(255 - power) % 255];
        let value = (0..=degree)
            .rev()
            .fold(0, |value, i| gf.mul(value, inverse) ^ locator[i]);
        if value == 0 {
            positions.push(position);
            locations.push(gf.exp[power]);
        }
    }
    if positions.len() != degree {
        return None;
    }
    let mut matrix = [[0u8; 5]; 4];
    for row in 0..degree {
        for (column, &location) in locations.iter().enumerate() {
            matrix[row][column] = gf.exp[(gf.log[location as usize] * row) % 255];
        }
        matrix[row][degree] = errors[row];
    }
    for column in 0..degree {
        let pivot = (column..degree).find(|&row| matrix[row][column] != 0)?;
        matrix.swap(column, pivot);
        let divisor = matrix[column][column];
        for j in column..=degree {
            matrix[column][j] = gf.div(matrix[column][j], divisor)?;
        }
        for row in 0..degree {
            if row == column {
                continue;
            }
            let factor = matrix[row][column];
            for j in column..=degree {
                matrix[row][j] ^= gf.mul(factor, matrix[column][j]);
            }
        }
    }
    for i in 0..degree {
        output[positions[i]] ^= matrix[i][degree];
    }
    if gf.syndromes(&output) != [0; 8] {
        return None;
    }
    Some((output, degree))
}

pub fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = u32::MAX;
    for &byte in bytes {
        crc ^= byte as u32;
        for _ in 0..8 {
            crc = (crc >> 1) ^ if crc & 1 != 0 { 0xedb88320 } else { 0 };
        }
    }
    !crc
}

fn decode_checked(input: &[u8]) -> Result<V2Result, &'static str> {
    if !(17..=255).contains(&input.len()) {
        return Err("Invalid frame length");
    }
    let (codeword, corrected_bytes) = repair(input).ok_or("Reed-Solomon recovery failed")?;
    let data = &codeword[..codeword.len() - 8];
    let crc_offset = data.len() - 4;
    let expected = u32::from_be_bytes(data[crc_offset..].try_into().map_err(|_| "Invalid CRC")?);
    if crc32(&data[..crc_offset]) != expected {
        return Err("CRC32 mismatch");
    }
    if data[..2] != [0x43, 0x43] {
        return Err("Unsupported format");
    }
    let mode = match data[2] {
        2 | 0x20 => "utf8",
        0x21 => "numeric",
        0x22 => "alphanumeric",
        0x23 => "binary",
        _ => return Err("Unsupported mode"),
    };
    let length = u16::from_be_bytes([data[3], data[4]]) as usize;
    let packed = &data[5..crc_offset];
    let bits = match mode {
        "numeric" => length / 3 * 10 + [0, 4, 7][length % 3],
        "alphanumeric" => length / 2 * 11 + length % 2 * 6,
        _ => length * 8,
    };
    if bits > packed.len() * 8 {
        return Err("Invalid payload length");
    }
    let mut offset = 0;
    let mut read = |width: usize| {
        let mut value = 0usize;
        for _ in 0..width {
            value = value * 2 + ((packed[offset / 8] >> (7 - offset % 8)) & 1) as usize;
            offset += 1;
        }
        value
    };
    let mut bytes = Vec::new();
    if mode == "numeric" {
        for i in (0..length).step_by(3) {
            let digits = 3.min(length - i);
            let value = read([0, 4, 7, 10][digits]);
            if value >= 10usize.pow(digits as u32) {
                return Err("Invalid numeric group");
            }
            bytes.extend(format!("{:0width$}", value, width = digits).as_bytes());
        }
    } else if mode == "alphanumeric" {
        let alphabet = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
        for i in (0..length).step_by(2) {
            let pair = i + 1 < length;
            let value = read(if pair { 11 } else { 6 });
            if value >= if pair { 2025 } else { 45 } {
                return Err("Invalid alphanumeric group");
            }
            if pair {
                bytes.push(alphabet[value / 45]);
                bytes.push(alphabet[value % 45]);
            } else {
                bytes.push(alphabet[value]);
            }
        }
    } else {
        bytes.extend_from_slice(&packed[..length]);
    }
    if (bits..packed.len() * 8).any(|i| packed[i / 8] & (1 << (7 - i % 8)) != 0) {
        return Err("Invalid padding");
    }
    let text = if mode == "binary" {
        None
    } else {
        Some(String::from_utf8(bytes.clone()).map_err(|_| "Invalid UTF-8")?)
    };
    let format = if data[2] == 2 { "2" } else { "2.1" }.to_string();
    Ok(V2Result {
        ok: true,
        text,
        bytes,
        mode: Some(mode.into()),
        format: Some(format),
        corrected_bytes,
        payload_length: length,
        packed_bits: bits,
        codeword,
        rings: 0,
        inverted: false,
        mirrored: false,
        reason: None,
    })
}

pub fn decode_frame(input: &[u8]) -> V2Result {
    decode_checked(input).unwrap_or_else(V2Result::failure)
}

fn center(pixels: &[f32], w: usize, h: usize) -> Option<(f32, f32, f32)> {
    let step = (w.min(h) / 80).clamp(4, 12);
    let mut best_center = None;
    let mut best_score = -1.0;
    for y in (24..h.saturating_sub(24)).step_by(step) {
        for x in (24..w.saturating_sub(24)).step_by(step) {
            for r in (10.max(w.min(h) / 40)..=w.min(h) * 35 / 100).step_by(4) {
                let (x, y, r) = (x as f32, y as f32, r as f32);
                let gap = 1.15 * r;
                if x - gap < 2.0
                    || y - gap < 2.0
                    || x + gap >= w as f32 - 2.0
                    || y + gap >= h as f32 - 2.0
                {
                    continue;
                }
                let at = |radius, angle| crate::sample(pixels, w, h, x, y, radius, angle, 1.0, 0.0);
                let inner4 = (0..4)
                    .map(|a| at(r * 0.80, a as f32 * std::f32::consts::FRAC_PI_2))
                    .sum::<f32>();
                if inner4 > 660.0 {
                    continue;
                }
                let inner = (inner4
                    + [1, 3, 5, 7]
                        .iter()
                        .map(|&a| at(r * 0.80, a as f32 * std::f32::consts::FRAC_PI_4))
                        .sum::<f32>())
                    / 8.0;
                let outer = (0..8)
                    .map(|a| at(r * 1.12, a as f32 * std::f32::consts::FRAC_PI_4))
                    .sum::<f32>()
                    / 8.0;
                let score = outer - inner;
                if score > best_score && score > 18.0 && outer > inner * 1.15 && inner < 165.0 {
                    best_center = Some((x, y, r));
                    best_score = score;
                }
            }
        }
    }
    let (x, y, radius) = best_center?;
    let mut points = Vec::new();
    for ray in 0..24 {
        let angle = ray as f64 * std::f64::consts::TAU / 24.0;
        let (sin, cos) = angle.sin_cos();
        let mut best = (20.0, radius as f64);
        let mut r = radius as f64 * 0.72;
        while r <= radius as f64 * 1.35 {
            let value = |distance: f64| -> Option<f32> {
                let px = (x as f64 + distance * cos).round() as isize;
                let py = (y as f64 + distance * sin).round() as isize;
                if px < 0 || py < 0 || px >= w as isize || py >= h as isize {
                    None
                } else {
                    Some(pixels[py as usize * w + px as usize])
                }
            };
            if let (Some(inner), Some(outer)) = (value(r - 2.0), value(r + 2.0)) {
                let gradient = (outer - inner) as f64;
                if gradient > best.0 {
                    best = (gradient, r);
                }
            }
            r += 0.5f64.max(radius as f64 * 0.02);
        }
        if best.0 > 20.0 {
            points.push((best.1 * cos, best.1 * sin));
        }
    }
    if points.len() < 8 {
        return Some((x, y, radius / crate::CENTER_R));
    }
    let mut matrix = [[0f64; 4]; 3];
    for &(px, py) in &points {
        let row = [2.0 * px, 2.0 * py, 1.0];
        for i in 0..3 {
            for j in 0..3 {
                matrix[i][j] += row[i] * row[j];
            }
            matrix[i][3] += row[i] * (px * px + py * py);
        }
    }
    for column in 0..3 {
        let pivot = (column..3)
            .max_by(|&a, &b| matrix[a][column].abs().total_cmp(&matrix[b][column].abs()))?;
        if matrix[pivot][column].abs() < 1e-6 {
            return Some((x, y, radius / crate::CENTER_R));
        }
        matrix.swap(column, pivot);
        let divisor = matrix[column][column];
        for j in column..4 {
            matrix[column][j] /= divisor;
        }
        for row in 0..3 {
            if row == column {
                continue;
            }
            let factor = matrix[row][column];
            for j in column..4 {
                matrix[row][j] -= factor * matrix[column][j];
            }
        }
    }
    let (dx, dy) = (matrix[0][3], matrix[1][3]);
    let fit_r = points
        .iter()
        .map(|&(px, py)| (px - dx).hypot(py - dy))
        .sum::<f64>()
        / points.len() as f64;
    if dx.hypot(dy) < radius as f64 * 0.35 && fit_r > 8.0 && fit_r < w.min(h) as f64 * 0.4 {
        Some((x + dx as f32, y + dy as f32, fit_r as f32 / crate::CENTER_R))
    } else {
        Some((x, y, radius / crate::CENTER_R))
    }
}

pub fn scan_rgba(rgba: &[u8], width: usize, height: usize, rings: usize) -> V2Result {
    if !(32..=2048).contains(&width)
        || !(32..=2048).contains(&height)
        || width.checked_mul(height).and_then(|n| n.checked_mul(4)) != Some(rgba.len())
        || (rings != 0 && !(4..=14).contains(&rings))
    {
        return V2Result::failure("Invalid image or ring count");
    }
    let grayscale: Vec<f32> = rgba
        .chunks_exact(4)
        .map(|p| {
            let lum = ((p[0] as u32 * 77 + p[1] as u32 * 150 + p[2] as u32 * 29) >> 8) as f32;
            (lum * p[3] as f32 + 255.0 * (255 - p[3]) as f32) / 255.0
        })
        .collect();
    let ring_counts = if rings == 0 {
        vec![7, 5, 6, 8, 9, 10, 4, 11, 12, 13, 14]
    } else {
        vec![rings]
    };
    for inverted in [false, true] {
        let pixels: Vec<f32> = grayscale
            .iter()
            .map(|&v| if inverted { 255.0 - v } else { v })
            .collect();
        let Some((cx, cy, scale)) = center(&pixels, width, height) else {
            continue;
        };
        for &count in &ring_counts {
            let geometry: Vec<(f32, usize)> = (0..count)
                .map(|i| {
                    let r = 55.0 + 102.0 * i as f64 / (count - 1) as f64;
                    (r as f32, 12.max((r * 0.35).floor() as usize))
                })
                .collect();
            for factor in [1.0, 0.99, 1.01, 0.98, 1.02] {
                let scale = scale * factor;
                for mirrored in [false, true] {
                    let direction = if mirrored { -1.0 } else { 1.0 };
                    let mut angles: Vec<(f32, f32)> = (0..200)
                        .map(|i| {
                            let rotation = i as f32 * std::f32::consts::PI / 100.0;
                            let score = geometry
                                .iter()
                                .map(|&(r, n)| {
                                    crate::sample(
                                        &pixels,
                                        width,
                                        height,
                                        cx,
                                        cy,
                                        r * scale,
                                        rotation + direction * std::f32::consts::PI / n as f32,
                                        1.0,
                                        0.0,
                                    )
                                })
                                .sum::<f32>()
                                / count as f32;
                            (rotation, score)
                        })
                        .collect();
                    angles.sort_by(|a, b| a.1.total_cmp(&b.1));
                    for &(angle, _) in angles.iter().take(6) {
                        for offset in [0.0f32, 0.45, -0.45, 0.9, -0.9] {
                            let rotation = angle + offset.to_radians();
                            let mut values = Vec::new();
                            let mut finders = Vec::new();
                            for &(r, n) in &geometry {
                                let slot = std::f32::consts::TAU / n as f32;
                                for j in 0..n {
                                    let theta = rotation + direction * (j as f32 + 0.5) * slot;
                                    let value = crate::median3(
                                        &pixels,
                                        width,
                                        height,
                                        cx,
                                        cy,
                                        r * scale,
                                        theta,
                                        slot,
                                        scale,
                                        1.0,
                                        0.0,
                                    );
                                    if j == 0 {
                                        finders.push(value);
                                    } else {
                                        values.push(value);
                                    }
                                }
                            }
                            let combined: Vec<f32> =
                                values.iter().chain(&finders).copied().collect();
                            let (threshold, separation) = crate::kmeans2(&combined);
                            if separation < 20.0
                                || finders.iter().filter(|&&v| v < threshold).count() < count - 1
                            {
                                continue;
                            }
                            let mut frame = vec![0; values.len() / 8];
                            for i in 0..frame.len() * 8 {
                                if values[i] < threshold {
                                    frame[i / 8] |= 1 << (7 - i % 8);
                                }
                            }
                            let mut result = decode_frame(&frame);
                            if result.ok {
                                result.rings = count;
                                result.inverted = inverted;
                                result.mirrored = mirrored;
                                return result;
                            }
                        }
                    }
                }
            }
        }
    }
    V2Result::failure("No valid V2/V2.1 code found")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_and_recovery() {
        let frame = vec![
            67, 67, 2, 0, 8, 84, 97, 98, 108, 101, 45, 50, 52, 0, 0, 0, 0, 0, 0, 211, 57, 156, 24,
            46, 138, 204, 23, 190, 242, 121, 91,
        ];
        assert_eq!(decode_frame(&frame).text.as_deref(), Some("Table-24"));
        let mut damaged = frame.clone();
        for i in [0, 5, 10, 30] {
            damaged[i] ^= 255;
        }
        let decoded = decode_frame(&damaged);
        assert_eq!(decoded.codeword, frame);
        assert_eq!(decoded.corrected_bytes, 4);
        assert_eq!(crc32(b"123456789"), 0xcbf43926);
    }
    #[test]
    fn rejects_invalid_boundaries() {
        for size in [0, 16, 256] {
            assert!(!decode_frame(&vec![0; size]).ok);
        }
        for (w, h, rings) in [(0, 0, 0), (usize::MAX, 480, 7), (480, 480, 15)] {
            assert!(!scan_rgba(&[], w, h, rings).ok);
        }
    }
}
