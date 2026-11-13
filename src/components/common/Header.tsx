import React, { useState } from 'react';
import {
  LogOut,
  Database,
  Wifi,
  WifiOff,
  UserCheck,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { ROLES } from '../../types/greenhouse';
import { AromaFlowersLogo } from './AromaFlowersLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { DataManagementModal } from './DataManagementModal';

export const Header: React.FC = () => {
  const {
    activeRole,
    setActiveRole,
    setActiveView,
    isOnline,
    demoDataCleared,
  } = useGreenhouse();

  const [showDataModal, setShowDataModal] = useState(false);

  const currentRoleConfig = ROLES.find((r) => r.id === activeRole);

  const handleLogout = () => {
    setActiveRole(null);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Brand Logo & System Name - Clean Unencapsulated Presentation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView(activeRole === 'aroma_flowers' ? 'fi_general' : 'principal')}
              className="flex items-center gap-2.5 hover:opacity-95 transition text-left group cursor-pointer"
              title="Aroma Flower - Inicio de Módulo"
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
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online / Offline status */}
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                isOnline
                  ? 'text-[#535B28] bg-[#f7f8f2] border border-[#dce4bf]'
                  : 'text-white bg-[#5C1125] border border-[#3f0918] animate-pulse'
              }`}
              title={isOnline ? 'Conexión activa' : 'Modo Offline (Los registros se guardan localmente)'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-[#535B28]" /> : <WifiOff className="w-3.5 h-3.5 text-[#C3A25D]" />}
              <span className="hidden sm:inline">{isOnline ? 'En Línea' : 'Offline'}</span>
            </div>

            {/* Data Management / Database Trigger */}
            <button
              onClick={() => setShowDataModal(true)}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                demoDataCleared
                  ? 'border-[#C3A25D]/60 bg-[#fcfaf4] text-[#5C1125] hover:bg-[#f7f0df]'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
              title="Borrar datos de prueba / Conectar Base de Datos"
            >
              <Database className="w-3.5 h-3.5 text-[#5C1125]" />
              <span className="hidden sm:inline">Datos & DB</span>
              {!demoDataCleared && (
                <span className="w-2 h-2 rounded-full bg-[#C3A25D] absolute -top-0.5 -right-0.5 animate-pulse" />
              )}
            </button>

            {/* Quick PWA Install Button with brand wine/gold */}
            <PWAInstallButton compact />

            {/* Active Role Identifier */}
            {currentRoleConfig && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#fbf2f4] border border-[#ebccd4] rounded-lg text-xs font-bold text-[#5C1125]">
                <UserCheck className="w-3.5 h-3.5 text-[#5C1125] shrink-0" />
                <span className="max-w-[120px] sm:max-w-[180px] truncate">
                  {currentRoleConfig.shortTitle}
                </span>
              </div>
            )}

            {/* Unified Logout Button */}
            <button
              onClick={handleLogout}
              title="Cerrar sesión para seleccionar otro perfil"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#5C1125] bg-stone-100 hover:bg-[#fbf2f4] border border-stone-200 hover:border-[#ebccd4] active:scale-95 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cerrar Sesión</span>
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

