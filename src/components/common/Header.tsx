import React, { useState } from 'react';
import {
  LogOut,
  Database,
  Wifi,
  WifiOff,
  ShieldCheck,
  PackageCheck,
  ArrowLeftRight,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { UserRole } from '../../types/greenhouse';
import { AromaFlowersLogo } from './AromaFlowersLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { DataManagementModal } from './DataManagementModal';

export const Header: React.FC = () => {
  const {
    currentUser,
    activeRole,
    setActiveRole,
    setActiveView,
    canAccessRole,
    logout,
    isOnline,
    demoDataCleared,
  } = useGreenhouse();

  const [showDataModal, setShowDataModal] = useState(false);

  const handleSwitchRole = (role: UserRole) => {
    if (!canAccessRole(role)) return;
    setActiveRole(role);
    if (role === 'admin') {
      setActiveView('admin_panel');
    } else if (role === 'produccion') {
      setActiveView('produccion_dia');
    } else if (role === 'aroma_flowers') {
      setActiveView('fi_general');
    } else {
      setActiveView('principal');
    }
  };

  const handleHomeLogoClick = () => {
    if (activeRole === 'admin') {
      setActiveView('admin_panel');
    } else if (activeRole === 'produccion') {
      setActiveView('produccion_dia');
    } else if (activeRole === 'aroma_flowers') {
      setActiveView('fi_general');
    } else {
      setActiveView('principal');
    }
  };

  const userInitials = (currentUser?.fullName || 'AF')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Brand Logo & System Name - Clean Unencapsulated Presentation */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleHomeLogoClick}
              className="flex items-center gap-2.5 hover:opacity-95 transition text-left group cursor-pointer"
              title="Aroma Flower - Inicio del Rol Actual"
            >
              <AromaFlowersLogo size="md" className="group-hover:scale-105 transition-transform" />
              <div className="flex flex-col">
                <span className="font-extrabold text-[#000000] text-base sm:text-lg tracking-tight leading-none">
                  Aroma <span className="text-[#5C1125]">Flower</span>
                </span>
                <span className="text-[10px] font-bold tracking-wider text-[#535B28] uppercase mt-0.5">
                  Invernadero Florícola
                </span>
              </div>
            </button>
          </div>

          {/* Right Action Section */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Quick Role Switcher for Admin (Admin | Producción) */}
            {currentUser?.role === 'admin' && (
              <div className="hidden md:flex items-center bg-[#FAF8F5] p-1 rounded-xl border border-stone-200 gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchRole('admin')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    activeRole === 'admin'
                      ? 'bg-[#5C1125] text-white shadow-xs'
                      : 'text-stone-600 hover:text-[#5C1125]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole('produccion')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    activeRole === 'produccion'
                      ? 'bg-[#535B28] text-white shadow-xs'
                      : 'text-stone-600 hover:text-[#535B28]'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Producción</span>
                </button>
              </div>
            )}

            {/* Online / Offline status */}
            <div
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                isOnline
                  ? 'text-[#535B28] bg-[#f7f8f2] border border-[#dce4bf]'
                  : 'text-white bg-[#5C1125] border border-[#3f0918] animate-pulse'
              }`}
              title={isOnline ? 'Conexión activa' : 'Modo Offline (Los registros se guardan localmente)'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-[#535B28]" /> : <WifiOff className="w-3.5 h-3.5 text-[#C3A25D]" />}
              <span className="hidden xl:inline">{isOnline ? 'En Línea' : 'Offline'}</span>
            </div>

            {/* Data Management / Database Trigger (Admin only) */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setShowDataModal(true)}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                  demoDataCleared
                    ? 'border-[#C3A25D]/60 bg-[#fcfaf4] text-[#5C1125] hover:bg-[#f7f0df]'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
                title="Base de Datos Supabase y Respaldos"
              >
                <Database className="w-3.5 h-3.5 text-[#5C1125]" />
                <span className="hidden sm:inline">Datos & DB</span>
                {!demoDataCleared && (
                  <span className="w-2 h-2 rounded-full bg-[#C3A25D] absolute -top-0.5 -right-0.5 animate-pulse" />
                )}
              </button>
            )}

            {/* Quick PWA Install Button */}
            <PWAInstallButton compact />

            {/* Profile / User Avatar Button (Opens Mi Perfil module inside active role) */}
            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveView('mi_perfil')}
                className="flex items-center gap-2 px-2 py-1 rounded-xl border transition cursor-pointer bg-[#fbf2f4] border-[#ebccd4] text-[#5C1125] hover:bg-[#f5e4e8]"
                title="Ir a Mi Perfil (datos personales y fotografía)"
              >
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    className="w-6 h-6 rounded-full object-cover border border-[#C3A25D]"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#5C1125] text-[#C3A25D] flex items-center justify-center text-[10px] font-extrabold border border-[#C3A25D]/60">
                    {userInitials}
                  </span>
                )}
                <span className="hidden sm:inline max-w-[115px] truncate text-xs font-bold">
                  {currentUser.username}
                </span>
              </button>
            )}

            {/* Switch Role selector button */}
            <button
              type="button"
              onClick={() => setActiveRole(null)}
              title="Cambiar de Rol"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#535B28] bg-[#f7f8f2] hover:bg-[#ecf0dc] border border-[#dce4bf] active:scale-95 transition cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Roles</span>
            </button>

            {/* Full Logout Button */}
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión de usuario"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-[#5C1125] bg-stone-100 hover:bg-[#fbf2f4] border border-stone-200 hover:border-[#ebccd4] active:scale-95 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Modal for Data Management */}
      <DataManagementModal
        isOpen={showDataModal}
        onClose={() => setShowDataModal(false)}
      />
    </>
  );
};

