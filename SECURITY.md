# Security Policy

CircleCode takes the security of its barcode generation and scanning algorithms seriously. This document outlines our supported versions, threat model, security protections, and procedures for reporting vulnerabilities.

---

## Supported Versions

Security updates and vulnerability patches are actively provided for the following versions:

| Version | Supported | Status |
| :--- | :---: | :--- |
| **`1.1.x`** | :white_check_mark: | **Current Stable Release** (Full support) |
| `1.0.x` | :warning: | Maintenance mode (Critical security fixes only) |
| `< 1.0.0` | :x: | End of Life (Unsupported) |

We strongly recommend keeping your `@axphia/circlecode` dependency up to date with the latest release.

---

## Threat Model & Security Protections

As a client-side and server-side barcode codec, CircleCode implements specific defenses against common barcode and computer vision security vectors:

### 1. Cross-Site Scripting (XSS) & SVG Injection Defense
Barcode generators frequently accept arbitrary user-controlled strings (URLs, product IDs, session tokens, and center badge labels). If inserted into SVG markup without sanitization, malicious payloads like `"><script>alert(1)</script>` could execute in the user's browser.

**CircleCode Safeguards:**
- **Strict XML Escaping**: All text payload strings and center labels are strictly escaped before inclusion into SVG paths, `<text>`, `<title>`, or `<desc>` tags (`&`, `<`, `>`, `"`, `'`).
- **Center Image Protocol Whitelisting**: The `center` image option strictly validates data URLs and image sources. Only safe protocols are permitted:
  - `https://...` and `http://...`
  - `blob:https://...`
  - `data:image/(png|jpeg|svg+xml|webp);base64,...`
- **Dangerous Schemes Blocked**: URI schemes such as `javascript:`, `vbscript:`, or `data:text/html` throw immediate `Unsupported center image URL` validation exceptions.

### 2. Denial of Service (DoS) & Memory Exhaustion
Maliciously crafted image inputs or extreme generator parameters could attempt to trigger memory allocation exhaustion or CPU lockups:

**CircleCode Safeguards:**
- **Ring Count & Dimension Bounds**: Barcode models enforce strict mathematical bounds on ring counts ($k \in [1, 16]$) and radius values ($r \le 190$).
- **Canvas Dimension Guards**: Scanner methods validate input `ImageData` dimensions and reject zero-width, negative, or degenerate frame buffers.
- **Fixed-Iteration Sweeps**: Orientation finder sweeps and radial moment evaluations operate within bounded, deterministic iteration limits ($O(n)$ where $n$ is slot count), preventing infinite loops or CPU exhaustion.
- **WASM Memory Bounds**: The native WebAssembly decoder allocates fixed-size linear memory buffers and validates TypedArray bounds before copying image bytes.

### 3. Checksum Integrity & Framing Attack Defense
- **16-bit Header Verification**: The binary length header is checked against total ring bit capacity to prevent buffer over-reads.
- **Modulo-256 Checksum Validation**: Every CircleCode payload includes an 8-bit checksum byte verifying the modulo-256 sum of all payload octets. Corrupted or partially framed codes are rejected with `ok: false`.

---

## Reporting a Vulnerability

If you discover a security vulnerability in CircleCode, **please do not disclose it publicly** through GitHub Issues, Discussions, or social media.

Instead, please report the vulnerability privately:

1. **GitHub Security Advisory (Preferred)**:
   Navigate to the [CircleCode Security Advisories](https://github.com/Axphia/CircleCode/security/advisories/new) page and click **"Draft a new advisory"**.
2. **Direct Email**:
   Send an encrypted email to **`security@axphia.org`** (or `contact@axphia.org`) with the subject line `[SECURITY] CircleCode Vulnerability Report`.

### What to Include in Your Report
To help us triage and resolve the issue quickly, please provide:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or a Minimal Reproducible Example (proof of concept).
- Affected versions of `@axphia/circlecode`.
- Any proposed mitigations or fixes.

---

## Vulnerability Handling Process

1. **Initial Acknowledgment**: We will acknowledge receipt of your report within **48 hours**.
2. **Triage & Assessment**: Maintainers will investigate and determine the severity within **3 business days**.
3. **Patch Development**: We will prepare and verify a fix in a private repository.
4. **Coordinated Disclosure**: A security patch release and CVE advisory will be published together with credit given to the reporter.
