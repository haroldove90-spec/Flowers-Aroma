import {
  FoliarDoseUnit,
  FoliarProductPresentation,
  SupplyItem,
  SupplyPurchase,
} from '../types/greenhouse';

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;
export const round4 = (n: number): number => Math.round((Number(n) || 0) * 10000) / 10000;

export function normalizeFoliarUnit(raw?: string): FoliarDoseUnit {
  const lower = (raw || '').trim().toLowerCase();
  if (lower === 'l' || lower === 'lt' || lower === 'lts' || lower === 'litro' || lower === 'litros') {
    return 'L';
  }
  if (lower === 'kg' || lower === 'kgs' || lower === 'kilo' || lower === 'kilos') {
    return 'kg';
  }
  if (lower === 'g' || lower === 'gr' || lower === 'grs' || lower === 'gramo' || lower === 'gramos') {
    return 'g';
  }
  return 'ml';
}

export function inferPresentation(item: Pick<SupplyItem, 'presentation' | 'unit'>): FoliarProductPresentation {
  if (item.presentation === 'polvo' || item.presentation === 'liquido') {
    return item.presentation;
  }
  const u = normalizeFoliarUnit(item.unit);
  return u === 'kg' || u === 'g' ? 'polvo' : 'liquido';
}

/**
 * Obtiene el costo unitario vigente de un producto agroquímico, priorizando
 * el catálogo (que Compras actualiza automáticamente) o la compra más reciente en Compras.
 */
export function resolveEffectivePurchaseCost(
  item: SupplyItem,
  purchases: SupplyPurchase[]
): { unitCost: number; unit: FoliarDoseUnit; fromPurchaseDate?: string } {
  const catalogUnit = normalizeFoliarUnit(item.unit);
  const matchingPurchases = purchases
    .filter(
      (p) =>
        (p.supplyItemId && p.supplyItemId === item.id) ||
        p.supplyName.trim().toLowerCase() === item.name.trim().toLowerCase()
    )
    .sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));

  const latest = matchingPurchases[0];
  if (Number(item.unitCost || 0) > 0) {
    return {
      unitCost: Number(item.unitCost),
      unit: catalogUnit,
      fromPurchaseDate: latest?.purchaseDate,
    };
  }
  if (latest && Number(latest.unitCost || 0) > 0) {
    return {
      unitCost: Number(latest.unitCost),
      unit: normalizeFoliarUnit(latest.unit || item.unit),
      fromPurchaseDate: latest.purchaseDate,
    };
  }
  return { unitCost: 0, unit: catalogUnit };
}

/**
 * Devuelve el costo convertido a la unidad mínima (ml para líquido, g para polvo)
 * para mostrar referencia clara al usuario (ej. "$2.00 / ml" o "$0.50 / g").
 */
export function getMinimumUnitCost(
  unitCost: number,
  storedUnit: FoliarDoseUnit,
  presentation?: FoliarProductPresentation
): { costPerMinUnit: number; minUnit: 'ml' | 'g' } {
  const isPowder = presentation === 'polvo' || storedUnit === 'kg' || storedUnit === 'g';
  const minUnit: 'ml' | 'g' = isPowder ? 'g' : 'ml';
  const cleanCost = Math.max(0, Number(unitCost || 0));

  if (storedUnit === 'L' || storedUnit === 'kg') {
    return { costPerMinUnit: round4(cleanCost / 1000), minUnit };
  }
  return { costPerMinUnit: round4(cleanCost), minUnit };
}

/**
 * Convierte una dosis capturada (dose + doseUnit) a la unidad almacenada del producto (storedUnit).
 * Ejemplos:
 * - 1.25 kg -> 1250 g (cuando el producto está en g)
 * - 100 ml -> 0.1 L (cuando el producto está en L)
 * - 250 g -> 0.25 kg (cuando el producto está en kg)
 */
