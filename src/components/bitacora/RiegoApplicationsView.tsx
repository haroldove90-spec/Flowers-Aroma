import React, { useMemo, useState } from 'react';
import {
  Droplets,
  Plus,
  Trash2,
  Save,
  Calendar,
  RotateCcw,
  History,
  CheckCircle2,
  Edit3,
  FlaskConical,
  Filter,
} from 'lucide-react';
import {
  FOLIAR_DOSE_UNITS,
  FOLIAR_PARCHONEO_MODULES,
  FoliarDoseUnit,
  IRRIGATION_APPLICATION_METHODS,
  IRRIGATION_OBJECTIVE_SUGGESTIONS,
  IrrigationApplication,
  IrrigationApplicationMethod,
  IrrigationProductRow,
  SupplyItem,
} from '../../types/greenhouse';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  calculateDoseCost,
  formatMoneyMXN,
  getMinimumUnitCost,
  getTodayLocalISO,
  inferPresentation,
  resolveEffectivePurchaseCost,
  round2,
} from '../../utils/foliarCalculations';
import { AgrochemicalsCatalogPanel } from '../foliar/AgrochemicalsCatalogPanel';

const createEmptyRow = (): IrrigationProductRow => ({
  id: `irr-row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productId: '',
  productName: '',
  objective: '',
  dose: 0,
  unit: 'ml',
  calculatedCost: 0,
});

const METHOD_LABEL: Record<IrrigationApplicationMethod, string> = {
  aspersion: 'Aspersión',
  regadera: 'Regadera',
  pasillo: 'Pasillo',
};

const METHOD_BADGE_STYLE: Record<IrrigationApplicationMethod, string> = {
  aspersion: 'bg-[#f7f8f2] text-[#535B28] border-[#dce4bf]',
  regadera: 'bg-[#fcf8ee] text-[#8a6d2b] border-[#e6d5a9]',
  pasillo: 'bg-[#fbf2f4] text-[#5C1125] border-[#ebccd4]',
};

export const RiegoApplicationsView: React.FC = () => {
  const {
    supplyItems,
    supplyPurchases,
    irrigationApplications,
    saveIrrigationApplication,
    deleteIrrigationApplication,
  } = useGreenhouse();

  const [applicationDate, setApplicationDate] = useState<string>(getTodayLocalISO);
  const [moduleName, setModuleName] = useState<string>(FOLIAR_PARCHONEO_MODULES[0]);
  const [applicationMethod, setApplicationMethod] =
    useState<IrrigationApplicationMethod>('aspersion');
  const [waterLiters, setWaterLiters] = useState<string>('');
  const [rows, setRows] = useState<IrrigationProductRow[]>(() => [createEmptyRow()]);
  const [notes, setNotes] = useState<string>('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  // History filters
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterMethod, setFilterMethod] = useState<string>('');

  const availableProducts = useMemo(() => {
    const greenhouse = supplyItems.filter(
      (s) => s.active !== false && s.area === 'invernadero'
    );
    const list = greenhouse.length > 0 ? greenhouse : supplyItems.filter((s) => s.active !== false);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [supplyItems]);

  const productById = useMemo(() => {
    const map = new Map<string, SupplyItem>();
    supplyItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [supplyItems]);

  const computedRows = useMemo(() => {
    return rows.map((row) => {
      const product = row.productId ? productById.get(row.productId) : undefined;
      const { cost, conversionNote } = calculateDoseCost(
        row.dose,
        row.unit,
        product,
        supplyPurchases
      );
      return {
        ...row,
        productName: product ? product.name : row.productName,
        calculatedCost: cost,
        conversionNote,
      };
    });
  }, [rows, productById, supplyPurchases]);

  const totalCost = useMemo(
    () => round2(computedRows.reduce((sum, r) => sum + r.calculatedCost, 0)),
    [computedRows]
  );

  const filteredHistory = useMemo(() => {
    return irrigationApplications.filter((entry) => {
      if (filterDate && entry.applicationDate !== filterDate) return false;
      if (filterModule && entry.moduleName !== filterModule) return false;
      if (filterMethod && entry.applicationMethod !== filterMethod) return false;
      return true;
    });
  }, [irrigationApplications, filterDate, filterModule, filterMethod]);

  const historyTotalCost = useMemo(
    () => round2(filteredHistory.reduce((sum, e) => sum + Number(e.totalCost || 0), 0)),
    [filteredHistory]
  );

  const showNotice = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setFeedback({ tone, text });
    window.setTimeout(() => setFeedback(null), 4500);
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      return next.length > 0 ? next : [createEmptyRow()];
    });
  };

  const handleUpdateRow = (rowId: string, patch: Partial<IrrigationProductRow>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const handleSelectProduct = (rowId: string, productId: string) => {
    const product = productById.get(productId);
    if (!product) {
      handleUpdateRow(rowId, { productId: '', productName: '', calculatedCost: 0 });
      return;
    }
    const pres = inferPresentation(product);
    const defaultUnit: FoliarDoseUnit = pres === 'polvo' ? 'g' : 'ml';
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          productId: product.id,
          productName: product.name,
          unit: defaultUnit,
          objective: r.objective.trim() ? r.objective : product.purpose || '',
        };
      })
    );
  };

  const handleResetForm = () => {
    setEditingRecordId(null);
    setApplicationDate(getTodayLocalISO());
    setModuleName(FOLIAR_PARCHONEO_MODULES[0]);
    setApplicationMethod('aspersion');
    setWaterLiters('');
    setRows([createEmptyRow()]);
    setNotes('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedRows: IrrigationProductRow[] = computedRows
      .filter((r) => r.productId || r.productName.trim() || r.dose > 0 || r.objective.trim())
      .map(({ conversionNote: _cn, ...rest }) => rest);

    if (cleanedRows.length === 0) {
      showNotice('Agrega al menos un producto y su dosis antes de guardar el riego.', 'warn');
      return;
    }

    setSaving(true);
    const res = await saveIrrigationApplication(
      {
        applicationDate,
        moduleName,
        applicationMethod,
        waterLiters: Math.max(0, Number(waterLiters || 0)),
        rows: cleanedRows,
        totalCost,
        notes: notes.trim() || undefined,
      },
      editingRecordId || undefined
    );
    setSaving(false);

    if (res.ok) {
      showNotice(
        res.cloudSynced
          ? `Aplicación de riego (${METHOD_LABEL[applicationMethod]}) guardada y sincronizada (${formatMoneyMXN(totalCost)}).`
          : `Aplicación de riego (${METHOD_LABEL[applicationMethod]}) guardada localmente (${formatMoneyMXN(totalCost)}).`
      );
      handleResetForm();
    }
  };

  const handleLoadForEdit = (rec: IrrigationApplication) => {
    setEditingRecordId(rec.id);
    setApplicationDate(rec.applicationDate);
    setModuleName(rec.moduleName);
    setApplicationMethod(rec.applicationMethod);
    setWaterLiters(rec.waterLiters > 0 ? String(rec.waterLiters) : '');
    setRows(rec.rows.length > 0 ? rec.rows : [createEmptyRow()]);
    setNotes(rec.notes || '');
    showNotice(`Registro de riego del ${rec.applicationDate} cargado para edición.`);
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    await deleteIrrigationApplication(id);
    if (editingRecordId === id) {
      handleResetForm();
    }
    showNotice('Registro de riego eliminado.');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Shared datalist for irrigation objectives */}
      <datalist id="riego-objective-suggestions">
        {IRRIGATION_OBJECTIVE_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {/* Main Capture Card */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
      >
        {/* Header Bar */}
        <div className="px-5 sm:px-6 py-4 bg-[#FAF8F5] border-b border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5C1125] text-[#C3A25D] flex items-center justify-center shrink-0">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#000000] tracking-tight">
                {editingRecordId ? 'Editar Aplicación de Riego' : 'Registro de Riego y Fertirrigación'}
              </h2>
              <p className="text-xs text-stone-600 mt-0.5">
                Selecciona el tipo de aplicación (Aspersión, Regadera o Pasillo), los productos, su objetivo y calcula el costo exacto de la dosis.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCatalog(true)}
              className="h-10 px-3.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-[#000000] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <FlaskConical className="w-4 h-4 text-[#535B28]" />
              <span>Catálogo de Productos ({availableProducts.length})</span>
            </button>

            {editingRecordId && (
              <button
                type="button"
                onClick={handleResetForm}
                className="h-10 px-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nuevo registro</span>
              </button>
            )}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {feedback && (
            <div
              className={`px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                feedback.tone === 'ok'
                  ? 'bg-[#f7f8f2] border-[#dce4bf] text-[#535B28]'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Row 1: Date, Module, Water Volume */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="riego-date"
                className="block text-xs font-bold text-stone-700 mb-1.5"
              >
                Fecha *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#5C1125] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="riego-date"
                  type="date"
                  required
                  value={applicationDate}
                  onChange={(e) => setApplicationDate(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="riego-module"
                className="block text-xs font-bold text-stone-700 mb-1.5"
              >
                Unidad / Módulo *
              </label>
              <select
                id="riego-module"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
              >
                {FOLIAR_PARCHONEO_MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="riego-water"
                className="block text-xs font-bold text-stone-700 mb-1.5"
              >
                Volumen de agua (litros)
              </label>
              <input
                id="riego-water"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="Ej. 200, 400, 1000"
                value={waterLiters}
                onChange={(e) => setWaterLiters(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-bold text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Row 2: Tipo de aplicación (Aspersión / Regadera / Pasillo) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-700">
              Tipo de aplicación realizada *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {IRRIGATION_APPLICATION_METHODS.map((method) => {
                const isSelected = applicationMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setApplicationMethod(method.id)}
                    aria-pressed={isSelected}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#5C1125] border-[#5C1125] text-white shadow-xs'
                        : 'bg-[#FAF8F5] border-stone-200 text-[#000000] hover:border-[#C3A25D]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold">{method.label}</span>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#C3A25D]' : 'border-stone-300'
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-[#C3A25D]" />}
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-0.5 ${
                        isSelected ? 'text-[#e5d2a4]' : 'text-stone-500'
                      }`}
                    >
                      {method.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Dynamic Products Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#000000]">
                  Productos aplicados en este riego
                </h3>
                <p className="text-xs text-stone-500">
                  El costo de la dosis se calcula automáticamente con el precio de compra del producto.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRow}
                className="h-9 px-3.5 rounded-xl bg-[#535B28] hover:bg-[#3f461d] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-[#C3A25D]" />
                <span>+ Agregar producto</span>
              </button>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block rounded-xl border border-stone-200 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-stone-200 text-xs font-bold text-stone-600">
                    <th className="py-3 pl-4 pr-3 w-[250px]">Producto</th>
                    <th className="py-3 px-3 min-w-[200px]">Objetivo (función del producto)</th>
                    <th className="py-3 px-3 w-[120px] text-right">Dosis</th>
                    <th className="py-3 px-3 w-[100px]">Unidad</th>
                    <th className="py-3 px-3 w-[180px] text-right">Costo de la dosis aplicada</th>
                    <th className="py-3 pl-3 pr-4 w-[68px] text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {computedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF8F5]/60">
                      <td className="py-2.5 pl-4 pr-3">
                        <select
                          aria-label="Producto aplicado en riego"
                          value={row.productId}
                          onChange={(e) => handleSelectProduct(row.id, e.target.value)}
                          className="w-full h-10 px-2.5 rounded-lg border border-stone-200 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                        >
                          <option value="">Seleccionar producto...</option>
                          {availableProducts.map((item) => {
                            const eff = resolveEffectivePurchaseCost(item, supplyPurchases);
                            const min = getMinimumUnitCost(
                              eff.unitCost,
                              eff.unit,
                              inferPresentation(item)
                            );
                            return (
                              <option key={item.id} value={item.id}>
                                {item.name} ({formatMoneyMXN(min.costPerMinUnit)}/{min.minUnit})
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          list="riego-objective-suggestions"
                          placeholder="Ej. Enraizamiento, Nutrición, Desinfección..."
                          value={row.objective}
                          onChange={(e) =>
                            handleUpdateRow(row.id, { objective: e.target.value })
                          }
                          className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          placeholder="0"
                          value={row.dose === 0 ? '' : row.dose}
                          onChange={(e) =>
                            handleUpdateRow(row.id, {
                              dose:
                                e.target.value === ''
                                  ? 0
                                  : Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm font-bold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <select
                          aria-label="Unidad de dosis"
                          value={row.unit}
                          onChange={(e) =>
                            handleUpdateRow(row.id, {
                              unit: e.target.value as FoliarDoseUnit,
                            })
                          }
                          className="w-full h-10 px-2.5 rounded-lg border border-stone-200 bg-white text-sm font-semibold text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                        >
                          {FOLIAR_DOSE_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="text-sm font-extrabold text-[#000000] tabular-nums">
                          {formatMoneyMXN(row.calculatedCost)}
                        </div>
                        {row.conversionNote && (
                          <div className="text-[11px] text-stone-500 tabular-nums">
                            = {row.conversionNote}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 pl-3 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="w-8 h-8 rounded-lg border border-stone-200 hover:border-[#5C1125] hover:text-[#5C1125] text-stone-400 inline-flex items-center justify-center transition cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards */}
            <div className="lg:hidden space-y-3">
              {computedRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="p-4 rounded-xl border border-stone-200 bg-[#FAF8F5]/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#5C1125]">
                      Producto #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-[#5C1125] inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Producto
                      </label>
                      <select
                        value={row.productId}
                        onChange={(e) => handleSelectProduct(row.id, e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm font-medium text-[#000000]"
                      >
                        <option value="">Seleccionar producto...</option>
                        {availableProducts.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Objetivo (función del producto)
                      </label>
                      <input
                        type="text"
                        list="riego-objective-suggestions"
                        placeholder="Ej. Nutrición, Enraizamiento..."
                        value={row.objective}
                        onChange={(e) =>
                          handleUpdateRow(row.id, { objective: e.target.value })
                        }
                        className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm text-[#000000]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Dosis
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        placeholder="0"
                        value={row.dose === 0 ? '' : row.dose}
                        onChange={(e) =>
                          handleUpdateRow(row.id, {
                            dose:
                              e.target.value === ''
                                ? 0
                                : Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-[#000000] tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Unidad
                      </label>
                      <select
                        value={row.unit}
                        onChange={(e) =>
                          handleUpdateRow(row.id, {
                            unit: e.target.value as FoliarDoseUnit,
                          })
                        }
                        className="w-full h-10 px-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-[#000000]"
                      >
                        {FOLIAR_DOSE_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Costo dosis
                      </label>
                      <div className="h-10 px-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-end text-sm font-extrabold text-[#5C1125] tabular-nums">
                        {formatMoneyMXN(row.calculatedCost)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes + Summary Footer */}
          <div className="bg-[#5C1125] text-white rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <p className="text-xs font-bold text-[#C3A25D]">
                {moduleName} &bull; Tipo: {METHOD_LABEL[applicationMethod]}
                {Number(waterLiters || 0) > 0 ? ` • ${Number(waterLiters).toLocaleString('es-MX')} L` : ''}
              </p>
              <input
                type="text"
                placeholder="Observaciones opcionales (pH, CE, turno, operador)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full max-w-xl h-9 px-3 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-stone-300 focus:outline-none focus:border-[#C3A25D]"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
              <div className="sm:text-right">
                <div className="text-xs text-[#d6be83] font-semibold">
                  Costo total de dosis aplicadas
                </div>
                <div className="text-2xl font-extrabold text-white tabular-nums">
                  {formatMoneyMXN(totalCost)}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="h-11 px-5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-sm font-extrabold inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>
                  {saving
                    ? 'Guardando...'
                    : editingRecordId
                    ? 'Actualizar riego'
                    : 'Guardar aplicación de riego'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Filterable History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 bg-[#FAF8F5] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#5C1125]" />
            <h3 className="text-sm font-extrabold text-[#000000]">
              Historial de Riego ({filteredHistory.length})
            </h3>
            {filteredHistory.length > 0 && (
              <span className="text-xs font-bold text-[#5C1125] tabular-nums">
                &bull; Total: {formatMoneyMXN(historyTotalCost)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
            <input
              type="date"
              aria-label="Filtrar por fecha"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-[#000000]"
            />
            <select
              aria-label="Filtrar por módulo"
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-[#000000]"
            >
              <option value="">Todos los módulos</option>
              {FOLIAR_PARCHONEO_MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por tipo de aplicación"
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-[#000000]"
            >
              <option value="">Todos los tipos</option>
              {IRRIGATION_APPLICATION_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {(filterDate || filterModule || filterMethod) && (
              <button
                type="button"
                onClick={() => {
                  setFilterDate('');
                  setFilterModule('');
                  setFilterMethod('');
                }}
                className="h-9 px-2.5 rounded-lg text-xs font-bold text-[#5C1125] hover:bg-stone-100 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-stone-500">
            Aún no hay aplicaciones de riego registradas con los filtros actuales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-white border-b border-stone-200 text-xs font-bold text-stone-600">
                  <th className="py-3 pl-5 pr-3 whitespace-nowrap">Fecha</th>
                  <th className="py-3 px-3 whitespace-nowrap">Módulo</th>
                  <th className="py-3 px-3 whitespace-nowrap">Tipo de aplicación</th>
                  <th className="py-3 px-3 min-w-[280px]">Productos, Objetivo y Costo de Dosis</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Costo Total</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#FAF8F5]/60 align-top">
                    <td className="py-3 pl-5 pr-3 font-semibold text-[#000000] tabular-nums whitespace-nowrap">
                      {rec.applicationDate}
                      {rec.waterLiters > 0 && (
                        <div className="text-[11px] font-normal text-stone-500">
                          {rec.waterLiters.toLocaleString('es-MX')} L agua
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-stone-800 whitespace-nowrap">
                      {rec.moduleName}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg border text-xs font-bold ${
                          METHOD_BADGE_STYLE[rec.applicationMethod]
                        }`}
                      >
                        {METHOD_LABEL[rec.applicationMethod]}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1.5">
                        {rec.rows.map((r) => (
                          <div
                            key={r.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs bg-[#FAF8F5] px-2.5 py-1.5 rounded-lg border border-stone-100"
                          >
                            <div>
                              <span className="font-bold text-[#000000]">
                                {r.productName || 'Producto'}
                              </span>
                              <span className="text-stone-600 font-semibold ml-1.5 tabular-nums">
                                ({r.dose} {r.unit})
                              </span>
                              {r.objective && (
                                <span className="text-stone-500 ml-1.5">
                                  &bull; Obj: {r.objective}
                                </span>
                              )}
                            </div>
                            <span className="font-extrabold text-[#535B28] tabular-nums">
                              {formatMoneyMXN(r.calculatedCost)}
                            </span>
                          </div>
                        ))}
                        {rec.notes && (
                          <p className="text-[11px] text-stone-500 italic">{rec.notes}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-[#5C1125] tabular-nums whitespace-nowrap">
                      {formatMoneyMXN(rec.totalCost)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                      {confirmDeleteId === rec.id ? (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                          <button
                            type="button"
                            onClick={() => handleDelete(rec.id)}
                            className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <span className="text-stone-300">|</span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-stone-500 hover:underline cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadForEdit(rec)}
                            className="w-8 h-8 rounded-lg border border-stone-200 hover:border-[#5C1125] hover:text-[#5C1125] text-stone-500 inline-flex items-center justify-center transition cursor-pointer"
                            title="Editar aplicación"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(rec.id)}
                            className="w-8 h-8 rounded-lg border border-stone-200 hover:border-rose-500 hover:text-rose-600 text-stone-400 inline-flex items-center justify-center transition cursor-pointer"
                            title="Eliminar aplicación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shared Linked Agrochemicals & Fertilizers Catalog */}
      <AgrochemicalsCatalogPanel
        isOpen={showCatalog}
        onClose={() => setShowCatalog(false)}
      />
    </div>
  );
};
