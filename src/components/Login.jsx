import React, { useState } from 'react';
import { pb } from '../pb';
import { LogIn, Key, Mail, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Authenticate with PocketBase as a regular user
      await pb.collection('users').authWithPassword(email, password);
      onLoginSuccess();
    } catch (err) {
      console.error('Login error:', err);
      setError('Giriş başarısız. Lütfen e-posta ve şifrenizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <div className="w-[400px] p-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10">
        <h2 className="font-display font-extrabold text-slate-900 text-3xl text-center mb-1 tracking-tight">MEDEK PRO</h2>
        <p className="text-text-muted text-xs text-center mb-8 font-medium">Akademik Ölçme ve Değerlendirme Sistemi</p>
        
        {error && (
          <div className="bg-danger/10 text-danger p-3.5 rounded-xl text-xs mb-5 flex items-center gap-2 border border-danger/20">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Mail size={12} /> E-posta / Kullanıcı Adı
            </label>
            <input
              id="email"
              type="text"
              required
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Key size={12} /> Şifre
            </label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 mt-2 bg-s hover:bg-p-hover text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-s/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Giriş Yapılıyor...' : (
              <>
                <LogIn size={16} /> Giriş Yap
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