export function convertDoseToStoredUnit(
  dose: number,
  doseUnit: FoliarDoseUnit,
  storedUnit: FoliarDoseUnit
): number {
  const qty = Math.max(0, Number(dose || 0));
  if (qty === 0) return 0;

  // Normalizar ambos a escala mínima (ml o g; 1 ml ≈ 1 g si se cruzan por captura manual)
  const doseInMin = doseUnit === 'L' || doseUnit === 'kg' ? qty * 1000 : qty;
  if (storedUnit === 'L' || storedUnit === 'kg') {
    return doseInMin / 1000;
  }
  return doseInMin;
}

/**
 * Calcula el costo en MXN de una dosis específica usando el costo unitario del producto.
 */
export function calculateDoseCost(
  dose: number,
  doseUnit: FoliarDoseUnit,
  item: SupplyItem | undefined,
  purchases: SupplyPurchase[]
): { cost: number; costPerDoseUnit: number; conversionNote?: string } {
  if (!item || !dose || dose <= 0) {
    return { cost: 0, costPerDoseUnit: 0 };
  }
  const { unitCost, unit: storedUnit } = resolveEffectivePurchaseCost(item, purchases);
  if (unitCost <= 0) {
    return { cost: 0, costPerDoseUnit: 0 };
  }

  const convertedQty = convertDoseToStoredUnit(dose, doseUnit, storedUnit);
  const cost = round2(convertedQty * unitCost);
  const unitFactor = convertDoseToStoredUnit(1, doseUnit, storedUnit);
  const costPerDoseUnit = round4(unitFactor * unitCost);

  let conversionNote: string | undefined;
  if (doseUnit === 'kg' && dose > 0) {
    const grams = Math.round(dose * 1000);
    conversionNote = `${grams.toLocaleString('es-MX')} g`;
  } else if (doseUnit === 'L' && dose > 0 && storedUnit === 'ml') {
    const ml = Math.round(dose * 1000);
    conversionNote = `${ml.toLocaleString('es-MX')} ml`;
  } else if (doseUnit !== storedUnit) {
    conversionNote = `${round4(convertedQty)} ${storedUnit}`;
  }

  return { cost, costPerDoseUnit, conversionNote };
}

/**
 * Calculadora de Regla de Tres para Parchoneo:
 * Dosis real = (Volumen de agua utilizado * Cantidad base) / Litros base
 */
export function calculateParchoneoRuleOfThree(params: {
  waterLiters: number;
  baseDoseAmount: number;
  baseWaterLiters: number;
  baseDoseUnit: FoliarDoseUnit;
  product: SupplyItem | undefined;
  purchases: SupplyPurchase[];
}): {
  calculatedDose: number;
  calculatedCost: number;
  costPerDoseUnit: number;
} {
  const water = Math.max(0, Number(params.waterLiters || 0));
  const baseDose = Math.max(0, Number(params.baseDoseAmount || 0));
  const baseWater = Math.max(0, Number(params.baseWaterLiters || 0));

  if (water <= 0 || baseDose <= 0 || baseWater <= 0) {
    return { calculatedDose: 0, calculatedCost: 0, costPerDoseUnit: 0 };
  }

  const calculatedDose = round4((water * baseDose) / baseWater);
  const { cost, costPerDoseUnit } = calculateDoseCost(
    calculatedDose,
    params.baseDoseUnit,
    params.product,
    params.purchases
  );

  return {
    calculatedDose,
    calculatedCost: cost,
    costPerDoseUnit,
  };
}

