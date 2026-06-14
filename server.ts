import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const app = express();
const PORT = 3000;

// Setup VAPID keys for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BNxksZRSC9NZMBo2yD8Eq6MIlac9IoVLOwWru3_uG5-AJoUkJJ0qRxGCcTOBVp8fNLYzYnfJjecI089IZBjEea0';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'cJuQ8ysQV8yd2L-1ivbYOnhddoD9_-R9tXXQx-cExS8';
const VAPID_SUBJECT = 'mailto:operator@harrisgubeng.com';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Supabase client config ( Singapore URL )
const SUPABASE_URL = 'https://wqpymfxglapkqaaqjyku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxcHltZnhnbGFwa3FhYXFqeWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTk1MjQsImV4cCI6MjA5NjM5NTUyNH0.uAZK5kMV-_wGGHfWZMzW4-MlzfLwAUnv7Sye_ujQbN4';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middlewares
app.use(express.json());

// CORS settings for ease of calling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, X-Client-Info, Apikey, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Endpoint untuk status health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Endpoint utama untuk mengirim notifikasi push
// Endpoint ini kompatibel dengan database trigger Supabase pg_net ATAU panggilan langsung dari React frontend!
app.post('/api/send-web-push', async (req, res) => {
  try {
    const payload = req.body;
    console.log('[PUSH SERVER] Menerima data notifikasi:', payload);

    if (!payload || !payload.title || !payload.body) {
      return res.status(400).json({ error: 'Title and body are required.' });
    }

    // Ambil semua subscriber dari tabel push_subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('[PUSH SERVER] Gagal mengambil push_subscriptions dari Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[PUSH SERVER] Tidak ada perangkat terdaftar di push_subscriptions.');
      return res.json({ status: 'no_subscribers', message: 'No registered devices found.' });
    }

    console.log(`[PUSH SERVER] Mengirim notifikasi ke ${subscriptions.length} perangkat...`);

    const results = await Promise.all(
      subscriptions.map(async (row) => {
        const pushSubscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.keys_p256dh,
            auth: row.keys_auth
          }
        };

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              tag: payload.tag || 'harris-wo-notification',
              data: payload.data || { url: '/' }
            })
          );
          return { endpoint: row.endpoint, status: 'success' };
        } catch (err: any) {
          console.error(`[PUSH SERVER] Gagal dikirim ke ${row.endpoint}:`, err.message);
          
          // Jika statusnya 410 atau 404, tandanya subscription sudah hangus (expired), hapus dari database
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`[PUSH SERVER] Menghapus subscription kadaluarsa: ${row.endpoint}`);
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', row.id);
          }
          return { endpoint: row.endpoint, status: 'failed', error: err.message };
        }
      })
    );

    return res.json({ status: 'completed', results });
  } catch (err: any) {
    console.error('[PUSH SERVER] Critical error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Inisialisasi Vite Middleware untuk dev mode atau sajikan static build untuk production mode
async function initServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[SERVER] Running in Development Mode utilizing Vite middleware');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[SERVER] Running in Production Mode serving static files from dist/');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Ready & listening on http://0.0.0.0:${PORT}`);
  });
}

initServer();
