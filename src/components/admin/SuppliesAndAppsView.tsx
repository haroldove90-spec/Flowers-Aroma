import React, { useMemo, useState } from 'react';
import {
  Sprout,
  Package,
  ShoppingCart,
  Droplets,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Info,
  Search,
  AlertTriangle,
  Copy,
  MessageCircle,
  Plus,
  X,
  RotateCcw,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  GreenhouseApplication,
  GreenhouseApplicationItem,
  GreenhouseApplicationType,
  SupplyArea,
  SupplyItem,
} from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
  exportSingleApplicationSheetPdf,
  exportSuppliesAndAppsExcel,
  exportSuppliesAndAppsPdf,
} from '../../utils/exportReports';

const parseDec = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const AREAS: Array<{ id: SupplyArea; label: string; badgeClass: string }> = [
  { id: 'invernadero', label: 'Invernadero (Fitosanitarios / Fert.)', badgeClass: 'bg-[#f7f8f2] text-[#535B28] border-[#dce4bf]' },
  { id: 'empaque', label: 'Empaque (Capuchones / Cajas / Ligas)', badgeClass: 'bg-amber-50 text-amber-900 border-amber-200' },
  { id: 'comida_trabajadores', label: 'Comida / Despensa Trabajadores', badgeClass: 'bg-sky-50 text-sky-900 border-sky-200' },
  { id: 'otros', label: 'Otros / Mantenimiento', badgeClass: 'bg-stone-100 text-stone-700 border-stone-200' },
];

const AREA_SHORT_LABEL: Record<SupplyArea, string> = {
  invernadero: 'Invernadero',
  empaque: 'Empaque',
  comida_trabajadores: 'Comida / Despensa',
  otros: 'Otros',
};

const APP_TYPES: Array<{ id: GreenhouseApplicationType; label: string; short: string }> = [
  { id: 'foliar', label: 'Aplicación Foliar (Fumigación)', short: 'Foliar' },
  { id: 'fertilizacion', label: 'Nutrición / Fertirriego', short: 'Nutrición' },
  { id: 'drench', label: 'Aplicación al Suelo (Drench)', short: 'Drench' },
  { id: 'otro', label: 'Otra Aplicación', short: 'Otra' },
];

// Estructura real de Unidades y Módulos del negocio
const PRODUCTION_UNITS: Array<{ name: string; modules: string[] }> = [
  { name: 'Santa Cruz', modules: ['Módulo 1', 'Módulo 2', 'Módulos 1 y 2 (Ambos)'] },
  { name: 'Saúl', modules: ['Módulo 1', 'Módulo 2', 'Módulos 1 y 2 (Ambos)'] },
  { name: 'Tlapizaco', modules: ['Módulo 1', 'Módulo 2', 'Módulo 3', 'Módulos 1, 2 y 3 (Todos)'] },
];

const DOSE_UNITS = ['ml', 'L', 'g', 'kg', 'pza', 'paq'] as const;

interface DraftAppRow {
  rowKey: string;
  supplyItemId: string; // '' = vacía, '__custom__' = captura libre
  customProductName: string;
  qtyStr: string;
  doseUnit: string;
  objective: string;
  costStr: string;
  manualCost: boolean;
}