export function formatMoneyMXN(amount: number): string {
  return `$${(Number(amount) || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getTodayLocalISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Estima el costo de la dosis de referencia escrita en el catálogo
 * (ej. "50 ml por 200L" o "250 g por 200L"). Si no incluye cantidad,
 * devuelve null para mostrar el costo por unidad mínima.
 */
export function calculateReferenceDoseCost(
  item: SupplyItem,
  purchases: SupplyPurchase[]
): { doseLabel: string; cost: number } | null {
  const raw = (item.recommendedDose || '').trim();
  if (!raw) return null;
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|lt|lts|g|gr|grs|kg|kgs)\b/i);
  if (!match) return null;
  const qty = parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = normalizeFoliarUnit(match[2]);
  const { cost } = calculateDoseCost(qty, unit, item, purchases);
  return {
    doseLabel: `${qty} ${unit}`,
    cost,
  };
}

/**
 * Extrae dosis recomendada y litros de agua base desde el texto del catálogo
 * (ej. "50 ml / 200 L", "250 g por 200L", "1.5 ml / L").
 */
export function parseRecommendedDoseFromText(
  raw?: string
): { amount: number; unit: FoliarDoseUnit; waterLiters: number } | null {
  const text = (raw || '').trim();
  if (!text) return null;
  const doseMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|lt|lts|g|gr|grs|kg|kgs)\b/i);
  if (!doseMatch) return null;
  const amount = parseFloat(doseMatch[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = normalizeFoliarUnit(doseMatch[2]);

  // Buscar volumen base (ej. "/ 200 L", "por 200L", "en 100 litros", "/ L")
  const afterDose = text.slice((doseMatch.index || 0) + doseMatch[0].length);
  const waterNumMatch = afterDose.match(/(?:\/|por|en|cada)\s*(\d+(?:[.,]\d+)?)\s*(?:l|lt|lts|litro|litros)\b/i);
  let waterLiters = 200;
  if (waterNumMatch) {
    const parsedWater = parseFloat(waterNumMatch[1].replace(',', '.'));
    if (Number.isFinite(parsedWater) && parsedWater > 0) {
      waterLiters = parsedWater;
    }
  } else if (/(?:\/|por|en|cada)\s*(?:l|lt|litro)\b/i.test(afterDose)) {
    waterLiters = 1;
  }

  return { amount, unit, waterLiters };
}

/**
 * Calcula la cantidad exacta de producto a utilizar en Aplicación General
 * a partir de la dosis recomendada, el agua base y el volumen total de la unidad,
 * devolviendo también una equivalencia amigable (ej. 1,250 ml = 1.25 L).
 */
export function calculateGeneralAutoDose(params: {
  recommendedDose: number;
  recommendedWaterLiters: number;
  targetWaterLiters: number;
  unit: FoliarDoseUnit;
}): { calculatedDose: number; equivalentLabel?: string } {
  const rec = Math.max(0, Number(params.recommendedDose || 0));
  const baseWater = Math.max(0, Number(params.recommendedWaterLiters || 0));
  const targetWater = Math.max(0, Number(params.targetWaterLiters || 0));

  if (rec <= 0 || baseWater <= 0 || targetWater <= 0) {
    return { calculatedDose: 0 };
  }

  const calculatedDose = round2((rec * targetWater) / baseWater);
  let equivalentLabel: string | undefined;

  if (params.unit === 'ml' && calculatedDose >= 1000) {
    equivalentLabel = `${round2(calculatedDose / 1000)} L`;
  } else if (params.unit === 'g' && calculatedDose >= 1000) {
    equivalentLabel = `${round2(calculatedDose / 1000)} kg`;
  } else if (params.unit === 'L' && calculatedDose > 0 && calculatedDose < 1) {
    equivalentLabel = `${Math.round(calculatedDose * 1000).toLocaleString('es-MX')} ml`;
  } else if (params.unit === 'kg' && calculatedDose > 0 && calculatedDose < 1) {
    equivalentLabel = `${Math.round(calculatedDose * 1000).toLocaleString('es-MX')} g`;
  }

  return { calculatedDose, equivalentLabel };
}

/**
 * Normaliza nombres históricos mal escritos ("Lapisaco" / "Tlapisaco") a "Tlapizaco".
 */
export function normalizeTlapizacoName(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/\bTlapisaco\b/gi, 'Tlapizaco')
    .replace(/\bLapisaco\b/gi, 'Tlapizaco');
}


