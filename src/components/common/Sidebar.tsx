import React, { useState } from 'react';
import {
  LayoutDashboard,
  GitBranch,
  Building2,
  Settings,
  Sprout,
  Flower2,
  TrendingUp,
  Tablet,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Droplet,
  ShieldAlert,
  Boxes,
  Users,
  Wallet,
  Sparkles,
  CreditCard,
  FileSpreadsheet,
  AlertOctagon,
  Scale,
  Calendar,
  Layers,
  ThermometerSnowflake,
  Package,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';

export const Sidebar: React.FC = () => {
  const {
    activeRole,
    setActiveRole,
    activeView,
    setActiveView,
  } = useGreenhouse();

  const [collapsed, setCollapsed] = useState(false);

  // Return all comprehensive modules for the active role
  const getRoleSpecificMenuItems = () => {
    switch (activeRole) {
      case 'aroma_flowers':
        return [
          { id: 'fi_general', label: '1. FI-General', icon: FileSpreadsheet },
          { id: 'produccion_aaron', label: '2. Producción Aarón', icon: Boxes },
          { id: 'suma_paquetes', label: '3. Suma de Paquetes', icon: Package },
          { id: 'resumen_variedades', label: '4. Resumen Variedades', icon: Layers },
          { id: 'venta', label: '5. Venta Diaria', icon: TrendingUp },
          { id: 'resumen_venta', label: '6. Resumen de Venta', icon: Scale },
          { id: 'matriz_2026', label: '7. Matriz Anual 2026', icon: Sparkles },
        ];
      case 'director':
        return [
          { id: 'principal', label: 'Panel Dirección (KPIs)', icon: LayoutDashboard },
          { id: 'finanzas', label: 'Tesorería & Cuentas', icon: Wallet },
          { id: 'costos', label: 'Costos & Rentabilidad', icon: TrendingUp },
          { id: 'deudas', label: 'Préstamos & Créditos', icon: CreditCard },
          { id: 'reportes', label: 'Reportes & Auditoría', icon: FileSpreadsheet },
        ];
      case 'operaciones':
        return [
          { id: 'principal', label: 'Módulos de Producción', icon: Building2 },
          { id: 'personal', label: 'Personal & Nómina', icon: Users },
          { id: 'almacen', label: 'Compras & Almacén', icon: Boxes },
          { id: 'activos', label: 'Activos & Mantenimiento', icon: Settings },
        ];
      case 'agronomo':
        return [
          { id: 'principal', label: 'Labores Culturales', icon: Sprout },
          { id: 'riego', label: 'Riego & Fertirrigación', icon: Droplet },
          { id: 'sanidad', label: 'Sanidad & Monitoreo', icon: ShieldAlert },
        ];
      case 'cosecha':
        return [
          { id: 'principal', label: 'Corte Diario de Tallos', icon: Flower2 },
          { id: 'clasificacion', label: 'Clasificación & Empaque (x25)', icon: Boxes },
          { id: 'merma', label: 'Control de Merma & Descarte', icon: AlertOctagon },
          { id: 'camara', label: 'Cámara Fría & Trazabilidad', icon: ThermometerSnowflake },
        ];
      case 'ventas':
        return [
          { id: 'principal', label: 'Pedidos & Facturación', icon: TrendingUp },
          { id: 'clientes', label: 'Clientes & Canales', icon: Users },
          { id: 'cobranza', label: 'Cobranza & Cartera', icon: Wallet },
          { id: 'temporadas', label: 'Temporadas Especiales', icon: Calendar },
        ];
      case 'sistema':
        return [
          { id: 'principal', label: 'Consola Táctil Campo', icon: Tablet },
          { id: 'offline', label: 'Sincronización Offline', icon: GitBranch },
          { id: 'auditoria', label: 'Auditoría & Usuarios (RBAC)', icon: Settings },
          { id: 'sensores', label: 'Sensores IoT & Básculas', icon: Scale },
        ];
      default:
        return [{ id: 'principal', label: 'Inicio', icon: LayoutDashboard }];
    }
  };

  const menuItems = getRoleSpecificMenuItems();

  return (
    <aside
      className={`hidden lg:flex flex-col bg-[#000000] text-stone-300 border-r border-stone-800 transition-all duration-300 select-none ${
        collapsed ? 'w-20' : 'w-64'
      } shrink-0`}
    >
      {/* Sidebar Header toggle */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-stone-800">
        {!collapsed && (
          <span className="text-xs font-bold uppercase tracking-wider text-[#C3A25D]">
            Módulos del Rol
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-900 transition ml-auto cursor-pointer"
          title={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5 text-[#C3A25D]" /> : <ChevronLeft className="w-5 h-5 text-[#C3A25D]" />}
        </button>
      </div>

      {/* Role specific links */}
      <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#535B28] px-3 py-1">
          {!collapsed && 'Navegación'}
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#5C1125] text-white shadow-md shadow-black/50 border border-[#C3A25D]/50'
                  : 'text-stone-300 hover:bg-stone-900 hover:text-white'
              }`}
              title={item.label}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#C3A25D]' : 'text-stone-400'}`} />
              {!collapsed && <span className="truncate text-left">{item.label}</span>}
            </button>
          );
        })}

        {/* Global Workflow Pipeline link */}
        <div className="pt-4 border-t border-stone-800 mt-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#535B28] px-3 py-1">
            {!collapsed && 'Flujo Operativo'}
          </div>
          <button
            onClick={() => setActiveView('workflow')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeView === 'workflow'
                ? 'bg-[#5C1125] text-white shadow-md shadow-black/50 border border-[#C3A25D]/50'
                : 'text-stone-300 hover:bg-stone-900 hover:text-white'
            }`}
            title="Flujo de Trabajo Integral"
          >
            <GitBranch className={`w-5 h-5 shrink-0 ${activeView === 'workflow' ? 'text-[#C3A25D]' : 'text-[#C3A25D]/80'}`} />
            {!collapsed && <span className="truncate text-left">Flujo Integral (6 Etapas)</span>}
          </button>
        </div>

        {/* Note for the user about session separation */}
        {!collapsed && (
          <div className="pt-6 mt-4 border-t border-stone-800/80 px-3">
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Para cambiar de rol, cierra la sesión actual desde el botón inferior o cabecera.
            </p>
          </div>
        )}
      </div>

      {/* Sidebar Footer: Logout button */}
      <div className="p-3 border-t border-stone-800 bg-[#000000]">
        <button
          onClick={() => setActiveRole(null)}
          className="w-full flex items-center justify-center sm:justify-start gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-300 hover:bg-[#5C1125]/30 hover:text-white transition border border-rose-900/30 cursor-pointer"
          title="Cerrar sesión para cambiar de perfil"
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
};
