import { CroquisUnitId } from '../types/greenhouse';

export interface CroquisVarietyZone {
  startAisle: number;
  endAisle: number;
  variety: string;
  lengthMeters: number;
}

export interface CroquisSectionSpec {
  id: 'A' | 'B';
  label: string;
  totalAisles: number;
  zones: CroquisVarietyZone[];
}

export interface CroquisModuleSpec {
  moduleNumber: number;
  label: string;
  fullModuleName: string;
  dimensionsNote?: string;
  leftCorridorLabel?: string;
  centerCorridorLabel?: string;
  rightCorridorLabel?: string;
  /** Orden visual izquierda -> derecha tal como viene en el croquis PDF */
  sectionsOrder: Array<'A' | 'B'>;
  sections: Record<'A' | 'B', CroquisSectionSpec>;
}

export interface CroquisUnitSpec {
  id: CroquisUnitId;
  name: string;
  shortName: string;
  subtitle: string;
  /** Santa Cruz coloca Módulo 1 y Módulo 2 lado a lado; Saúl y Tlapizaco apilan sus módulos verticalmente */
  layout: 'side_by_side' | 'stacked';
  modules: CroquisModuleSpec[];
}

export const ORIGINAL_CROQUIS_PDF_PATH =
  '/assets/aistudio/croquis_unidades_produccion_39674430.pdf';

/**
 * Distribución fiel a los 3 croquis esquemáticos oficiales de Aroma Flower:
 * - Página 1: Unidad de producción Santa Cruz (Módulo 1 y Módulo 2)
 * - Página 2: Unidad de producción Saúl (Módulo 1 y Módulo 2)
 * - Página 3: Unidad de producción Tlapizaco (Módulo 1, Módulo 2 y Módulo 3)
 */
