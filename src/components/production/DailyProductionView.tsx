import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Layers,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  UserCheck,
  Users,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  AromaProduct,
  DailyProductionEntry,
  DailyProductionRow,
} from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';

const getTodayDate = (): string => new Date().toISOString().slice(0, 10);

const parsePositiveInt = (raw: string): number => {
  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (!digitsOnly) return 0;
  const parsed = parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const buildRowsFromCatalog = (
  products: AromaProduct[],
  existingEntry?: DailyProductionEntry
): DailyProductionRow[] => {
  const activeCatalog = [...products]
    .filter((p) => p.active !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const existingMap = new Map<string, DailyProductionRow>();
  existingEntry?.rows.forEach((r) => {
    existingMap.set(r.productName.trim().toUpperCase(), r);
  });

  const rows: DailyProductionRow[] = activeCatalog.map((prod) => {
    const prev = existingMap.get(prod.name.trim().toUpperCase());
    if (prev) {
      const lar = prod.captureMode === 'direct_total' ? 0 : Number(prev.lar || 0);
      const med = prod.captureMode === 'direct_total' ? 0 : Number(prev.med || 0);
      const chi = prod.captureMode === 'direct_total' ? 0 : Number(prev.chi || 0);
      const total =
        prod.captureMode === 'direct_total'
          ? Number(prev.total || 0)
          : lar + med + chi;
      return {
        productId: prod.id,
        productName: prod.name,
        captureMode: prod.captureMode,
        lar,
        med,
        chi,
        total,
      };
    }
    return {
      productId: prod.id,
      productName: prod.name,
      captureMode: prod.captureMode,
      lar: 0,
      med: 0,
      chi: 0,
      total: 0,
    };
  });

  return rows;
};

const computeTotals = (rows: DailyProductionRow[]) => {
  return rows.reduce(
    (acc, r) => {
      if (r.captureMode === 'direct_total') {
        acc.totalDirect += r.total;
        acc.grandTotal += r.total;
      } else {
        acc.totalLar += r.lar;
        acc.totalMed += r.med;
        acc.totalChi += r.chi;
        acc.grandTotal += r.lar + r.med + r.chi;
      }
      return acc;
    },
    { totalLar: 0, totalMed: 0, totalChi: 0, totalDirect: 0, grandTotal: 0 }
  );
};

export const DailyProductionView: React.FC = () => {
  const {
    currentUser,
    activeRole,
    appUsers,
    aromaProducts,
    dailyProductions,
    saveDailyProduction,
    deleteDailyProduction,
    refreshFromSupabase,
    isOnline,
    supabaseConfig,
  } = useGreenhouse();

  const isAdminView = activeRole === 'admin' && currentUser?.role === 'admin';

  // Selected date (shared across capture & admin consolidation)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate);

  // Admin sub-tabs: 'consolidado' | 'empleados' | 'capturar'
  const [adminTab, setAdminTab] = useState<'consolidado' | 'empleados' | 'capturar'>('consolidado');
  // Employee sub-tabs: 'captura' | 'historial'
  const [empTab, setEmpTab] = useState<'captura' | 'historial'>('captura');

  // Target employee when Admin is capturing/editing for someone
  const productionEmployees = useMemo(
    () =>
      appUsers.filter(
        (u) => u.active !== false && (u.role === 'produccion' || u.role === 'admin')
      ),
    [appUsers]
  );

  const [targetEmployeeId, setTargetEmployeeId] = useState<string>(
    () => currentUser?.id || ''
  );

  const effectiveEmployee = useMemo(() => {
    if (!isAdminView) return currentUser;
    return (
      appUsers.find((u) => u.id === targetEmployeeId) ||
      productionEmployees[0] ||
      currentUser
    );
  }, [isAdminView, currentUser, appUsers, targetEmployeeId, productionEmployees]);

  // Current employee entry for selectedDate
  const existingEntryForSelection = useMemo(() => {
    if (!effectiveEmployee) return undefined;
    return dailyProductions.find(
      (d) =>
        d.productionDate === selectedDate &&
        (d.employeeUserId === effectiveEmployee.id ||
          d.employeeUsername.toLowerCase() === effectiveEmployee.username.toLowerCase())
    );
  }, [dailyProductions, selectedDate, effectiveEmployee]);

  // Capture form state
  const [draftRows, setDraftRows] = useState<DailyProductionRow[]>(() =>
    buildRowsFromCatalog(aromaProducts, existingEntryForSelection)
  );
  const [notes, setNotes] = useState<string>(existingEntryForSelection?.notes || '');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sync draft rows whenever date, employee, catalog or existing saved entry changes
  useEffect(() => {
    setDraftRows(buildRowsFromCatalog(aromaProducts, existingEntryForSelection));
    setNotes(existingEntryForSelection?.notes || '');
  }, [
    selectedDate,
    effectiveEmployee?.id,
    aromaProducts,
    existingEntryForSelection?.id,
    existingEntryForSelection?.updatedAt,
  ]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const ok = await refreshFromSupabase();
    setIsRefreshing(false);
    showToast(
      ok
        ? 'Producción sincronizada con Supabase en tiempo real.'
        : 'Sin conexión a la nube; mostrando registros locales.'
    );
  };

  const handleCellChange = (
    productId: string,
    field: 'lar' | 'med' | 'chi' | 'direct',
    rawValue: string
  ) => {
    const num = parsePositiveInt(rawValue);
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.productId !== productId) return row;
        if (field === 'direct' || row.captureMode === 'direct_total') {
          return { ...row, lar: 0, med: 0, chi: 0, total: num };
        }
        const nextLar = field === 'lar' ? num : row.lar;
        const nextMed = field === 'med' ? num : row.med;
        const nextChi = field === 'chi' ? num : row.chi;
        return {
          ...row,
          lar: nextLar,
          med: nextMed,
          chi: nextChi,
          total: nextLar + nextMed + nextChi,
        };
      })
    );
  };

  const handleClearDraft = () => {
    setDraftRows(buildRowsFromCatalog(aromaProducts, undefined));
    setNotes('');
  };

  const draftTotals = useMemo(() => computeTotals(draftRows), [draftRows]);

  const handleSaveCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveEmployee) return;

    const nonZeroRows = draftRows.filter((r) => r.total > 0);
    const totals = computeTotals(nonZeroRows);

    saveDailyProduction(
      {
        productionDate: selectedDate,
        employeeUserId: effectiveEmployee.id,
        employeeUsername: effectiveEmployee.username,
        employeeName: effectiveEmployee.fullName,
        rows: nonZeroRows,
        totalLar: totals.totalLar,
        totalMed: totals.totalMed,
        totalChi: totals.totalChi,
        grandTotal: totals.grandTotal,
        notes: notes.trim() || undefined,
      },
      existingEntryForSelection?.id
    );

    showToast(
      `Producción del día guardada para ${effectiveEmployee.fullName} (${totals.grandTotal} total).`
    );
  };

  // ---------- Admin Consolidation Logic for selectedDate ----------
  const entriesForSelectedDate = useMemo(
    () =>
      dailyProductions
        .filter((d) => d.productionDate === selectedDate)
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    [dailyProductions, selectedDate]
  );

  // Distinct available dates in history (for quick filter pills)
  const availableDates = useMemo(() => {
    const set = new Set<string>([getTodayDate()]);
    dailyProductions.forEach((d) => {
      if (d.productionDate) set.add(d.productionDate);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [dailyProductions]);

  // Consolidated rows (CEDA CDMX style): sums all employees' production by product
  const consolidatedData = useMemo(() => {
    const catalogOrder = new Map<string, number>();
    const catalogMode = new Map<string, 'lar_med_chi' | 'direct_total'>();
    aromaProducts.forEach((p, idx) => {
      catalogOrder.set(p.name.trim().toUpperCase(), p.sortOrder || idx + 1);
      catalogMode.set(p.name.trim().toUpperCase(), p.captureMode);
    });

    interface ConsolidatedRow {
      productName: string;
      captureMode: 'lar_med_chi' | 'direct_total';
      lar: number;
      med: number;
      chi: number;
      total: number;
      byEmployee: Record<string, number>;
    }

    const rowMap = new Map<string, ConsolidatedRow>();

    // Seed active catalog items first so order matches Admin catalog
    [...aromaProducts]
      .filter((p) => p.active !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((p) => {
        rowMap.set(p.name.trim().toUpperCase(), {
          productName: p.name,
          captureMode: p.captureMode,
          lar: 0,
          med: 0,
          chi: 0,
          total: 0,
          byEmployee: {},
        });
      });

    // Aggregate every employee submission on selectedDate
    entriesForSelectedDate.forEach((entry) => {
      entry.rows.forEach((r) => {
        const key = r.productName.trim().toUpperCase();
        const mode = catalogMode.get(key) || r.captureMode;
        const current = rowMap.get(key) || {
          productName: r.productName,
          captureMode: mode,
          lar: 0,
          med: 0,
          chi: 0,
          total: 0,
          byEmployee: {},
        };

        if (mode === 'direct_total') {
          current.total += Number(r.total || 0);
        } else {
          current.lar += Number(r.lar || 0);
          current.med += Number(r.med || 0);
          current.chi += Number(r.chi || 0);
          current.total += Number(r.lar || 0) + Number(r.med || 0) + Number(r.chi || 0);
        }
        current.byEmployee[entry.employeeUserId] =
          (current.byEmployee[entry.employeeUserId] || 0) + Number(r.total || 0);
        rowMap.set(key, current);
      });
    });

    const list = Array.from(rowMap.values())
      .filter((r) => r.total > 0)
      .sort((a, b) => {
        const oa = catalogOrder.get(a.productName.trim().toUpperCase()) ?? 999;
        const ob = catalogOrder.get(b.productName.trim().toUpperCase()) ?? 999;
        return oa - ob;
      });

    const totals = list.reduce(
      (acc, r) => {
        if (r.captureMode === 'direct_total') {
          acc.totalDirect += r.total;
          acc.grandTotal += r.total;
        } else {
          acc.totalLar += r.lar;
          acc.totalMed += r.med;
          acc.totalChi += r.chi;
          acc.grandTotal += r.total;
        }
        return acc;
      },
      { totalLar: 0, totalMed: 0, totalChi: 0, totalDirect: 0, grandTotal: 0 }
    );

    return { rows: list, totals };
  }, [aromaProducts, entriesForSelectedDate]);

  // Active production-role employees who have NOT yet submitted on selectedDate
  const pendingEmployees = useMemo(() => {
    const onlyEmp = appUsers.filter((u) => u.active !== false && u.role === 'produccion');
    return onlyEmp.filter(
      (emp) =>
        !entriesForSelectedDate.some(
          (e) =>
            e.employeeUserId === emp.id ||
            e.employeeUsername.toLowerCase() === emp.username.toLowerCase()
        )
    );
  }, [appUsers, entriesForSelectedDate]);

  // Employee personal history (all dates for currentUser)
  const myHistory = useMemo(() => {
    if (!currentUser) return [];
    return dailyProductions
      .filter(
        (d) =>
          d.employeeUserId === currentUser.id ||
          d.employeeUsername.toLowerCase() === currentUser.username.toLowerCase()
      )
      .sort((a, b) => b.productionDate.localeCompare(a.productionDate));
  }, [dailyProductions, currentUser]);

  const exportConsolidatedCsv = () => {
    const empHeaders = entriesForSelectedDate.map((e) => e.employeeName.toUpperCase());
    const headers = ['VARIEDAD', 'LAR', 'MED', 'CHI', ...empHeaders, 'TOTAL'];
    const lines = [
      headers.join(','),
      ...consolidatedData.rows.map((r) => {
        const empCols = entriesForSelectedDate.map(
          (e) => r.byEmployee[e.employeeUserId] || 0
        );
        if (r.captureMode === 'direct_total') {
          return [`"${r.productName}"`, 0, 0, 0, ...empCols, r.total].join(',');
        }
        return [`"${r.productName}"`, r.lar, r.med, r.chi, ...empCols, r.total].join(',');
      }),
      [
        'TOTAL GENERAL',
        consolidatedData.totals.totalLar,
        consolidatedData.totals.totalMed,
        consolidatedData.totals.totalChi,
        ...entriesForSelectedDate.map((e) => e.grandTotal),
        consolidatedData.totals.grandTotal,
      ].join(','),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Produccion_Consolidada_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportEntryCsv = (entry: DailyProductionEntry) => {
    const lines = [
      `EMPLEADO,${entry.employeeName},FECHA,${entry.productionDate}`,
      'VARIEDAD,LAR,MED,CHI,TOTAL',
      ...entry.rows.map((r) => `"${r.productName}",${r.lar},${r.med},${r.chi},${r.total}`),
      `TOTAL,${entry.totalLar},${entry.totalMed},${entry.totalChi},${entry.grandTotal}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Produccion_${entry.employeeName}_${entry.productionDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Reusable Capture Table ----------
  const renderCaptureForm = () => (
    <form onSubmit={handleSaveCapture} className="space-y-5">
      {/* Form Controls Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#535B28] mb-1">
              Fecha de Producción
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-[#5C1125] absolute left-3 top-2.5" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#535B28] mb-1">
              Empleado / Responsable
            </label>
            {isAdminView ? (
              <select
                value={effectiveEmployee?.id || ''}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] bg-white focus:ring-2 focus:ring-[#5C1125]"
              >
                {productionEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} (@{emp.username})
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 border border-stone-200 bg-[#FAF8F5] rounded-xl text-xs sm:text-sm font-extrabold text-[#5C1125] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#535B28]" />
                <span>{currentUser?.fullName}</span>
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#535B28] mb-1">
              Observaciones del Día (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Corte matutino, lote nave norte..."
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>
        </div>

        {/* Status Indicator: editing existing or new blank capture */}
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
            existingEntryForSelection
              ? 'bg-[#fbf7eb] border-[#e7d4a5] text-[#7c5b16]'
              : 'bg-[#f7f8f2] border-[#dce4bf] text-[#535B28]'
          }`}
        >
          <span className="font-semibold">
            {existingEntryForSelection
              ? `Editando registro guardado de ${effectiveEmployee?.fullName} (${selectedDate}) — Última actualización: ${existingEntryForSelection.updatedAt || existingEntryForSelection.createdAt}`
              : `Nuevo registro en blanco para ${effectiveEmployee?.fullName} (${selectedDate}) — ${draftRows.length} productos activos del catálogo.`}
          </span>

          <button
            type="button"
            onClick={handleClearDraft}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-[11px] hover:bg-stone-100 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpiar a 0</span>
          </button>
        </div>
      </div>

      {/* Product Capture Grid (Manual numeric inputs without spinner arrows) */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 bg-[#FAF8F5] border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#5C1125]" />
            <h2 className="text-sm font-extrabold text-[#000000]">
              Lista de Productos — {effectiveEmployee?.fullName.toUpperCase()}
            </h2>
          </div>
          <span className="text-xs font-bold text-[#535B28]">
            Total en captura: <strong className="text-[#5C1125] text-sm">{draftTotals.grandTotal}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#5C1125] text-white text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Variedad / Producto</th>
                <th className="py-3 px-2 sm:px-4 font-bold text-center w-24">LAR</th>
                <th className="py-3 px-2 sm:px-4 font-bold text-center w-24">MED</th>
                <th className="py-3 px-2 sm:px-4 font-bold text-center w-24">CHI</th>
                <th className="py-3 px-4 font-bold text-right w-24 bg-[#430c1b]">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
              {draftRows.map((row) => (
                <tr key={row.productId} className="hover:bg-[#FAF8F5]/80 transition">
                  <td className="py-2.5 px-4 font-extrabold text-[#000000]">
                    <div className="flex items-center gap-2">
                      <span>{row.productName}</span>
                      {row.captureMode === 'direct_total' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C3A25D]/20 text-[#8a6d2b]">
                          Directo
                        </span>
                      )}
                    </div>
                  </td>

                  {row.captureMode === 'direct_total' ? (
                    <td colSpan={3} className="py-2 px-3">
                      <div className="max-w-[200px] mx-auto">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.total === 0 ? '' : String(row.total)}
                          onChange={(e) => handleCellChange(row.productId, 'direct', e.target.value)}
                          placeholder="0"
                          aria-label={`${row.productName} monto directo`}
                          className="no-spinner w-full text-center py-1.5 px-2 border border-[#C3A25D]/70 bg-[#fcfaf4] rounded-lg font-extrabold text-[#5C1125] focus:ring-2 focus:ring-[#5C1125] focus:outline-hidden"
                        />
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="py-2 px-1.5 sm:px-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.lar === 0 ? '' : String(row.lar)}
                          onChange={(e) => handleCellChange(row.productId, 'lar', e.target.value)}
                          placeholder="0"
                          aria-label={`${row.productName} LAR`}
                          className="no-spinner w-full text-center py-1.5 px-1 border border-stone-300 rounded-lg font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125] focus:outline-hidden"
                        />
                      </td>
                      <td className="py-2 px-1.5 sm:px-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.med === 0 ? '' : String(row.med)}
                          onChange={(e) => handleCellChange(row.productId, 'med', e.target.value)}
                          placeholder="0"
                          aria-label={`${row.productName} MED`}
                          className="no-spinner w-full text-center py-1.5 px-1 border border-stone-300 rounded-lg font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125] focus:outline-hidden"
                        />
                      </td>
                      <td className="py-2 px-1.5 sm:px-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.chi === 0 ? '' : String(row.chi)}
                          onChange={(e) => handleCellChange(row.productId, 'chi', e.target.value)}
                          placeholder="0"
                          aria-label={`${row.productName} CHI`}
                          className="no-spinner w-full text-center py-1.5 px-1 border border-stone-300 rounded-lg font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125] focus:outline-hidden"
                        />
                      </td>
                    </>
                  )}

                  <td className="py-2.5 px-4 text-right font-black text-[#5C1125] bg-[#FAF8F5]/60">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#000000] text-white font-extrabold text-xs sm:text-sm">
                <td className="py-3 px-4 uppercase">TOTAL ({effectiveEmployee?.fullName})</td>
                <td className="py-3 px-2 text-center text-[#C3A25D]">{draftTotals.totalLar}</td>
                <td className="py-3 px-2 text-center text-[#C3A25D]">{draftTotals.totalMed}</td>
                <td className="py-3 px-2 text-center text-[#C3A25D]">{draftTotals.totalChi}</td>
                <td className="py-3 px-4 text-right text-base text-[#C3A25D] bg-[#5C1125]">
                  {draftTotals.grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 sm:p-5 bg-[#FAF8F5] border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-600">
            {draftTotals.totalDirect > 0 && (
              <span>
                Incluye <strong>{draftTotals.totalDirect}</strong> de captura directa (STD Y MOL).
              </span>
            )}
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer border border-[#C3A25D]/40"
          >
            <Save className="w-4 h-4 text-[#C3A25D]" />
            <span>
              {existingEntryForSelection
                ? 'Actualizar Producción del Día'
                : 'Guardar Producción del Día'}
            </span>
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 bg-[#5C1125] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#C3A25D]/50 flex items-center gap-2 text-xs sm:text-sm font-semibold max-w-md">
          <CheckCircle2 className="w-4 h-4 text-[#C3A25D] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-[#C3A25D]/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AromaFlowersLogo size="lg" className="shrink-0" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C3A25D]">
                  {isAdminView
                    ? 'Rol Admin • Consolidado en Tiempo Real'
                    : 'Rol Producción • Registro Diario'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#535B28] text-white">
                  {aromaProducts.filter((p) => p.active !== false).length} Productos Activos
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                Producción del Día
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                {isAdminView
                  ? 'Visualiza y suma automáticamente la producción diaria de todos tus empleados.'
                  : `Registra tu corte y producción diaria (${currentUser?.fullName}).`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {supabaseConfig.isConnected && isOnline && (
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold border border-[#C3A25D]/40 transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#C3A25D] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Sincronizando...' : 'Sincronizar en Vivo'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= ADMIN CONSOLIDATED VIEW ================= */}
      {isAdminView ? (
        <>
          {/* Date Selector & Quick Dates */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#5C1125]" />
                <label className="text-xs font-extrabold uppercase text-stone-600">
                  Fecha de Consulta:
                </label>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-stone-500 mr-1">Fechas con registros:</span>
              {availableDates.slice(0, 5).map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setSelectedDate(dt)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedDate === dt
                      ? 'bg-[#5C1125] text-white'
                      : 'bg-[#FAF8F5] text-stone-700 border border-stone-200 hover:border-[#C3A25D]'
                  }`}
                >
                  {dt === getTodayDate() ? `Hoy (${dt})` : dt}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Cards for Selected Date */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold text-[#5C1125] uppercase tracking-wider">
                Total Consolidado del Día
              </span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-[#000000]">
                {consolidatedData.totals.grandTotal.toLocaleString()}
              </p>
              <span className="text-[10px] text-stone-500">
                Suma total ({selectedDate})
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold text-[#535B28] uppercase tracking-wider">
                LAR / MED / CHI
              </span>
              <p className="mt-1 text-lg sm:text-xl font-black text-[#000000]">
                {consolidatedData.totals.totalLar} / {consolidatedData.totals.totalMed} /{' '}
                {consolidatedData.totals.totalChi}
              </p>
              <span className="text-[10px] text-stone-500">Totales por calibre</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold text-[#C3A25D] uppercase tracking-wider">
                Directo (STD / Molotes)
              </span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-[#000000]">
                {consolidatedData.totals.totalDirect.toLocaleString()}
              </p>
              <span className="text-[10px] text-stone-500">Unidades directas sumadas</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Empleados Sincronizados
              </span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-[#000000]">
                {entriesForSelectedDate.length}
              </p>
              <span className="text-[10px] text-stone-500 truncate block">
                {entriesForSelectedDate.length > 0
                  ? entriesForSelectedDate.map((e) => e.employeeName).join(', ')
                  : 'Sin registros aún'}
              </span>
            </div>
          </div>

          {/* Pending employees alert if any */}
          {pendingEmployees.length > 0 && (
            <div className="px-4 py-3 rounded-xl bg-[#fbf7eb] border border-[#e7d4a5] text-[#7c5b16] text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Pendientes de registrar el <strong>{selectedDate}</strong>:{' '}
                  <strong>{pendingEmployees.map((p) => p.fullName).join(', ')}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTargetEmployeeId(pendingEmployees[0].id);
                  setAdminTab('capturar');
                }}
                className="px-3 py-1 rounded-lg bg-[#5C1125] text-white font-bold text-[11px] hover:bg-[#430c1b] transition cursor-pointer"
              >
                Capturar por {pendingEmployees[0].fullName}
              </button>
            </div>
          )}

          {/* Admin Sub-tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAdminTab('consolidado')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                adminTab === 'consolidado'
                  ? 'bg-[#5C1125] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Layers className="w-4 h-4 text-[#C3A25D]" />
              <span>Consolidado del Día (Total Empleados)</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('empleados')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                adminTab === 'empleados'
                  ? 'bg-[#5C1125] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Users className="w-4 h-4 text-[#C3A25D]" />
              <span>Desglose por Empleado ({entriesForSelectedDate.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('capturar')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                adminTab === 'capturar'
                  ? 'bg-[#535B28] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
              <span>Capturar / Editar Planilla</span>
            </button>
          </div>

          {/* Admin Tab 1: Consolidated Table (CEDA CDMX) */}
          {adminTab === 'consolidado' && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
                    Consolidado Total del Día &bull; {selectedDate}
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Suma automática por variedad y calibre de{' '}
                    {entriesForSelectedDate.length > 0
                      ? entriesForSelectedDate.map((e) => `${e.employeeName} (${e.grandTotal})`).join(' + ')
                      : 'todos los empleados'}
                  </p>
                </div>

                {consolidatedData.rows.length > 0 && (
                  <button
                    type="button"
                    onClick={exportConsolidatedCsv}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C3A25D]" />
                    <span>Exportar CSV Consolidado</span>
                  </button>
                )}
              </div>

              {consolidatedData.rows.length === 0 ? (
                <div className="p-10 text-center space-y-2 text-stone-500">
                  <PackageCheck className="w-10 h-10 mx-auto text-stone-300" />
                  <p className="text-sm font-bold text-stone-700">
                    Aún no hay producción registrada para el {selectedDate}
                  </p>
                  <p className="text-xs">
                    Cuando Aaron, David u otro empleado registren su producción del día, aparecerán aquí sumados automáticamente.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#5C1125] text-white text-xs uppercase tracking-wider">
                        <th className="py-3 px-4 font-bold">Variedad</th>
                        <th className="py-3 px-3 font-bold text-center">LAR</th>
                        <th className="py-3 px-3 font-bold text-center">MED</th>
                        <th className="py-3 px-3 font-bold text-center">CHI</th>
                        {entriesForSelectedDate.map((emp) => (
                          <th
                            key={emp.id}
                            className="py-3 px-3 font-bold text-center bg-[#430c1b]/80 text-[#d6be83]"
                          >
                            {emp.employeeName}
                          </th>
                        ))}
                        <th className="py-3 px-4 font-bold text-right bg-[#000000] text-[#C3A25D]">
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
                      {consolidatedData.rows.map((r) => (
                        <tr key={r.productName} className="hover:bg-[#FAF8F5] transition">
                          <td className="py-2.5 px-4 font-extrabold text-[#000000]">
                            {r.productName}
                          </td>
                          {r.captureMode === 'direct_total' ? (
                            <td colSpan={3} className="py-2.5 px-3 text-center font-bold text-[#5C1125] bg-[#fcfaf4]">
                              {r.total} <span className="text-[10px] font-semibold text-stone-500">(Directo)</span>
                            </td>
                          ) : (
                            <>
                              <td className="py-2.5 px-3 text-center font-semibold text-stone-800">{r.lar}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-stone-800">{r.med}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-stone-800">{r.chi}</td>
                            </>
                          )}
                          {entriesForSelectedDate.map((emp) => (
                            <td key={emp.id} className="py-2.5 px-3 text-center font-semibold text-[#535B28] bg-[#f7f8f2]/40">
                              {r.byEmployee[emp.employeeUserId] || 0}
                            </td>
                          ))}
                          <td className="py-2.5 px-4 text-right font-black text-[#5C1125] bg-[#FAF8F5]">
                            {r.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#000000] text-white font-extrabold text-xs sm:text-sm">
                        <td className="py-3 px-4 uppercase">TOTAL DEL DÍA</td>
                        <td className="py-3 px-3 text-center text-[#C3A25D]">
                          {consolidatedData.totals.totalLar}
                        </td>
                        <td className="py-3 px-3 text-center text-[#C3A25D]">
                          {consolidatedData.totals.totalMed}
                        </td>
                        <td className="py-3 px-3 text-center text-[#C3A25D]">
                          {consolidatedData.totals.totalChi}
                        </td>
                        {entriesForSelectedDate.map((emp) => (
                          <td key={emp.id} className="py-3 px-3 text-center text-white bg-[#1a1a1a]">
                            {emp.grandTotal}
                          </td>
                        ))}
                        <td className="py-3 px-4 text-right text-base text-[#C3A25D] bg-[#5C1125]">
                          {consolidatedData.totals.grandTotal}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Admin Tab 2: Individual Breakdown per Employee */}
          {adminTab === 'empleados' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {entriesForSelectedDate.length === 0 ? (
                <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-500">
                  No hay registros individuales cargados para el {selectedDate}.
                </div>
              ) : (
                entriesForSelectedDate.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden flex flex-col"
                  >
                    <div className="px-5 py-3.5 bg-[#5C1125] text-white flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-extrabold uppercase tracking-wide">
                          {entry.employeeName}
                        </h3>
                        <p className="text-[11px] text-[#d6be83]">
                          @{entry.employeeUsername} &bull; Actualizado: {entry.updatedAt || entry.createdAt}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetEmployeeId(entry.employeeUserId);
                            setAdminTab('capturar');
                          }}
                          className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
                          title="Editar registro"
                        >
                          <Edit3 className="w-4 h-4 text-[#C3A25D]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportEntryCsv(entry)}
                          className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
                          title="Exportar CSV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === entry.id ? (
                          <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                deleteDailyProduction(entry.id);
                                setConfirmDeleteId(null);
                                showToast('Registro eliminado.');
                              }}
                              className="font-bold text-rose-300 hover:underline cursor-pointer"
                            >
                              Borrar
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-stone-300 hover:underline cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(entry.id)}
                            className="p-1.5 rounded-lg bg-white/15 hover:bg-rose-600 text-white transition cursor-pointer"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase">
                            <th className="py-2 px-3 font-bold">Variedad</th>
                            <th className="py-2 px-2 font-bold text-center">LAR</th>
                            <th className="py-2 px-2 font-bold text-center">MED</th>
                            <th className="py-2 px-2 font-bold text-center">CHI</th>
                            <th className="py-2 px-3 font-bold text-right">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {entry.rows.map((r) => (
                            <tr key={r.productName}>
                              <td className="py-2 px-3 font-bold text-[#000000]">{r.productName}</td>
                              {r.captureMode === 'direct_total' ? (
                                <td colSpan={3} className="py-2 px-2 text-center font-bold text-[#5C1125] bg-[#fcfaf4]">
                                  {r.total}
                                </td>
                              ) : (
                                <>
                                  <td className="py-2 px-2 text-center">{r.lar}</td>
                                  <td className="py-2 px-2 text-center">{r.med}</td>
                                  <td className="py-2 px-2 text-center">{r.chi}</td>
                                </>
                              )}
                              <td className="py-2 px-3 text-right font-extrabold text-[#5C1125]">
                                {r.total}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[#000000] text-white font-extrabold">
                            <td className="py-2.5 px-3">TOTAL {entry.employeeName.toUpperCase()}</td>
                            <td className="py-2.5 px-2 text-center text-[#C3A25D]">{entry.totalLar}</td>
                            <td className="py-2.5 px-2 text-center text-[#C3A25D]">{entry.totalMed}</td>
                            <td className="py-2.5 px-2 text-center text-[#C3A25D]">{entry.totalChi}</td>
                            <td className="py-2.5 px-3 text-right text-[#C3A25D] bg-[#5C1125]">
                              {entry.grandTotal}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {entry.notes && (
                      <div className="px-4 py-2.5 bg-[#FAF8F5] border-t border-stone-200 text-[11px] text-stone-600">
                        <strong>Notas:</strong> {entry.notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Admin Tab 3: Capture / Edit for any employee */}
          {adminTab === 'capturar' && renderCaptureForm()}
        </>
      ) : (
        /* ================= EMPLOYEE PRODUCTION VIEW ================= */
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEmpTab('captura')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                empTab === 'captura'
                  ? 'bg-[#5C1125] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <ClipboardList className="w-4 h-4 text-[#C3A25D]" />
              <span>Registrar Producción del Día</span>
            </button>

            <button
              type="button"
              onClick={() => setEmpTab('historial')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                empTab === 'historial'
                  ? 'bg-[#5C1125] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Layers className="w-4 h-4 text-[#C3A25D]" />
              <span>Mis Registros ({myHistory.length})</span>
            </button>
          </div>

          {empTab === 'captura' ? (
            renderCaptureForm()
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 bg-[#FAF8F5]">
                <h2 className="text-sm font-extrabold text-[#000000]">
                  Historial de Producción &bull; {currentUser?.fullName}
                </h2>
                <p className="text-[11px] text-stone-500">
                  Tus envíos diarios sincronizados con Administración.
                </p>
              </div>

              {myHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  Aún no tienes registros guardados.
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {myHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/70"
                    >
                      <div>
                        <p className="text-sm font-extrabold text-[#000000]">
                          Fecha: {entry.productionDate}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          LAR: <strong>{entry.totalLar}</strong> &bull; MED:{' '}
                          <strong>{entry.totalMed}</strong> &bull; CHI:{' '}
                          <strong>{entry.totalChi}</strong> &bull; Total:{' '}
                          <strong className="text-[#5C1125]">{entry.grandTotal}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(entry.productionDate);
                            setEmpTab('captura');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#fbf2f4] text-[#5C1125] text-xs font-bold border border-[#ebccd4] hover:bg-[#ebccd4] transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportEntryCsv(entry)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f7f8f2] text-[#535B28] text-xs font-bold border border-[#dce4bf] hover:bg-[#ecf0dc] transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
