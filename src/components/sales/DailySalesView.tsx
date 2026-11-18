import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  FileText,
  Layers,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  DollarSign,
  Package,
  CopyCheck,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  AromaProduct,
  DailyProductionEntry,
  DailySalesEntry,
  DailySalesRow,
} from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
  exportAllAdminRecordsExcel,
  exportAllAdminRecordsPdf,
  exportDailySalesExcel,
  exportDailySalesPdf,
  exportSingleEntryExcel,
  exportSingleEntryPdf,
  exportSingleSaleExcel,
  exportSingleSalePdf,
} from '../../utils/exportReports';

const getTodayDate = (): string => new Date().toISOString().slice(0, 10);

const parsePositiveInt = (raw: string): number => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return 0;
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const parsePositiveDecimal = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parts = cleaned.split('.');
  const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const formatCurrency = (val: number): string =>
  `$${Number(val || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const buildSalesRowsFromCatalog = (
  products: AromaProduct[],
  existingSale?: DailySalesEntry
): DailySalesRow[] => {
  const activeCatalog = [...products]
    .filter((p) => p.active !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const existingMap = new Map<string, DailySalesRow>();
  existingSale?.rows.forEach((r) => {
    existingMap.set(r.productName.trim().toUpperCase(), r);
  });

  return activeCatalog.map((prod) => {
    const prev = existingMap.get(prod.name.trim().toUpperCase());
    if (prev) {
      const packagesSold = Number(prev.packagesSold || 0);
      const unitPrice = Number(prev.unitPrice || 0);
      return {
        productId: prod.id,
        productName: prod.name,
        captureMode: prod.captureMode,
        packagesSold,
        unitPrice,
        subtotal: Number((packagesSold * unitPrice).toFixed(2)),
      };
    }
    return {
      productId: prod.id,
      productName: prod.name,
      captureMode: prod.captureMode,
      packagesSold: 0,
      unitPrice: 0,
      subtotal: 0,
    };
  });
};

const computeSaleTotals = (rows: DailySalesRow[]) => {
  return rows.reduce(
    (acc, r) => {
      acc.totalPackages += Number(r.packagesSold || 0);
      acc.totalAmount += Number(r.subtotal || 0);
      return acc;
    },
    { totalPackages: 0, totalAmount: 0 }
  );
};

export const DailySalesView: React.FC = () => {
  const {
    currentUser,
    activeRole,
    appUsers,
    aromaProducts,
    dailyProductions,
    dailySales,
    saveDailySale,
    deleteDailySale,
    refreshFromSupabase,
    isOnline,
    supabaseConfig,
  } = useGreenhouse();

  const isAdminView = activeRole === 'admin' && currentUser?.role === 'admin';

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate);
  const [dateFilterMode, setDateFilterMode] = useState<'single' | 'all'>('all');
  const [employeeFilterId, setEmployeeFilterId] = useState<string>('ALL');

  const [adminTab, setAdminTab] = useState<'resumen' | 'empleados' | 'capturar'>('resumen');
  const [empTab, setEmpTab] = useState<'mi_resumen' | 'capturar'>('mi_resumen');

  const salesEmployees = useMemo(
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
      salesEmployees[0] ||
      currentUser
    );
  }, [isAdminView, currentUser, appUsers, targetEmployeeId, salesEmployees]);

  const existingSaleForSelection = useMemo(() => {
    if (!effectiveEmployee) return undefined;
    return dailySales.find(
      (s) =>
        s.saleDate === selectedDate &&
        (s.employeeUserId === effectiveEmployee.id ||
          s.employeeUsername.toLowerCase() === effectiveEmployee.username.toLowerCase())
    );
  }, [dailySales, selectedDate, effectiveEmployee]);

  const matchingProductionForSelection = useMemo(() => {
    if (!effectiveEmployee) return undefined;
    return dailyProductions.find(
      (d) =>
        d.productionDate === selectedDate &&
        (d.employeeUserId === effectiveEmployee.id ||
          d.employeeUsername.toLowerCase() === effectiveEmployee.username.toLowerCase())
    );
  }, [dailyProductions, selectedDate, effectiveEmployee]);

  // Capture form state
  const [channel, setChannel] = useState<string>(
    existingSaleForSelection?.channel || 'CEDA CDMX'
  );
  const [notes, setNotes] = useState<string>(existingSaleForSelection?.notes || '');
  const [draftRows, setDraftRows] = useState<DailySalesRow[]>(() =>
    buildSalesRowsFromCatalog(aromaProducts, existingSaleForSelection)
  );
  // Keep raw decimal text for price fields while typing (so "12." works smoothly)
  const [priceDraftText, setPriceDraftText] = useState<Record<string, string>>({});

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const built = buildSalesRowsFromCatalog(aromaProducts, existingSaleForSelection);
    setDraftRows(built);
    setChannel(existingSaleForSelection?.channel || 'CEDA CDMX');
    setNotes(existingSaleForSelection?.notes || '');
    const nextPriceText: Record<string, string> = {};
    built.forEach((r) => {
      if (r.unitPrice > 0) nextPriceText[r.productId] = String(r.unitPrice);
    });
    setPriceDraftText(nextPriceText);
  }, [
    selectedDate,
    effectiveEmployee?.id,
    aromaProducts,
    existingSaleForSelection?.id,
    existingSaleForSelection?.updatedAt,
  ]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const ok = await refreshFromSupabase();
    setIsRefreshing(false);
    showToast(
      ok
        ? 'Ventas y producción sincronizadas con Supabase.'
        : 'Sin conexión a la nube; mostrando registros locales.'
    );
  };

  const handleLoadFromProduction = () => {
    if (!matchingProductionForSelection) {
      showToast(
        `No hay producción registrada para ${effectiveEmployee?.fullName} el ${selectedDate}.`
      );
      return;
    }
    const prodByName = new Map<string, number>();
    matchingProductionForSelection.rows.forEach((r) => {
      prodByName.set(r.productName.trim().toUpperCase(), Number(r.total || 0));
    });

    setDraftRows((prev) =>
      prev.map((row) => {
        const qty = prodByName.get(row.productName.trim().toUpperCase()) ?? 0;
        const nextPkg = qty > 0 ? qty : row.packagesSold;
        return {
          ...row,
          packagesSold: nextPkg,
          subtotal: Number((nextPkg * row.unitPrice).toFixed(2)),
        };
      })
    );
    showToast(
      `Cantidades cargadas desde Producción del Día (${matchingProductionForSelection.grandTotal} unidades).`
    );
  };

  const handlePackagesChange = (productId: string, raw: string) => {
    const qty = parsePositiveInt(raw);
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.productId !== productId) return row;
        return {
          ...row,
          packagesSold: qty,
          subtotal: Number((qty * row.unitPrice).toFixed(2)),
        };
      })
    );
  };

  const handlePriceChange = (productId: string, raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setPriceDraftText((prev) => ({ ...prev, [productId]: cleaned }));
    const price = parsePositiveDecimal(cleaned);
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.productId !== productId) return row;
        return {
          ...row,
          unitPrice: price,
          subtotal: Number((row.packagesSold * price).toFixed(2)),
        };
      })
    );
  };

  const handleClearDraft = () => {
    setDraftRows(buildSalesRowsFromCatalog(aromaProducts, undefined));
    setPriceDraftText({});
    setNotes('');
  };

  const draftTotals = useMemo(() => computeSaleTotals(draftRows), [draftRows]);

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveEmployee) return;

    const nonZeroRows = draftRows.filter(
      (r) => r.packagesSold > 0 || r.unitPrice > 0 || r.subtotal > 0
    );
    const totals = computeSaleTotals(nonZeroRows);

    setIsSaving(true);
    const res = await saveDailySale(
      {
        saleDate: selectedDate,
        employeeUserId: effectiveEmployee.id,
        employeeUsername: effectiveEmployee.username,
        employeeName: effectiveEmployee.fullName,
        channel: channel.trim() || 'CEDA CDMX',
        rows: nonZeroRows,
        totalPackages: totals.totalPackages,
        totalAmount: Number(totals.totalAmount.toFixed(2)),
        notes: notes.trim() || undefined,
      },
      existingSaleForSelection?.id
    );
    setIsSaving(false);

    if (res.cloudSynced) {
      showToast(
        `Venta de ${effectiveEmployee.fullName} (${formatCurrency(totals.totalAmount)}) guardada en Supabase.`
      );
    } else {
      showToast(
        `Venta guardada localmente (${formatCurrency(totals.totalAmount)}). Pendiente en Supabase: ${res.cloudError || 'Sin conexión'}`
      );
    }
  };

  // ---------- Filtered Sales & Productions (Admin & Employee) ----------
  const availableDates = useMemo(() => {
    const set = new Set<string>([getTodayDate()]);
    dailySales.forEach((s) => s.saleDate && set.add(s.saleDate));
    dailyProductions.forEach((d) => d.productionDate && set.add(d.productionDate));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [dailySales, dailyProductions]);

  const filteredSales = useMemo(() => {
    return dailySales
      .filter((s) => {
        if (!isAdminView && currentUser) {
          const isMine =
            s.employeeUserId === currentUser.id ||
            s.employeeUsername.toLowerCase() === currentUser.username.toLowerCase();
          if (!isMine) return false;
        }
        if (dateFilterMode === 'single' && s.saleDate !== selectedDate) return false;
        if (
          isAdminView &&
          employeeFilterId !== 'ALL' &&
          s.employeeUserId !== employeeFilterId
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.saleDate.localeCompare(a.saleDate) ||
          a.employeeName.localeCompare(b.employeeName)
      );
  }, [dailySales, isAdminView, currentUser, dateFilterMode, selectedDate, employeeFilterId]);

  const filteredProductions = useMemo(() => {
    return dailyProductions
      .filter((d) => {
        if (!isAdminView && currentUser) {
          const isMine =
            d.employeeUserId === currentUser.id ||
            d.employeeUsername.toLowerCase() === currentUser.username.toLowerCase();
          if (!isMine) return false;
        }
        if (dateFilterMode === 'single' && d.productionDate !== selectedDate) return false;
        if (
          isAdminView &&
          employeeFilterId !== 'ALL' &&
          d.employeeUserId !== employeeFilterId
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.productionDate.localeCompare(a.productionDate) ||
          a.employeeName.localeCompare(b.employeeName)
      );
  }, [dailyProductions, isAdminView, currentUser, dateFilterMode, selectedDate, employeeFilterId]);

  // Consolidated Production vs Sales by Variety
  const consolidatedComparison = useMemo(() => {
    const orderMap = new Map<string, number>();
    aromaProducts.forEach((p, idx) =>
      orderMap.set(p.name.trim().toUpperCase(), p.sortOrder || idx + 1)
    );

    interface VarietyRow {
      productName: string;
      produced: number;
      sold: number;
      amount: number;
    }
    const map = new Map<string, VarietyRow>();

    filteredProductions.forEach((p) => {
      p.rows.forEach((r) => {
        const key = r.productName.trim().toUpperCase();
        const cur = map.get(key) || {
          productName: r.productName,
          produced: 0,
          sold: 0,
          amount: 0,
        };
        cur.produced += Number(r.total || 0);
        map.set(key, cur);
      });
    });

    filteredSales.forEach((s) => {
      s.rows.forEach((r) => {
        const key = r.productName.trim().toUpperCase();
        const cur = map.get(key) || {
          productName: r.productName,
          produced: 0,
          sold: 0,
          amount: 0,
        };
        cur.sold += Number(r.packagesSold || 0);
        cur.amount += Number(r.subtotal || 0);
        map.set(key, cur);
      });
    });

    const rows = Array.from(map.values())
      .filter((r) => r.produced > 0 || r.sold > 0 || r.amount > 0)
      .sort((a, b) => {
        const oa = orderMap.get(a.productName.trim().toUpperCase()) ?? 999;
        const ob = orderMap.get(b.productName.trim().toUpperCase()) ?? 999;
        return oa - ob;
      });

    const totals = rows.reduce(
      (acc, r) => {
        acc.produced += r.produced;
        acc.sold += r.sold;
        acc.amount += r.amount;
        return acc;
      },
      { produced: 0, sold: 0, amount: 0 }
    );

    return { rows, totals };
  }, [aromaProducts, filteredProductions, filteredSales]);

  // Summary grouped by employee
  const summaryByEmployee = useMemo(() => {
    const map = new Map<
      string,
      {
        employeeUserId: string;
        employeeName: string;
        employeeUsername: string;
        produced: number;
        sold: number;
        amount: number;
        salesCount: number;
        prodCount: number;
      }
    >();

    filteredProductions.forEach((p) => {
      const cur = map.get(p.employeeUserId) || {
        employeeUserId: p.employeeUserId,
        employeeName: p.employeeName,
        employeeUsername: p.employeeUsername,
        produced: 0,
        sold: 0,
        amount: 0,
        salesCount: 0,
        prodCount: 0,
      };
      cur.produced += Number(p.grandTotal || 0);
      cur.prodCount += 1;
      map.set(p.employeeUserId, cur);
    });

    filteredSales.forEach((s) => {
      const cur = map.get(s.employeeUserId) || {
        employeeUserId: s.employeeUserId,
        employeeName: s.employeeName,
        employeeUsername: s.employeeUsername,
        produced: 0,
        sold: 0,
        amount: 0,
        salesCount: 0,
        prodCount: 0,
      };
      cur.sold += Number(s.totalPackages || 0);
      cur.amount += Number(s.totalAmount || 0);
      cur.salesCount += 1;
      map.set(s.employeeUserId, cur);
    });

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [filteredProductions, filteredSales]);

  const filterLabel =
    (dateFilterMode === 'all' ? 'Todas las fechas' : `Fecha ${selectedDate}`) +
    (isAdminView && employeeFilterId !== 'ALL'
      ? ` • ${appUsers.find((u) => u.id === employeeFilterId)?.fullName || ''}`
      : '');

  // ---------- Reusable Sales Capture Form ----------
  const renderCaptureForm = () => (
    <form onSubmit={handleSaveSale} className="space-y-5">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#535B28] mb-1">
              Fecha de Venta
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
                {salesEmployees.map((emp) => (
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

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#535B28] mb-1">
              Punto / Canal de Venta
            </label>
            <input
              type="text"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="CEDA CDMX"
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#535B28] mb-1">
              Observaciones (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Liquidación bodega CEDA..."
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>
        </div>

        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
            existingSaleForSelection
              ? 'bg-[#fbf7eb] border-[#e7d4a5] text-[#7c5b16]'
              : 'bg-[#f7f8f2] border-[#dce4bf] text-[#535B28]'
          }`}
        >
          <span className="font-semibold">
            {existingSaleForSelection
              ? `Editando venta guardada de ${effectiveEmployee?.fullName} (${selectedDate}) — Última edición: ${existingSaleForSelection.updatedAt || existingSaleForSelection.createdAt}`
              : `Nueva venta para ${effectiveEmployee?.fullName} (${selectedDate}). Captura paquetes vendidos y precio unitario ($).`}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadFromProduction}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#535B28] text-white font-bold text-[11px] hover:bg-[#3b411c] transition cursor-pointer"
              title="Copiar cantidades entregadas en Producción del Día (CEDA CDMX)"
            >
              <CopyCheck className="w-3.5 h-3.5 text-[#C3A25D]" />
              <span>Cargar desde Producción del Día</span>
            </button>
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
      </div>

      {/* Sales Capture Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 bg-[#FAF8F5] border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#5C1125]" />
            <h2 className="text-sm font-extrabold text-[#000000]">
              Detalle de Venta — {effectiveEmployee?.fullName.toUpperCase()} ({channel || 'CEDA CDMX'})
            </h2>
          </div>
          <div className="text-xs font-bold text-[#535B28] flex items-center gap-3">
            <span>
              Paquetes: <strong className="text-[#000000]">{draftTotals.totalPackages}</strong>
            </span>
            <span>
              Total Venta:{' '}
              <strong className="text-[#5C1125] text-sm">
                {formatCurrency(draftTotals.totalAmount)}
              </strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#5C1125] text-white text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Variedad / Producto</th>
                <th className="py-3 px-3 font-bold text-center w-32">Paquetes Vendidos</th>
                <th className="py-3 px-3 font-bold text-center w-36">Precio Unitario ($ MXN)</th>
                <th className="py-3 px-4 font-bold text-right w-36 bg-[#430c1b]">Subtotal ($ MXN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
              {draftRows.map((row) => (
                <tr key={row.productId} className="hover:bg-[#FAF8F5]/80 transition">
                  <td className="py-2.5 px-4 font-extrabold text-[#000000]">
                    {row.productName}
                  </td>
                  <td className="py-2 px-2 sm:px-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={row.packagesSold === 0 ? '' : String(row.packagesSold)}
                      onChange={(e) => handlePackagesChange(row.productId, e.target.value)}
                      placeholder="0"
                      aria-label={`${row.productName} paquetes vendidos`}
                      className="no-spinner w-full text-center py-1.5 px-2 border border-stone-300 rounded-lg font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125] focus:outline-hidden"
                    />
                  </td>
                  <td className="py-2 px-2 sm:px-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        priceDraftText[row.productId] !== undefined
                          ? priceDraftText[row.productId]
                          : row.unitPrice === 0
                          ? ''
                          : String(row.unitPrice)
                      }
                      onChange={(e) => handlePriceChange(row.productId, e.target.value)}
                      placeholder="0.00"
                      aria-label={`${row.productName} precio unitario`}
                      className="no-spinner w-full text-center py-1.5 px-2 border border-stone-300 rounded-lg font-bold text-[#535B28] focus:ring-2 focus:ring-[#5C1125] focus:outline-hidden"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right font-black text-[#5C1125] bg-[#FAF8F5]/60">
                    {formatCurrency(row.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#000000] text-white font-extrabold text-xs sm:text-sm">
                <td className="py-3 px-4 uppercase">TOTAL VENTA ({effectiveEmployee?.fullName})</td>
                <td className="py-3 px-3 text-center text-[#C3A25D]">
                  {draftTotals.totalPackages} paq.
                </td>
                <td className="py-3 px-3 text-center text-stone-400">
                  {draftTotals.totalPackages > 0
                    ? `Prom. ${formatCurrency(draftTotals.totalAmount / draftTotals.totalPackages)}`
                    : '—'}
                </td>
                <td className="py-3 px-4 text-right text-base text-[#C3A25D] bg-[#5C1125]">
                  {formatCurrency(draftTotals.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 sm:p-5 bg-[#FAF8F5] border-t border-stone-200 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer border border-[#C3A25D]/40 disabled:opacity-60"
          >
            <Save className="w-4 h-4 text-[#C3A25D]" />
            <span>
              {isSaving
                ? 'Guardando en Supabase...'
                : existingSaleForSelection
                ? 'Actualizar Venta en Supabase'
                : 'Guardar Resumen de Venta'}
            </span>
          </button>
        </div>
      </div>
    </form>
  );

  // ---------- Consolidated & Employee Summary Content (Shared by Admin & Employee) ----------
  const renderSummaryTables = () => (
    <div className="space-y-6">
      {/* Summary by Employee (shows each employee's total production + total sales) */}
      {isAdminView && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
                Producción y Ventas por Empleado &bull; {filterLabel}
              </h2>
              <p className="text-[11px] text-stone-500">
                Consulta rápida de cuánto produjo y vendió cada empleado.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#5C1125] text-white text-xs uppercase">
                  <th className="py-3 px-4 font-bold">Empleado</th>
                  <th className="py-3 px-3 font-bold text-center">Planillas Prod.</th>
                  <th className="py-3 px-3 font-bold text-center">Total Producido</th>
                  <th className="py-3 px-3 font-bold text-center">Registros Venta</th>
                  <th className="py-3 px-3 font-bold text-center">Paquetes Vendidos</th>
                  <th className="py-3 px-4 font-bold text-right bg-[#000000] text-[#C3A25D]">
                    Venta Total ($ MXN)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {summaryByEmployee.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-stone-500 text-xs">
                      No hay registros de producción ni venta para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  summaryByEmployee.map((emp) => (
                    <tr key={emp.employeeUserId} className="hover:bg-[#FAF8F5] transition">
                      <td className="py-2.5 px-4 font-extrabold text-[#000000]">
                        {emp.employeeName}{' '}
                        <span className="text-xs font-normal text-stone-500">
                          (@{emp.employeeUsername})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">{emp.prodCount}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#535B28]">
                        {emp.produced.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">{emp.salesCount}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#000000]">
                        {emp.sold.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-[#5C1125] bg-[#FAF8F5]">
                        {formatCurrency(emp.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consolidated Production vs Sales by Variety */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
              Comparativo Producción vs Ventas por Variedad ( CEDA CDMX )
            </h2>
            <p className="text-[11px] text-stone-500">
              {filterLabel} &bull; {consolidatedComparison.rows.length} variedades con movimiento
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportDailySalesExcel(filteredSales, filterLabel)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
              <span>Exportar Ventas (Excel)</span>
            </button>
            <button
              type="button"
              onClick={() => exportDailySalesPdf(filteredSales, filterLabel)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-bold transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
              <span>Exportar Ventas (PDF)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#5C1125] text-white text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Variedad / Producto</th>
                <th className="py-3 px-3 font-bold text-center">Producido (CEDA)</th>
                <th className="py-3 px-3 font-bold text-center">Vendido (Paq.)</th>
                <th className="py-3 px-3 font-bold text-center">Diferencia</th>
                <th className="py-3 px-3 font-bold text-center">Precio Prom. ($)</th>
                <th className="py-3 px-4 font-bold text-right bg-[#000000] text-[#C3A25D]">
                  Total Venta ($ MXN)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {consolidatedComparison.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500 text-xs">
                    No hay movimientos de producción o venta en el periodo seleccionado.
                  </td>
                </tr>
              ) : (
                consolidatedComparison.rows.map((r) => {
                  const diff = r.produced - r.sold;
                  const avgPrice = r.sold > 0 ? r.amount / r.sold : 0;
                  return (
                    <tr key={r.productName} className="hover:bg-[#FAF8F5] transition">
                      <td className="py-2.5 px-4 font-extrabold text-[#000000]">
                        {r.productName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-[#535B28]">
                        {r.produced}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#000000]">
                        {r.sold}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-center font-bold ${
                          diff > 0
                            ? 'text-amber-700'
                            : diff < 0
                            ? 'text-rose-700'
                            : 'text-stone-500'
                        }`}
                      >
                        {diff > 0 ? `+${diff} sobrante` : diff === 0 ? '0 (100%)' : diff}
                      </td>
                      <td className="py-2.5 px-3 text-center text-stone-700 font-semibold">
                        {avgPrice > 0 ? formatCurrency(avgPrice) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-[#5C1125] bg-[#FAF8F5]">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {consolidatedComparison.rows.length > 0 && (
              <tfoot>
                <tr className="bg-[#000000] text-white font-extrabold text-xs sm:text-sm">
                  <td className="py-3 px-4 uppercase">TOTAL CONSOLIDADO</td>
                  <td className="py-3 px-3 text-center text-[#C3A25D]">
                    {consolidatedComparison.totals.produced.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center text-[#C3A25D]">
                    {consolidatedComparison.totals.sold.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center text-stone-300">
                    {consolidatedComparison.totals.produced - consolidatedComparison.totals.sold}
                  </td>
                  <td className="py-3 px-3 text-center text-stone-300">
                    {consolidatedComparison.totals.sold > 0
                      ? formatCurrency(
                          consolidatedComparison.totals.amount /
                            consolidatedComparison.totals.sold
                        )
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-base text-[#C3A25D] bg-[#5C1125]">
                    {formatCurrency(consolidatedComparison.totals.amount)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* For Employees: Quick personal history of both sales & production */}
      {!isAdminView && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200 bg-[#FAF8F5]">
              <h3 className="text-sm font-extrabold text-[#000000]">
                Mis Registros de Venta ({filteredSales.length})
              </h3>
            </div>
            {filteredSales.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500">
                Aún no tienes ventas registradas. Usa la pestaña "Registrar / Actualizar Mi Venta".
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filteredSales.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-2 hover:bg-[#FAF8F5]/70"
                  >
                    <div>
                      <p className="text-sm font-extrabold text-[#000000]">
                        {s.saleDate} &bull; {s.channel || 'CEDA CDMX'}
                      </p>
                      <p className="text-xs text-stone-500">
                        {s.totalPackages} paq. &bull;{' '}
                        <strong className="text-[#5C1125]">{formatCurrency(s.totalAmount)}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(s.saleDate);
                          setEmpTab('capturar');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#fbf2f4] text-[#5C1125] text-xs font-bold border border-[#ebccd4] hover:bg-[#ebccd4] transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportSingleSaleExcel(s)}
                        className="p-1.5 rounded-lg bg-[#f7f8f2] text-[#535B28] border border-[#dce4bf] cursor-pointer"
                        title="Exportar Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportSingleSalePdf(s)}
                        className="p-1.5 rounded-lg bg-[#fbf7eb] text-[#7c5b16] border border-[#e7d4a5] cursor-pointer"
                        title="Exportar PDF"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200 bg-[#FAF8F5]">
              <h3 className="text-sm font-extrabold text-[#000000]">
                Mis Entregas de Producción ({filteredProductions.length})
              </h3>
            </div>
            {filteredProductions.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500">
                Sin entregas de producción en el periodo seleccionado.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filteredProductions.map((p: DailyProductionEntry) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-2 hover:bg-[#FAF8F5]/70"
                  >
                    <div>
                      <p className="text-sm font-extrabold text-[#000000]">
                        {p.productionDate}
                      </p>
                      <p className="text-xs text-stone-500">
                        LAR: {p.totalLar} &bull; MED: {p.totalMed} &bull; CHI: {p.totalChi} &bull;{' '}
                        <strong className="text-[#535B28]">{p.grandTotal} total</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => exportSingleEntryExcel(p)}
                        className="p-1.5 rounded-lg bg-[#f7f8f2] text-[#535B28] border border-[#dce4bf] cursor-pointer"
                        title="Exportar Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportSingleEntryPdf(p)}
                        className="p-1.5 rounded-lg bg-[#fbf7eb] text-[#7c5b16] border border-[#e7d4a5] cursor-pointer"
                        title="Exportar PDF"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
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
                    ? 'Rol Admin • Control de Ventas y Liquidación'
                    : 'Rol Producción • Resumen de Ventas y Producción'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#535B28] text-white">
                  CEDA CDMX
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                Resumen de Ventas ( CEDA CDMX )
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                {isAdminView
                  ? 'Consulta, edita, compara y exporta las ventas diarias y la producción de cada empleado.'
                  : `Consulta tu resumen de producción y ventas diarias (${currentUser?.fullName}).`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdminView && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    exportAllAdminRecordsExcel(
                      dailyProductions,
                      aromaProducts,
                      appUsers,
                      dailySales
                    );
                    showToast('Excel maestro descargado con Producción, Ventas, Catálogo y Usuarios.');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold border border-[#C3A25D]/50 transition cursor-pointer shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                  <span>Exportar Todos (Excel)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportAllAdminRecordsPdf(
                      dailyProductions,
                      aromaProducts,
                      appUsers,
                      dailySales
                    );
                    showToast('PDF maestro descargado con Producción, Ventas, Catálogo y Usuarios.');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Exportar Todos (PDF)</span>
                </button>
              </>
            )}
            {supabaseConfig.isConnected && isOnline && (
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#C3A25D] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Sincronizando...' : 'Sincronizar en Vivo'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                dateFilterMode === 'all'
                  ? 'bg-[#5C1125] text-white'
                  : 'text-stone-600 hover:text-[#5C1125]'
              }`}
            >
              Todas las fechas
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('single')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                dateFilterMode === 'single'
                  ? 'bg-[#5C1125] text-white'
                  : 'text-stone-600 hover:text-[#5C1125]'
              }`}
            >
              Por fecha específica
            </button>
          </div>

          {dateFilterMode === 'single' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
            />
          )}

          {isAdminView && (
            <select
              value={employeeFilterId}
              onChange={(e) => setEmployeeFilterId(e.target.value)}
              className="px-3 py-1.5 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] bg-white focus:ring-2 focus:ring-[#5C1125]"
            >
              <option value="ALL">Todos los empleados</option>
              {salesEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  Solo: {emp.fullName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {availableDates.slice(0, 4).map((dt) => (
            <button
              key={dt}
              type="button"
              onClick={() => {
                setSelectedDate(dt);
                setDateFilterMode('single');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                dateFilterMode === 'single' && selectedDate === dt
                  ? 'bg-[#5C1125] text-white'
                  : 'bg-[#FAF8F5] text-stone-700 border border-stone-200 hover:border-[#C3A25D]'
              }`}
            >
              {dt === getTodayDate() ? `Hoy (${dt})` : dt}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5C1125] uppercase tracking-wider">
              Total Vendido
            </span>
            <DollarSign className="w-4 h-4 text-[#C3A25D]" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-black text-[#000000]">
            {formatCurrency(consolidatedComparison.totals.amount)}
          </p>
          <span className="text-[10px] text-stone-500">{filterLabel}</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#535B28] uppercase tracking-wider">
              Paquetes Vendidos
            </span>
            <Package className="w-4 h-4 text-[#535B28]" />
          </div>
          <p className="mt-1 text-2xl sm:text-3xl font-black text-[#000000]">
            {consolidatedComparison.totals.sold.toLocaleString()}
          </p>
          <span className="text-[10px] text-stone-500">
            de {consolidatedComparison.totals.produced.toLocaleString()} producidos
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-[#C3A25D] uppercase tracking-wider">
            Precio Promedio
          </span>
          <p className="mt-1 text-xl sm:text-2xl font-black text-[#000000]">
            {consolidatedComparison.totals.sold > 0
              ? formatCurrency(
                  consolidatedComparison.totals.amount /
                    consolidatedComparison.totals.sold
                )
              : '$0.00'}
          </p>
          <span className="text-[10px] text-stone-500">Por paquete vendido</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
            Registros de Venta
          </span>
          <p className="mt-1 text-2xl sm:text-3xl font-black text-[#000000]">
            {filteredSales.length}
          </p>
          <span className="text-[10px] text-stone-500">
            {filteredProductions.length} planilla(s) de producción
          </span>
        </div>
      </div>

      {/* Role Specific Navigation Tabs */}
      {isAdminView ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAdminTab('resumen')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                adminTab === 'resumen'
                  ? 'bg-[#5C1125] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Layers className="w-4 h-4 text-[#C3A25D]" />
              <span>Resumen Consolidado y Comparativo</span>
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
              <span>Ventas por Empleado ({filteredSales.length})</span>
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
              <span>Capturar / Editar Venta</span>
            </button>
          </div>

          {adminTab === 'resumen' && renderSummaryTables()}

          {adminTab === 'empleados' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSales.length === 0 ? (
                <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-500 text-xs">
                  No hay registros de venta para el filtro actual. Puedes crear uno en "Capturar / Editar Venta".
                </div>
              ) : (
                filteredSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden flex flex-col"
                  >
                    <div className="px-5 py-3.5 bg-[#5C1125] text-white flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-extrabold uppercase tracking-wide">
                          {sale.employeeName} &bull; {sale.saleDate}
                        </h3>
                        <p className="text-[11px] text-[#d6be83]">
                          @{sale.employeeUsername} &bull; {sale.channel || 'CEDA CDMX'} &bull;{' '}
                          {sale.totalPackages} paq.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(sale.saleDate);
                            setTargetEmployeeId(sale.employeeUserId);
                            setAdminTab('capturar');
                          }}
                          className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
                          title="Editar venta"
                        >
                          <Edit3 className="w-4 h-4 text-[#C3A25D]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSingleSaleExcel(sale)}
                          className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
                          title="Exportar Excel"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-[#C3A25D]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSingleSalePdf(sale)}
                          className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
                          title="Exportar PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === sale.id ? (
                          <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg text-[11px]">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteDailySale(sale.id);
                                setConfirmDeleteId(null);
                                showToast('Registro de venta eliminado.');
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
                            onClick={() => setConfirmDeleteId(sale.id)}
                            className="p-1.5 rounded-lg bg-white/15 hover:bg-rose-600 text-white transition cursor-pointer"
                            title="Eliminar venta"
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
                            <th className="py-2 px-2 font-bold text-center">Paq.</th>
                            <th className="py-2 px-2 font-bold text-center">Precio</th>
                            <th className="py-2 px-3 font-bold text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {sale.rows.map((r) => (
                            <tr key={r.productName}>
                              <td className="py-2 px-3 font-bold text-[#000000]">{r.productName}</td>
                              <td className="py-2 px-2 text-center">{r.packagesSold}</td>
                              <td className="py-2 px-2 text-center">{formatCurrency(r.unitPrice)}</td>
                              <td className="py-2 px-3 text-right font-extrabold text-[#5C1125]">
                                {formatCurrency(r.subtotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[#000000] text-white font-extrabold">
                            <td className="py-2.5 px-3">TOTAL {sale.employeeName.toUpperCase()}</td>
                            <td className="py-2.5 px-2 text-center text-[#C3A25D]">
                              {sale.totalPackages}
                            </td>
                            <td className="py-2.5 px-2 text-center">—</td>
                            <td className="py-2.5 px-3 text-right text-[#C3A25D] bg-[#5C1125]">
                              {formatCurrency(sale.totalAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {sale.notes && (
                      <div className="px-4 py-2.5 bg-[#FAF8F5] border-t border-stone-200 text-[11px] text-stone-600">
                        <strong>Notas:</strong> {sale.notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {adminTab === 'capturar' && renderCaptureForm()}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEmpTab('mi_resumen')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                empTab === 'mi_resumen'
                  ? 'bg-[#5C1125] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-[#C3A25D]" />
              <span>Mi Resumen de Producción y Ventas</span>
            </button>

            <button
              type="button"
              onClick={() => setEmpTab('capturar')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                empTab === 'capturar'
                  ? 'bg-[#535B28] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
              <span>Registrar / Actualizar Mi Venta</span>
            </button>
          </div>

          {empTab === 'mi_resumen' ? renderSummaryTables() : renderCaptureForm()}
        </>
      )}
    </div>
  );
};
