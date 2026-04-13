# 🚀 The AQUOS Panel Journey (Chronicles)

*Sebuah dokumentasi komprehensif, dari awal pembuatan hingga menjadi sistem kontrol server otonom berbasi AI di atas Device Android (Aquos Sense4Plus) menggunakan Termux.*

---

## 📖 Latar Belakang (The Genesis)
Semuanya berawal dari kebutuhan untuk memiliki sebuah "Control Panel" kelas atas ala Pterodactyl/Vercel, namun didesain khusus agar ringan, responsif, dan bisa berjalan mandiri di atas HP Android bekas (Aquos Sense4Plus) menggunakan Termux.
Tujuannya adalah menyulap device lawas menjadi server pribadi yang kuat tangguh, dengan UI/UX yang memanjakan mata, fungsional, dan sepenuhnya *autonomous* (dapat menyembuhkan dirinya sendiri saat terjadi error).

---

## 🛠️ Stack Teknologi (The Foundation)
Kami menggunakan perpaduan teknologi paling modern, efisien, dan cepat untuk memastikan server dari HP Android tidak terbebani secara berlebihan, sekaligus memberikan pengalaman kelas enterprise bagi pengguna:

- **Frontend:**
  - React (via Vite)
  - TailwindCSS v4 + Tailwind Typography
  - Recharts (untuk visualisasi grafik real-time)
  - Lucide React (untuk ikon yang elegan)
  - XTerm.js (untuk simulasi bash terminal langsung dari browser)
  - React Markdown (untuk merender diagnosis AI)

- **Backend:**
  - Node.js + Express.js
  - Node-Pty (beserta *fallback* native `child_process.spawn` jika build C++ gagal di Termux)
  - PM2 API (untuk manajemen proses, daemonizing, dan monitoring)
  - WebSockets (komunikasi 2 arah *low-latency* untuk terminal dan logs)
  - JSON File Database (ringan, tidak butuh setup MySQL/Postgres)
  - JWT (JSON Web Tokens) untuk autentikasi dan pengamanan panel.

- **AI Engine / Sentinel:**
  - Mistral AI (`codestral-latest`) yang difokuskan pada penguasaan coding, shell scripting, dan trouble-shooting.

---

## 📜 Apa Saja yang Sudah Kita Lakukan? (The Achievements)

Berikut adalah rangkuman dari semua *milestones* yang telah diimplementasikan dalam AQUOS Panel hingga detik ini:

### 1. Panel & Desain UI (Operations Hub)
- **Desain Premium:** Mengadopsi desain *sleek, modern, glassmorphism, flat-colorful* (warna utama biru Google `#1a73e8`, merah `#ea4335`, hijau `#34a853`). Tidak ada satupun sudut aplikasi yang terlihat "murahan".
- **Real-Time Monitoring:** Dashboard dengan grafik *Live* (Memory & CPU) dengan *pulse ring* animation untuk status koneksi websocket.
- **Project Cards:** Mengelompokkan aplikasi dalam kartu-kartu cantik dengan badge status, nama memori, dan uptime.
- **Dark/Light Mode (Semantic):** Menggunakan palet yang nyaman dipakai di malam maupun siang hari oleh SysAdmin.

### 2. Autentikasi Keamanan (The Gates)
- **Login Portal:** Keamanan pertama yang wajib diakses menggunakan satu Master Password eksklusif.
- **JWT Protection:** Token untuk memvalidasi setiap request API maupun koneksi WebSocket untuk masuk ke bash terminal.

### 3. Bash Terminal Native di Browser (The Command Center)
- **Web-based SSH/Terminal:** Integrasi `xterm.js` untuk langsung mengakses sistem Termux dari Panel web. 
- **Auto-resize & Fallbacks:** Terminal bisa mengikuti ukuran window dan memiliki sistem ganda (jika `node-pty` gagal di Android, ia menggunakan *spawn shell fallback*).

### 4. Continuous Integration & Auto-Deploy (The Factory)
- **Git Push & Auto-Setup:** Mendukung deploy aplikasi langsung dari URL Git/Github. Panel akan otomatis melakukan proses `clone/pull`.
- **Auto Stack Detection:** Sistem deteksi ajaib - mencari `package.json` (Node.js), `requirements.txt` (Python), atau `go.mod` (Go), lalu menginstall depedensinya sesuai stack.
- **Auto Port Binding:** Tidak perlu mengatur port secara manual. Panel membaca history dan otomatis mencari port selanjutnya (`3001, 3002..`) dan membongkar (`inject`) *environment variable* `PORT` ke script.
- **Pull & Restart:** Tombol instan untuk memperbarui dari repositori dan me-restart *down-time* minimum.

