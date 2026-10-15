# CircleCode ECC prototype

ต้นแบบทดลอง V2.1: แพ็ก Numeric / Alphanumeric / UTF-8 / Binary พร้อม Reed–Solomon + CRC32 แยกจากไลบรารีหลัก ใช้ JavaScript โดยไม่มี dependency เพิ่ม

โค้ด codec/packing/RS/scanner ตัวจริงอยู่ที่ `v2/` ภายในโฟลเดอร์ทดลองนี้ ไฟล์ชื่อเดิม re-export โค้ดร่วมเพื่อให้ ECC Lab กับเว็บสแกนใช้ implementation เดียวกัน ทุกส่วนของ V2 รวมเว็บสแกนและ Rust/WASM อยู่ใน `test/ecc-prototype/` เท่านั้น ไม่แก้ exports, scripts หรือไลบรารีหลัก สำเนา `legacy/` ใช้ renderer และตัวช่วย V1 ที่แยกจากโค้ดหลัก

เว็บสแกนมือถือพร้อมกล้องและ Rust/WASM อยู่ที่ [scanner-web](scanner-web/README.md) ตัวอ่าน JS/Rust ทดลองค้นหาจำนวนวงอัตโนมัติ 4–14 ได้ด้วยค่า rings = 0; ECC Lab ยังคงให้เลือกจำนวนวงเอง ไม่มีการเผยแพร่เว็บหรือเชื่อมต่อ Sites ในโฟลเดอร์นี้

จากรากโปรเจกต์ รันชุดทดลองทั้งหมดด้วย `npm --prefix test/ecc-prototype test` สร้างเว็บสแกนด้วย `npm --prefix test/ecc-prototype run build:scanner` และเปิดด้วย `npm --prefix test/ecc-prototype run preview` ที่ `http://127.0.0.1:4180/` คำสั่ง build:wasm ของ package ทดลองสร้างเฉพาะ `native/rust/` และ `wasm/` ภายในโฟลเดอร์นี้

## เปิดเว็บทดลอง

จากโฟลเดอร์รากของโปรเจกต์:

```sh
node test/ecc-prototype/serve.mjs
```

