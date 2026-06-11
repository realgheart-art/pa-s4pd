# PA S4PD — Panduan Pemasangan

Sistem pengurusan jadual pergerakan pegawai. Dua bahagian:

- **Frontend** (fail HTML/CSS/JS) → dihos di **GitHub Pages**
- **Backend** (`Code.gs`) → **Google Apps Script** + **Google Sheets** sebagai pangkalan data

Ikut **4 langkah** ini dari atas ke bawah. Sekali sahaja, lepas tu sistem terus jalan.

---

## Langkah 1 — Sediakan Google Sheets + Apps Script

1. Buka [sheets.new](https://sheets.new) untuk cipta Spreadsheet baru. Namakan, cth **"Pangkalan Data PA S4PD"**.
2. Dalam Sheet tersebut: menu **Extensions → Apps Script**.
3. Padam kod contoh yang ada. Buka fail `Code.gs` dari pakej ini, salin **semua** isinya, tampal ke dalam editor Apps Script.
4. Di bahagian atas kod, cari blok ini dan **tukar dua kod**:

   ```javascript
   ADMIN_CODE: 'GANTI-KOD-ADMIN-2026',   // kod untuk PA / pegawai (boleh kemaskini)
   GUEST_CODE: 'GANTI-KOD-GUEST-2026'    // kod kongsi (lihat sahaja)
   ```

   Gunakan kod yang **tidak mudah diteka**. Kod admin jangan dikongsi luas.
5. Klik ikon **Save** (cakera).

---

## Langkah 2 — Deploy Apps Script sebagai Web App

1. Di editor Apps Script, klik **Deploy → New deployment**.
2. Klik gear di sebelah "Select type" → pilih **Web app**.
3. Tetapkan:
   - **Description**: PA S4PD API
   - **Execute as**: **Me** (akaun anda)
   - **Who has access**: **Anyone**
4. Klik **Deploy**. Kali pertama, ia minta kebenaran → **Authorize access** → pilih akaun → "Advanced" → "Go to (project)" → **Allow**.
5. **Salin URL Web App** yang dipaparkan. Bentuknya:
   `https://script.google.com/macros/s/XXXXXXXX/exec`

   Simpan URL ini — perlu di Langkah 3.

> Jadual (sheet "Jadual") dengan semua header akan dicipta **automatik** kali pertama data ditambah. Tak perlu sediakan manual.

---

## Langkah 3 — Sambungkan Frontend ke Backend

1. Buka fail **`config.js`** dari pakej ini.
2. Ganti teks dalam tanda petik dengan URL Web App dari Langkah 2:

   ```javascript
   window.PA_CONFIG = {
     API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec'
   };
   ```

3. Simpan fail.

---

## Langkah 4 — Hos di GitHub Pages

1. Cipta repository baru di GitHub (cth **`pa-s4pd`**). Boleh set **Public**.
2. Muat naik **semua fail** ini ke repo (terus di root, bukan dalam subfolder):

   ```
   index.html
   style.css
   app.js
   config.js          ← sudah diisi URL di Langkah 3
   manifest.json
   service-worker.js
   icons/icon-192.png
   icons/icon-512.png
   icons/icon-maskable-512.png
   ```

   > `Code.gs` dan `README.md` **tidak perlu** dimuat naik (Code.gs sudah dalam Apps Script). Tak mengapa kalau dimuat naik sekali pun.
3. Di repo: **Settings → Pages**.
4. Bawah "Build and deployment", **Source** → **Deploy from a branch**.
5. **Branch** → pilih `main`, folder `/ (root)` → **Save**.
6. Tunggu 1–2 minit. URL laman akan muncul:
   `https://NAMA-ANDA.github.io/pa-s4pd/`

Buka URL tersebut — skrin gerbang akan keluar. Masuk dengan kod yang ditetapkan.

---

## Pasang di telefon (PWA)

1. Buka URL GitHub Pages di **Chrome (Android)** atau **Safari (iPhone)**.
2. **Android**: menu (⋮) → **Add to Home screen / Pasang aplikasi**.
   **iPhone**: butang Kongsi → **Add to Home Screen**.
3. Ikon **S4PD** akan muncul di skrin utama, buka seperti aplikasi biasa.

---

## Tiga peringkat akses

| Peringkat | Cara masuk | Boleh buat |
|-----------|-----------|------------|
| **Tatapan** (Guest) | Taip *kod guest* | Lihat kalendar, klik event, baca maklumat, hubungi PIC |
| **Admin** | Taip *kod admin* | Semua di atas + tambah/edit/padam event + jana laporan PDF |

Kod akan diingat sepanjang sesi (sehingga tab ditutup atau klik **Log keluar**).

---

## Nota keselamatan (penting)

- Kedua-dua kod **tidak** disimpan dalam fail frontend — ia hanya di dalam Apps Script. Walaupun GitHub Pages bersifat awam, kod akses tidak terdedah dalam *view source*.
- Setiap operasi tambah/edit/padam **disahkan semula di server** (GAS). Tanpa kod admin yang sah, GAS menolaknya — bukan sekadar sembunyi butang.
- Nak tukar kod kemudian: edit semula `Code.gs`, **Save**, kemudian **Deploy → Manage deployments → Edit (pensel) → Version: New version → Deploy**. (Penting: guna "New version", bukan deployment baru, supaya URL kekal sama.)

---

## Mengaktifkan fungsi Lampiran (v2)

Sistem kini menyokong muat naik dokumen (PDF/JPG/PNG, maks 10MB) ke Google Drive. Sebab ini melibatkan **kebenaran Google Drive baru**, ikut langkah ini **sekali sahaja** selepas menampal `Code.gs` versi terkini:

1. Dalam editor Apps Script, di menu fungsi (atas, sebelah butang Run), pilih fungsi **`authorize`**.
2. Klik **Run**. Google akan minta kebenaran tambahan (Drive) → **Authorize access** → pilih akaun → "Advanced" → "Go to (project)" → **Allow**.
3. Selepas itu, **Deploy → Manage deployments → Edit (pensel) → Version: New version → Deploy**.

> Tanpa langkah `authorize` ini, percubaan muat naik akan gagal dengan ralat kebenaran.

**Cara guna:** dalam borang Kemaskini Jadual, ada medan **Lampiran** di bawah sekali. Pilih fail → Simpan. Fail muncul sebagai pratonton dalam tetingkap maklumat event, dengan butang buka/muat turun. Semasa edit, lampiran sedia ada boleh dikekalkan, diganti, atau dibuang.

**Nota keselamatan lampiran:** fail dikongsi sebagai "sesiapa yang ada pautan boleh lihat" supaya bos/guest boleh membukanya tanpa perlu log masuk Drive. Pautannya panjang dan sukar diteka, tetapi sesiapa yang ada URL tepat boleh melihat fail tersebut. Elakkan memuat naik dokumen yang sangat sulit. Fail disimpan dalam folder Drive **"PA S4PD - Lampiran"** (dicipta automatik), dan akan dialih ke Trash apabila event dipadam atau lampiran diganti.

---

## Penyelesaian masalah

| Masalah | Punca & penyelesaian |
|---------|---------------------|
| "URL API belum ditetapkan" | `config.js` belum diisi URL Langkah 2/3. |
| "Kod akses tidak sah" | Kod salah, atau Apps Script belum di-*redeploy* selepas tukar kod. |
| Kalendar kosong walau dah tambah | Buka URL Web App terus dalam pelayar — patut papar `{"success":true,...}`. Kalau ralat kebenaran, ulang Langkah 2 (Authorize). |
| Butang call tak berfungsi di PC | Normal — `tel:` hanya berfungsi di telefon. |
| Tukar kod tapi tak berkesan | Belum redeploy "New version" (lihat Nota keselamatan). |

---

## Yang belum termasuk (fasa akan datang)

Dirancang untuk kemaskini akan datang:
- **Sync ke Google Calendar** untuk reminder automatik di telefon bos.
