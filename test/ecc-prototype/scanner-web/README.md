# เว็บสแกน V2.1 — ทดลองใน test เท่านั้น

เว็บมือถือทดลองกล้องและอ่านภาพ CircleCode V2/V2.1 ใช้ JavaScript สำหรับ UI/กล้อง และ Rust/WebAssembly หรือ JavaScript อ่านภาพใน Worker โค้ดทั้งหมดรวม Rust, WASM และไลบรารีร่วมอยู่ภายใน test/ecc-prototype ไม่เปลี่ยนไลบรารีหลักหรือ package.json ที่รากโปรเจกต์ และไม่มีการตั้งค่าเผยแพร่ Sites ในโฟลเดอร์นี้

## เปิดเว็บทดลอง

จากรากโปรเจกต์:

```sh
npm --prefix test/ecc-prototype run build:scanner
npm --prefix test/ecc-prototype run preview
```

เปิด http://127.0.0.1:4180/ บนเครื่องเดียวกัน ส่วน ECC Lab เดิมเปิดด้วย npm --prefix test/ecc-prototype run lab ที่พอร์ต 4173

โทรศัพท์ที่เปิดผ่าน HTTP IP ของเครื่องอื่นใน LAN ใช้กล้องไม่ได้ ต้องใช้ HTTPS หรือ origin ที่เบราว์เซอร์ถือว่าเป็น secure context ดู [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) ยังไม่ได้เผยแพร่เว็บหรือรับรองการใช้งานบนโทรศัพท์จริง

## สิ่งที่ทดลองได้

- เปิด/หยุด/สลับกล้อง โดยขอกล้องหลังเป็นตัวเลือกที่ต้องการ ไม่ใช้ไมโครโฟน
- ภาพกล้อง crop กลางและย่อไม่เกิน 640 × 640 ทำงานครั้งละหนึ่งเฟรม และต้องอ่านตรงกันสองเฟรมก่อนยอมรับและหยุดกล้อง
- กล้องและ Worker หยุดเมื่อสลับแท็บ ออกจากหน้า กดหยุด หรือพบข้อผิดพลาด ผลขอสิทธิ์ที่มาช้าจะปล่อยกล้องทันทีหากงานถูกยกเลิก
- PNG/JPEG/WebP ตรวจลายเซ็นไฟล์ จำกัด 10 MB และไม่เกิน 32 ล้านพิกเซล ย่อด้านยาวไม่เกิน 960 ก่อนอ่าน
- เลือก Rust/WASM, JavaScript หรือ Auto ที่ใช้ JS สำรองเมื่อโหลด WASM ไม่ได้ ค้นหาจำนวนวง 4–14 อัตโนมัติหรือระบุเองได้
- อ่าน Numeric, Alphanumeric, UTF-8 และ Binary ไบนารีแสดงเป็น hex และบันทึกคืนเป็นไฟล์ดิบได้
- ภาพประมวลผลในเครื่อง ไม่เก็บประวัติ ไม่ส่งภาพขึ้นเซิร์ฟเวอร์ และไม่เปิดลิงก์จากผลอ่านอัตโนมัติ

หน้านี้รองรับ V2/V2.1 เท่านั้น ไม่อ่าน V1 และยังกู้ข้อมูลเสียได้สูงสุด 4 ไบต์ตาม format ทดลองเดิม

## โครงสร้างภายใน test/ecc-prototype

- v2/: codec, packing, RS และ scanner JS ที่ ECC Lab กับเว็บสแกนใช้ร่วมกัน
- legacy/: สำเนา renderer และตัวช่วย V1 ที่แยกจากโปรเจกต์หลัก
- native/rust/: crate ทดลองพร้อม source, Cargo.lock และ outputs ของ wasm-pack แยกจาก native/rust หลัก
- wasm/: runtime V2 สำหรับเว็บทดลองนี้เท่านั้น
- scanner-web/src/: หน้าเว็บ กล้อง Worker และตัวจัดการการยกเลิกงาน
- scanner-web/dist/: ไฟล์เว็บที่สร้างจากโค้ดทดลองข้างต้น

สร้าง WASM ทดลองใหม่ โดยต้องมี Rust target wasm32-unknown-unknown และ wasm-pack:

```sh
npm --prefix test/ecc-prototype run build:wasm
npm --prefix test/ecc-prototype run build:scanner
```

คำสั่งนี้สร้างเฉพาะ test/ecc-prototype/native/rust/pkg และ sync ไป test/ecc-prototype/wasm ไม่เปลี่ยน WASM ของโปรเจกต์หลัก

## ตรวจสอบ

```sh
npm --prefix test/ecc-prototype test
cargo test --locked --manifest-path test/ecc-prototype/native/rust/Cargo.toml
```

ชุดทดสอบใช้ ImageMagick และ Python/Pillow ที่มีในเครื่อง รวมการแพ็ก/กู้ข้อมูล, JS–Rust ตรงกัน 2,000 กรณี, ภาพ 37 กรณี, ภาพเสียหาย 4 ไบต์ทุกโหมดทั้ง Circle/LonCle และค้นหาจำนวนวงครบ 4–14 ทั้งสอง engine กล้องจำลองตรวจ cancellation, track cleanup, stale replies และการยืนยันสองเฟรม

ตรวจในเบราว์เซอร์จริงแล้วทั้ง JS และ Rust/WASM รวมอ่าน PNG Binary และดาวน์โหลดกลับตรง 14 ไบต์ แต่ยังไม่ได้ตรวจกล้องจริงบน Android/iOS แสง/มุมเอียงทุกสภาพ หรือความร้อนและแบตเตอรี่ จึงยังเป็นโค้ดทดลองใน test ไม่ใช่การรับรอง production
