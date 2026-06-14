# Panduan Setup Web Push Notification (Paling Mudah & 100% Berhasil)
## Hotel Harris Gubeng Task Manager

Kabar gembira! **Anda TIDAK perlu lagi melakukan deploy Supabase Edge Function** yang rumit dan sering gagal menggunakan CLI Deno. 

Kami telah memindahkan sistem pengirim notifikasi (**Push Notification Server**) langsung ke dalam aplikasi ini secara full-stack! Sekarang, setiap kali Anda memasukkan tugas baru atau merubah status tugas menjadi selesai (Complete) di aplikasi, aplikasi akan otomatis menyebarkan notifikasi ke seluruh perangkat yang terdaftar secara real-time—**otomatis tanpa perlu Deno!**

Satu-satunya setup yang Anda butuhkan di Supabase adalah menjalankan skrip SQL dasar di bawah ini untuk mengaktifkan tabel penyimpanan perangkat (`push_subscriptions`).

---

## 1. Satu-satunya Langkah di Supabase: Jalankan SQL ini
Buka menu **SQL Editor** pada Supabase Dashboard Anda, buat query baru, hapus semua query lama, lalu salin skrip berikut dan tekan **Run**:

```sql
-- 1. Membuat Tabel push_subscriptions untuk menampung pendaftaran perangkat
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    username text,
    endpoint text UNIQUE NOT NULL,
    keys_p256dh text NOT NULL,
    keys_auth text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Atur keamanan baris data (RLS) agar semua petugas bisa mendaftarkan perangkat
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop policy jika sudah ada agar aman ditimpa ulang (idempotent)
DROP POLICY IF EXISTS "Allow anonymous/public insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow anonymous/public select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow anonymous/public update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow anonymous/public delete" ON public.push_subscriptions;

CREATE POLICY "Allow anonymous/public insert" 
ON public.push_subscriptions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous/public select" 
ON public.push_subscriptions FOR SELECT 
USING (true);

CREATE POLICY "Allow anonymous/public update" 
ON public.push_subscriptions FOR UPDATE 
USING (true);

CREATE POLICY "Allow anonymous/public delete" 
ON public.push_subscriptions FOR DELETE 
USING (true);
```

Setelah Anda klik **Run** dan mendapatkan status sukses, setup Supabase Anda **SELESAI!** Sangat simple, bukan?

---

## 2. Cara Kerja Alur Notifikasi Sekarang
Sistem ini menggunakan alur modern **Hybrid Direct Push Delivery**:
1. **Pendaftaran Perangkat**: Saat petugas membuka aplikasi di iPhone/Android (setelah ditambahkan ke Home Screen) dan mengetuk tombol **Lonceng Bergetar/Bel**, browser mendaftarkan perangkat ke server push (Apple APNs / Google FCM).
2. **Menyimpan Kunci**: Kunci unik perangkat (Subscription) tersebut disimpan langsung ke tabel `push_subscriptions` di Supabase Anda.
3. **Pengiriman Instan**: Saat ada petugas yang menginput Work Order baru atau menyelesaikan Work Order dari aplikasi, aplikasi akan memanggil backend server kita (`/api/send-web-push`).
4. **Distribusi**: Server kita akan otomatis mengambil list perangkat aktif dari tabel `push_subscriptions` Supabase Anda dan seketika menembakkan push notification ke browser ponsel masing-masing petugas, bahkan saat ponsel mereka dalam keadaan terkunci atau di saku!

---

## 3. Cara Menginstal PWA di iPhone agar Notifikasi Muncul 100%
Karena Apple iOS membatasi Push Notification untuk Web standar, Anda **WAJIB** mengikuti langkah ini di iPhone Anda:

1. **Buka Safari**: Buka aplikasi **Safari** bawaan iPhone Anda.
2. **Kunjungi Aplikasi**: Buka URL aplikasi Harris Gubeng Anda:
   `https://ais-dev-pjjren7xbukcr4snpaky3z-950978305486.asia-southeast1.run.app`
3. **Tambahkan ke Home Screen**:
   - Ketuk tombol **Share 📤** (ikon persegi dengan panah ke atas) di menu bar bagian bawah Safari.
   - Gulir ke bawah, lalu pilih **'Tambahkan ke Layar Utama' (Add to Home Screen) ➕**.
   - Ketuk **Tambah (Add)** di sudut kanan atas.
4. **Buka Aplikasi Baru Anda**: Berpindahlah ke Home Screen iPhone Anda, temukan ikon aplikasi **Harris Gubeng WO** yang baru ditambahkan, lalu buka aplikasi tersebut.
5. **Aktifkan Lonceng Permisi**:
   - Di sudut kanan atas aplikasi, ketuk tombol **Bel Lonceng 🔔**.
   - Ketika iPhone Anda menampilkan pop-up meminta izin: **"Apakah Anda mengizinkan notifikasi?"**, pilih **Izinkan (Allow)**.
6. **Selesai!** Sekarang, silakan coba tambahkan tugas pekerjaan dari browser laptop/komputer lain, dan saksikan notifikasi push cantik langsung meluncur di layar iPhone Anda secara instan layaknya aplikasi App Store asli!