เปิด [ECC Lab](http://127.0.0.1:4173/) ต้องเปิดผ่าน HTTP server เพื่อโหลด ES modules และ Web Worker

หน้าเว็บสร้าง Circle / LonCle, เปลี่ยนข้อมูลแบบสุ่มหรือกดเลือกไบต์, แสดงต้นฉบับ/ความเสียหาย/ผลกู้ และบันทึกภาพ PNG หรือ SVG ได้ ส่วนอ่านภาพใช้ตัวถอดรหัสทดลองจริงใน Worker รองรับ Canvas ด้านบน ภาพตัวอย่าง และไฟล์ PNG/JPEG/WebP ไม่เกิน 10 MB โดยย่อด้านยาวเหลือไม่เกิน 800 พิกเซลก่อนอ่าน

เลือกโหมดแพ็กข้อมูลเป็น Auto เพื่อเลือก Numeric, Alphanumeric หรือ UTF-8 สำหรับทั้งข้อความ หรือเลือก Binary แล้วใส่ hex ครบคู่ เช่น `00 FF 80 41` หน้าเว็บแสดงจำนวนหลัก/ตัว/ไบต์และจำนวนบิตที่แพ็กจริง ไบนารีที่อ่านกลับจะแสดงเป็น hex เพื่อคงค่า `00`, `FF` และไบต์ที่ไม่ใช่ UTF-8

ภาพและข้อความประมวลผลในเบราว์เซอร์ เซิร์ฟเวอร์ใช้ Node มาตรฐานและรับการเชื่อมต่อเฉพาะ `127.0.0.1` จำนวนวงของภาพต้องระบุเอง ภาพตัวอย่างที่แนบมาใช้ 7 วงทั้งหมด เว็บนี้ไม่มีการอ่านจากกล้อง

ตรวจการใช้งานจริงในเบราว์เซอร์แล้ว: กู้ 4 ไบต์จาก Canvas, ปฏิเสธกรณี 5 ไบต์ที่เลือกและภาพ noise, อ่านภาพหมุน/กระจก/กลับสี, ภาษาไทยและ emoji แบบ LonCle, ข้อความเกินความจุ, ดาวน์โหลด PNG/SVG และนำ PNG ที่ดาวน์โหลดกลับมาอ่านได้ ตรวจความกว้าง 375 และ 1280 พิกเซลแล้วไม่มีเนื้อหาล้นแนวนอน ภาพหน้าเว็บอยู่ที่ `outputs/web-preview.jpg`

โหมด V2.1 ตรวจผ่านหน้าเว็บจริงแล้ว: Auto Numeric 33 หลักที่มีศูนย์นำหน้าและเสียหาย 4 ไบต์, Alphanumeric 20 ตัวแบบ LonCle, UTF-8 ที่เกินความจุ, hex ไม่ครบคู่ถูกปฏิเสธ และ Binary ครบ 14 ไบต์ที่เสียหาย 4 ไบต์ถูกส่งออกเป็น PNG แล้วนำกลับมาอ่านได้ตรงทุกไบต์ ตรวจหน้าจอ 375/1280 พิกเซลซ้ำสำหรับ UI โหมดใหม่แล้วไม่มีเนื้อหาล้นแนวนอน

## รันการทดลอง

จากโฟลเดอร์รากของโปรเจกต์:

```sh
node test/ecc-prototype/run-tests.js
```

โปรแกรมทดสอบและเขียนตัวอย่างลง `test/ecc-prototype/outputs/` ทุกครั้งที่รัน

การทดสอบเพิ่มเติม รวมการอ่านภาพ:

```sh
node test/ecc-prototype/run-more-tests.js
node test/ecc-prototype/run-web-tests.js
```

คำสั่งเพิ่มเติมใช้ ImageMagick (`magick`) และ Python พร้อม Pillow ที่ติดตั้งอยู่ในเครื่องสำหรับสร้างและอ่านภาพ ไม่มี dependency JavaScript เพิ่ม ตัวทดสอบรันชุดพื้นฐานก่อน แล้วเขียนภาพลง `outputs/optical/` และผลลง `outputs/more-results.json`

## ไฟล์

- `legacy/circle-code.js`, `legacy/circle-scanner.js`, `legacy/LICENSE`: สำเนาไฟล์ปัจจุบันของโปรเจกต์ ใช้เทียบพฤติกรรมเดิมและใช้ renderer เดิม สำเนาเหล่านี้ไม่อัปเดตตามไฟล์หลักโดยอัตโนมัติ
- `reed-solomon.js`: shortened Reed–Solomon บน GF(256), primitive polynomial `0x11D`, generator roots เริ่มที่ α⁰ ใช้ Berlekamp–Massey หาตำแหน่งผิด และแก้ระบบสมการเพื่อหาค่าที่ต้องแก้
- `codec.js`: กรอบข้อมูลทดลอง version 2, CRC32 และการวางข้อมูลลงโมเดลวงกลม
- `packing.js`: แพ็กและอ่านโหมดข้อมูล คำนวณความจุ และตรวจกลุ่มบิต/บิตเติมที่ไม่ถูกต้อง
- `run-packing-tests.js`: ตรวจเวกเตอร์แพ็ก ความจุ ไบนารี และความเข้ากันได้กับ V2 เดิม รันรวมในชุดพื้นฐานด้วย
- `run-tests.js`: การทดสอบและตัวสร้างไฟล์ตัวอย่าง
- `scan-image.js`: ตัวอ่านภาพทดลอง ใช้ตัวค้นหาศูนย์กลางและตัว sample จากสำเนา scanner เดิม แล้วส่งไบต์ให้ RS + CRC32
- `make-optical-fixtures.py`: แปลง SVG จริงเป็นภาพ แล้วสร้างภาพหมุน กลับสี กระจก เบลอ JPEG และรอยขีดอย่างทำซ้ำได้
- `run-more-tests.js`: ทดสอบคู่บิตทุกคู่ รูปแบบไบต์เสียทุกตำแหน่ง และภาพที่แปลงแล้ว
- `index.html`, `web.css`, `web.js`: หน้าเว็บทดลอง ใช้ codec และ renderer เดิมร่วมกัน
- `scan-worker.js`: อ่านภาพใน Web Worker เพื่อไม่ขวางการใช้งานหน้าเว็บ
- `serve.mjs`: HTTP server สำหรับเปิดเว็บในเครื่อง
- `run-web-tests.js`: ตรวจ protocol ของ Worker, ภาพจริงทั้ง 4 โหมด × 2 รูปแบบ × ต้นฉบับ/เสียหาย 4 ไบต์ รวม 16 ภาพ, ภาพ V2 เดิม และกรณี input/exception
- `outputs/packing-results.json`, `outputs/web-results.json`: ผลทดสอบโหมดแพ็กและ Worker
- `outputs/results.json`: สรุปผลที่สร้างจากการรันจริง
- `outputs/circle-{clean,damaged,recovered}.svg`: ภาพแบบขีดแยก ก่อนเสียหาย/เสียหาย/หลังกู้
- `outputs/loncle-{clean,damaged,recovered}.svg`: ตัวอย่างเดียวกันแบบส่วนโค้งต่อเนื่อง

## รูปแบบทดลอง

```text
magic CC (2 bytes) | format/mode (1 byte) | length (2 bytes, big-endian)
packed payload | zero padding | CRC32 (4 bytes) | RS parity (8 bytes)
```

ความยาวกรอบข้อมูลกำหนดจากความจุของวงแหวน โดยใช้เฉพาะไบต์เต็ม เศษบิตที่เหลือเติม 0 ตัวถอดรหัสจึงไม่ต้องเชื่อ length header ก่อนแก้ข้อมูล

CRC32/ISO-HDLC คำนวณบน header, payload และ padding ทั้งหมด จากนั้น Reed–Solomon ครอบข้อมูลรวม CRC32 อีกชั้น หลังแก้ RS ต้องผ่าน CRC32, magic/mode, ความยาว, กลุ่มบิตที่ถูกต้อง และ padding ศูนย์ก่อนคืน `ok: true` โหมด UTF-8 ต้องผ่านการถอด UTF-8 แบบ strict ด้วย

ไบต์ format/mode: `0x20` = UTF-8, `0x21` = Numeric, `0x22` = Alphanumeric, `0x23` = Binary ตั้งชื่อรูปแบบนี้ว่า V2.1 ตัวอ่านใหม่ยังรับกรอบ V2 เดิมที่ใช้ `0x02` เป็น UTF-8 ได้ ตัวอ่าน V2 เดิมจะปฏิเสธกรอบใหม่ จึงต้องอัปเดตตัวอ่านก่อนใช้โหมดแพ็กใหม่ และทั้งสองรูปแบบใช้กับ scanner หลัก V1 ไม่ได้

Numeric นับ length เป็นจำนวนหลัก `0–9`: ทุก 3 หลักใช้ 10 บิต เศษ 1/2 หลักใช้ 4/7 บิต Alphanumeric นับเป็นจำนวนตัวจากชุด `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:`: ทุก 2 ตัวใช้ 11 บิต เศษ 1 ตัวใช้ 6 บิต UTF-8 และ Binary นับเป็นจำนวนไบต์ โดยแต่ละไบต์ใช้ 8 บิต

กฎแพ็ก Numeric/Alphanumeric สอดคล้องกับ [ตัวเข้ารหัส QR ของ Project Nayuki](https://github.com/nayuki/QR-Code-generator/blob/master/typescript-javascript/qrcodegen.ts#L743-L772) แต่ header, CRC และรูปแบบภาพนี้เป็น CircleCode ทดลอง ไม่ใช่ QR Code ไม่มี dependency จาก QR library และยังไม่มีการแบ่งหลาย segment ในหนึ่งกรอบ

ตัวอย่างเริ่มต้น 7 วงมีพื้นที่ 31 ไบต์ ใช้ overhead 17 ไบต์ เหลือ 112 บิตสำหรับ payload จึงเก็บได้สูงสุด 33 หลัก Numeric, 20 ตัว Alphanumeric หรือ 14 ไบต์ UTF-8/Binary โดยยังใช้ parity 8 ไบต์ กู้ได้สูงสุด 4 ไบต์ที่ผิดตำแหน่งใดก็ได้ในกรอบ รวม header, CRC หรือ parity ตัวเลขนี้นับความเสียหายหลังแพ็กแล้ว ไม่ใช่จำนวนตัวอักษรหรือเปอร์เซ็นต์พื้นที่ภาพ

```js
import { encodeFrame, decodeFrame } from './codec.js';

const frame = encodeFrame('Table-24');
frame[5] ^= 1;
const result = decodeFrame(frame);
console.log(result.ok, result.text, result.correctedBytes);
// true Table-24 1

const numbers = encodeFrame('000123456789012345678901234567890');
console.log(decodeFrame(numbers).mode); // numeric; ศูนย์นำหน้าคงเดิม
const binary = encodeFrame(Uint8Array.of(0, 255, 128, 65));
const decoded = decodeFrame(binary);
console.log(decoded.bytes); // Uint8Array [0, 255, 128, 65]
// binary คืน bytes โดย text เป็น undefined
```

API `encodeFrame(payload, frameBytes = 31, mode = 'auto')` และ `buildEccModel(payload, rings = 7, mode = 'auto')` รับ string หรือ Uint8Array; เลือกโหมดเองได้ด้วย `numeric`, `alphanumeric`, `utf8`, `binary` โหมดข้อความไม่แก้ตัวพิมพ์หรือเลขศูนย์นำหน้า และปฏิเสธอักขระที่ใช้กับโหมดนั้นไม่ได้ ข้อความที่มี UTF-16 surrogate ไม่ครบคู่ถูกปฏิเสธเพื่อไม่ให้ข้อมูลเปลี่ยนเงียบ ๆ

ผลอ่านเพิ่ม `mode`, `bytes` (Uint8Array), `payloadLength`, `packedBits`, `packedBytes` และ `format` เป็น `2` หรือ `2.1` ทุกโหมดข้อความยังคืน `text` ตามเดิม การแพ็กไม่ใช่การเข้ารหัสลับหรือการบีบอัดไฟล์ทั่วไป

## สิ่งที่ทดสอบ

- RS encoder ตรงกับ test vector จาก ISO 18004 Annex I ที่เผยแพร่ใน [ZXing ReedSolomonTestCase.testQRCode](https://github.com/zxing/zxing/blob/master/core/src/test/java/com/google/zxing/common/reedsolomon/ReedSolomonTestCase.java#L55-L65) และ decoder กู้บล็อกอ้างอิงที่เสียหายได้
- CRC32 ของ `123456789` ตรงกับค่าอ้างอิง `CBF43926`
- การพลิกบิตทีละตำแหน่งครบ 248 ตำแหน่ง และ XOR ทุกค่าที่ไม่เป็นศูนย์ในหนึ่งไบต์
- 2,000 กรณีสุ่มแบบ seed คงที่: เสียหาย 1–4 ไบต์ ความยาวกรอบสูงสุด 255 ไบต์ และตรวจว่า decoder ไม่แก้ input ต้นฉบับ
- 200 รูปแบบที่เลือกให้เสียหายเกินขีดจำกัดถูกปฏิเสธ ตัวเลขนี้ไม่ใช่ข้อรับประกันสำหรับทุกกรณีที่เกินขีดจำกัด
- กรอบที่ RS ถูกต้องแต่ CRC32 ไม่ตรงถูกปฏิเสธ รวมถึง version, length และ UTF-8 ที่ไม่ถูกต้อง
- เทียบข้อผิดพลาดเดิม: `AB` ที่เสีย 1 บิตถูกตัวเดิมยอมรับเป็น `@B` ขณะที่ต้นแบบกู้ `AB` กลับได้
- ตัวอย่างโมเดลวงกลมพลิก 32 บิตใน 4 ไบต์ แล้วกู้ `Table-24` กลับได้
- ภาษาไทย, emoji, ข้อความว่าง, ข้อจำกัดความจุ และ input ที่ไม่ถูกต้อง
- เวกเตอร์ Numeric `01234567` → `03 15 98 60` (27 บิต + padding), Alphanumeric `AB` → `39 A0` (11 บิต + padding), กลุ่มตัวเลขครบ 1,000 ค่า และคู่ Alphanumeric ครบ 2,025 คู่
- ขอบเขตความจุ 956 กรณี: 4 โหมด × พื้นที่ payload 0–238 ไบต์ ทั้งค่าที่พอดีและเกิน 1 หน่วย รวมไบต์ดิบครบทุกค่า 0–255
- เฟรมเสียหาย 1–4 ไบต์อีก 400 กรณีสำหรับโหมดใหม่, header/mode/กลุ่มบิต/padding ที่ปลอมพร้อม CRC/RS ถูกต้อง, BOM, newline และภาพ V2 เดิมที่จับค่าไว้

## ผลการทดสอบเพิ่มเติม

- คู่บิตผิดทุกคู่ในกรอบ 31 ไบต์ รวม 30,628 กรณี กู้คืนได้ครบ
- ความเสียหายหนึ่งไบต์ทุกตำแหน่ง × ทุก XOR mask ที่ไม่เป็นศูนย์ รวม 7,905 กรณี กู้คืนได้ครบ
- กรอบข้อมูลสุ่ม 2,000 กรณีถูกปฏิเสธ ไม่ใช่ข้อรับประกันว่าไม่มี false positive สำหรับ input ทั้งหมด
- ภาพ 37 กรณีที่ rasterize จาก SVG ของ renderer จริง ครอบคลุม Circle และ LonCle: ขนาด 240–800 พิกเซล, มุมหมุน, สะท้อนกระจก, กลับดำ–ขาว, ภาพที่แปลงหลายอย่างพร้อมกัน, Gaussian blur, JPEG quality 35 และข้อมูลเสียหาย 4 ไบต์
- ภาพที่กำหนดให้อ่านได้ 30 กรณีอ่าน `Table-24` ถูกทั้งหมด และภาพรอยขีดทดลองอีก 2 กรณีอ่านได้ รอยขีดบางนี้ถูกตัว sampling กรองออกโดยไม่ต้องแก้ไบต์ด้วย RS
- ภาพถูกปิดทับหนัก 2 ภาพ ภาพว่างขาว/ดำ และภาพ noise รวม 5 กรณีถูกปฏิเสธ ไม่พบข้อความผิดที่ถูกยอมรับในชุดภาพนี้
- ค้นหาศูนย์กลาง ขนาด มุมหมุน polarity และการสะท้อนจากพิกเซล โดยไม่ส่งค่าการแปลงของ fixture ให้ decoder; ยังคงระบุจำนวนวงเป็น 7 และ density เป็น 0.35
- เวลารายภาพใน JSON เป็นข้อมูลวินิจฉัยจากการรันครั้งเดียวบนเครื่องนี้ ไม่ใช่ benchmark หรือข้อตกลงด้านประสิทธิภาพ

## ข้อจำกัด

- ชุดเพิ่มเติมอ่านภาพที่สร้างจาก SVG ได้แล้ว แต่ยังไม่ได้ทดสอบภาพถ่าย กล้องจริง และ perspective ภาพ fixture เป็น format ทดลองและสแกนด้วยตัวหลัก version 1 ไม่ได้
- เว็บทดลองหน้านี้ใช้จำนวนวงที่กำหนดและ density คงที่ 0.35 ไม่มี erasures; codec และตัวอ่าน Rust/WASM สำหรับ V2.1 เพิ่มใน `native/rust/src/v2.rs` และทดสอบร่วมกับเว็บสแกนใหม่แล้ว
- เมื่อเสียหายเกินขีดจำกัด RS อาจแก้เป็นข้อมูลอื่นได้ CRC32 ช่วยลดการยอมรับผิด แต่ยังมีโอกาสชนกัน และไม่ใช่การยืนยันความแท้ของข้อมูล
- V2.1 ใช้โหมดเดียวต่อกรอบ ไม่มี Kanji mode, mixed segments, ระดับ ECC ให้เลือก หรือการอ่านไฟล์ไบนารีจากปุ่มบนเว็บโดยตรง (ใช้ Uint8Array ผ่าน API หรือ hex บนเว็บ)
- ก่อนนำไปใช้จริงต้องวางแผนอัปเดตตัวอ่าน V2 เดิม เพราะอ่านกรอบ V2.1 ไม่ได้
- implementation นี้เป็นต้นแบบที่ผ่านการทดสอบข้างต้น ยังไม่ถือเป็นการตรวจรับระดับ production