### 5. Detail Project Management (The Inspector)
- **Environment Variables Manager:** Mengatur variabel .env per-proyek secara mudah lewat UI.
- **Log Streaming (Realtime):** Membaca `stdout` dan `stderr` PM2 tanpa perlu repot membuka terminal manual.

### 6. Integrasi AI Sentinel (The AI Era)
- **Ask AI Sentinel:** Fitur manual di UI Logs di mana pengguna dapat mengirim tumpukan log error ke AI (Mistral Codestral). AI akan memberikan diagnosis mendetail menggunakan format *Markdown*.
- **🤖 AQUOS AUTONOMOUS WARDEN (The Guardian):** Inovasi *Level 3 Autonomous AI*. 
  - Agen cerdas ini memantau (`polling`) semua status aplikasi PM2 setiap 60 detik.
  - Jika sebuah aplikasi ditemukan `errored` atau memori bocor hingga `0 MB`, Warden akan merampok log errornya.
  - Log dikirim ke AI dalam format Prompt ketat JSON.
  - AI akan membalas dengan **root-cause**, serta command **Bash Shell** (seperti `npm install`, `chmod`, `rm -rf`).
  - Warden akan **mengeksekusi command shell tersebut tanpa intervensi manusia**, merestart PM2, dan mencatat waktunya untuk mengamankan dari infinite-restart (cooldown 10 menit).

---

## 🚧 Apa yang Belum Kita Lakukan / Rencana Ke Depan (The Future / Whiteboard)

Sebagai sistem yang terus berevolusi, banyak ide-ide "gila" yang masih bisa dan belum sempat dieksekusi:

### 1. Reverse Proxy Automation & SSL
- **Caddy/Nginx Controller:** Saat ini semua app berjalan di port (`:3000`, `:3001`). Ke depannya Panel harus bisa menulis config *Reverse Proxy* sehingga setiap app bisa diakses dengan subdomain cantik (misal: `app1.local:80` atau `app1.aquos.net`).
- **Ngrok / Cloudflare Tunnel Integration:** Integrasi langsung dari UI Panel untuk me-ngekspos port local HP/Termux ke internet global lengkap dengan SSL *on-the-fly*. Menggantikan kebutuhan VPS.

### 2. Multi-Node (Cluster) Management
- **The Swarm:** Bagaimana bila kita punya 5 HP bekas? Panel harusnya bisa memiliki mode "Master" dan "Worker". Panel Master mengatur proses dan distribusi deploy ke Panel Worker (di HP lainnya).

### 3. Containerization (Fake Docker / chroot)
- Android tidak memiliki akses kernel asli Docker, tetapi kita bisa menggunakan PRoot / chroot. Ke depannya Warden bisa membuat lingkungan "Isolator Linux" buatan per satu aplikasi PM2 agar sistem lebih aman dari salah ketik direktori oleh AI.

### 4. Pemberitahuan & Peringatan Sosial (Alerts)
- **Telegram / WhatsApp Webhook:** Apabila Warden *gagal* memulihkan aplikasi setelah mencoba command bash, bot Telegram harus mengirim notifikasi berbunyi *"Bos, saya menyerah memperbaiki aplikasi X. Log error terakhir ini, tolong bantu!"* 

### 5. Traffic / Network Analytics
- Belum ada pelacakan HTTP requests metrics (seperti status kode 200, 404, 500) kecepatan response dari tiap app. Panel ke depan bisa memasangkan *sniffer* untuk mem-visualisasikan bandwidth per aplikasi.

### 6. Secrets Vault (Bazaar)
- Daripada mengisi Env Variables, ciptakan Vault (lemari rahasia). Cukup sebutkan key token yang disimpan aman tersendiri yang lalu disisipkan (di-*mount*) pada memori *runtime* ketika `pm2 start`. Jika token berubah, semua app ter-update otomatis.

### 7. Pengelolaan Hardware Lebih Ganas
- Pengukuran panas (Temperatur Baterai SoC) bisa diambil di level Termux shell (`dumpsys battery`). Tambahkan grafik suhu baterai server (karena HP rawan *overheating* dan baterai melembung).
- Auto shutdown hardware HP kalau baterai terlalu *overheat*.

---

## 📝 Konklusi

AQUOS Panel bukanlah sekadar "dashboard sederhana", namun merupakan metamorfosa sebuah smartphone bekas menjadi **Cloud Server Pintar Pribadi** dengan kemampuan mandiri (*Self-Healing*).
Perjalanan kita merancang fondasi backend C++, integrasi Terminal, UI yang ciamik, dan terakhir otak Artifisial Intelligence (Warden), membuktikan bahwa batas sistem modern hanyalah sebatas imajinasi programmernya!

*"To be continued as the code evolves..."*