const createEmptyAppRow = (index: number): DraftAppRow => ({
  rowKey: `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
  supplyItemId: '',
  customProductName: '',
  qtyStr: '',
  doseUnit: 'ml',
  objective: '',
  costStr: '',
  manualCost: false,
});

const createInitial8Rows = (): DraftAppRow[] =>
  Array.from({ length: 8 }, (_, idx) => createEmptyAppRow(idx));

/** Convierte una dosis capturada (ej. 250 ml) a la unidad de inventario del insumo (ej. L -> 0.25) */
const convertDoseToStockUnit = (qty: number, doseUnit: string, stockUnit?: string): number => {
  if (!qty || qty <= 0) return 0;
  const from = (doseUnit || '').trim().toLowerCase();
  const to = (stockUnit || '').trim().toLowerCase();
  if (!to || from === to) return Number(qty.toFixed(4));
  if (from === 'ml' && (to === 'l' || to === 'lt' || to === 'litro' || to === 'litros')) {
    return Number((qty / 1000).toFixed(4));
  }
  if ((from === 'l' || from === 'lt') && to === 'ml') {
    return Number((qty * 1000).toFixed(4));
  }
  if ((from === 'g' || from === 'gr') && (to === 'kg' || to === 'kilo' || to === 'kilos')) {
    return Number((qty / 1000).toFixed(4));
  }
  if (from === 'kg' && (to === 'g' || to === 'gr')) {
    return Number((qty * 1000).toFixed(4));
  }
  return Number(qty.toFixed(4));
};

const getDefaultDoseUnitForSupply = (stockUnit?: string): string => {
  const u = (stockUnit || '').trim().toLowerCase();
  if (u === 'l' || u === 'lt') return 'ml';
  if (u === 'kg') return 'kg';
  if (u === 'g' || u === 'gr') return 'g';
  if (u === 'pza') return 'pza';
  if (u === 'paq') return 'paq';
  return 'ml';
};

export const SuppliesAndAppsView: React.FC = () => {
  const {
    supplyItems,
    saveSupplyItem,
    deleteSupplyItem,
    supplyPurchases,
    addSupplyPurchase,
    deleteSupplyPurchase,
    greenhouseApplications,
    addGreenhouseApplication,
    deleteGreenhouseApplication,
    payrollEmployees,
  } = useGreenhouse();

  const today = new Date().toISOString().slice(0, 10);

  const [subTab, setSubTab] = useState<'inventario' | 'compras' | 'aplicaciones'>('inventario');
  const [areaFilter, setAreaFilter] = useState<SupplyArea | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---------- TAB 1: SUPPLY ITEM FORM ----------
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemArea, setItemArea] = useState<SupplyArea>('invernadero');
  const [itemCategory, setItemCategory] = useState('Fungicida');
  const [itemUnit, setItemUnit] = useState('L');
  const [itemPurpose, setItemPurpose] = useState('');
  const [itemDose, setItemDose] = useState('');
  const [itemStockStr, setItemStockStr] = useState('');
  const [itemMinStockStr, setItemMinStockStr] = useState('2');
  const [itemUnitCostStr, setItemUnitCostStr] = useState('');
  const [itemSupplier, setItemSupplier] = useState('');
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);

  // ---------- TAB 2: SUPPLY PURCHASE FORM ----------
  const [purDate, setPurDate] = useState(today);
  const [purSupplyId, setPurSupplyId] = useState(supplyItems[0]?.id || '');
  const [purSupplier, setPurSupplier] = useState('');
  const [purQtyStr, setPurQtyStr] = useState('');
  const [purUnitCostStr, setPurUnitCostStr] = useState('');
  const [purInvoiceRef, setPurInvoiceRef] = useState('');
  const [purNotes, setPurNotes] = useState('');
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [confirmDeletePurchaseId, setConfirmDeletePurchaseId] = useState<string | null>(null);

  // ---------- TAB 3: HOJA DE APLICACIÓN FOLIAR Y NUTRICIÓN (UNIDAD / MÓDULO / 1..8 PRODUCTOS) ----------
  const greenhouseSupplies = useMemo(
    () => supplyItems.filter((s) => s.area === 'invernadero' && s.active !== false),
    [supplyItems]
  );
  const availableAppSupplies = useMemo(
    () => (greenhouseSupplies.length > 0 ? greenhouseSupplies : supplyItems),
    [greenhouseSupplies, supplyItems]
  );

  const [appDate, setAppDate] = useState(today);
  const [appUnit, setAppUnit] = useState<string>(PRODUCTION_UNITS[0].name);
  const [appCustomUnit, setAppCustomUnit] = useState('');
  const [appModule, setAppModule] = useState<string>(PRODUCTION_UNITS[0].modules[0]);
  const [appCustomModule, setAppCustomModule] = useState('');
  const [appType, setAppType] = useState<GreenhouseApplicationType>('foliar');
  const [appDrumsStr, setAppDrumsStr] = useState('1');
  const [appApplicator, setAppApplicator] = useState(payrollEmployees[0]?.fullName || 'ING ANA');
  const [appNotes, setAppNotes] = useState('');
  const [appRows, setAppRows] = useState<DraftAppRow[]>(() => createInitial8Rows());
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [confirmDeleteAppId, setConfirmDeleteAppId] = useState<string | null>(null);

  // Filtros de Bitácora de Aplicaciones
  const [filterUnit, setFilterUnit] = useState<string>('todas');
  const [filterModule, setFilterModule] = useState<string>('todos');
  const [filterType, setFilterType] = useState<GreenhouseApplicationType | 'todos'>('todos');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  const availableModulesForSelectedUnit = useMemo(() => {
    const found = PRODUCTION_UNITS.find((u) => u.name === appUnit);
    return found ? found.modules : [];
  }, [appUnit]);

  const availableModulesForFilterUnit = useMemo(() => {
    if (filterUnit === 'todas') return [];
    const found = PRODUCTION_UNITS.find((u) => u.name === filterUnit);
    return found ? found.modules : [];
  }, [filterUnit]);

  const draftSheetTotalCost = useMemo(() => {
    return round2(
      appRows.reduce((acc, r) => {
        if (!r.supplyItemId) return acc;
        return acc + parseDec(r.costStr);
      }, 0)
    );
  }, [appRows]);

  const activeDraftRowsCount = useMemo(
    () =>
      appRows.filter(
        (r) =>
          (r.supplyItemId && r.supplyItemId !== '__custom__') ||
          (r.supplyItemId === '__custom__' && r.customProductName.trim().length > 0)
      ).length,
    [appRows]
  );

  const filteredApplications = useMemo(() => {
    return greenhouseApplications.filter((app) => {
      const uName = app.unitName || app.greenhouseName || '';
      const mName = app.moduleName || '';
      if (filterUnit !== 'todas' && uName !== filterUnit) return false;
      if (filterModule !== 'todos' && mName !== filterModule) return false;
      if (filterType !== 'todos' && app.applicationType !== filterType) return false;
      if (filterFromDate && app.applicationDate < filterFromDate) return false;
      if (filterToDate && app.applicationDate > filterToDate) return false;
      return true;
    });
  }, [greenhouseApplications, filterUnit, filterModule, filterType, filterFromDate, filterToDate]);

  const unitCostSummary = useMemo(() => {
    return PRODUCTION_UNITS.map((unit) => {
      const unitApps = greenhouseApplications.filter(
        (a) => (a.unitName || '').toLowerCase() === unit.name.toLowerCase()
      );
      const foliarCost = round2(
        unitApps
          .filter((a) => a.applicationType === 'foliar')
          .reduce((acc, a) => acc + Number(a.totalCost || 0), 0)
      );
      const nutritionCost = round2(
        unitApps
          .filter((a) => a.applicationType === 'fertilizacion')
          .reduce((acc, a) => acc + Number(a.totalCost || 0), 0)
      );
      const totalCost = round2(
        unitApps.reduce((acc, a) => acc + Number(a.totalCost || 0), 0)
      );
      const byModule = unit.modules.slice(0, -1).map((mod) => {
        const modApps = unitApps.filter((a) => a.moduleName === mod);
        return {
          moduleName: mod,
          count: modApps.length,
          cost: round2(modApps.reduce((acc, a) => acc + Number(a.totalCost || 0), 0)),
        };
      });
      return {
        unitName: unit.name,
        count: unitApps.length,
        foliarCost,
        nutritionCost,
        totalCost,
        byModule,
      };
    });
  }, [greenhouseApplications]);

  const selectedPurchaseSupply = useMemo(
    () => supplyItems.find((s) => s.id === purSupplyId),
    [supplyItems, purSupplyId]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return supplyItems.filter((item) => {
      if (areaFilter !== 'todos' && item.area !== areaFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.purpose.toLowerCase().includes(q) ||
        (item.supplier || '').toLowerCase().includes(q)
      );
    });
  }, [supplyItems, areaFilter, searchQuery]);

  const kpis = useMemo(() => {
    const invValue = supplyItems.reduce(
      (acc, i) => acc + round2(Number(i.stock || 0) * Number(i.unitCost || 0)),
      0
    );
    const lowStockCount = supplyItems.filter((i) => Number(i.stock || 0) <= Number(i.minStock || 0)).length;
    const totalPurchasesCost = supplyPurchases.reduce((acc, p) => acc + Number(p.totalCost || 0), 0);
    const totalAppsCost = greenhouseApplications.reduce((acc, a) => acc + Number(a.totalCost || 0), 0);
    const byArea: Record<SupplyArea, number> = {
      invernadero: 0,
      empaque: 0,
      comida_trabajadores: 0,
      otros: 0,
    };
    supplyPurchases.forEach((p) => {
      byArea[p.area] = round2((byArea[p.area] || 0) + Number(p.totalCost || 0));
    });
    return { invValue, lowStockCount, totalPurchasesCost, totalAppsCost, byArea };
  }, [supplyItems, supplyPurchases, greenhouseApplications]);

  const notifyOk = (msg: string) => {
    setErrorMsg(null);
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4500);
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemName('');
    setItemArea('invernadero');
    setItemCategory('Fungicida');
    setItemUnit('L');
    setItemPurpose('');
    setItemDose('');
    setItemStockStr('');
    setItemMinStockStr('2');
    setItemUnitCostStr('');
    setItemSupplier('');
  };

  const loadItemEdit = (item: SupplyItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemArea(item.area);
    setItemCategory(item.category);
    setItemUnit(item.unit);
    setItemPurpose(item.purpose);
    setItemDose(item.recommendedDose || '');
    setItemStockStr(String(item.stock));
    setItemMinStockStr(String(item.minStock));
    setItemUnitCostStr(String(item.unitCost));
    setItemSupplier(item.supplier || '');
    setSubTab('inventario');
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setErrorMsg('Escribe el nombre del insumo o fertilizante.');
      return;
    }
    if (!itemPurpose.trim()) {
      setErrorMsg('Describe "¿Para qué sirve?" el producto para referencia en aplicaciones.');
      return;
    }
    setIsSavingItem(true);
    const res = await saveSupplyItem(
      {
        name: itemName.trim(),
        area: itemArea,
        category: itemCategory.trim() || 'General',
        unit: itemUnit.trim() || 'pza',
        purpose: itemPurpose.trim(),
        recommendedDose: itemDose.trim() || undefined,
        stock: parseDec(itemStockStr),
        minStock: parseDec(itemMinStockStr),
        unitCost: parseDec(itemUnitCostStr),
        supplier: itemSupplier.trim() || undefined,
        active: true,
      },
      editingItemId || undefined
    );
    setIsSavingItem(false);
    notifyOk(
      res.cloudSynced
        ? `Insumo "${res.entry?.name || itemName.trim()}" guardado y sincronizado con Supabase.`
        : `Insumo "${res.entry?.name || itemName.trim()}" guardado localmente.`
    );
    resetItemForm();
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSupply = supplyItems.find((s) => s.id === purSupplyId);
    if (!targetSupply) {
      setErrorMsg('Selecciona un insumo del inventario primero.');
      return;
    }
    const qty = parseDec(purQtyStr);
    const unitCost = parseDec(purUnitCostStr) || targetSupply.unitCost;
    if (qty <= 0) {
      setErrorMsg('Ingresa una cantidad mayor a cero.');
      return;
    }
    setIsSavingPurchase(true);
    const res = await addSupplyPurchase({
      purchaseDate: purDate,
      supplyItemId: targetSupply.id,
      supplyName: targetSupply.name,
      area: targetSupply.area,
      supplierName: purSupplier.trim() || targetSupply.supplier || 'Proveedor General',
      quantity: qty,
      unit: targetSupply.unit,
      unitCost,
      totalCost: round2(qty * unitCost),
      invoiceRef: purInvoiceRef.trim() || undefined,
      notes: purNotes.trim() || undefined,
    });
    setIsSavingPurchase(false);
    setPurQtyStr('');
    setPurInvoiceRef('');
    setPurNotes('');
    notifyOk(
      res.cloudSynced
        ? `Compra registrada (+${qty} ${targetSupply.unit} de ${targetSupply.name}). Inventario actualizado en Supabase.`
        : `Compra registrada localmente (+${qty} ${targetSupply.unit}).`
    );
  };

  const handleSelectUnitChange = (nextUnit: string) => {
    setAppUnit(nextUnit);
    const found = PRODUCTION_UNITS.find((u) => u.name === nextUnit);
    if (found && found.modules.length > 0) {
      setAppModule(found.modules[0]);
    } else {
      setAppModule('');
    }
  };

  const updateAppRow = (rowKey: string, updater: (row: DraftAppRow) => DraftAppRow) => {
    setAppRows((prev) => prev.map((r) => (r.rowKey === rowKey ? updater(r) : r)));
  };

  const handleRowSupplyChange = (rowKey: string, nextSupplyId: string) => {
    const found = supplyItems.find((s) => s.id === nextSupplyId);
    updateAppRow(rowKey, (row) => {
      if (!nextSupplyId) {
        return {
          ...row,
          supplyItemId: '',
          customProductName: '',
          qtyStr: '',
          objective: '',
          costStr: '',
          manualCost: false,
        };
      }
      if (nextSupplyId === '__custom__') {
        return {
          ...row,
          supplyItemId: '__custom__',
          doseUnit: row.doseUnit || 'ml',
          manualCost: true,
        };
      }
      const defaultUnit = getDefaultDoseUnitForSupply(found?.unit);
      const qtyNum = parseDec(row.qtyStr);
      const stockQty = convertDoseToStockUnit(qtyNum, defaultUnit, found?.unit);
      const autoCost = found ? round2(stockQty * Number(found.unitCost || 0)) : 0;
      return {
        ...row,
        supplyItemId: nextSupplyId,
        customProductName: '',
        doseUnit: defaultUnit,
        objective: found?.purpose || row.objective,
        costStr: qtyNum > 0 ? String(autoCost) : row.costStr,
        manualCost: false,
      };
    });
  };

  const handleRowQtyOrUnitChange = (rowKey: string, nextQtyStr: string, nextDoseUnit: string) => {
    updateAppRow(rowKey, (row) => {
      const found =
        row.supplyItemId && row.supplyItemId !== '__custom__'
          ? supplyItems.find((s) => s.id === row.supplyItemId)
          : undefined;
      if (found && !row.manualCost) {
        const qtyNum = parseDec(nextQtyStr);
        const stockQty = convertDoseToStockUnit(qtyNum, nextDoseUnit, found.unit);
        const autoCost = round2(stockQty * Number(found.unitCost || 0));
        return {
          ...row,
          qtyStr: nextQtyStr,
          doseUnit: nextDoseUnit,
          costStr: qtyNum > 0 ? String(autoCost) : '',
        };
      }
      return {
        ...row,
        qtyStr: nextQtyStr,
        doseUnit: nextDoseUnit,
      };
    });
  };

  const handleDuplicateApplication = (app: GreenhouseApplication) => {
    const sourceItems =
      app.items && app.items.length > 0
        ? app.items
        : [
            {
              lineNo: 1,
              supplyItemId: app.supplyItemId,
              productName: app.supplyName,
              dose: app.doseUsed || `${app.quantityUsed} ${app.unit}`,
              quantityUsed: app.quantityUsed,
              doseUnit: app.unit,
              stockDeductedQty: app.quantityUsed,
              objective: app.supplyPurpose,
              unitCost: app.unitCost || 0,
              cost: app.totalCost,
            },
          ];

    const matchedUnit = PRODUCTION_UNITS.find((u) => u.name === app.unitName);
    if (matchedUnit) {
      setAppUnit(matchedUnit.name);
      setAppCustomUnit('');
      setAppModule(app.moduleName || matchedUnit.modules[0]);
      setAppCustomModule('');
    } else if (app.unitName) {
      setAppUnit('__otra__');
      setAppCustomUnit(app.unitName);
      setAppCustomModule(app.moduleName || '');
    }

    setAppDate(today);
    setAppType(app.applicationType);
    setAppDrumsStr(String(app.drums200L ?? 1));
    setAppApplicator(app.applicatorName || '');
    setAppNotes(app.notes || '');

    const minRows = Math.max(8, sourceItems.length);
    const clonedRows: DraftAppRow[] = Array.from({ length: minRows }, (_, idx) => {
      const it = sourceItems[idx];
      if (!it) return createEmptyAppRow(idx);
      const existsInStock = Boolean(it.supplyItemId && supplyItems.some((s) => s.id === it.supplyItemId));
      return {
        rowKey: `dup-${Date.now()}-${idx}`,
        supplyItemId: existsInStock ? String(it.supplyItemId) : '__custom__',
        customProductName: existsInStock ? '' : it.productName,
        qtyStr: it.quantityUsed ? String(it.quantityUsed) : '',
        doseUnit: it.doseUnit || 'ml',
        objective: it.objective || '',
        costStr: it.cost ? String(it.cost) : '',
        manualCost: !existsInStock,
      };
    });
    setAppRows(clonedRows);
    notifyOk(`Mezcla de ${app.folio || app.greenhouseName} cargada en la hoja. Cambia Unidad/Módulo/Fecha y guarda.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buildApplicationWhatsAppText = (app: GreenhouseApplication): string => {
    const typeLabel =
      app.applicationType === 'fertilizacion'
        ? 'NUTRICIÓN / FERTIRRIEGO'
        : app.applicationType === 'foliar'
        ? 'APLICACIÓN FOLIAR'
        : app.applicationType.toUpperCase();
    const items =
      app.items && app.items.length > 0
        ? app.items
        : [
            {
              lineNo: 1,
              productName: app.supplyName,
              dose: app.doseUsed || `${app.quantityUsed} ${app.unit}`,
              objective: app.supplyPurpose,
              cost: app.totalCost,
            },
          ];
    const lines = items.map(
      (it, idx) =>
        `${idx + 1}. *${it.productName}* — Dosis: ${it.dose} | Objetivo: ${it.objective || 'General'} | Costo: ${fmtMoney(it.cost)}`
    );
    return [
      `*AROMA FLOWER — HOJA DE ${typeLabel}*`,
      `Folio: ${app.folio || app.id}`,
      `Unidad: *${app.unitName || app.greenhouseName}*`,
      `Módulo: *${app.moduleName || 'General'}*`,
      `Fecha: *${app.applicationDate}*`,
      app.drums200L ? `Tambos 200L: ${app.drums200L}` : '',
      `Aplicador: ${app.applicatorName || 'Operador'}`,
      '',
      '*PRODUCTOS / MEZCLA:*',
      ...lines,
      '',
      `*Costo total: ${fmtMoney(app.totalCost)}*`,
      app.notes ? `Observaciones: ${app.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleSaveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUnit = appUnit === '__otra__' ? appCustomUnit.trim() : appUnit;
    const finalModule =
      appUnit === '__otra__'
        ? appCustomModule.trim() || 'Módulo 1'
        : appModule === '__otro_mod__'
        ? appCustomModule.trim()
        : appModule;

    if (!finalUnit) {
      setErrorMsg('Selecciona o escribe la UNIDAD (Santa Cruz, Saúl, Tlapizaco u otra).');
      return;
    }
    if (!finalModule) {
      setErrorMsg('Selecciona o escribe el MÓDULO donde se realizó la aplicación.');
      return;
    }

    const builtItems: GreenhouseApplicationItem[] = [];
    for (const row of appRows) {
      if (!row.supplyItemId) continue;
      const isCustom = row.supplyItemId === '__custom__';
      const linked = !isCustom ? supplyItems.find((s) => s.id === row.supplyItemId) : undefined;
      const prodName = isCustom ? row.customProductName.trim() : linked?.name || '';
      if (!prodName) continue;

      const qtyNum = parseDec(row.qtyStr);
      const stockDeductedQty = linked
        ? convertDoseToStockUnit(qtyNum, row.doseUnit, linked.unit)
        : qtyNum;
      const lineCost =
        row.costStr.trim() !== ''
          ? round2(parseDec(row.costStr))
          : linked
          ? round2(stockDeductedQty * Number(linked.unitCost || 0))
          : 0;

      builtItems.push({
        lineNo: builtItems.length + 1,
        supplyItemId: linked?.id || '',
        productName: prodName,
        dose: qtyNum > 0 ? `${qtyNum} ${row.doseUnit}` : row.doseUnit || 'Según etiqueta',
        quantityUsed: qtyNum,
        doseUnit: row.doseUnit || linked?.unit || 'L',
        stockDeductedQty,
        objective: row.objective.trim() || linked?.purpose || 'Aplicación operativa',
        unitCost: Number(linked?.unitCost || 0),
        cost: lineCost,
      });
    }

    if (builtItems.length === 0) {
      setErrorMsg('Captura al menos 1 producto en la tabla de la hoja de aplicación.');
      return;
    }

    const totalCost = round2(builtItems.reduce((acc, it) => acc + Number(it.cost || 0), 0));
    const ghDisplay = `${finalUnit} — ${finalModule}`;

    setIsSavingApp(true);
    const res = await addGreenhouseApplication({
      applicationDate: appDate,
      unitName: finalUnit,
      moduleName: finalModule,
      greenhouseName: ghDisplay,
      applicationType: appType,
      items: builtItems,
      supplyItemId: builtItems[0].supplyItemId || '',
      supplyName:
        builtItems.length === 1
          ? builtItems[0].productName
          : `${builtItems[0].productName} + ${builtItems.length - 1} más`,
      supplyPurpose: builtItems.map((i) => i.objective).filter(Boolean).slice(0, 2).join(' | '),
      quantityUsed: builtItems[0].stockDeductedQty,
      unit: builtItems[0].doseUnit,
      unitCost: builtItems[0].unitCost,
      totalCost,
      estimatedCost: totalCost,
      doseUsed: builtItems.map((i) => `${i.productName}: ${i.dose}`).join('; '),
      drums200L: parseDec(appDrumsStr) || 0,
      applicatorName: appApplicator.trim() || 'Operador Invernadero',
      notes: appNotes.trim() || undefined,
    });
    setIsSavingApp(false);
    setAppRows(createInitial8Rows());
    setAppNotes('');
    notifyOk(
      res.cloudSynced
        ? `Hoja ${res.entry?.folio || ''} guardada para ${ghDisplay} (${builtItems.length} producto(s), ${fmtMoney(totalCost)}) y stock descontado en Supabase.`
        : `Hoja ${res.entry?.folio || ''} guardada localmente para ${ghDisplay} y stock descontado.`
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-[#C3A25D]/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AromaFlowersLogo size="lg" className="shrink-0" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C3A25D]">
                  Invernaderos &bull; Almacén &bull; Sanidad Vegetal
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#535B28] text-white">
                  Descuento Automático de Stock
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                Compras, Insumos y Aplicaciones
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                Inventario separado por área (Invernadero, Empaque, Comida), ficha técnica "¿Para qué sirve?" y bitácora foliar/fertilización.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportSuppliesAndAppsExcel(supplyItems, supplyPurchases, greenhouseApplications)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#C3A25D]" />
              <span>Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportSuppliesAndAppsPdf(supplyItems, supplyPurchases, greenhouseApplications)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs font-bold transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-stone-500">Valor en Almacén</span>
          <p className="text-xl sm:text-2xl font-black text-[#000000] mt-0.5">{fmtMoney(kpis.invValue)}</p>
          <span className="text-[11px] text-stone-500">{supplyItems.length} insumos registrados</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-[#535B28]">Total Compras Registradas</span>
          <p className="text-xl sm:text-2xl font-black text-[#535B28] mt-0.5">{fmtMoney(kpis.totalPurchasesCost)}</p>
          <span className="text-[11px] text-stone-500">{supplyPurchases.length} compras por área</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-[#5C1125]">Aplicaciones Invernadero</span>
          <p className="text-xl sm:text-2xl font-black text-[#5C1125] mt-0.5">{fmtMoney(kpis.totalAppsCost)}</p>
          <span className="text-[11px] text-stone-500">{greenhouseApplications.length} aplicaciones en bitácora</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-amber-700">Alertas Stock Mínimo</span>
          <p className="text-xl sm:text-2xl font-black text-amber-800 mt-0.5">{kpis.lowStockCount}</p>
          <span className="text-[11px] text-stone-500">Insumos por resurtir</span>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(
          [
            { id: 'inventario', label: '1. Inventario por Área y Ficha Técnica', icon: Package, badge: `${supplyItems.length}` },
            { id: 'compras', label: '2. Compras de Insumos', icon: ShoppingCart, badge: `${supplyPurchases.length}` },
            { id: 'aplicaciones', label: '3. Hojas de Foliares y Nutrición', icon: Droplets, badge: `${greenhouseApplications.length}` },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                active
                  ? 'bg-[#5C1125] text-white border-[#C3A25D]/60 shadow-sm'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-[#5C1125]/40'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#C3A25D]' : 'text-[#5C1125]'}`} />
                <span className="truncate">{tab.label}</span>
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold shrink-0 ${
                  active ? 'bg-[#3f0918] text-[#C3A25D]' : 'bg-[#FAF8F5] text-stone-600'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-[#f7f8f2] border border-[#dce4bf] text-[#535B28] text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-[#fbf2f4] border border-[#ebccd4] text-[#5C1125] text-xs sm:text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ==================== TAB 1: INVENTARIO POR ÁREA ==================== */}
      {subTab === 'inventario' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <form
            onSubmit={handleSaveItem}
            className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3.5 self-start"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <h2 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#535B28]" />
                <span>{editingItemId ? 'Editar Insumo' : 'Registrar Insumo / Producto'}</span>
              </h2>
              {editingItemId && (
                <button
                  type="button"
                  onClick={resetItemForm}
                  className="text-xs font-bold text-[#5C1125] hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Nombre del Producto / Insumo
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ej. Consist Max, Capuchones Kraft, Despensa..."
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Área</label>
                <select
                  value={itemArea}
                  onChange={(e) => setItemArea(e.target.value as SupplyArea)}
                  className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                >
                  {AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {AREA_SHORT_LABEL[a.id]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Categoría</label>
                <input
                  type="text"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  placeholder="Fungicida / Fertilizante"
                  className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#5C1125] mb-1">
                ¿Para qué sirve? (Descripción técnica / uso)
              </label>
              <textarea
                rows={3}
                value={itemPurpose}
                onChange={(e) => setItemPurpose(e.target.value)}
                placeholder="Ej. Fungicida sistémico para control preventivo y curativo de cenicilla (oídio) y mancha negra en rosal."
                required
                className="w-full px-3 py-2 border border-[#5C1125]/30 bg-[#FAF8F5] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Dosis Recomendada (opc.)
                </label>
                <input
                  type="text"
                  value={itemDose}
                  onChange={(e) => setItemDose(e.target.value)}
                  placeholder="Ej. 100 ml / tambo 200L"
                  className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Unidad</label>
                <input
                  type="text"
                  value={itemUnit}
                  onChange={(e) => setItemUnit(e.target.value)}
                  placeholder="L, kg, g, pza, paq"
                  className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Stock Actual</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={itemStockStr}
                  onChange={(e) => setItemStockStr(e.target.value)}
                  placeholder="0"
                  className="no-spinner w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold text-right focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Stock Mín.</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={itemMinStockStr}
                  onChange={(e) => setItemMinStockStr(e.target.value)}
                  placeholder="2"
                  className="no-spinner w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold text-right focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Costo Unit. $</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={itemUnitCostStr}
                  onChange={(e) => setItemUnitCostStr(e.target.value)}
                  placeholder="0.00"
                  className="no-spinner w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold text-right focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Proveedor Habitual</label>
              <input
                type="text"
                value={itemSupplier}
                onChange={(e) => setItemSupplier(e.target.value)}
                placeholder="Ej. Agroquímicos del Sur"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingItem}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
              <span>{isSavingItem ? 'Guardando...' : editingItemId ? 'Actualizar Insumo' : 'Guardar Insumo'}</span>
            </button>
          </form>

          {/* List & Area Filters */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAreaFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    areaFilter === 'todos'
                      ? 'bg-[#000000] text-[#C3A25D] border-[#000000]'
                      : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Todas las Áreas ({supplyItems.length})
                </button>
                {AREAS.map((a) => {
                  const count = supplyItems.filter((i) => i.area === a.id).length;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAreaFilter(a.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        areaFilter === a.id
                          ? 'bg-[#5C1125] text-white border-[#5C1125]'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-[#5C1125]/40'
                      }`}
                    >
                      {AREA_SHORT_LABEL[a.id]} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre (ej. Consist Max), categoría o para qué sirve..."
                  className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-xs text-stone-500">
                  No se encontraron insumos con este filtro.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const lowStock = Number(item.stock || 0) <= Number(item.minStock || 0);
                  const areaBadge =
                    AREAS.find((a) => a.id === item.area)?.badgeClass ||
                    'bg-stone-100 text-stone-700 border-stone-200';
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 space-y-2.5 hover:border-[#C3A25D]/70 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm sm:text-base font-black text-[#000000]">
                              {item.name}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${areaBadge}`}>
                              {AREA_SHORT_LABEL[item.area]}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF8F5] text-stone-600 border border-stone-200">
                              {item.category}
                            </span>
                            {lowStock && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                Stock Bajo
                              </span>
                            )}
                          </div>
                          {item.supplier && (
                            <p className="text-[11px] text-stone-500 mt-0.5">
                              Proveedor: <strong className="text-stone-700">{item.supplier}</strong>
                              {item.recommendedDose ? ` • Dosis: ${item.recommendedDose}` : ''}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-start">
                          <div className="text-right">
                            <div className="text-sm font-black text-[#5C1125]">
                              {item.stock} {item.unit}
                            </div>
                            <div className="text-[11px] text-stone-500">
                              {fmtMoney(item.unitCost)} / {item.unit}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => loadItemEdit(item)}
                            className="p-1.5 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] cursor-pointer"
                            title="Editar insumo"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {confirmDeleteItemId === item.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteSupplyItem(item.id);
                                  setConfirmDeleteItemId(null);
                                  notifyOk(`Insumo "${item.name}" eliminado.`);
                                }}
                                className="text-[11px] font-bold text-rose-700 cursor-pointer"
                              >
                                Sí
                              </button>
                              <span className="text-stone-300">|</span>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteItemId(null)}
                                className="text-[11px] text-stone-500 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteItemId(item.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                              title="Eliminar insumo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Purpose Callout */}
                      <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#C3A25D]/40 flex items-start gap-2">
                        <Info className="w-4 h-4 text-[#5C1125] shrink-0 mt-0.5" />
                        <div className="text-xs text-stone-800">
                          <span className="font-extrabold text-[#5C1125]">¿Para qué sirve?: </span>
                          <span>{item.purpose}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: COMPRAS DE INSUMOS ==================== */}
      {subTab === 'compras' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSavePurchase}
            className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3.5 self-start"
          >
            <h2 className="text-sm font-extrabold text-[#000000] border-b border-stone-100 pb-2.5 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#5C1125]" />
              <span>Registrar Compra de Insumo</span>
            </h2>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Fecha de Compra</label>
              <input
                type="date"
                value={purDate}
                onChange={(e) => setPurDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Insumo Comprado</label>
              <select
                value={purSupplyId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPurSupplyId(id);
                  const found = supplyItems.find((s) => s.id === id);
                  if (found) {
                    setPurUnitCostStr(String(found.unitCost));
                    if (found.supplier) setPurSupplier(found.supplier);
                  }
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
              >
                {supplyItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{AREA_SHORT_LABEL[s.area]}] {s.name} (Stock: {s.stock} {s.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Proveedor</label>
              <input
                type="text"
                value={purSupplier}
                onChange={(e) => setPurSupplier(e.target.value)}
                placeholder="Ej. Agroquímicos del Sur"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Cantidad ({selectedPurchaseSupply?.unit || 'u'})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={purQtyStr}
                  onChange={(e) => setPurQtyStr(e.target.value)}
                  placeholder="0"
                  required
                  className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-right focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Costo Unit. ($)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={purUnitCostStr}
                  onChange={(e) => setPurUnitCostStr(e.target.value)}
                  placeholder={String(selectedPurchaseSupply?.unitCost || 0)}
                  className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-right focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#C3A25D]/40 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Total de Compra:</span>
              <span className="text-base font-black text-[#5C1125]">
                {fmtMoney(
                  round2(
                    parseDec(purQtyStr) *
                      (parseDec(purUnitCostStr) || Number(selectedPurchaseSupply?.unitCost || 0))
                  )
                )}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Factura / Ticket (opc.)</label>
              <input
                type="text"
                value={purInvoiceRef}
                onChange={(e) => setPurInvoiceRef(e.target.value)}
                placeholder="Ej. FAC-4582"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Notas (opc.)</label>
              <input
                type="text"
                value={purNotes}
                onChange={(e) => setPurNotes(e.target.value)}
                placeholder="Observaciones de entrega..."
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingPurchase}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
              <span>{isSavingPurchase ? 'Guardando...' : 'Guardar Compra y Sumar Stock'}</span>
            </button>
          </form>

          {/* Purchases History + Area Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {AREAS.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-white border border-stone-200 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-stone-500 block truncate">
                    {AREA_SHORT_LABEL[a.id]}
                  </span>
                  <span className="text-sm font-black text-[#000000]">
                    {fmtMoney(kpis.byArea[a.id] || 0)}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-[#FAF8F5] border-b border-stone-200 font-extrabold text-xs sm:text-sm text-[#000000]">
                Historial de Compras ({supplyPurchases.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[680px]">
                  <thead>
                    <tr className="bg-[#5C1125] text-white text-[10px] uppercase">
                      <th className="py-2.5 px-3 text-left">Fecha</th>
                      <th className="py-2.5 px-2 text-left">Insumo / Área</th>
                      <th className="py-2.5 px-2 text-left">Proveedor</th>
                      <th className="py-2.5 px-2 text-right">Cant.</th>
                      <th className="py-2.5 px-2 text-right">Total</th>
                      <th className="py-2.5 px-2 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {supplyPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-stone-500">
                          No hay compras registradas aún.
                        </td>
                      </tr>
                    ) : (
                      supplyPurchases.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF8F5]">
                          <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{p.purchaseDate}</td>
                          <td className="py-2.5 px-2">
                            <div className="font-extrabold text-[#000000]">{p.supplyName}</div>
                            <span className="text-[10px] font-bold text-[#535B28] uppercase">
                              {AREA_SHORT_LABEL[p.area]}
                              {p.invoiceRef ? ` • ${p.invoiceRef}` : ''}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-stone-600">{p.supplierName}</td>
                          <td className="py-2.5 px-2 text-right font-bold whitespace-nowrap">
                            {p.quantity} {p.unit}
                          </td>
                          <td className="py-2.5 px-2 text-right font-black text-[#5C1125] whitespace-nowrap">
                            {fmtMoney(p.totalCost)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {confirmDeletePurchaseId === p.id ? (
                              <div className="inline-flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteSupplyPurchase(p.id);
                                    setConfirmDeletePurchaseId(null);
                                    notifyOk('Compra eliminada.');
                                  }}
                                  className="text-[10px] font-bold text-rose-700 cursor-pointer"
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePurchaseId(null)}
                                  className="text-[10px] text-stone-500 cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePurchaseId(p.id)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: HOJAS DE APLICACIÓN FOLIAR Y NUTRICIÓN (UNIDAD / MÓDULO) ==================== */}
      {subTab === 'aplicaciones' && (
        <div className="space-y-6">
          {/* 1. FORMATO DIGITAL DE HOJA DE APLICACIÓN (IDÉNTICO AL BOCETO DEL CLIENTE) */}
          <form
            onSubmit={handleSaveApplication}
            className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden"
          >
            {/* Cabecera de la Hoja */}
            <div className="px-5 py-4 bg-[#FAF8F5] border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[#000000] flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-[#535B28]" />
                  <span>Hoja de Control de Aplicaciones Foliares y Nutrición</span>
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Santa Cruz (Módulos 1 y 2) &middot; Saúl (Módulos 1 y 2) &middot; Tlapizaco (Módulos 1, 2 y 3)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAppRows(createInitial8Rows());
                    setAppNotes('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-700 transition cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar hoja</span>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Fila Principal: UNIDAD | MÓDULO | FECHA (estructura directa del formato) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-[#FAF8F5] border border-stone-200">
                <div>
                  <label className="block text-[11px] font-extrabold text-[#5C1125] uppercase tracking-wide mb-1">
                    Unidad
                  </label>
                  <select
                    value={appUnit}
                    onChange={(e) => handleSelectUnitChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                  >
                    {PRODUCTION_UNITS.map((u) => (
                      <option key={u.name} value={u.name}>
                        {u.name} ({u.modules.length - 1} módulos)
                      </option>
                    ))}
                    <option value="__otra__">+ Otra Unidad...</option>
                  </select>
                  {appUnit === '__otra__' && (
                    <input
                      type="text"
                      value={appCustomUnit}
                      onChange={(e) => setAppCustomUnit(e.target.value)}
                      placeholder="Nombre de nueva unidad..."
                      className="w-full mt-1.5 px-3 py-2 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-[#5C1125] uppercase tracking-wide mb-1">
                    Módulo
                  </label>
                  {appUnit === '__otra__' ? (
                    <input
                      type="text"
                      value={appCustomModule}
                      onChange={(e) => setAppCustomModule(e.target.value)}
                      placeholder="Ej. Módulo 1"
                      className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white"
                    />
                  ) : (
                    <>
                      <select
                        value={appModule}
                        onChange={(e) => setAppModule(e.target.value)}
                        className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                      >
                        {availableModulesForSelectedUnit.map((mod) => (
                          <option key={mod} value={mod}>
                            {mod}
                          </option>
                        ))}
                        <option value="__otro_mod__">+ Otro módulo...</option>
                      </select>
                      {appModule === '__otro_mod__' && (
                        <input
                          type="text"
                          value={appCustomModule}
                          onChange={(e) => setAppCustomModule(e.target.value)}
                          placeholder="Ej. Módulo 4"
                          className="w-full mt-1.5 px-3 py-2 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                        />
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-[#5C1125] uppercase tracking-wide mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={appDate}
                    onChange={(e) => setAppDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white text-[#000000] tabular-nums focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              {/* Fila Operativa: Tipo (Foliar / Nutrición), Tambos 200L, Aplicador */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Tipo de Aplicación
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {APP_TYPES.slice(0, 2).map((t) => {
                      const active = appType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAppType(t.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[#535B28] text-white border-[#535B28]'
                              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          {t.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Tambos de 200L (opcional)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={appDrumsStr}
                    onChange={(e) => setAppDrumsStr(e.target.value)}
                    placeholder="Ej. 2"
                    className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-right tabular-nums focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Responsable / Aplicador
                  </label>
                  <input
                    type="text"
                    list="applicators-datalist"
                    value={appApplicator}
                    onChange={(e) => setAppApplicator(e.target.value)}
                    placeholder="Ej. ING ANA, SERGIO, FIDEL"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
                  />
                  <datalist id="applicators-datalist">
                    {payrollEmployees.map((emp) => (
                      <option key={emp.id} value={emp.fullName} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Tabla 1 a 8: No. | PRODUCTO | DOSIS | OBJETIVO | COSTO */}
              <div className="border border-stone-300 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[820px]">
                    <thead>
                      <tr className="bg-[#5C1125] text-white text-[11px] font-extrabold uppercase tracking-wider">
                        <th className="py-2.5 px-2.5 text-center w-12 border-r border-[#752036]">No.</th>
                        <th className="py-2.5 px-3 text-left w-60 border-r border-[#752036]">Producto</th>
                        <th className="py-2.5 px-3 text-left w-44 border-r border-[#752036]">Dosis</th>
                        <th className="py-2.5 px-3 text-left border-r border-[#752036]">Objetivo (¿Para qué sirve?)</th>
                        <th className="py-2.5 px-3 text-right w-32 border-r border-[#752036]">Costo ($)</th>
                        <th className="py-2.5 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {appRows.map((row, idx) => {
                        const linkedSupply =
                          row.supplyItemId && row.supplyItemId !== '__custom__'
                            ? supplyItems.find((s) => s.id === row.supplyItemId)
                            : undefined;
                        const qtyNum = parseDec(row.qtyStr);
                        const stockEq = linkedSupply
                          ? convertDoseToStockUnit(qtyNum, row.doseUnit, linkedSupply.unit)
                          : 0;
                        return (
                          <tr key={row.rowKey} className="hover:bg-[#FAF8F5]/60 align-top">
                            <td className="py-2.5 px-2 text-center font-extrabold text-stone-700 bg-[#FAF8F5] border-r border-stone-200 tabular-nums">
                              {idx + 1}
                            </td>

                            <td className="py-2 px-2.5 border-r border-stone-200 space-y-1">
                              <select
                                value={row.supplyItemId}
                                onChange={(e) => handleRowSupplyChange(row.rowKey, e.target.value)}
                                className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-xs font-bold bg-white text-[#000000] focus:ring-1 focus:ring-[#5C1125]"
                              >
                                <option value="">— Seleccionar producto —</option>
                                {availableAppSupplies.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} (Stock: {s.stock} {s.unit})
                                  </option>
                                ))}
                                <option value="__custom__">+ Escribir otro producto libre...</option>
                              </select>
                              {row.supplyItemId === '__custom__' && (
                                <input
                                  type="text"
                                  value={row.customProductName}
                                  onChange={(e) =>
                                    updateAppRow(row.rowKey, (r) => ({
                                      ...r,
                                      customProductName: e.target.value,
                                    }))
                                  }
                                  placeholder="Nombre del producto..."
                                  className="w-full px-2 py-1 border border-stone-300 rounded-md text-xs font-semibold"
                                />
                              )}
                              {linkedSupply?.recommendedDose && (
                                <p className="text-[10px] text-[#535B28] font-medium">
                                  Sugerida: {linkedSupply.recommendedDose}
                                </p>
                              )}
                            </td>

                            <td className="py-2 px-2.5 border-r border-stone-200">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.qtyStr}
                                  onChange={(e) =>
                                    handleRowQtyOrUnitChange(row.rowKey, e.target.value, row.doseUnit)
                                  }
                                  placeholder="0"
                                  disabled={!row.supplyItemId}
                                  className="no-spinner w-full px-2 py-1.5 border border-stone-300 rounded-lg text-xs font-bold text-right tabular-nums disabled:bg-stone-50"
                                />
                                <select
                                  value={row.doseUnit}
                                  onChange={(e) =>
                                    handleRowQtyOrUnitChange(row.rowKey, row.qtyStr, e.target.value)
                                  }
                                  disabled={!row.supplyItemId}
                                  className="px-1.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold bg-white disabled:bg-stone-50"
                                >
                                  {DOSE_UNITS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {linkedSupply && qtyNum > 0 && (
                                <p className="text-[10px] text-stone-500 mt-1 tabular-nums">
                                  Descuenta: <strong className="text-stone-700">{stockEq} {linkedSupply.unit}</strong>
                                </p>
                              )}
                            </td>

                            <td className="py-2 px-2.5 border-r border-stone-200">
                              <input
                                type="text"
                                value={row.objective}
                                onChange={(e) =>
                                  updateAppRow(row.rowKey, (r) => ({ ...r, objective: e.target.value }))
                                }
                                placeholder={
                                  row.supplyItemId
                                    ? 'Objetivo técnico (plaga, hongo, nutrición)...'
                                    : 'Se llena automático al elegir producto'
                                }
                                disabled={!row.supplyItemId}
                                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs text-stone-800 disabled:bg-stone-50"
                              />
                            </td>

                            <td className="py-2 px-2.5 border-r border-stone-200">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.costStr}
                                onChange={(e) =>
                                  updateAppRow(row.rowKey, (r) => ({
                                    ...r,
                                    costStr: e.target.value,
                                    manualCost: true,
                                  }))
                                }
                                placeholder="0.00"
                                disabled={!row.supplyItemId}
                                className="no-spinner w-full px-2 py-1.5 border border-stone-300 rounded-lg text-xs font-extrabold text-right text-[#5C1125] tabular-nums disabled:bg-stone-50"
                              />
                            </td>

                            <td className="py-2 px-1.5 text-center">
                              {row.supplyItemId && (
                                <button
                                  type="button"
                                  onClick={() => handleRowSupplyChange(row.rowKey, '')}
                                  title="Limpiar fila"
                                  className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#FAF8F5] border-t-2 border-stone-300">
                        <td colSpan={3} className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() =>
                              setAppRows((prev) => [...prev, createEmptyAppRow(prev.length)])
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-[#535B28] cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar fila ({appRows.length + 1})</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-extrabold uppercase text-stone-700">
                          Costo total ({activeDraftRowsCount} prod.):
                        </td>
                        <td className="py-2.5 px-3 text-right text-base font-black text-[#5C1125] tabular-nums bg-white border-l border-stone-300">
                          {fmtMoney(draftSheetTotalCost)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Observaciones + Botón Guardar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-extrabold text-stone-700 uppercase tracking-wide mb-1">
                    Observaciones
                  </label>
                  <textarea
                    rows={2}
                    value={appNotes}
                    onChange={(e) => setAppNotes(e.target.value)}
                    placeholder="Clima, hora de aplicación, plaga detectada, etapa fenológica, pH/CE en nutrición..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isSavingApp}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
                  >
                    <PlusCircle className="w-4 h-4 text-[#C3A25D] shrink-0" />
                    <span>
                      {isSavingApp
                        ? 'Guardando Hoja...'
                        : 'Guardar Hoja y Descontar Stock'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* 2. RESUMEN DE GASTO POR UNIDAD Y MÓDULO (Santa Cruz, Saúl, Tlapizaco) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {unitCostSummary.map((u) => (
              <div
                key={u.unitName}
                className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2.5">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#000000]">Unidad {u.unitName}</h3>
                    <p className="text-[11px] text-stone-500 tabular-nums">
                      {u.count} hoja(s) registrada(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-stone-500 block">
                      Total Aplicado
                    </span>
                    <span className="text-base font-black text-[#5C1125] tabular-nums">
                      {fmtMoney(u.totalCost)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-600 tabular-nums">
                  <span>
                    Foliar: <strong className="text-stone-900">{fmtMoney(u.foliarCost)}</strong>
                  </span>
                  <span>
                    Nutrición: <strong className="text-[#535B28]">{fmtMoney(u.nutritionCost)}</strong>
                  </span>
                </div>

                <div className="divide-y divide-stone-100 border-t border-stone-100 pt-1">
                  {u.byModule.map((m) => (
                    <div
                      key={m.moduleName}
                      className="py-1.5 flex items-center justify-between text-xs tabular-nums"
                    >
                      <span className="font-semibold text-stone-700">{m.moduleName}</span>
                      <span className="text-stone-500">
                        {m.count} reg. &middot;{' '}
                        <strong className="text-stone-900">{fmtMoney(m.cost)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 3. BITÁCORA HISTÓRICA FILTRABLE CON PDF, WHATSAPP Y DUPLICAR MEZCLA */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-[#FAF8F5] border-b border-stone-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-extrabold text-sm text-[#000000]">
                  Bitácora de Hojas de Aplicación ({filteredApplications.length})
                </h3>
                <span className="text-xs font-black text-[#5C1125] tabular-nums">
                  Costo Filtrado:{' '}
                  {fmtMoney(
                    round2(
                      filteredApplications.reduce((acc, a) => acc + Number(a.totalCost || 0), 0)
                    )
                  )}
                </span>
              </div>

              {/* Barra de Filtros */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <select
                  value={filterUnit}
                  onChange={(e) => {
                    setFilterUnit(e.target.value);
                    setFilterModule('todos');
                  }}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs font-bold bg-white"
                >
                  <option value="todas">Todas las Unidades</option>
                  {PRODUCTION_UNITS.map((u) => (
                    <option key={u.name} value={u.name}>
                      Unidad: {u.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                  disabled={filterUnit === 'todas'}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs font-bold bg-white disabled:bg-stone-100 disabled:text-stone-400"
                >
                  <option value="todos">Todos los Módulos</option>
                  {availableModulesForFilterUnit.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as GreenhouseApplicationType | 'todos')}
                  className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs font-bold bg-white"
                >
                  <option value="todos">Foliar y Nutrición</option>
                  {APP_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.short}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  aria-label="Fecha desde"
                  className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs font-semibold bg-white tabular-nums"
                />

                <input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  aria-label="Fecha hasta"
                  className="px-2.5 py-2 border border-stone-300 rounded-lg text-xs font-semibold bg-white tabular-nums"
                />
              </div>
            </div>

            <div className="divide-y divide-stone-200">
              {filteredApplications.length === 0 ? (
                <div className="p-10 text-center text-xs text-stone-500">
                  No hay hojas de aplicación registradas con los filtros seleccionados.
                </div>
              ) : (
                filteredApplications.map((app) => {
                  const itemsList =
                    app.items && app.items.length > 0
                      ? app.items
                      : [
                          {
                            lineNo: 1,
                            productName: app.supplyName,
                            dose: app.doseUsed || `${app.quantityUsed} ${app.unit}`,
                            objective: app.supplyPurpose,
                            cost: app.totalCost,
                          },
                        ];
                  const waHref = `https://wa.me/?text=${encodeURIComponent(
                    buildApplicationWhatsAppText(app)
                  )}`;
                  const typeLabel =
                    app.applicationType === 'fertilizacion'
                      ? 'Nutrición'
                      : app.applicationType === 'foliar'
                      ? 'Foliar'
                      : app.applicationType === 'drench'
                      ? 'Drench'
                      : 'Otra';

                  return (
                    <div key={app.id} className="p-4 sm:p-5 space-y-3 hover:bg-[#FAF8F5]/50">
                      {/* Encabezado limpio con metadatos sin cápsulas */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-extrabold text-[#000000]">
                            <span>{app.unitName || app.greenhouseName}</span>
                            {app.moduleName && (
                              <>
                                <span className="text-stone-400">&middot;</span>
                                <span className="text-[#5C1125]">{app.moduleName}</span>
                              </>
                            )}
                            <span className="text-stone-400">&middot;</span>
                            <span className="text-[#535B28]">{typeLabel}</span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                            {app.folio ? `${app.folio} · ` : ''}
                            Fecha: <strong className="text-stone-800">{app.applicationDate}</strong>
                            {' · '}Aplicador:{' '}
                            <strong className="text-stone-800">{app.applicatorName || 'Operador'}</strong>
                            {app.drums200L ? ` · ${app.drums200L} tambo(s) 200L` : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => exportSingleApplicationSheetPdf(app)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-[#000000] cursor-pointer whitespace-nowrap"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#5C1125]" />
                            <span>PDF Hoja</span>
                          </button>

                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dce4bf] bg-[#f7f8f2] hover:bg-[#edf1df] text-xs font-bold text-[#535B28] whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDuplicateApplication(app)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-700 cursor-pointer whitespace-nowrap"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Duplicar</span>
                          </button>

                          {confirmDeleteAppId === app.id ? (
                            <div className="inline-flex items-center gap-1.5 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteGreenhouseApplication(app.id);
                                  setConfirmDeleteAppId(null);
                                  notifyOk('Hoja de aplicación eliminada y stock restaurado.');
                                }}
                                className="text-xs font-bold text-rose-700 cursor-pointer"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteAppId(null)}
                                className="text-xs text-stone-500 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAppId(app.id)}
                              title="Eliminar hoja y restaurar inventario"
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Tabla de productos de la hoja registrada */}
                      <div className="overflow-x-auto border border-stone-200 rounded-xl">
                        <table className="w-full text-xs border-collapse min-w-[580px]">
                          <thead>
                            <tr className="bg-[#FAF8F5] text-stone-600 text-[10px] font-extrabold uppercase border-b border-stone-200">
                              <th className="py-2 px-2.5 text-center w-10">No.</th>
                              <th className="py-2 px-3 text-left">Producto</th>
                              <th className="py-2 px-3 text-left w-32">Dosis</th>
                              <th className="py-2 px-3 text-left">Objetivo</th>
                              <th className="py-2 px-3 text-right w-28">Costo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {itemsList.map((it, idx) => (
                              <tr key={`${app.id}-${idx}`}>
                                <td className="py-2 px-2.5 text-center font-bold text-stone-500 tabular-nums">
                                  {it.lineNo || idx + 1}
                                </td>
                                <td className="py-2 px-3 font-extrabold text-[#000000]">
                                  {it.productName}
                                </td>
                                <td className="py-2 px-3 font-semibold text-stone-700 tabular-nums">
                                  {it.dose}
                                </td>
                                <td className="py-2 px-3 text-stone-600">{it.objective}</td>
                                <td className="py-2 px-3 text-right font-bold text-stone-900 tabular-nums">
                                  {fmtMoney(it.cost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#FAF8F5] border-t border-stone-200">
                              <td
                                colSpan={4}
                                className="py-2 px-3 text-right text-[11px] font-extrabold uppercase text-stone-600"
                              >
                                Costo total:
                              </td>
                              <td className="py-2 px-3 text-right text-sm font-black text-[#5C1125] tabular-nums">
                                {fmtMoney(app.totalCost)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {app.notes && (
                        <p className="text-xs text-stone-600">
                          <strong className="text-stone-800">Observaciones:</strong> {app.notes}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
