import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Calendar,
  Droplets,
  RotateCcw,
  History,
  CheckCircle2,
  Edit3,
} from 'lucide-react';
import {
  FOLIAR_DOSE_UNITS,
  FOLIAR_OBJECTIVE_SUGGESTIONS,
  FOLIAR_PRODUCTION_UNITS,
  FoliarDoseUnit,
  FoliarGeneralApplication,
  FoliarGeneralProductRow,
  FoliarGeneralUnitBlock,
  SupplyItem,
} from '../../types/greenhouse';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  calculateDoseCost,
  formatMoneyMXN,
  getMinimumUnitCost,
  getTodayLocalISO,
  inferPresentation,
  normalizeFoliarUnit,
  resolveEffectivePurchaseCost,
  round2,
} from '../../utils/foliarCalculations';

const createEmptyRow = (): FoliarGeneralProductRow => ({
  id: `fgr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productId: '',
  productName: '',
  objective: '',
  dose: 0,
  unit: 'ml',
  calculatedCost: 0,
});

const createDefaultUnits = (): FoliarGeneralUnitBlock[] =>
  FOLIAR_PRODUCTION_UNITS.map((u) => ({
    unitId: u.id,
    unitName: u.name,
    waterLiters: u.defaultWaterLiters,
    rows: [createEmptyRow()],
    unitTotalCost: 0,
  }));

export const GeneralApplicationView: React.FC = () => {
  const {
    supplyItems,
    supplyPurchases,
    foliarGeneralApplications,
    saveFoliarGeneralApplication,
    deleteFoliarGeneralApplication,
    currentUser,
  } = useGreenhouse();

  const agrochemicals = useMemo(
    () =>
      supplyItems
        .filter((s) => s.active !== false && s.area === 'invernadero')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [supplyItems]
  );

  const productById = useMemo(() => {
    const map = new Map<string, SupplyItem>();
    agrochemicals.forEach((p) => map.set(p.id, p));
    return map;
  }, [agrochemicals]);

  const [applicationDate, setApplicationDate] = useState<string>(() => getTodayLocalISO());
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [units, setUnits] = useState<FoliarGeneralUnitBlock[]>(() => createDefaultUnits());
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Recalculate all costs live from current Compras/Inventario prices
  const computedUnits = useMemo(() => {
    return units.map((u) => {
      const nextRows = u.rows.map((row) => {
        const prod = row.productId ? productById.get(row.productId) : undefined;
        const { cost, conversionNote } = calculateDoseCost(
          row.dose,
          row.unit,
          prod,
          supplyPurchases
        );
        return {
          ...row,
          productName: prod ? prod.name : row.productName,
          calculatedCost: cost,
          conversionNote,
        };
      });
      const unitTotalCost = round2(
        nextRows.reduce((acc, r) => acc + Number(r.calculatedCost || 0), 0)
      );
      return {
        ...u,
        rows: nextRows,
        unitTotalCost,
      };
    });
  }, [units, productById, supplyPurchases]);

  const totals = useMemo(() => {
    const grandTotalCost = round2(
      computedUnits.reduce((acc, u) => acc + Number(u.unitTotalCost || 0), 0)
    );
    const totalWaterLiters = round2(
      computedUnits.reduce((acc, u) => acc + Math.max(0, Number(u.waterLiters || 0)), 0)
    );
    const totalProductsCount = computedUnits.reduce(
      (acc, u) => acc + u.rows.filter((r) => r.productId || r.productName).length,
      0
    );
    return { grandTotalCost, totalWaterLiters, totalProductsCount };
  }, [computedUnits]);

  const showNotice = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setFeedback({ text, tone });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const handleWaterChange = (unitId: string, raw: string) => {
    const val = raw === '' ? 0 : Math.max(0, Number(raw) || 0);
    setUnits((prev) =>
      prev.map((u) => (u.unitId === unitId ? { ...u, waterLiters: val } : u))
    );
  };

  const handleAddProductRow = (unitId: string) => {
    setUnits((prev) =>
      prev.map((u) =>
        u.unitId === unitId ? { ...u, rows: [...u.rows, createEmptyRow()] } : u
      )
    );
  };

  const handleRemoveProductRow = (unitId: string, rowId: string) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.unitId !== unitId) return u;
        const remaining = u.rows.filter((r) => r.id !== rowId);
        return { ...u, rows: remaining.length > 0 ? remaining : [createEmptyRow()] };
      })
    );
  };

  const handleUpdateRow = (
    unitId: string,
    rowId: string,
    patch: Partial<FoliarGeneralProductRow>
  ) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.unitId !== unitId) return u;
        return {
          ...u,
          rows: u.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
        };
      })
    );
  };

  const handleSelectProduct = (unitId: string, rowId: string, productId: string) => {
    const prod = productById.get(productId);
    if (!prod) {
      handleUpdateRow(unitId, rowId, { productId: '', productName: '' });
      return;
    }
    const pres = inferPresentation(prod);
    const defaultDoseUnit: FoliarDoseUnit = pres === 'polvo' ? 'g' : 'ml';
    handleUpdateRow(unitId, rowId, {
      productId: prod.id,
      productName: prod.name,
      unit: defaultDoseUnit,
    });
  };

  const handleResetForm = () => {
    setEditingRecordId(null);
    setApplicationDate(getTodayLocalISO());
    setUnits(createDefaultUnits());
    setNotes('');
  };

  const handleSaveGeneral = async () => {
    if (totals.totalProductsCount === 0) {
      showNotice('Agrega al menos un producto en alguna Unidad de Producción antes de guardar.', 'warn');
      return;
    }

    const sanitizedUnits: FoliarGeneralUnitBlock[] = computedUnits.map((u) => ({
      unitId: u.unitId,
      unitName: u.unitName,
      waterLiters: Math.max(0, Number(u.waterLiters || 0)),
      rows: u.rows
        .filter((r) => r.productId || r.productName || r.dose > 0 || r.objective.trim())
        .map(({ conversionNote: _ignore, ...cleanRow }) => cleanRow),
      unitTotalCost: u.unitTotalCost,
    }));

    setSaving(true);
    const res = await saveFoliarGeneralApplication(
      {
        applicationDate,
        units: sanitizedUnits,
        totalWaterLiters: totals.totalWaterLiters,
        totalProductsCount: totals.totalProductsCount,
        grandTotalCost: totals.grandTotalCost,
        notes: notes.trim(),
        createdBy: currentUser?.fullName || '',
      },
      editingRecordId || undefined
    );
    setSaving(false);

    if (res.entry) {
      setEditingRecordId(res.entry.id);
    }
    showNotice(
      res.cloudSynced
        ? `Aplicación general del ${applicationDate} guardada en Supabase.`
        : `Aplicación general del ${applicationDate} guardada localmente.`,
      res.cloudSynced ? 'ok' : 'warn'
    );
  };

  const handleLoadRecord = (rec: FoliarGeneralApplication) => {
    setEditingRecordId(rec.id);
    setApplicationDate(rec.applicationDate);
    setNotes(rec.notes || '');
    const mergedUnits: FoliarGeneralUnitBlock[] = FOLIAR_PRODUCTION_UNITS.map((def) => {
      const savedUnit = rec.units.find((u) => u.unitId === def.id || u.unitName === def.name);
      if (savedUnit) {
        return {
          ...savedUnit,
          rows:
            savedUnit.rows && savedUnit.rows.length > 0
              ? savedUnit.rows
              : [createEmptyRow()],
        };
      }
      return {
        unitId: def.id,
        unitName: def.name,
        waterLiters: def.defaultWaterLiters,
        rows: [createEmptyRow()],
        unitTotalCost: 0,
      };
    });
    setUnits(mergedUnits);
    showNotice(`Jornada del ${rec.applicationDate} cargada para consulta o edición.`);
  };

  const handleDeleteRecord = async (id: string) => {
    setConfirmDeleteId(null);
    await deleteFoliarGeneralApplication(id);
    if (editingRecordId === id) {
      handleResetForm();
    }
    showNotice('Registro de aplicación general eliminado.');
  };

  return (
    <div className="space-y-6">
      {/* Shared datalist for Objetivo suggestions */}
      <datalist id="foliar-objective-suggestions">
        {FOLIAR_OBJECTIVE_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {/* Top Date & Jornada Grand Total Strip */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="foliar-general-date"
              className="text-xs font-bold text-stone-600 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Calendar className="w-4 h-4 text-[#5C1125]" />
              <span>Fecha de aplicación</span>
            </label>
            <input
              id="foliar-general-date"
              type="date"
              value={applicationDate}
              onChange={(e) => setApplicationDate(e.target.value)}
              className="h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
            />
          </div>

          {editingRecordId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="h-10 px-3 rounded-xl border border-stone-200 bg-[#FAF8F5] hover:bg-stone-100 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Nueva jornada</span>
            </button>
          )}
        </div>

        {/* Right Grand Total + Save Action */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4">
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-[11px] font-semibold text-stone-500">
                Volumen total
              </div>
              <div className="text-sm font-bold text-[#000000] tabular-nums">
                {totals.totalWaterLiters.toLocaleString('es-MX')} L
              </div>
            </div>
            <div className="h-8 w-px bg-stone-200" />
            <div>
              <div className="text-[11px] font-semibold text-stone-500">
                Costo total general
              </div>
              <div className="text-xl font-extrabold text-[#5C1125] tabular-nums leading-tight">
                {formatMoneyMXN(totals.grandTotalCost)}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveGeneral}
            className="h-10 px-4 rounded-xl bg-[#5C1125] hover:bg-[#460c1b] text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Save className="w-4 h-4 text-[#C3A25D]" />
            <span>
              {saving
                ? 'Guardando...'
                : editingRecordId
                ? 'Actualizar jornada'
                : 'Guardar aplicación'}
            </span>
          </button>
        </div>
      </div>

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

      {/* 3 Independent Production Unit Blocks */}
      <div className="space-y-5">
        {computedUnits.map((unit) => (
          <section
            key={unit.unitId}
            className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
          >
            {/* Unit Header Bar */}
            <div className="px-4 sm:px-6 py-4 bg-[#FAF8F5] border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#000000] tracking-tight">
                  {unit.unitName}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Captura los productos de la mezcla (incluyendo adherente al final)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Editable Water Volume (L) */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200">
                  <Droplets className="w-4 h-4 text-[#535B28] shrink-0" />
                  <label
                    htmlFor={`water-${unit.unitId}`}
                    className="text-xs font-semibold text-stone-600 whitespace-nowrap"
                  >
                    Agua:
                  </label>
                  <input
                    id={`water-${unit.unitId}`}
                    type="number"
                    min={0}
                    step="any"
                    value={unit.waterLiters === 0 ? '' : unit.waterLiters}
                    onChange={(e) => handleWaterChange(unit.unitId, e.target.value)}
                    className="w-24 h-8 px-2 rounded-lg border border-stone-200 text-sm font-extrabold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs font-bold text-stone-500">litros</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddProductRow(unit.unitId)}
                  className="h-10 px-3.5 rounded-xl bg-[#535B28] hover:bg-[#3f461d] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 text-[#C3A25D]" />
                  <span>+ Agregar producto</span>
                </button>
              </div>
            </div>

            {/* DESKTOP TABLE (lg+) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-bold text-stone-600 bg-white">
                    <th className="py-3 pl-6 pr-3 w-[270px]">Producto</th>
                    <th className="py-3 px-3 min-w-[190px]">Objetivo</th>
                    <th className="py-3 px-3 w-[125px] text-right">Dosis</th>
                    <th className="py-3 px-3 w-[105px]">Unidad</th>
                    <th className="py-3 px-3 w-[170px] text-right">Costo calculado</th>
                    <th className="py-3 pl-3 pr-6 w-[76px] text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {unit.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      {/* 1. Producto */}
                      <td className="py-2.5 pl-6 pr-3">
                        <select
                          aria-label="Producto agroquímico"
                          value={row.productId}
                          onChange={(e) =>
                            handleSelectProduct(unit.unitId, row.id, e.target.value)
                          }
                          className="w-full h-10 px-2.5 rounded-lg border border-stone-200 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                        >
                          <option value="">Seleccionar producto...</option>
                          {agrochemicals.map((item) => {
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

                      {/* 2. Objetivo */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          list="foliar-objective-suggestions"
                          aria-label="Objetivo o plaga a tratar"
                          placeholder="Ej. Cenicilla, Peronospora..."
                          value={row.objective}
                          onChange={(e) =>
                            handleUpdateRow(unit.unitId, row.id, {
                              objective: e.target.value,
                            })
                          }
                          className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                        />
                      </td>

                      {/* 3. Dosis */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          aria-label="Dosis"
                          placeholder="0"
                          value={row.dose === 0 ? '' : row.dose}
                          onChange={(e) =>
                            handleUpdateRow(unit.unitId, row.id, {
                              dose: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm font-bold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>

                      {/* 4. Unidad */}
                      <td className="py-2.5 px-3">
                        <select
                          aria-label="Unidad de dosis"
                          value={row.unit}
                          onChange={(e) =>
                            handleUpdateRow(unit.unitId, row.id, {
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

                      {/* 5. Costo calculado (read-only) */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="h-10 px-3 rounded-lg bg-[#FAF8F5] border border-stone-200/80 flex flex-col justify-center items-end">
                          <span className="text-sm font-extrabold text-[#000000] tabular-nums leading-tight">
                            {formatMoneyMXN(row.calculatedCost)}
                          </span>
                          {row.conversionNote && (
                            <span className="text-[10px] text-stone-500 tabular-nums leading-tight">
                              = {row.conversionNote}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Acción */}
                      <td className="py-2.5 pl-3 pr-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveProductRow(unit.unitId, row.id)}
                          className="w-9 h-9 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 text-stone-400 hover:text-[#5C1125] inline-flex items-center justify-center transition cursor-pointer"
                          title="Eliminar renglón"
                          aria-label="Eliminar renglón"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE & TABLET STACKED CARDS (<lg) */}
            <div className="lg:hidden divide-y divide-stone-100">
              {unit.rows.map((row, idx) => (
                <div key={row.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-500">
                      Producto #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveProductRow(unit.unitId, row.id)}
                      className="h-8 px-2.5 rounded-lg border border-stone-200 text-stone-500 hover:text-[#5C1125] inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Producto
                      </label>
                      <select
                        value={row.productId}
                        onChange={(e) =>
                          handleSelectProduct(unit.unitId, row.id, e.target.value)
                        }
                        className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-sm font-medium text-[#000000]"
                      >
                        <option value="">Seleccionar producto...</option>
                        {agrochemicals.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Objetivo
                      </label>
                      <input
                        type="text"
                        list="foliar-objective-suggestions"
                        placeholder="Ej. Cenicilla, Peronospora..."
                        value={row.objective}
                        onChange={(e) =>
                          handleUpdateRow(unit.unitId, row.id, { objective: e.target.value })
                        }
                        className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-sm text-[#000000]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
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
                          handleUpdateRow(unit.unitId, row.id, {
                            dose: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-[#000000] tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Unidad
                      </label>
                      <select
                        value={row.unit}
                        onChange={(e) =>
                          handleUpdateRow(unit.unitId, row.id, {
                            unit: e.target.value as FoliarDoseUnit,
                          })
                        }
                        className="w-full h-11 px-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-[#000000]"
                      >
                        {FOLIAR_DOSE_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Costo
                      </label>
                      <div className="h-11 px-2.5 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-end text-sm font-extrabold text-[#000000] tabular-nums">
                        {formatMoneyMXN(row.calculatedCost)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Unit Footer: Mezcla Total */}
            <div className="px-4 sm:px-6 py-3 bg-[#FAF8F5]/80 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleAddProductRow(unit.unitId)}
                className="text-xs font-bold text-[#5C1125] hover:text-[#3f0918] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar otro producto a {unit.unitName}</span>
              </button>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-stone-600 font-medium">Costo total de la mezcla:</span>
                <span className="text-base font-extrabold text-[#000000] tabular-nums">
                  {formatMoneyMXN(unit.unitTotalCost)}
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Jornada Closing Breakdown Card */}
      <div className="bg-[#5C1125] text-white rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2 flex-1">
          <p className="text-xs font-bold text-[#C3A25D]">
            Resumen de Jornada · {applicationDate}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs sm:text-sm text-stone-200 tabular-nums">
            {computedUnits.map((u) => (
              <span key={u.unitId}>
                {u.unitName.replace('Unidad de Producción ', '')}:{' '}
                <strong className="text-white">{formatMoneyMXN(u.unitTotalCost)}</strong>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Observaciones opcionales de la jornada (clima, operador, notas)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full max-w-xl h-9 px-3 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-stone-300 focus:outline-none focus:border-[#C3A25D]"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
          <div className="sm:text-right">
            <div className="text-xs text-[#d6be83] font-semibold">
              Costo total general
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight">
              {formatMoneyMXN(totals.grandTotalCost)}
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveGeneral}
            className="h-11 px-5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-sm font-extrabold inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Guardar jornada'}</span>
          </button>
        </div>
      </div>

      {/* Saved General Applications History */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#5C1125]" />
            <h3 className="text-sm font-bold text-[#000000]">
              Historial de Aplicaciones Generales ({foliarGeneralApplications.length})
            </h3>
          </div>
        </div>

        {foliarGeneralApplications.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-stone-500">
            Aún no hay jornadas de aplicación general guardadas. Captura las mezclas arriba y
            presiona <strong>Guardar jornada</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-stone-200 text-xs font-bold text-stone-600">
                  <th className="py-3 pl-5 pr-3">Fecha</th>
                  <th className="py-3 px-3">Desglose por Unidad</th>
                  <th className="py-3 px-3 text-right">Agua Total</th>
                  <th className="py-3 px-3 text-right">Costo General</th>
                  <th className="py-3 pl-3 pr-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {foliarGeneralApplications.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#FAF8F5]/70 transition-colors">
                    <td className="py-3 pl-5 pr-3 font-bold text-[#000000] tabular-nums whitespace-nowrap">
                      {rec.applicationDate}
                    </td>
                    <td className="py-3 px-3 text-xs text-stone-600">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {rec.units.map((u) => (
                          <span key={u.unitId} className="tabular-nums">
                            <strong className="text-stone-800">
                              {u.unitName.replace('Unidad de Producción ', '')}
                            </strong>
                            : {u.rows.length} prod. ({formatMoneyMXN(u.unitTotalCost)})
                          </span>
                        ))}
                      </div>
                      {rec.notes && (
                        <div className="text-[11px] text-stone-400 mt-0.5">{rec.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-stone-700 tabular-nums whitespace-nowrap">
                      {rec.totalWaterLiters.toLocaleString('es-MX')} L
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-[#5C1125] tabular-nums whitespace-nowrap">
                      {formatMoneyMXN(rec.grandTotalCost)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {confirmDeleteId === rec.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                            >
                              Borrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-semibold cursor-pointer"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleLoadRecord(rec)}
                              className="h-8 px-2.5 rounded-lg border border-stone-200 hover:border-[#535B28] text-stone-600 hover:text-[#535B28] text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Abrir</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(rec.id)}
                              className="w-8 h-8 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 text-stone-400 hover:text-[#5C1125] inline-flex items-center justify-center transition cursor-pointer"
                              aria-label="Eliminar jornada"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
