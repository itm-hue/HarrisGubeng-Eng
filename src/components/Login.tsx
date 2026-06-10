/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { supabase } from '../supabase';
import { ShieldCheck, User as UserIcon, Lock, Hotel } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  inactivityNotice?: string;
  onClearNotice?: () => void;
}

export default function Login({ onLoginSuccess, inactivityNotice, onClearNotice }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onClearNotice) onClearNotice();
    if (!username.trim()) {
      setError('Ketik username Anda.');
      return;
    }
    if (!password.trim()) {
      setError('Masukkan password secure Anda.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Direct query to the real 'users' table in Singapore Supabase using .single()
      const { data: userRow, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.trim().toLowerCase())
        .single();

      if (queryError) {
        // PGRST116 corresponds to '0 rows returned' in PostgREST
        if (queryError.code === 'PGRST116') {
          setError('Username tidak terdaftar di sistem database Harris Gubeng.');
          setLoading(false);
          return;
        }
        throw queryError;
      }

      if (userRow) {
        // Match user credentials against password_text
        const dbPass = (userRow.password_text || '').toString().trim();
        const inputPass = password.trim();

        if (dbPass !== inputPass) {
          setError('Password yang Anda masukkan salah.');
          setLoading(false);
          return;
        }

        // Successfully authenticated
        const loggedUser: User = {
          id: userRow.id,
          username: userRow.username,
          fullname: userRow.nama_lengkap || userRow.fullname || '',
          role: userRow.role === 'Admin' ? 'ADMIN' : (userRow.role === 'Teknisi' ? 'TEKNISI' : (userRow.role ? userRow.role.toUpperCase() : 'TEKNISI')),
          createdAt: userRow.created_at || userRow.createdAt || new Date().toISOString()
        };

        // Complete transition delay
        setTimeout(() => {
          onLoginSuccess(loggedUser);
          setLoading(false);
        }, 600);
      } else {
        setError('Username tidak terdaftar di sistem database Harris Gubeng.');
        setLoading(false);
      }
    } catch (e: any) {
      console.error('Login process error from Singapore Supabase:', e);
      setError('Koneksi terhambat atau tabel tidak ditemukan: ' + (e?.message || e?.details || e?.toString()));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07111e] bg-radial from-[#0f2139] to-[#050c15] p-4 font-sans text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-600/10 via-transparent to-transparent pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl shadow-orange-950/20"
        id="login_card_container"
      >
        {/* Header Branding Panel */}
        <div className="p-8 text-center bg-gradient-to-b from-slate-900 to-slate-950/80 relative border-b border-slate-800">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-orange-500 rounded-full" />
          
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-orange-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Hotel className="w-7 h-7 text-white" id="hotel_icon" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1 font-sans">
            HARRIS <span className="text-orange-500">GUBENG</span>
          </h2>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">
            Task Management Systems
          </p>
        </div>

        {/* Content Form Body */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5" id="login_form">
            {inactivityNotice && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300 flex items-start gap-2.5 relative"
                id="login_inactivity_banner"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 animate-ping" />
                <span className="pr-6">{inactivityNotice}</span>
                <button
                  type="button"
                  onClick={onClearNotice}
                  className="absolute top-2.5 right-2.5 text-amber-400/60 hover:text-amber-300 p-0.5 rounded cursor-pointer"
                  title="Tutup pesan"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-300 flex items-start gap-2.5"
                id="login_error_banner"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 uppercase tracking-wider block">
                Username Teknisi / Admin
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ketik username terdaftar"
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/10 text-white rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all placeholder:text-slate-600"
                  id="username_input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 uppercase tracking-wider block">
                Password Aplikasi
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password secure"
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/10 text-white rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all placeholder:text-slate-600 shadow-inner"
                  id="password_input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 px-4 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-600/10"
              id="submit_login_button"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
