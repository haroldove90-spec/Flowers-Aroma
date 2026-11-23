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
  ShieldCheck,
  UserCog,
  PackageCheck,
  ArrowLeftRight,
  Truck,
  Calculator,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { UserRole } from '../../types/greenhouse';

const AROMA_MODULE_ITEMS = [
  { id: 'fi_general', label: '1. FI-General', icon: FileSpreadsheet },
  { id: 'produccion_aaron', label: '2. Producción Aarón', icon: Boxes },
  { id: 'suma_paquetes', label: '3. Suma de Paquetes', icon: Package },
  { id: 'resumen_variedades', label: '4. Resumen Variedades', icon: Layers },
  { id: 'venta', label: '5. Venta Diaria', icon: TrendingUp },
  { id: 'resumen_venta', label: '6. Resumen de Venta', icon: Scale },
  { id: 'matriz_2026', label: '7. Matriz Anual 2026', icon: Sparkles },
];

export const Sidebar: React.FC = () => {
  const {
    currentUser,
    activeRole,
    setActiveRole,
    activeView,
    setActiveView,
    canAccessRole,
    logout,
  } = useGreenhouse();

  const [collapsed, setCollapsed] = useState(false);

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

  // Return all comprehensive modules for the active role
  const getRoleSpecificMenuItems = () => {
    switch (activeRole) {
      case 'admin':
        return [
          { id: 'admin_panel', label: 'Panel Admin & Usuarios', icon: ShieldCheck },
          { id: 'produccion_dia', label: 'Producción e Inventario', icon: Layers },
          { id: 'ventas_operacion', label: 'Ventas, Remisiones y Cobranza', icon: Truck },
          { id: 'admin_insumos', label: 'Insumos y Aplicaciones', icon: Sprout },
          { id: 'admin_costos', label: 'Control de Costos y Utilidad', icon: Calculator },
          { id: 'admin_pagos', label: 'Pagos, Nómina y Préstamos', icon: Wallet },
          { id: 'admin_empleados', label: 'Empleados', icon: Users },
          { id: 'admin_productos', label: 'Catálogo de Productos', icon: Boxes },
          { id: 'resumen_ventas', label: 'Resumen Diario (Histórico)', icon: TrendingUp },
          { id: 'mi_perfil', label: 'Mi Perfil', icon: UserCog },
        ];
      case 'produccion':
        return [
          { id: 'produccion_dia', label: 'Producción e Inventario', icon: PackageCheck },
          { id: 'ventas_operacion', label: 'Ventas y Remisiones (Tablet)', icon: Truck },
          { id: 'mi_perfil', label: 'Mi Perfil', icon: UserCog },
        ];
      case 'aroma_flowers':
        return AROMA_MODULE_ITEMS;
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
            {activeRole === 'admin' ? 'Rol Admin' : 'Rol Producción'}
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
          {!collapsed && 'Módulos Activos'}
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

        {/* Quick Role Switch Section for Admin accounts */}
        {currentUser?.role === 'admin' && (
          <div className="pt-4 border-t border-stone-800 mt-4 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#535B28] px-3 py-1">
              {!collapsed && 'Cambio Rápido de Rol'}
            </div>

            {activeRole !== 'admin' && (
              <button
                type="button"
                onClick={() => handleSwitchRole('admin')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-stone-300 hover:bg-stone-900 hover:text-white transition cursor-pointer"
                title="Ir a Rol Admin"
              >
                <ShieldCheck className="w-5 h-5 shrink-0 text-[#C3A25D]" />
                {!collapsed && <span className="truncate text-left">Cambiar a Admin</span>}
              </button>
            )}

            {activeRole !== 'produccion' && (
              <button
                type="button"
                onClick={() => handleSwitchRole('produccion')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-stone-300 hover:bg-stone-900 hover:text-white transition cursor-pointer"
                title="Ir a Rol Producción"
              >
                <PackageCheck className="w-5 h-5 shrink-0 text-[#535B28]" />
                {!collapsed && <span className="truncate text-left">Cambiar a Producción</span>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer: Switch Role & Logout buttons */}
      <div className="p-3 border-t border-stone-800 bg-[#000000] space-y-2">
        <button
          type="button"
          onClick={() => setActiveRole(null)}
          className="w-full flex items-center justify-center sm:justify-start gap-3 px-3 py-2 rounded-xl text-xs font-bold text-[#C3A25D] hover:bg-stone-900 hover:text-white transition border border-stone-800 cursor-pointer"
          title="Volver al selector de roles"
        >
          <ArrowLeftRight className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Cambiar de Rol</span>}
        </button>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center sm:justify-start gap-3 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:bg-[#5C1125]/30 hover:text-white transition border border-rose-900/30 cursor-pointer"
          title="Cerrar sesión de usuario"
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
};
