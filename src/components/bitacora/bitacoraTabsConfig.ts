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
      'Control de aplicaciones generales por unidad de producción, parchoneo por regla de tres y costos sincronizados con compras.',
    icon: SprayCan,
    ready: true,
    relatedAdminView: {
      viewId: 'aplicaciones_foliares',
      buttonLabel: 'Abrir módulo completo de Aplicaciones Foliares',
    },
  },
  {
    id: 'riego',
    label: 'Riego',
    shortLabel: 'Riego',
    description:
      'Registro de aplicaciones por Aspersión, Regadera o Pasillo con objetivo del producto y costo automático de la dosis.',
    icon: Droplets,
    ready: true,
  },
  {
    id: 'monitoreo',
    label: 'Monitoreo',
    shortLabel: 'Monitoreo',
    description:
      'Croquis interactivo de Santa Cruz, Saúl y Tlapizaco para ubicar focos por unidad, módulo, sección, pasillo y variedad con porcentaje de incidencia y acción recomendada.',
    icon: SearchCheck,
    ready: true,
  },
];
