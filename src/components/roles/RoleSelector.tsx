import React from 'react';
import {
  Building2,
  Settings,
  Sprout,
  Flower2,
  TrendingUp,
  Tablet,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
} from 'lucide-react';
import { ROLES, UserRole } from '../../types/greenhouse';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { PWAHomeInstallBanner } from '../common/PWAInstallButton';

const ROLE_ICON_MAP: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  aroma_flowers: PackageCheck,
  director: Building2,
  operaciones: Settings,
  agronomo: Sprout,
  cosecha: Flower2,
  ventas: TrendingUp,
  sistema: Tablet,
};

export const RoleSelector: React.FC = () => {
  const { setActiveRole, setActiveView } = useGreenhouse();
  const activeRoles = ROLES.filter((role) => role.enabled !== false);

  const handleSelectRole = (roleId: UserRole) => {
    const targetRole = ROLES.find((r) => r.id === roleId);
    if (!targetRole || targetRole.enabled === false) return;
    setActiveRole(roleId);
    if (roleId === 'aroma_flowers') {
      setActiveView('fi_general');
    } else {
      setActiveView('principal');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF8F5] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 select-none">
      <div className="w-full max-w-5xl flex flex-col items-center">
        {/*
          LOGO OFICIAL AROMA FLOWER EN EL HOME ARRIBA DE LOS ROLES.
          Completamente sin encapsular (sin marco blanco, sin tarjeta, sin caja cuadrada).
        */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <img
            src="https://daloocomercializadora.com.mx/aromaflowerlogo.png"
            alt="Aroma Flower"
            className="h-28 sm:h-36 md:h-44 w-auto object-contain transition-transform duration-300 hover:scale-103 drop-shadow-xs"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/aromaflowerlogo.png';
            }}
          />
          <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#000000]">
            Aroma <span className="text-[#5C1125]">Flower</span>
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-px w-6 sm:w-10 bg-[#C3A25D]/60" />
            <span className="text-[11px] sm:text-xs font-bold tracking-widest text-[#535B28] uppercase">
              Sistema Integral de Gestión de Invernadero
            </span>
            <span className="h-px w-6 sm:w-10 bg-[#C3A25D]/60" />
          </div>
          <p className="mt-2 text-xs sm:text-sm text-stone-600 max-w-md">
            Accede al módulo operativo de Aroma Flowers para capturar y consultar registros.
          </p>
        </div>

        {/* PWA Direct Installation Banner for Mobile & Desktop */}
        <PWAHomeInstallBanner />

        {/*
          Solo roles activos visibles (actualmente Aroma Flowers).
          Tarjetas limpias con paleta: #5C1125 (vino), #535B28 (olivo), #C3A25D (oro), #000000 (negro).
        */}
        <div
          className={`w-full grid gap-3.5 sm:gap-5 ${
            activeRoles.length === 1
              ? 'max-w-sm mx-auto grid-cols-1'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3'
          }`}
        >
          {activeRoles.map((role) => {
            const Icon = ROLE_ICON_MAP[role.id] || Building2;
            return (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role.id)}
                className="group relative flex flex-col items-center justify-between text-center p-6 sm:p-8 rounded-2xl bg-white border border-stone-200 shadow-xs hover:shadow-xl hover:border-[#5C1125] active:scale-98 transition-all duration-200 min-h-[200px] sm:min-h-[230px] cursor-pointer overflow-hidden"
              >
                {/* Subtle gold accent indicator on top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#C3A25D]/40 group-hover:bg-[#C3A25D] transition-colors" />

                {/* Role Icon - Clean unencapsulated vector */}
                <div className="mt-2 w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-[#5C1125] group-hover:text-[#C3A25D] group-hover:scale-110 transition-all duration-300">
                  <Icon className="w-11 h-11 sm:w-12 sm:h-12 stroke-[1.8]" />
                </div>

                {/* Role Info */}
                <div className="w-full my-auto">
                  <span className="inline-block text-[10px] sm:text-[11px] font-semibold text-[#535B28] uppercase tracking-wider mb-1">
                    {role.badge}
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-[#000000] group-hover:text-[#5C1125] transition-colors leading-snug px-1 line-clamp-2">
                    {role.title}
                  </h2>
                </div>

                {/* Bottom enter indicator */}
                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#5C1125] group-hover:text-[#C3A25D] transition-colors">
                  <span>Acceder al Módulo</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Security & footer notice */}
        <div className="mt-8 text-center text-[11px] text-stone-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#535B28]" />
          <span>Aroma Flower &bull; Datos cifrados y sincronización en tiempo real</span>
        </div>
      </div>
    </div>
  );
};