export const CROQUIS_UNITS: CroquisUnitSpec[] = [
  {
    id: 'santa_cruz',
    name: 'Unidad de Producción Santa Cruz',
    shortName: 'Santa Cruz',
    subtitle: '2 módulos · Secciones A y B · 33 a 39 pasillos por sección',
    layout: 'side_by_side',
    modules: [
      {
        moduleNumber: 1,
        label: 'Módulo 1',
        fullModuleName: 'Santa Cruz Módulo 1',
        sectionsOrder: ['A', 'B'],
        sections: {
          A: {
            id: 'A',
            label: 'Sección A',
            totalAisles: 33,
            zones: [
              { startAisle: 1, endAisle: 4, variety: 'Proud', lengthMeters: 42.25 },
              { startAisle: 5, endAisle: 6, variety: 'Hermosa', lengthMeters: 42.25 },
              { startAisle: 7, endAisle: 33, variety: 'Freedom', lengthMeters: 42.25 },
            ],
          },
          B: {
            id: 'B',
            label: 'Sección B',
            totalAisles: 39,
            zones: [
              { startAisle: 1, endAisle: 6, variety: 'Mundial', lengthMeters: 42.25 },
              { startAisle: 7, endAisle: 9, variety: 'Cool Water', lengthMeters: 42.25 },
              { startAisle: 10, endAisle: 18, variety: 'Topaz', lengthMeters: 42.25 },
              { startAisle: 19, endAisle: 25, variety: 'Boulevard', lengthMeters: 42.25 },
              { startAisle: 26, endAisle: 26, variety: 'Hermosa', lengthMeters: 42.25 },
              { startAisle: 27, endAisle: 32, variety: 'Homer', lengthMeters: 42.25 },
              { startAisle: 33, endAisle: 39, variety: 'Proud', lengthMeters: 39 },
            ],
          },
        },
      },
      {
        moduleNumber: 2,
        label: 'Módulo 2',
        fullModuleName: 'Santa Cruz Módulo 2',
        sectionsOrder: ['A', 'B'],
        sections: {
          A: {
            id: 'A',
            label: 'Sección A',
            totalAisles: 37,
            zones: [
              { startAisle: 1, endAisle: 20, variety: 'Freedom', lengthMeters: 42.25 },
              { startAisle: 21, endAisle: 28, variety: 'Mundial', lengthMeters: 48.25 },
              { startAisle: 29, endAisle: 32, variety: 'Hermosa', lengthMeters: 48.25 },
              { startAisle: 33, endAisle: 37, variety: 'Deep Purple', lengthMeters: 48.25 },
            ],
          },
          B: {
            id: 'B',
            label: 'Sección B',
            totalAisles: 37,
            zones: [
              { startAisle: 1, endAisle: 20, variety: 'Freedom', lengthMeters: 42.25 },
              { startAisle: 21, endAisle: 28, variety: 'Mundial', lengthMeters: 48.25 },
              { startAisle: 29, endAisle: 35, variety: 'Caricia', lengthMeters: 48.25 },
              { startAisle: 36, endAisle: 37, variety: 'Cool Water', lengthMeters: 48.25 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'saul',
    name: 'Unidad de Producción Saúl',
    shortName: 'Saúl',
    subtitle: '2 módulos · Secciones A y B · 16 y 18 pasillos por sección',
    layout: 'stacked',
    modules: [
      {
        moduleNumber: 1,
        label: 'Módulo 1',
        fullModuleName: 'Saúl Módulo 1',
        dimensionsNote: '4 túneles de 5 × 90 m',
        leftCorridorLabel: '1 m',
        centerCorridorLabel: '1.5 m',
        rightCorridorLabel: '1 m',
        sectionsOrder: ['A', 'B'],
        sections: {
          A: {
            id: 'A',
            label: 'Sección A',
            totalAisles: 16,
            zones: [{ startAisle: 1, endAisle: 16, variety: 'Freedom', lengthMeters: 43.25 }],
          },
          B: {
            id: 'B',
            label: 'Sección B',
            totalAisles: 16,
            zones: [{ startAisle: 1, endAisle: 16, variety: 'Freedom', lengthMeters: 43.25 }],
          },
        },
      },
      {
        moduleNumber: 2,
        label: 'Módulo 2',
        fullModuleName: 'Saúl Módulo 2',
        dimensionsNote: '4 túneles de 5 m y 1 túnel de 3.5 m · largo total 88 m',
        leftCorridorLabel: '1 m',
        centerCorridorLabel: '1.5 m',
        rightCorridorLabel: '1 m',
        sectionsOrder: ['A', 'B'],
        sections: {
          A: {
            id: 'A',
            label: 'Sección A',
            totalAisles: 18,
            zones: [
              { startAisle: 1, endAisle: 5, variety: 'Hermosa', lengthMeters: 42.25 },
              { startAisle: 6, endAisle: 10, variety: 'Mundial', lengthMeters: 42.25 },
              { startAisle: 11, endAisle: 13, variety: 'Topaz', lengthMeters: 42.25 },
              { startAisle: 14, endAisle: 18, variety: 'Homer', lengthMeters: 42.25 },
            ],
          },
          B: {
            id: 'B',
            label: 'Sección B',
            totalAisles: 18,
            zones: [
              { startAisle: 1, endAisle: 4, variety: 'Hermosa', lengthMeters: 42.25 },
              { startAisle: 5, endAisle: 10, variety: 'Proud', lengthMeters: 42.25 },
              { startAisle: 11, endAisle: 13, variety: 'Topaz', lengthMeters: 42.25 },
              { startAisle: 14, endAisle: 18, variety: 'Novia', lengthMeters: 42.25 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'tlapizaco',
    name: 'Unidad de Producción Tlapizaco',
    shortName: 'Tlapizaco',
    subtitle: '3 módulos · Sección B (izq.) y Sección A (der.) · 11 pasillos por sección',
    layout: 'stacked',
    modules: [
      {
        moduleNumber: 1,
        label: 'Módulo 1',
        fullModuleName: 'Tlapizaco Módulo 1',
        dimensionsNote: '3 túneles de 5 × 76 m',
        leftCorridorLabel: '1 m',
        centerCorridorLabel: '1.5 m',
        rightCorridorLabel: '1 m',
        sectionsOrder: ['B', 'A'],
        sections: {
          B: {
            id: 'B',
            label: 'Sección B',
            totalAisles: 11,
            zones: [{ startAisle: 1, endAisle: 11, variety: 'Bee Sweet', lengthMeters: 36.25 }],
          },
          A: {
            id: 'A',
            label: 'Sección A',
            totalAisles: 11,
            zones: [{ startAisle: 1, endAisle: 11, variety: 'Hermosa', lengthMeters: 36.25 }],
          },
        },
      },
      {
        moduleNumber: 2,
        label: 'Módulo 2',
        fullModuleName: 'Tlapizaco Módulo 2',
        dimensionsNote: '3 túneles de 5 × 74 m',
        leftCorridorLabel: '1 m',
        centerCorridorLabel: '1.5 m',
        rightCorridorLabel: '1 m',
        sectionsOrder: ['B', 'A'],
        sections: {
          B: {
            id: 'B',
            label: 'Sección B',
            totalAisles: 11,
            zones: [{ startAisle: 1, endAisle: 11, variety: 'Mandala', lengthMeters: 35.25 }],
          },
          A: {
            id: 'A',
            label: 'Sección A',
            totalAisles: 11,
            zones: [{ startAisle: 1, endAisle: 11, variety: 'Novia', lengthMeters: 35.25 }],
          },
        },
      },
      {
        moduleNumber: 3,
        label: 'Módulo 3',
        fullModuleName: 'Tlapizaco Módulo 3',
        dimensionsNote: '3 túneles de 5 × 72 m',
        leftCorridorLabel: '1 m',
        centerCorridorLabel: '1.5 m',
        rightCorridorLabel: '1 m',
        sectionsOrder: ['B', 'A'],
        sections: {
          B: {
            id: 'B',
            label: 'Sección B',
            totalAisles: 11,
            zones: [{ startAisle: 1, endAisle: 11, variety: 'Caricia', lengthMeters: 34.25 }],
          },
          A: {
            id: 'A',
            label: 'Sección A',
            totalAisles: 11,
            zones: [{ startAisle: 1, endAisle: 11, variety: 'Shimmer', lengthMeters: 34.25 }],
          },
        },
      },
    ],
  },
];

export function getCroquisUnitById(unitId: CroquisUnitId): CroquisUnitSpec {
  return CROQUIS_UNITS.find((u) => u.id === unitId) || CROQUIS_UNITS[0];
}

export function getVarietyZoneForAisle(
  unitId: CroquisUnitId,
  moduleNumber: number,
  sectionId: 'A' | 'B',
  aisleNumber: number
): { variety: string; lengthMeters: number } {
  const unit = getCroquisUnitById(unitId);
  const mod = unit.modules.find((m) => m.moduleNumber === moduleNumber);
  const sec = mod?.sections[sectionId];
  if (!sec) return { variety: 'General', lengthMeters: 42.25 };
  const zone = sec.zones.find(
    (z) => aisleNumber >= z.startAisle && aisleNumber <= z.endAisle
  );
  if (zone) {
    return { variety: zone.variety, lengthMeters: zone.lengthMeters };
  }
  return { variety: 'General', lengthMeters: 42.25 };
}

/**
 * Tintes botánicos muy suaves (baja saturación) para diferenciar visualmente
 * bloques de variedad en el croquis sin perder contraste ni legibilidad.
 */
const VARIETY_TINT_MAP: Record<string, string> = {
  Freedom: '#fdf4f5',
  Mundial: '#f7f8f5',
  Proud: '#f8f6f2',
  Hermosa: '#fcf5f8',
  'Cool Water': '#f6f4fb',
  Topaz: '#fdf6f0',
  Boulevard: '#f5f8f5',
  Homer: '#faf7f0',
  'Deep Purple': '#f6f3f9',
  Caricia: '#fdf4f7',
  Novia: '#faf9f5',
  'Bee Sweet': '#fdf8ef',
  Mandala: '#fcf4f1',
  Shimmer: '#fdf5f3',
};

export function getVarietyZoneFill(variety: string): string {
  return VARIETY_TINT_MAP[variety] || '#FAF8F5';
}

export function describeAislePosition(
  positionPercent: number,
  lengthMeters?: number
): string {
  const pct = Math.max(0, Math.min(100, Math.round(positionPercent)));
  const zoneLabel = pct < 33 ? 'Tramo inicial' : pct > 67 ? 'Tramo final' : 'Tramo central';
  if (lengthMeters && lengthMeters > 0) {
    const m = Math.round(((pct / 100) * lengthMeters) * 10) / 10;
    return `${m} m de ${lengthMeters} m · ${zoneLabel}`;
  }
  return `${pct}% · ${zoneLabel}`;
}
