import React, { useMemo, useState } from 'react';
import {
  X,
  Plus,
  Edit3,
  Check,
  FlaskConical,
  ShoppingBag,
  Search,
} from 'lucide-react';
import {
  FOLIAR_DOSE_UNITS,
  FoliarDoseUnit,
  FoliarProductPresentation,
  SupplyItem,
} from '../../types/greenhouse';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  calculateReferenceDoseCost,
  formatMoneyMXN,
  getMinimumUnitCost,
  inferPresentation,
  normalizeFoliarUnit,
  resolveEffectivePurchaseCost,
} from '../../utils/foliarCalculations';

interface AgrochemicalsCatalogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgrochemicalsCatalogPanel: React.FC<AgrochemicalsCatalogPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { supplyItems, supplyPurchases, saveSupplyItem } =
    useGreenhouse();

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [presentation, setPresentation] = useState<FoliarProductPresentation>('liquido');
  const [unit, setUnit] = useState<FoliarDoseUnit>('L');
  const [unitCost, setUnitCost] = useState('');
  const [category, setCategory] = useState('Fungicida');
  const [purpose, setPurpose] = useState('');
  const [recommendedDose, setRecommendedDose] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const agrochemicals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return supplyItems
      .filter((item) => item.active !== false && item.area === 'invernadero')
      .filter(
        (item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.purpose || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [supplyItems, search]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPresentation('liquido');
    setUnit('L');
    setUnitCost('');
    setCategory('Fungicida');
    setPurpose('');
    setRecommendedDose('');
  };

  const handleEdit = (item: SupplyItem) => {
    const pres = inferPresentation(item);
    const normUnit = normalizeFoliarUnit(item.unit);
    setEditingId(item.id);
    setName(item.name);
    setPresentation(pres);
    setUnit(normUnit);
    setUnitCost(String(item.unitCost || ''));
    setCategory(item.category || 'Agroquímico');
    setPurpose(item.purpose || '');
    setRecommendedDose(item.recommendedDose || '');
    setMessage(null);
  };

  const handlePresentationChange = (next: FoliarProductPresentation) => {
    setPresentation(next);
    if (next === 'liquido' && (unit === 'kg' || unit === 'g')) {
      setUnit('L');
    } else if (next === 'polvo' && (unit === 'L' || unit === 'ml')) {
      setUnit('kg');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const numericCost = Number(unitCost || 0);
    if (!cleanName) {
      setMessage({ text: 'Ingresa el nombre del agroquímico.', tone: 'err' });
      return;
    }
    if (numericCost < 0 || Number.isNaN(numericCost)) {
      setMessage({ text: 'Ingresa un costo unitario válido.', tone: 'err' });
      return;
    }

    const existing = editingId ? supplyItems.find((s) => s.id === editingId) : undefined;
    setSaving(true);
    const res = await saveSupplyItem(
      {
        name: cleanName,
        area: 'invernadero',
        category: category.trim() || 'Agroquímico',
        unit,
        presentation,
        purpose: purpose.trim() || existing?.purpose || '',
        activeIngredient: existing?.activeIngredient || '',
        recommendedDose: recommendedDose.trim() || existing?.recommendedDose || '',
        stock: existing?.stock ?? 0,
        minStock: existing?.minStock ?? 1,
        unitCost: numericCost,
        supplier: existing?.supplier || '',
        active: true,
      },
      editingId || undefined
    );
    setSaving(false);

    if (!res.ok) {
      setMessage({ text: res.error || 'No se pudo guardar el producto.', tone: 'err' });
      return;
    }

    setMessage({
      text: res.cloudSynced
        ? `"${cleanName}" sincronizado con Compras/Inventario y Supabase.`
        : `"${cleanName}" guardado localmente en el catálogo.`,
      tone: 'ok',
    });
    resetForm();
  };

  const previewMin = getMinimumUnitCost(Number(unitCost || 0), unit, presentation);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Catálogo de Agroquímicos"
    >
      <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#5C1125] text-[#C3A25D] flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-[#000000] truncate">
                Catálogo de Agroquímicos
              </h2>
              <p className="text-xs text-stone-600 truncate">
                Vinculado directamente con Compras e Inventario de Insumos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 inline-flex items-center justify-center transition cursor-pointer"
              aria-label="Cerrar catálogo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Add / Edit Agrochemical Form */}
          <form
            onSubmit={handleSave}
            className="p-4 sm:p-5 rounded-xl border border-stone-200 bg-[#FAF8F5]/70 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#000000]">
                {editingId ? 'Editar producto agroquímico' : 'Registrar nuevo agroquímico'}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-stone-500 hover:text-[#5C1125] cursor-pointer"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Consis Max, Tocat 240, Tocat CLN, Adherente"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Presentación
                </label>
                <select
                  value={presentation}
                  onChange={(e) =>
                    handlePresentationChange(e.target.value as FoliarProductPresentation)
                  }
                  className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                >
                  <option value="liquido">Líquido</option>
                  <option value="polvo">Polvo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Unidad de medida base
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as FoliarDoseUnit)}
                  className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                >
                  {FOLIAR_DOSE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Costo por {unit} ($ MXN)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder={unit === 'L' || unit === 'kg' ? 'Ej. 2000' : 'Ej. 2.00'}
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-bold text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                />
                {Number(unitCost || 0) > 0 && (
                  <p className="text-[11px] text-[#535B28] font-medium mt-1 tabular-nums">
                    Equivale a {formatMoneyMXN(previewMin.costPerMinUnit)} / {previewMin.minUnit}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Dosis de referencia
                </label>
                <input
                  type="text"
                  placeholder="Ej. 50 ml por 200L"
                  value={recommendedDose}
                  onChange={(e) => setRecommendedDose(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Objetivo / Plaga principal
                </label>
                <input
                  type="text"
                  placeholder="Ej. Control de cenicilla, peronospora o adherente"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {message ? (
                <span
                  className={`text-xs font-semibold ${
                    message.tone === 'ok' ? 'text-[#535B28]' : 'text-[#5C1125]'
                  }`}
                >
                  {message.text}
                </span>
              ) : (
                <span className="text-xs text-stone-500">
                  Los costos actualizados en Compras se reflejan automáticamente en este catálogo.
                </span>
              )}

              <button
                type="submit"
                disabled={saving}
                className="h-10 px-4 rounded-xl bg-[#5C1125] hover:bg-[#460c1b] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {editingId ? <Check className="w-4 h-4 text-[#C3A25D]" /> : <Plus className="w-4 h-4 text-[#C3A25D]" />}
                <span>{saving ? 'Guardando...' : editingId ? 'Actualizar producto' : 'Agregar al catálogo'}</span>
              </button>
            </div>
          </form>

          {/* Search & Agrochemicals Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#000000]">
                Productos disponibles ({agrochemicals.length})
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-stone-200 bg-white text-xs text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                />
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-stone-200 text-xs font-bold text-stone-600">
                      <th className="py-2.5 px-4">Producto</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Objetivo</th>
                      <th className="py-2.5 px-3">Presentación</th>
                      <th className="py-2.5 px-3 text-right">Costo presentación</th>
                      <th className="py-2.5 px-3 text-right">Costo de la dosis</th>
                      <th className="py-2.5 px-4 text-right">Editar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {agrochemicals.map((item) => {
                      const pres = inferPresentation(item);
                      const eff = resolveEffectivePurchaseCost(item, supplyPurchases);
                      const min = getMinimumUnitCost(eff.unitCost, eff.unit, pres);
                      const refDose = calculateReferenceDoseCost(item, supplyPurchases);
                      return (
                        <tr key={item.id} className="hover:bg-[#FAF8F5]/70 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-[#000000]">{item.name}</div>
                            {item.recommendedDose && (
                              <div className="text-[11px] text-stone-500">
                                Dosis ref: {item.recommendedDose}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-stone-700">
                            {item.purpose || <span className="text-stone-400">Sin objetivo registrado</span>}
                          </td>
                          <td className="py-2.5 px-3 text-xs font-medium text-stone-700 whitespace-nowrap">
                            {pres === 'polvo' ? 'Polvo' : 'Líquido'} ({eff.unit})
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-[#000000] tabular-nums whitespace-nowrap">
                            {formatMoneyMXN(eff.unitCost)} / {eff.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {refDose ? (
                              <div>
                                <div className="font-extrabold text-[#535B28] tabular-nums">
                                  {formatMoneyMXN(refDose.cost)}
                                </div>
                                <div className="text-[11px] text-stone-500 tabular-nums">
                                  ({refDose.doseLabel} · {formatMoneyMXN(min.costPerMinUnit)}/{min.minUnit})
                                </div>
                              </div>
                            ) : (
                              <div className="font-bold text-[#535B28] tabular-nums">
                                {formatMoneyMXN(min.costPerMinUnit)} / {min.minUnit}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="w-8 h-8 rounded-lg border border-stone-200 hover:border-[#5C1125] hover:text-[#5C1125] text-stone-500 inline-flex items-center justify-center transition cursor-pointer"
                              title={`Editar ${item.name}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {agrochemicals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-stone-500">
                          No se encontraron agroquímicos con esa búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
