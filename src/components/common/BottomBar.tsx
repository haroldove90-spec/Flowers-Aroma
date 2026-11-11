import React from 'react';
import {
  LayoutDashboard,
  GitBranch,
  Wallet,
  TrendingUp,
  Building2,
  Users,
  Boxes,
  Sprout,
  Droplet,
  ShieldAlert,
  Flower2,
  Sparkles,
  Tablet,
  CreditCard,
  FileSpreadsheet,
  AlertOctagon,
  ThermometerSnowflake,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';

export const BottomBar: React.FC = () => {
  const { activeRole, activeView, setActiveView } = useGreenhouse();

  // Bottom navigation items according to current role
  const getBottomItems = () => {
    switch (activeRole) {
      case 'aroma_flowers':
        return [
          { id: 'fi_general', label: 'FI-General', icon: FileSpreadsheet },
          { id: 'produccion_aaron', label: 'Aarón', icon: Boxes },
          { id: 'suma_paquetes', label: 'Paquetes', icon: Sparkles },
          { id: 'resumen_variedades', label: 'Variedades', icon: Flower2 },
          { id: 'venta', label: 'Venta', icon: TrendingUp },
        ];
      case 'director':
        return [
          { id: 'principal', label: 'KPIs', icon: LayoutDashboard },
          { id: 'finanzas', label: 'Tesorería', icon: Wallet },
          { id: 'costos', label: 'Costos', icon: TrendingUp },
          { id: 'deudas', label: 'Créditos', icon: CreditCard },
          { id: 'workflow', label: 'Flujo', icon: GitBranch },
        ];
      case 'operaciones':
        return [
          { id: 'principal', label: 'Módulos', icon: Building2 },
          { id: 'personal', label: 'Personal', icon: Users },
          { id: 'almacen', label: 'Almacén', icon: Boxes },
          { id: 'activos', label: 'Activos', icon: Building2 },
          { id: 'workflow', label: 'Flujo', icon: GitBranch },
        ];
      case 'agronomo':
        return [
          { id: 'principal', label: 'Labores', icon: Sprout },
          { id: 'riego', label: 'Riego/CE', icon: Droplet },
          { id: 'sanidad', label: 'Sanidad', icon: ShieldAlert },
          { id: 'workflow', label: 'Flujo', icon: GitBranch },
        ];
      case 'cosecha':
        return [
          { id: 'principal', label: 'Corte', icon: Flower2 },
          { id: 'clasificacion', label: 'Empaque', icon: Boxes },
          { id: 'merma', label: 'Merma', icon: AlertOctagon },
          { id: 'camara', label: 'Cámara', icon: ThermometerSnowflake },
          { id: 'workflow', label: 'Flujo', icon: GitBranch },
        ];
      case 'ventas':
        return [
          { id: 'principal', label: 'Pedidos', icon: TrendingUp },
          { id: 'clientes', label: 'Clientes', icon: Users },
          { id: 'cobranza', label: 'Cobranza', icon: Wallet },
          { id: 'workflow', label: 'Flujo', icon: GitBranch },
        ];
      case 'sistema':
        return [
          { id: 'principal', label: 'Campo', icon: Tablet },
          { id: 'offline', label: 'Offline', icon: GitBranch },
          { id: 'auditoria', label: 'Auditoría', icon: LayoutDashboard },
          { id: 'workflow', label: 'Flujo', icon: GitBranch },
        ];
      default:
        return [
          { id: 'principal', label: 'Inicio', icon: LayoutDashboard },
          { id: 'workflow', label: 'Flujo', icon: GitBranch },
        ];
    }
  };

  const items = getBottomItems();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#5C1125] border-t border-[#3f0918] px-1.5 py-1.5 shadow-2xl flex items-center justify-around safe-bottom">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all duration-150 min-w-[55px] cursor-pointer ${
              isActive
                ? 'bg-[#3f0918] text-[#C3A25D] font-bold ring-1 ring-[#C3A25D]/70 scale-105 shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-[#4a0d1d]/60'
            }`}
          >
            <Icon className={`w-5 h-5 stroke-[2.2px] ${isActive ? 'text-[#C3A25D]' : 'text-stone-200'}`} />
            <span className={`text-[10px] mt-1 tracking-tight font-medium leading-tight truncate ${isActive ? 'text-[#C3A25D]' : 'text-stone-300'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
