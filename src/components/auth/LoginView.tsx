import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, LogIn, ShieldCheck, AlertCircle } from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { PWAHomeInstallBanner } from '../common/PWAInstallButton';

export const LoginView: React.FC = () => {
  const { login } = useGreenhouse();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await login(username, password);
      if (!res.ok) {
        setErrorMsg(res.error || 'No se pudo iniciar sesión.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF8F5] flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Official Unencapsulated Aroma Flower Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="https://daloocomercializadora.com.mx/aromaflowerlogo.png"
            alt="Aroma Flower"
            className="h-28 sm:h-36 w-auto object-contain drop-shadow-xs"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/aromaflowerlogo.png';
            }}
          />
          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#000000]">
            Aroma <span className="text-[#5C1125]">Flower</span>
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-px w-6 bg-[#C3A25D]/70" />
            <span className="text-[11px] font-bold tracking-widest text-[#535B28] uppercase">
              Acceso al Sistema
            </span>
            <span className="h-px w-6 bg-[#C3A25D]/70" />
          </div>
        </div>

        {/* PWA Install Banner */}
        <PWAHomeInstallBanner />

        {/* Login Card */}
        <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden">
          <div className="h-1.5 w-full bg-linear-to-r from-[#5C1125] via-[#C3A25D] to-[#535B28]" />

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-extrabold text-[#000000]">Iniciar Sesión</h2>
              <p className="text-xs text-stone-500 mt-1">
                Ingresa tus credenciales para acceder a Admin, Producción o tu Perfil.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#fbf2f4] border border-[#ebccd4] text-[#5C1125] text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#5C1125] absolute left-3.5 top-3" />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F5] border border-stone-300 rounded-xl text-sm font-semibold text-[#000000] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5C1125] absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-11 py-2.5 bg-[#FAF8F5] border border-stone-300 rounded-xl text-sm font-semibold text-[#000000] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 p-0.5 text-stone-400 hover:text-[#5C1125] cursor-pointer"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-sm font-bold shadow-md transition active:scale-99 disabled:opacity-60 cursor-pointer border border-[#C3A25D]/40"
            >
              <LogIn className="w-4 h-4 text-[#C3A25D]" />
              <span>{isSubmitting ? 'Validando acceso...' : 'Ingresar al Sistema'}</span>
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[11px] text-stone-500">
          <ShieldCheck className="w-4 h-4 text-[#535B28]" />
          <span>Aroma Flower &bull; Control de Acceso por Roles</span>
        </div>
      </div>
    </div>
  );
};
