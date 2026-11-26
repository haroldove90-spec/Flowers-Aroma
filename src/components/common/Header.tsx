import React, { useState } from 'react';
import {
  LogOut,
  Database,
  Wifi,
  WifiOff,
  ShieldCheck,
  TrendingUp,
  ClipboardList,
  Menu,
  X,
  Store,
  Layers,
  SprayCan,
  Truck,
  Sprout,
  Calculator,
  Wallet,
  CreditCard,
  Building2,
  Users,
  Boxes,
  UserCog,
  PackageCheck,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { UserRole, getUserRoleDisplayInfo } from '../../types/greenhouse';
import { AromaFlowersLogo } from './AromaFlowersLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { DataManagementModal } from './DataManagementModal';

export const Header: React.FC = () => {
  const {
    currentUser,
    activeRole,
    activeView,
    setActiveRole,
    setActiveView,
    canAccessRole,
    canAccessModule,
    hasFullAccess,
    getDefaultAllowedView,
    logout,
    isOnline,
    demoDataCleared,
  } = useGreenhouse();

  const isFullAdmin = hasFullAccess(currentUser);

  const [showDataModal, setShowDataModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleSwitchRole = (role: UserRole) => {
    if (!isFullAdmin || !canAccessRole(role)) return;
    setActiveRole(role);
    if (role === 'admin') {
      setActiveView('admin_panel');
    } else if (role === 'ventas') {
      setActiveView('ventas_operacion');
    } else if (role === 'bitacora') {
      setActiveView('bitacora');
    } else if (role === 'produccion') {
      setActiveView('produccion_dia');
    } else if (role === 'aroma_flowers') {
      setActiveView('fi_general');
    } else {
      setActiveView('principal');
    }
    setShowMobileMenu(false);
  };

  const handleHomeLogoClick = () => {
    if (!isFullAdmin) {
      setActiveView(getDefaultAllowedView(currentUser));
      return;
    }
    if (activeRole === 'admin') {
      setActiveView('admin_panel');
    } else if (activeRole === 'ventas') {
      setActiveView('ventas_operacion');
    } else if (activeRole === 'bitacora') {
      setActiveView('bitacora');
    } else if (activeRole === 'produccion') {
      setActiveView('produccion_dia');
    } else if (activeRole === 'aroma_flowers') {
      setActiveView('fi_general');
    } else {
      setActiveView('principal');
    }
  };

  const getMobileDrawerItems = () => {
    const allMainModules = [
      { id: 'admin_panel', label: 'Panel Admin & Usuarios', icon: ShieldCheck },
      { id: 'pos_caja', label: 'POS (Punto de Venta)', icon: Store },
      { id: 'produccion_dia', label: 'Producción e Inventario', icon: Layers },
      { id: 'bitacora', label: 'Bitácora', icon: ClipboardList },
      { id: 'aplicaciones_foliares', label: 'Aplicaciones Foliares', icon: SprayCan },
      { id: 'ventas_operacion', label: 'Ventas, Remisiones y Cobranza', icon: Truck },
      { id: 'admin_insumos', label: 'Insumos y Aplicaciones', icon: Sprout },
      { id: 'admin_costos', label: 'Control de Costos y Utilidad', icon: Calculator },
      { id: 'admin_pagos', label: 'Nómina y Pagos', icon: Wallet },
      { id: 'admin_incidencias', label: 'Préstamos, Desc. y Comis.', icon: CreditCard },
      { id: 'admin_proveedores', label: 'Proveedores y Ctas. x Pagar', icon: Building2 },
      { id: 'admin_empleados', label: 'Empleados', icon: Users },
      { id: 'admin_productos', label: 'Catálogo de Productos', icon: Boxes },
      { id: 'resumen_ventas', label: 'Resumen Diario (Histórico)', icon: TrendingUp },
      { id: 'mi_perfil', label: 'Mi Perfil', icon: UserCog },
    ];

    if (!isFullAdmin) {
      return allMainModules.filter((item) => canAccessModule(item.id));
    }

    if (activeRole === 'ventas') {
      return [
        { id: 'pos_caja', label: 'POS (Punto de Venta)', icon: Store },
        { id: 'ventas_operacion', label: 'Ventas, Remisiones y Cobranza', icon: Truck },
        { id: 'resumen_ventas', label: 'Resumen Diario (Histórico)', icon: TrendingUp },
        { id: 'produccion_dia', label: 'Producción e Inventario', icon: PackageCheck },
        { id: 'mi_perfil', label: 'Mi Perfil', icon: UserCog },
      ];
    }
    if (activeRole === 'bitacora') {
      return [
        { id: 'bitacora', label: 'Bitácora', icon: ClipboardList },
        { id: 'aplicaciones_foliares', label: 'Aplicaciones Foliares', icon: SprayCan },
        { id: 'mi_perfil', label: 'Mi Perfil', icon: UserCog },
      ];
    }
    return allMainModules;
  };

  const userInitials = (currentUser?.fullName || 'AF')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const mobileDrawerItems = getMobileDrawerItems();

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Left: Mobile Menu Trigger + Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowMobileMenu(true)}
              aria-label="Abrir menú de módulos"
              className="lg:hidden p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#f5e4e8] text-[#5C1125] border border-stone-200 transition cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

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
            {/* Single Role Switcher for Full Admin only (Admin | Ventas | Bitácora) */}
            {isFullAdmin && (
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
                  onClick={() => handleSwitchRole('ventas')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    activeRole === 'ventas'
                      ? 'bg-[#C3A25D] text-[#000000] shadow-xs'
                      : 'text-stone-600 hover:text-[#8a6d2b]'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Ventas</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole('bitacora')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    activeRole === 'bitacora'
                      ? 'bg-[#535B28] text-white shadow-xs'
                      : 'text-stone-600 hover:text-[#535B28]'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Bitácora</span>
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

            {/* Data Management / Database Trigger (Full Admin only) */}
            {isFullAdmin && (
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

            {/* Profile / User Avatar Button */}
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

      {/* Mobile & Tablet Navigation Drawer */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowMobileMenu(false)}
          />
          <aside className="relative z-10 w-72 max-w-[84vw] h-dvh bg-[#000000] text-stone-200 flex flex-col shadow-2xl border-r border-stone-800">
            <div className="h-16 px-4 border-b border-stone-800 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C3A25D]">
                {isFullAdmin
                  ? activeRole === 'admin'
                    ? 'Rol Admin'
                    : activeRole === 'ventas'
                    ? 'Rol Ventas'
                    : 'Rol Bitácora'
                  : getUserRoleDisplayInfo(currentUser).label}
              </span>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                aria-label="Cerrar menú"
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isFullAdmin && (
              <div className="px-3 pt-3 pb-2 border-b border-stone-800">
                <div className="grid grid-cols-3 gap-1 bg-stone-900 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleSwitchRole('admin')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      activeRole === 'admin'
                        ? 'bg-[#5C1125] text-white'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchRole('ventas')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      activeRole === 'ventas'
                        ? 'bg-[#C3A25D] text-[#000000]'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Ventas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchRole('bitacora')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      activeRole === 'bitacora'
                        ? 'bg-[#535B28] text-white'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Bitácora
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {mobileDrawerItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#5C1125] text-white border border-[#C3A25D]/50'
                        : 'text-stone-300 hover:bg-stone-900 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#C3A25D]' : 'text-stone-400'
                      }`}
                    />
                    <span className="truncate text-left">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-stone-800 safe-bottom">
              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-300 hover:bg-[#5C1125]/30 hover:text-white border border-rose-900/30 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Modal for Data Management */}
      <DataManagementModal
        isOpen={showDataModal}
        onClose={() => setShowDataModal(false)}
      />
    </>
  );
};
