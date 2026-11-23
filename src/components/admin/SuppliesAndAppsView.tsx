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
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  GreenhouseApplicationType,
  SupplyArea,
  SupplyItem,
} from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
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

const APP_TYPES: Array<{ id: GreenhouseApplicationType; label: string }> = [
  { id: 'foliar', label: 'Aplicación Foliar (Fumigación)' },
  { id: 'fertilizacion', label: 'Fertilización / Fertirriego' },
  { id: 'drench', label: 'Aplicación al Suelo (Drench)' },
  { id: 'otro', label: 'Otra Aplicación' },
];

const GREENHOUSE_PRESETS = [
  'Invernadero 1 (Freedom / Mondial)',
  'Invernadero 2 (Proud / Hermosa)',
  'Invernadero 3 (Topaz / Caricia)',
  'Invernadero 4 (Deep Purple / Novia)',
  'Invernadero 5 (Shimer / Gotcha)',
  'Todos los Invernaderos',
];

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

  // ---------- TAB 3: GREENHOUSE APPLICATION FORM ----------
  const greenhouseSupplies = useMemo(
    () => supplyItems.filter((s) => s.area === 'invernadero' && s.active !== false),
    [supplyItems]
  );
  const [appDate, setAppDate] = useState(today);
  const [appGreenhouse, setAppGreenhouse] = useState(GREENHOUSE_PRESETS[0]);
  const [appCustomGh, setAppCustomGh] = useState('');
  const [appType, setAppType] = useState<GreenhouseApplicationType>('foliar');
  const [appSupplyId, setAppSupplyId] = useState(greenhouseSupplies[0]?.id || supplyItems[0]?.id || '');
  const [appQtyStr, setAppQtyStr] = useState('');
  const [appDrumsStr, setAppDrumsStr] = useState('1');
  const [appDoseUsed, setAppDoseUsed] = useState('');
  const [appApplicator, setAppApplicator] = useState(payrollEmployees[0]?.fullName || 'Aarón Mena');
  const [appNotes, setAppNotes] = useState('');
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [confirmDeleteAppId, setConfirmDeleteAppId] = useState<string | null>(null);

  const selectedAppSupply = useMemo(
    () => supplyItems.find((s) => s.id === appSupplyId),
    [supplyItems, appSupplyId]
  );

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

  const handleSaveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSupply = supplyItems.find((s) => s.id === appSupplyId);
    if (!targetSupply) {
      setErrorMsg('Selecciona un producto/fertilizante para la aplicación.');
      return;
    }
    const qty = parseDec(appQtyStr);
    if (qty <= 0) {
      setErrorMsg('Ingresa la cantidad utilizada del producto.');
      return;
    }
    const ghName = appCustomGh.trim() || appGreenhouse;
    const totalCost = round2(qty * Number(targetSupply.unitCost || 0));
    setIsSavingApp(true);
    const res = await addGreenhouseApplication({
      applicationDate: appDate,
      greenhouseName: ghName,
      applicationType: appType,
      supplyItemId: targetSupply.id,
      supplyName: targetSupply.name,
      supplyPurpose: targetSupply.purpose,
      quantityUsed: qty,
      unit: targetSupply.unit,
      unitCost: Number(targetSupply.unitCost || 0),
      totalCost,
      estimatedCost: totalCost,
      doseUsed: appDoseUsed.trim() || targetSupply.recommendedDose || undefined,
      drums200L: parseDec(appDrumsStr) || 0,
      applicatorName: appApplicator.trim() || 'Operador Invernadero',
      notes: appNotes.trim() || undefined,
    });
    setIsSavingApp(false);
    setAppQtyStr('');
    setAppNotes('');
    notifyOk(
      res.cloudSynced
        ? `Aplicación registrada en ${ghName} (-${qty} ${targetSupply.unit} descontados del stock) y guardada en Supabase.`
        : `Aplicación registrada localmente (-${qty} ${targetSupply.unit} descontados del stock).`
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
            { id: 'aplicaciones', label: '3. Aplicaciones Foliares y Fertilización', icon: Droplets, badge: `${greenhouseApplications.length}` },
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

      {/* ==================== TAB 3: APLICACIONES FOLIARES Y FERTILIZACIÓN ==================== */}
      {subTab === 'aplicaciones' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSaveApplication}
            className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3.5 self-start"
          >
            <h2 className="text-sm font-extrabold text-[#000000] border-b border-stone-100 pb-2.5 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-[#535B28]" />
              <span>Registrar Aplicación en Invernadero</span>
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={appDate}
                  onChange={(e) => setAppDate(e.target.value)}
                  required
                  className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Tipo de Aplicación</label>
                <select
                  value={appType}
                  onChange={(e) => setAppType(e.target.value as GreenhouseApplicationType)}
                  className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                >
                  {APP_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Invernadero / Nave</label>
              <select
                value={appGreenhouse}
                onChange={(e) => setAppGreenhouse(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
              >
                {GREENHOUSE_PRESETS.map((gh) => (
                  <option key={gh} value={gh}>
                    {gh}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={appCustomGh}
                onChange={(e) => setAppCustomGh(e.target.value)}
                placeholder="O escribe otro invernadero específico..."
                className="w-full mt-1.5 px-3 py-1.5 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Producto / Fertilizante / Agroquímico
              </label>
              <select
                value={appSupplyId}
                onChange={(e) => setAppSupplyId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
              >
                {(greenhouseSupplies.length > 0 ? greenhouseSupplies : supplyItems).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category}) — Stock: {s.stock} {s.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Automatic "¿Para qué sirve?" preview card */}
            {selectedAppSupply && (
              <div className="p-3 rounded-xl bg-[#f7f8f2] border border-[#535B28]/40 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#535B28] uppercase">
                  <Info className="w-3.5 h-3.5" />
                  <span>Ficha Automática: ¿Para qué sirve {selectedAppSupply.name}?</span>
                </div>
                <p className="text-xs text-stone-800 font-medium">{selectedAppSupply.purpose}</p>
                {selectedAppSupply.recommendedDose && (
                  <p className="text-[11px] font-bold text-[#5C1125]">
                    Dosis sugerida: {selectedAppSupply.recommendedDose}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Cantidad Usada ({selectedAppSupply?.unit || 'L/kg'})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={appQtyStr}
                  onChange={(e) => setAppQtyStr(e.target.value)}
                  placeholder="0.5"
                  required
                  className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-right focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Tambos de 200L</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={appDrumsStr}
                  onChange={(e) => setAppDrumsStr(e.target.value)}
                  placeholder="1"
                  className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-right focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Aplicador</label>
                <input
                  type="text"
                  value={appApplicator}
                  onChange={(e) => setAppApplicator(e.target.value)}
                  placeholder="Nombre del trabajador"
                  className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Dosis Aplicada</label>
                <input
                  type="text"
                  value={appDoseUsed}
                  onChange={(e) => setAppDoseUsed(e.target.value)}
                  placeholder={selectedAppSupply?.recommendedDose || '100 ml / 200L'}
                  className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#C3A25D]/40 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Costo Estimado de Aplicación:</span>
              <span className="text-base font-black text-[#5C1125]">
                {fmtMoney(round2(parseDec(appQtyStr) * Number(selectedAppSupply?.unitCost || 0)))}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Notas de Campo</label>
              <input
                type="text"
                value={appNotes}
                onChange={(e) => setAppNotes(e.target.value)}
                placeholder="Ej. Aplicación preventiva por humedad matutina..."
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingApp}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
              <span>{isSavingApp ? 'Guardando...' : 'Registrar Aplicación y Descontar Stock'}</span>
            </button>
          </form>

          {/* Applications Log */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden self-start">
            <div className="px-4 py-3 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
              <span className="font-extrabold text-xs sm:text-sm text-[#000000]">
                Bitácora de Aplicaciones en Invernaderos ({greenhouseApplications.length})
              </span>
              <span className="text-xs font-black text-[#5C1125]">
                Total Aplicado: {fmtMoney(kpis.totalAppsCost)}
              </span>
            </div>

            <div className="divide-y divide-stone-100">
              {greenhouseApplications.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  No hay aplicaciones foliares o fertilizaciones registradas todavía.
                </div>
              ) : (
                greenhouseApplications.map((app) => (
                  <div key={app.id} className="p-4 space-y-2 hover:bg-[#FAF8F5]/70">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-[#000000]">{app.supplyName}</span>
                          <span className="px-2 py-0.5 rounded bg-[#535B28] text-white text-[10px] font-bold uppercase">
                            {app.applicationType}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-stone-200 text-[10px] font-bold text-[#5C1125]">
                            {app.greenhouseName}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Fecha: <strong className="text-stone-700">{app.applicationDate}</strong> &bull; Aplicador:{' '}
                          <strong className="text-stone-700">{app.applicatorName}</strong>
                          {app.drums200L ? ` • ${app.drums200L} tambo(s) 200L` : ''}
                          {app.doseUsed ? ` • Dosis: ${app.doseUsed}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-start">
                        <div className="text-right">
                          <div className="text-xs font-extrabold text-stone-800">
                            {app.quantityUsed} {app.unit}
                          </div>
                          <div className="text-xs font-black text-[#5C1125]">
                            {fmtMoney(app.totalCost)}
                          </div>
                        </div>
                        {confirmDeleteAppId === app.id ? (
                          <div className="inline-flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteGreenhouseApplication(app.id);
                                setConfirmDeleteAppId(null);
                                notifyOk('Aplicación eliminada.');
                              }}
                              className="text-[10px] font-bold text-rose-700 cursor-pointer"
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAppId(null)}
                              className="text-[10px] text-stone-500 cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAppId(app.id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-stone-200 text-xs text-stone-700">
                      <strong className="text-[#535B28]">Función / Uso: </strong>
                      {app.supplyPurpose}
                      {app.notes && <span className="block text-[11px] text-stone-500 mt-0.5">Nota: {app.notes}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
