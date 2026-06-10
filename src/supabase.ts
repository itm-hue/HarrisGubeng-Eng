import { createClient } from '@supabase/supabase-js';

// KUNCI MATI KONEKSI SUPABASE KE SERVER SINGAPORE ASLI (TIDAK MEMBACA ENV)
const SUPABASE_URL = 'https://wqpymfxglapkqaaqjyku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxcHltZnhnbGFwa3FhYXFqeWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTk1MjQsImV4cCI6MjA5NjM5NTUyNH0.uAZK5kMV-_wGGHfWZMzW4-MlzfLwAUnv7Sye_ujQbN4';

console.log('Gerbang Depan: Inisialisasi Klien Supabase ke URL Singapore:', SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
