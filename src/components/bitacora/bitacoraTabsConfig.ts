import type React from 'react';
import { Sprout, SprayCan, Droplets, SearchCheck } from 'lucide-react';
import { BitacoraCategory } from '../../types/greenhouse';

export interface BitacoraTabDefinition {
  id: BitacoraCategory;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
  plannedColumns?: string[];
  relatedAdminView?: {
    viewId: string;
    buttonLabel: string;
  };
}

/**
 * Registro modular de pestañas del módulo Bitácora.
 * Para agregar nuevas categorías a futuro (ej. "Cosecha", "Clima", "Mantenimiento"),
 * basta con añadir un nuevo objeto en este arreglo y asociar su vista en BitacoraView.
 */
export const BITACORA_TABS: BitacoraTabDefinition[] = [
  {
    id: 'labores_culturales',
    label: 'Labores culturales',
    shortLabel: 'Labores',
    description:
      'Registro diario de corte, deshierbe, poda y manejo por módulo con control de personal y avance.',
    icon: Sprout,
    ready: true,
  },
  {
    id: 'aplicaciones_foliares',
    label: 'Aplicaciones foliares',
    shortLabel: 'Foliares',
    description:
      'Plantilla preparada para registrar aplicaciones foliares, dosis, producto y responsable por módulo.',
    icon: SprayCan,
    ready: false,
    plannedColumns: ['Fecha', 'Módulo', 'Producto / Mezcla', 'Dosis', 'Responsable', 'Status'],
    relatedAdminView: {
      viewId: 'admin_insumos',
      buttonLabel: 'Ir a Hojas de Aplicaciones en Insumos',
    },
  },
  {
    id: 'riego',
    label: 'Riego',
    shortLabel: 'Riego',
    description:
      'Plantilla preparada para controlar turnos de riego, lámina/volumen, pH, CE y drenaje diario.',
    icon: Droplets,
    ready: false,
    plannedColumns: ['Fecha', 'Módulo', 'Turno / Duración', 'pH / CE', 'Volumen', 'Status'],
  },
  {
    id: 'monitoreo',
    label: 'Monitoreo',
    shortLabel: 'Monitoreo',
    description:
      'Plantilla preparada para seguimiento diario de plagas, enfermedades, incidencia y observaciones de campo.',
    icon: SearchCheck,
    ready: false,
    plannedColumns: ['Fecha', 'Módulo', 'Plaga / Enfermedad', 'Nivel / Incidencia', 'Acción', 'Status'],
  },
];
