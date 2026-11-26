import React, { useEffect, useMemo, useState } from 'react';
import {
  PlusCircle,
  Save,
  Trash2,
  Edit3,
  FileSpreadsheet,
  FileText,
  Receipt,
  Check,
  Sliders,
  Search,
  RefreshCw,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  LayoutList,
  UserCheck,
  Plus,
  MessageCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PayrollEmployee,
  PayrollExtraWorkItem,
  PayrollRates,
  PayrollWeekEntry,
  PayrollWeekRow,
} from '../../types/greenhouse';
import {
  exportEmployeePaySlipPdf,
  exportPayrollWeekExcel,
  exportPayrollWeekPdf,
} from '../../utils/exportReports';

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const parseDec = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseSignedDec = (raw: string): number => {
  const trimmed = raw.trim();
  const isNeg = trimmed.startsWith('-');
  const cleaned = trimmed.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return isNeg ? -parsed : parsed;
};

export const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtSignedMoney = (n: number) => {
  const val = round2(n);
  if (val > 0) return `+${fmtMoney(val)}`;
  if (val < 0) return `-${fmtMoney(Math.abs(val))}`;
  return fmtMoney(0);
};

export const DEFAULT_PAYROLL_RATES: PayrollRates = {
  fumigadaRate: 20,
  cargadaRate: 0,
  extraHourRate: 50,
  destajoRate: 0,
  defaultBonus: 150,
  workDaysPerWeek: 6,
  attendanceBonusPart: 100,
  punctualityBonusPart: 50,
  unjustifiedPenalty: 150,
  manyTardiesBonus: 50,
};

export const formatShortPeriodRange = (startIso: string, endIso: string): string => {
  const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const parsePart = (iso: string) => {
    const [y, m, d] = (iso || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    return { y, m, d, label: `${d} ${shortMonths[m - 1] || ''}` };
  };
  const s = parsePart(startIso);
  const e = parsePart(endIso);
  if (!s && !e) return '';
  if (s && e) {
    return `${s.label} - ${e.label} ${e.y}`;
  }
  return startIso || endIso;
};

export interface BonusRuleEvaluation {
  bonusAmount: number;
  penaltyAmount: number;
  netAmount: number;
  reason: string;
  tone: 'positive' | 'neutral' | 'negative';
}

export const evaluateAttendanceBonusRule = (
  daysWorked: number,
  tardiesCount: number,
  permissionsCount: number,
  rates: PayrollRates
): BonusRuleEvaluation => {
  const baseDays = rates.workDaysPerWeek > 0 ? rates.workDaysPerWeek : 6;
  const attPart = rates.attendanceBonusPart ?? 100;
  const punctPart = rates.punctualityBonusPart ?? 50;
  const perfectTotal = round2(attPart + punctPart);
  const penaltyAmt = rates.unjustifiedPenalty ?? 150;
  const manyTardiesAmt = rates.manyTardiesBonus ?? 50;

  const days = Math.max(0, Number(daysWorked || 0));
  const tardies = Math.max(0, Math.floor(Number(tardiesCount || 0)));
  const perms = Math.max(0, Number(permissionsCount || 0));

  // 1. Falta injustificada sin permiso (Días laborados + Permisos < 6)
  if (days + perms < baseDays) {
    return {
      bonusAmount: 0,
      penaltyAmount: penaltyAmt,
      netAmount: -penaltyAmt,
      reason: `Falta injustificada sin permiso (${days} días + ${perms} perm. < ${baseDays}): penalización de -${fmtMoney(penaltyAmt)} además de los días no laborados.`,
      tone: 'negative',
    };
  }

  // 2. Falta con permiso previo (Días laborados + Permisos >= 6, pero laboró menos de 6 días)
  if (days < baseDays) {
    return {
      bonusAmount: 0,
      penaltyAmount: 0,
      netAmount: 0,
      reason: `Falta con permiso previo (${perms} permiso(s) cubren la semana): $0.00 en bono (sin multa, solo se descuentan días no laborados).`,
      tone: 'neutral',
    };
  }

  // 3. Asistencia completa (6 días laborados)
  if (tardies === 0 && perms === 0) {
    return {
      bonusAmount: perfectTotal,
      penaltyAmount: 0,
      netAmount: perfectTotal,
      reason: `Asistencia perfecta (${days} días, 0 retardos, 0 permisos): ${fmtMoney(attPart)} asistencia + ${fmtMoney(punctPart)} puntualidad.`,
      tone: 'positive',
    };
  }

  if (tardies >= 1 && tardies <= 2) {
    return {
      bonusAmount: attPart,
      penaltyAmount: 0,
      netAmount: attPart,
      reason: `${tardies} retardo(s) en la semana: pierde puntualidad (${fmtMoney(punctPart)}) y conserva bono de asistencia (+${fmtMoney(attPart)}).`,
      tone: 'positive',
    };
  }

  if (tardies > 2) {
    return {
      bonusAmount: manyTardiesAmt,
      penaltyAmount: 0,
      netAmount: manyTardiesAmt,
      reason: `${tardies} retardos (más de 2): bono ajustado a ${fmtMoney(manyTardiesAmt)} según regla configurada.`,
      tone: manyTardiesAmt > 0 ? 'neutral' : 'negative',
    };
  }

  return {
    bonusAmount: 0,
    penaltyAmount: 0,
    netAmount: 0,
    reason: 'Permiso registrado en la semana: sin bono ni penalización.',
    tone: 'neutral',
  };
};

export const normalizeRowExtraItems = (row: PayrollWeekRow): PayrollExtraWorkItem[] => {
  if (Array.isArray(row.extraWorkItems)) return row.extraWorkItems;
  if (Number(row.extraWorkAmount || 0) > 0 || (row.extraWorkDescription || '').trim()) {
    return [
      {
        id: `ew-init-${row.employeeId}`,
        concept: row.extraWorkDescription?.trim() || 'Trabajo extra',
        amount: round2(row.extraWorkAmount || 0),
      },
    ];
  }
  return [];
};

export const recalculatePayrollRow = (
  row: PayrollWeekRow,
  rates: PayrollRates
): PayrollWeekRow => {
  const baseDays = rates.workDaysPerWeek > 0 ? rates.workDaysPerWeek : 6;
  const daysWorked = Math.max(0, round2(row.daysWorked || 0));
  const tardiesCount = Math.max(0, Math.floor(Number(row.tardiesCount || 0)));
  const permissionsCount = Math.max(0, round2(row.permissionsCount || 0));
  const weekPay = round2((Number(row.weeklySalary || 0) / baseDays) * daysWorked);

  let attendanceBonus = Math.max(0, round2(row.attendanceBonus || 0));
  let attendanceDiscount = Math.max(0, round2(row.attendanceDiscount || 0));

  if (!row.manualBonusOverride) {
    const evalRes = evaluateAttendanceBonusRule(daysWorked, tardiesCount, permissionsCount, rates);
    attendanceBonus = evalRes.bonusAmount;
    attendanceDiscount = evalRes.penaltyAmount;
  }

  let extraWorkAmount = Math.max(0, round2(row.extraWorkAmount || 0));
  let extraWorkQty = Number(row.extraWorkQty || 0);
  let extraWorkDescription = row.extraWorkDescription || '';

  if (Array.isArray(row.extraWorkItems)) {
    extraWorkAmount = round2(
      row.extraWorkItems.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0)
    );
    extraWorkQty = row.extraWorkItems.length;
    extraWorkDescription = row.extraWorkItems
      .map((item) => item.concept.trim())
      .filter(Boolean)
      .join(' | ');
  }

  const loanPrev = Math.max(0, round2(row.loanPreviousBalance || 0));
  const loanAdded = Math.max(0, round2(row.loanAddedAmount || 0));
  const loanPay = Math.max(0, round2(row.loanPayment || 0));
  const loanRemaining = Math.max(0, round2(loanPrev + loanAdded - loanPay));
  const commissionBonusAmount = Math.max(0, round2(row.commissionBonusAmount || 0));

  const totalNetPay = round2(
    weekPay +
      attendanceBonus -
      attendanceDiscount +
      Number(row.fumigadasAmount || 0) +
      Number(row.cargadasAmount || 0) +
      Number(row.extraHoursAmount || 0) +
      Number(row.destajosAmount || 0) +
      extraWorkAmount +
      commissionBonusAmount -
      loanPay -
      Number(row.otherDeductions || 0)
  );

  return {
    ...row,
    daysWorked,
    tardiesCount,
    permissionsCount,
    weekPay,
    attendanceBonus,
    attendanceDiscount,
    extraWorkQty,
    extraWorkAmount,
    extraWorkDescription,
    commissionBonusAmount,
    loanPreviousBalance: loanPrev,
    loanAddedAmount: loanAdded,
    loanPayment: loanPay,
    loanRemainingBalance: loanRemaining,
    totalNetPay,
  };
};

interface WorkerPayrollWorkbenchProps {
  today: string;
  payrollEmployees: PayrollEmployee[];
  payrollWeeks: PayrollWeekEntry[];
  selectedWeekId: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  teamGroup: string;
  weekStatus: 'borrador' | 'pagada';
  rates: PayrollRates;
  rows: PayrollWeekRow[];
  weekTotals: {
    totalWeekPay: number;
    totalBonus: number;
    totalAttendanceDiscounts: number;
    totalFumigadas: number;
    totalCargadas: number;
    totalExtraHours: number;
    totalDestajos: number;
    totalExtraWork: number;
    totalCommissions: number;
    totalOtherDeductions: number;
    totalNewLoans: number;
    totalLoanPayments: number;
    totalLoanRemaining: number;
    grandTotalPay: number;
  };
  availableGroups: string[];
  pendingAdjustmentsCount: number;
  syncLoansOnSave: boolean;
  isSavingWeek: boolean;
  confirmDeleteWeekId: string | null;
  currentExportWeek: PayrollWeekEntry;
  onSelectWeek: (val: string) => void;
  onStartNewWeek: (group: string) => void;
  onWeekLabelChange: (val: string) => void;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onTeamGroupChange: (val: string) => void;
  onWeekStatusChange: (val: 'borrador' | 'pagada') => void;
  onRateChange: (field: keyof PayrollRates, val: number) => void;
  onUpdateRow: (idx: number, updater: (row: PayrollWeekRow) => PayrollWeekRow) => void;
  onSyncPendingIncidents: () => void;
  onPullMissingEmployees: () => void;
  onMarkAllPaid: () => void;
  onSyncLoansOnSaveChange: (val: boolean) => void;
  onSavePayrollWeek: () => void;
  onRequestDeleteWeek: (id: string | null) => void;
  onConfirmDeleteWeek: (id: string) => void;
  onSaveEmployeeBaseSalary: (employeeId: string, newSalary: number) => Promise<void>;
}

export const WorkerPayrollWorkbench: React.FC<WorkerPayrollWorkbenchProps> = ({
  today,
  payrollEmployees,
  payrollWeeks,
  selectedWeekId,
  weekLabel,
  startDate,
  endDate,
  teamGroup,
  weekStatus,
  rates,
  rows,
  weekTotals,
  availableGroups,
  pendingAdjustmentsCount,
  syncLoansOnSave,
  isSavingWeek,
  confirmDeleteWeekId,
  currentExportWeek,
  onSelectWeek,
  onStartNewWeek,
  onWeekLabelChange,
  onStartDateChange,
  onEndDateChange,
  onTeamGroupChange,
  onWeekStatusChange,
  onRateChange,
  onUpdateRow,
  onSyncPendingIncidents,
  onPullMissingEmployees,
  onMarkAllPaid,
  onSyncLoansOnSaveChange,
  onSavePayrollWeek,
  onRequestDeleteWeek,
  onConfirmDeleteWeek,
  onSaveEmployeeBaseSalary,
}) => {
  const [viewMode, setViewMode] = useState<'individual' | 'resumen'>('individual');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(rows[0]?.employeeId || '');
  const [workerSearch, setWorkerSearch] = useState<string>('');
  const [showRulesPanel, setShowRulesPanel] = useState<boolean>(false);
  const [isEditingSalary, setIsEditingSalary] = useState<boolean>(false);
  const [isSavingBaseSalary, setIsSavingBaseSalary] = useState<boolean>(false);
  const [isEditingPrevLoan, setIsEditingPrevLoan] = useState<boolean>(false);
  const [showOtherConcepts, setShowOtherConcepts] = useState<boolean>(false);
  const [manualBonusInput, setManualBonusInput] = useState<string>('');

  // Keep selectedEmployeeId valid when rows change
  useEffect(() => {
    if (rows.length === 0) {
      setSelectedEmployeeId('');
      return;
    }
    const exists = rows.some((r) => r.employeeId === selectedEmployeeId);
    if (!exists) {
      setSelectedEmployeeId(rows[0].employeeId);
    }
  }, [rows, selectedEmployeeId]);

  const activeRowIndex = useMemo(() => {
    const idx = rows.findIndex((r) => r.employeeId === selectedEmployeeId);
    return idx >= 0 ? idx : 0;
  }, [rows, selectedEmployeeId]);

  const activeRow = rows[activeRowIndex] || null;
  const activeEmployeeMeta = useMemo(
    () => payrollEmployees.find((e) => e.id === activeRow?.employeeId) || null,
    [payrollEmployees, activeRow?.employeeId]
  );

  // Reset inline locks when switching active worker
  useEffect(() => {
    setIsEditingSalary(false);
    setIsEditingPrevLoan(false);
    if (activeRow) {
      const hasOther =
        Number(activeRow.commissionBonusAmount || 0) > 0 ||
        Number(activeRow.otherDeductions || 0) > 0 ||
        Number(activeRow.cargadasAmount || 0) > 0 ||
        Number(activeRow.destajosAmount || 0) > 0;
      setShowOtherConcepts(hasOther);
      const netBonus = round2(
        Number(activeRow.attendanceBonus || 0) - Number(activeRow.attendanceDiscount || 0)
      );
      setManualBonusInput(String(netBonus));
    }
  }, [activeRow?.employeeId, selectedWeekId]);

  const filteredWorkerList = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return rows
      .map((row, index) => ({
        row,
        index,
        meta: payrollEmployees.find((e) => e.id === row.employeeId),
      }))
      .filter(({ row, meta }) => {
        if (!q) return true;
        return (
          row.employeeName.toLowerCase().includes(q) ||
          (meta?.jobTitle || '').toLowerCase().includes(q) ||
          (row.teamGroup || '').toLowerCase().includes(q)
        );
      });
  }, [rows, payrollEmployees, workerSearch]);

  const paidWorkersCount = useMemo(() => rows.filter((r) => r.paid).length, [rows]);

  const activeBonusEval = useMemo(() => {
    if (!activeRow) return null;
    return evaluateAttendanceBonusRule(
      activeRow.daysWorked,
      activeRow.tardiesCount || 0,
      activeRow.permissionsCount || 0,
      rates
    );
  }, [activeRow?.daysWorked, activeRow?.tardiesCount, activeRow?.permissionsCount, rates]);

  const activeExtraItems = useMemo(
    () => (activeRow ? normalizeRowExtraItems(activeRow) : []),
    [activeRow]
  );

  const handleSelectWorker = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setViewMode('individual');
  };

  const handleStepWorker = (delta: number) => {
    if (rows.length === 0) return;
    const nextIdx = (activeRowIndex + delta + rows.length) % rows.length;
    setSelectedEmployeeId(rows[nextIdx].employeeId);
  };

  const handleAddExtraWorkItem = () => {
    if (!activeRow) return;
    const nextItems: PayrollExtraWorkItem[] = [
      ...activeExtraItems,
      { id: `ew-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, concept: '', amount: 0 },
    ];
    onUpdateRow(activeRowIndex, (row) => ({
      ...row,
      extraWorkItems: nextItems,
    }));
  };

  const handleChangeExtraWorkItem = (
    itemId: string,
    patch: Partial<Pick<PayrollExtraWorkItem, 'concept' | 'amount'>>
  ) => {
    if (!activeRow) return;
    const nextItems = activeExtraItems.map((it) =>
      it.id === itemId ? { ...it, ...patch } : it
    );
    onUpdateRow(activeRowIndex, (row) => ({
      ...row,
      extraWorkItems: nextItems,
    }));
  };

  const handleRemoveExtraWorkItem = (itemId: string) => {
    if (!activeRow) return;
    const nextItems = activeExtraItems.filter((it) => it.id !== itemId);
    onUpdateRow(activeRowIndex, (row) => ({
      ...row,
      extraWorkItems: nextItems,
    }));
  };

  const handleManualBonusChange = (rawValue: string) => {
    setManualBonusInput(rawValue);
    if (!activeRow) return;
    const signed = parseSignedDec(rawValue);
    onUpdateRow(activeRowIndex, (row) => ({
      ...row,
      manualBonusOverride: true,
      attendanceBonus: signed > 0 ? round2(signed) : 0,
      attendanceDiscount: signed < 0 ? round2(Math.abs(signed)) : 0,
    }));
  };

  const handleRevertAutoBonus = () => {
    if (!activeRow) return;
    onUpdateRow(activeRowIndex, (row) => ({
      ...row,
      manualBonusOverride: false,
    }));
    if (activeBonusEval) {
      setManualBonusInput(String(activeBonusEval.netAmount));
    }
  };

  const buildWorkerWhatsAppHref = (row: PayrollWeekRow) => {
    const bonusNet = round2(Number(row.attendanceBonus || 0) - Number(row.attendanceDiscount || 0));
    const extrasTotal = round2(
      Number(row.fumigadasAmount || 0) +
        Number(row.extraHoursAmount || 0) +
        Number(row.extraWorkAmount || 0) +
        Number(row.cargadasAmount || 0) +
        Number(row.destajosAmount || 0) +
        Number(row.commissionBonusAmount || 0)
    );
    const lines = [
      `*AROMA FLOWER — RECIBO DE NÓMINA*`,
      `Trabajador: *${row.employeeName}*`,
      `Periodo: ${formatShortPeriodRange(startDate, endDate)} (${weekLabel})`,
      `--------------------------------`,
      `(+) Sueldo (${row.daysWorked} días): ${fmtMoney(row.weekPay)}`,
      `(${bonusNet >= 0 ? '+' : '-'}) Bono / Penalización: ${fmtSignedMoney(bonusNet)}`,
      `(+) Fumigadas y Extras: ${fmtMoney(extrasTotal)}`,
      Number(row.otherDeductions || 0) > 0
        ? `(-) Otros descuentos: -${fmtMoney(row.otherDeductions)}`
        : null,
      Number(row.loanPayment || 0) > 0
        ? `(-) Abono a préstamo: -${fmtMoney(row.loanPayment)}`
        : null,
      `--------------------------------`,
      `*TOTAL NETO A PAGAR: ${fmtMoney(row.totalNetPay)}*`,
      row.loanRemainingBalance > 0 || Number(row.loanAddedAmount || 0) > 0
        ? `Saldo pendiente de préstamo: ${fmtMoney(row.loanRemainingBalance)}`
        : null,
    ].filter(Boolean);

    const phone = (activeEmployeeMeta?.phone || '').replace(/\D/g, '');
    const base = phone ? `https://wa.me/${phone.length === 10 ? `52${phone}` : phone}` : 'https://wa.me/';
    return `${base}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const activeBonusNet = activeRow
    ? round2(Number(activeRow.attendanceBonus || 0) - Number(activeRow.attendanceDiscount || 0))
    : 0;
  const activePerceptionsTotal = activeRow
    ? round2(
        Number(activeRow.fumigadasAmount || 0) +
          Number(activeRow.extraHoursAmount || 0) +
          Number(activeRow.extraWorkAmount || 0) +
          Number(activeRow.cargadasAmount || 0) +
          Number(activeRow.destajosAmount || 0) +
          Number(activeRow.commissionBonusAmount || 0)
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* ==================== TOP PERIOD & WORKSPACE TOOLBAR ==================== */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Week Selector + New Week */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5C1125] shrink-0" />
              <select
                value={selectedWeekId}
                onChange={(e) => onSelectWeek(e.target.value)}
                aria-label="Seleccionar semana de nómina"
                className="px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-[#FAF8F5] text-[#000000] focus:outline-hidden focus:ring-2 focus:ring-[#5C1125] max-w-[300px]"
              >
                {selectedWeekId === 'new' && (
                  <option value="new">+ Nueva Nómina (Sin guardar)</option>
                )}
                {payrollWeeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.weekLabel} ({w.teamGroup}) — {fmtMoney(w.grandTotalPay)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => onStartNewWeek(teamGroup || 'AARON')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
              <span>Nueva Semana</span>
            </button>
          </div>

          {/* Primary Toggle + Utilities */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setViewMode((prev) => (prev === 'individual' ? 'resumen' : 'individual'))
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer border ${
                viewMode === 'resumen'
                  ? 'bg-[#5C1125] text-white border-[#C3A25D]/60 shadow-sm'
                  : 'bg-[#FAF8F5] hover:bg-[#fbf2f4] text-[#5C1125] border-[#5C1125]/35'
              }`}
            >
              {viewMode === 'resumen' ? (
                <>
                  <UserCheck className="w-4 h-4 text-[#C3A25D]" />
                  <span>Volver a Ficha Individual</span>
                </>
              ) : (
                <>
                  <LayoutList className="w-4 h-4 text-[#5C1125]" />
                  <span>Ver Resumen General / Total Nómina</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onSyncPendingIncidents}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-stone-800 text-xs font-bold border border-stone-300 transition whitespace-nowrap shrink-0 cursor-pointer"
              title="Importar descuentos, bonos, comisiones y saldos vigentes de préstamos"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5C1125]" />
              <span>
                Sincronizar{pendingAdjustmentsCount > 0 ? ` (${pendingAdjustmentsCount})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowRulesPanel((s) => !s)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap shrink-0 cursor-pointer ${
                showRulesPanel
                  ? 'bg-[#000000] text-[#C3A25D] border-[#000000]'
                  : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Reglas y Tarifas</span>
            </button>

            <button
              type="button"
              onClick={() => exportPayrollWeekExcel(currentExportWeek)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={() => exportPayrollWeekPdf(currentExportWeek)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Period Date Range & Group Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-stone-100">
          <div className="lg:col-span-4">
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Periodo Semanal
            </label>
            <input
              type="text"
              value={weekLabel}
              onChange={(e) => onWeekLabelChange(e.target.value)}
              placeholder="Ej. 23 nov - 29 nov 2026"
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Equipo / Grupo
            </label>
            <select
              value={teamGroup}
              onChange={(e) => onTeamGroupChange(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
            >
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value="TODOS">TODOS LOS EQUIPOS</option>
            </select>
          </div>
          <div className="lg:col-span-2 flex flex-col justify-end">
            <div className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-500">Total Semana</span>
              <span className="text-sm font-black text-[#5C1125] tabular-nums">
                {fmtMoney(weekTotals.grandTotalPay)}
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Rules & Unit Rates Configuration Panel */}
        {showRulesPanel && (
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#C3A25D]/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-xs font-extrabold text-[#5C1125]">
                Reglas de Bonos por Asistencia y Tarifas Unitarias
              </h3>
              <span className="text-[11px] text-stone-500">
                Los cambios recalculan en tiempo real a todos los trabajadores de esta semana.
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {(
                [
                  ['workDaysPerWeek', 'Días base / sem.'],
                  ['attendanceBonusPart', 'Bono Asistencia ($)'],
                  ['punctualityBonusPart', 'Bono Puntualidad ($)'],
                  ['unjustifiedPenalty', 'Multa Falta Injust. ($)'],
                  ['manyTardiesBonus', 'Bono >2 Retardos ($)'],
                  ['fumigadaRate', 'Tarifa Fumigada ($)'],
                  ['extraHourRate', 'Tarifa Hora Extra ($)'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={String(rates[key] ?? DEFAULT_PAYROLL_RATES[key] ?? 0)}
                    onChange={(e) => onRateChange(key, parseDec(e.target.value))}
                    className="no-spinner w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold tabular-nums bg-white focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODE 1: WORKER-CENTRIC INDIVIDUAL SHEET ==================== */}
      {viewMode === 'individual' && (
        <div className="flex flex-col lg:flex-row items-start gap-5">
          {/* Mobile / Tablet Worker Selector Bar */}
          <div className="w-full lg:hidden bg-white rounded-2xl border border-stone-200 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#5C1125]">
                Trabajador ({activeRowIndex + 1} de {rows.length})
              </span>
              <span className="text-xs text-stone-500 tabular-nums">
                {paidWorkersCount}/{rows.length} pagados
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStepWorker(-1)}
                disabled={rows.length <= 1}
                className="p-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
                aria-label="Trabajador anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedEmployeeId}
                onChange={(e) => handleSelectWorker(e.target.value)}
                aria-label="Seleccionar trabajador"
                className="flex-1 px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-extrabold text-[#000000] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
              >
                {rows.map((r) => (
                  <option key={r.employeeId} value={r.employeeId}>
                    {r.employeeName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleStepWorker(1)}
                disabled={rows.length <= 1}
                className="p-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
                aria-label="Siguiente trabajador"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Desktop Fixed Vertical Worker Sidebar */}
          <aside className="hidden lg:flex lg:flex-col lg:w-72 shrink-0 bg-white rounded-2xl border border-stone-200 overflow-hidden lg:sticky lg:top-4">
            <div className="px-4 py-3.5 bg-[#FAF8F5] border-b border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#000000]">Trabajadores</h2>
                <span className="text-xs text-stone-500 font-semibold tabular-nums">
                  {paidWorkersCount}/{rows.length} pagados
                </span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  placeholder="Buscar trabajador..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <div className="divide-y divide-stone-100 max-h-[540px] overflow-y-auto">
              {filteredWorkerList.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  No se encontraron trabajadores.
                </div>
              ) : (
                filteredWorkerList.map(({ row }) => {
                  const isActive = row.employeeId === activeRow?.employeeId;
                  return (
                    <button
                      key={row.employeeId}
                      type="button"
                      onClick={() => handleSelectWorker(row.employeeId)}
                      className={`w-full text-left px-4 py-3 transition flex items-center justify-between gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-[#5C1125] text-white'
                          : 'bg-white hover:bg-[#FAF8F5] text-[#000000]'
                      }`}
                    >
                      <p
                        className={`text-sm font-extrabold truncate ${
                          isActive ? 'text-white' : 'text-[#000000]'
                        }`}
                      >
                        {row.employeeName}
                      </p>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#C3A25D]' : 'text-stone-300'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-3.5 bg-[#FAF8F5] border-t border-stone-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-600">Gran Total Semana</span>
                <span className="font-black text-[#5C1125] tabular-nums">
                  {fmtMoney(weekTotals.grandTotalPay)}
                </span>
              </div>
              <button
                type="button"
                onClick={onPullMissingEmployees}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-xs font-bold text-stone-700 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#535B28]" />
                <span>Traer Faltantes</span>
              </button>
            </div>
          </aside>

          {/* Main Worker Payroll Sheet */}
          {!activeRow ? (
            <div className="flex-1 w-full bg-white rounded-2xl border border-stone-200 p-10 text-center space-y-3">
              <p className="text-sm font-bold text-stone-700">
                No hay trabajadores cargados en esta semana.
              </p>
              <button
                type="button"
                onClick={() => onStartNewWeek(teamGroup || 'AARON')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
                <span>Generar Semana con Trabajadores Activos</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 w-full min-w-0 space-y-5">
              {/* 2. ENCABEZADO DE LA FICHA INDIVIDUAL */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-100">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span>Ficha Individual de Nómina</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatShortPeriodRange(startDate, endDate)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeRow.teamGroup || teamGroup}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-[#000000] tracking-tight mt-1">
                      {activeRow.employeeName}
                    </h2>
                    {activeEmployeeMeta?.jobTitle && (
                      <p className="text-xs text-stone-500 mt-0.5">
                        {activeEmployeeMeta.jobTitle}
                        {activeEmployeeMeta.phone ? ` · Tel. ${activeEmployeeMeta.phone}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Prev / Next + Paid Toggle */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateRow(activeRowIndex, (row) => ({ ...row, paid: !row.paid }))
                      }
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
                        activeRow.paid
                          ? 'bg-[#535B28] text-white border-[#535B28]'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{activeRow.paid ? 'Pagado' : 'Marcar Pagado'}</span>
                    </button>

                    <div className="hidden lg:flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepWorker(-1)}
                        disabled={rows.length <= 1}
                        className="p-2 rounded-xl border border-stone-300 bg-white hover:bg-[#FAF8F5] text-stone-700 disabled:opacity-40 cursor-pointer"
                        title="Trabajador anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepWorker(1)}
                        disabled={rows.length <= 1}
                        className="p-2 rounded-xl border border-stone-300 bg-white hover:bg-[#FAF8F5] text-stone-700 disabled:opacity-40 cursor-pointer"
                        title="Siguiente trabajador"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sueldo Semanal Base (Locked by default with discreet Edit button) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF8F5] rounded-xl p-4 border border-stone-200">
                  <div>
                    <span className="text-xs font-semibold text-stone-500 block">
                      Sueldo Semanal Base (base {rates.workDaysPerWeek || 6} días)
                    </span>
                    {!isEditingSalary ? (
                      <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-2xl font-black text-[#000000] tabular-nums">
                          {fmtMoney(activeRow.weeklySalary)}
                        </span>
                        <span className="text-xs text-stone-500 tabular-nums">
                          ({fmtMoney((activeRow.weeklySalary || 0) / (rates.workDaysPerWeek || 6))} / día)
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-sm font-bold text-stone-500">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={activeRow.weeklySalary ? String(activeRow.weeklySalary) : ''}
                            onChange={(e) =>
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                weeklySalary: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-36 pl-7 pr-3 py-1.5 bg-white border border-[#5C1125] rounded-lg text-sm font-black text-[#000000] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={isSavingBaseSalary}
                          onClick={async () => {
                            setIsSavingBaseSalary(true);
                            await onSaveEmployeeBaseSalary(
                              activeRow.employeeId,
                              activeRow.weeklySalary
                            );
                            setIsSavingBaseSalary(false);
                            setIsEditingSalary(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                        >
                          {isSavingBaseSalary ? 'Guardando...' : 'Guardar como sueldo fijo'}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditingSalary((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-stone-600 hover:text-[#5C1125] hover:bg-white border border-stone-300 transition self-start sm:self-center cursor-pointer"
                  >
                    {isEditingSalary ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Bloquear</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </>
                    )}
                  </button>
                </div>

                {/* ==================== BLOQUE A: ASISTENCIA Y REGLAS DE BONOS ==================== */}
                <section className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <h3 className="text-base font-extrabold text-[#000000]">
                        A. Asistencia y Reglas de Bonos
                      </h3>
                      <p className="text-xs text-stone-500">
                        Calcula automáticamente el sueldo proporcional y el bono o penalización semanal.
                      </p>
                    </div>
                    <div className="text-xs font-bold text-[#5C1125] tabular-nums">
                      Sueldo proporcional: {fmtMoney(activeRow.weekPay)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Días laborados */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-stone-700">
                        Días laborados (base {rates.workDaysPerWeek || 6})
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={activeRow.daysWorked === 0 ? '0' : String(activeRow.daysWorked)}
                        onChange={(e) =>
                          onUpdateRow(activeRowIndex, (row) => ({
                            ...row,
                            daysWorked: parseDec(e.target.value),
                            manualBonusOverride: false,
                          }))
                        }
                        className="no-spinner w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-base font-black text-[#000000] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                      />
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {[6, 5, 4, 3].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() =>
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                daysWorked: d,
                                manualBonusOverride: false,
                              }))
                            }
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                              activeRow.daysWorked === d
                                ? 'bg-[#5C1125] text-white'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Retardos */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-stone-700">
                        Retardos en la semana
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRow(activeRowIndex, (row) => ({
                              ...row,
                              tardiesCount: Math.max(0, (row.tardiesCount || 0) - 1),
                              manualBonusOverride: false,
                            }))
                          }
                          className="w-10 h-11 rounded-xl border border-stone-300 bg-[#FAF8F5] hover:bg-stone-200 font-black text-stone-700 cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={String(activeRow.tardiesCount || 0)}
                          onChange={(e) =>
                            onUpdateRow(activeRowIndex, (row) => ({
                              ...row,
                              tardiesCount: Math.max(0, Math.floor(parseDec(e.target.value))),
                              manualBonusOverride: false,
                            }))
                          }
                          className="no-spinner flex-1 min-w-0 text-center px-3 py-2.5 border border-stone-300 rounded-xl text-base font-black text-[#000000] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRow(activeRowIndex, (row) => ({
                              ...row,
                              tardiesCount: (row.tardiesCount || 0) + 1,
                              manualBonusOverride: false,
                            }))
                          }
                          className="w-10 h-11 rounded-xl border border-stone-300 bg-[#FAF8F5] hover:bg-stone-200 font-black text-stone-700 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[11px] text-stone-500">
                        1–2 ret.: +$100 · &gt;2 ret.: +${rates.manyTardiesBonus ?? 50}
                      </p>
                    </div>

                    {/* Permisos */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-stone-700">
                        Permisos (con aviso ≥1 día)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRow(activeRowIndex, (row) => ({
                              ...row,
                              permissionsCount: Math.max(0, (row.permissionsCount || 0) - 1),
                              manualBonusOverride: false,
                            }))
                          }
                          className="w-10 h-11 rounded-xl border border-stone-300 bg-[#FAF8F5] hover:bg-stone-200 font-black text-stone-700 cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={String(activeRow.permissionsCount || 0)}
                          onChange={(e) =>
                            onUpdateRow(activeRowIndex, (row) => ({
                              ...row,
                              permissionsCount: Math.max(0, parseDec(e.target.value)),
                              manualBonusOverride: false,
                            }))
                          }
                          className="no-spinner flex-1 min-w-0 text-center px-3 py-2.5 border border-stone-300 rounded-xl text-base font-black text-[#000000] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRow(activeRowIndex, (row) => ({
                              ...row,
                              permissionsCount: (row.permissionsCount || 0) + 1,
                              manualBonusOverride: false,
                            }))
                          }
                          className="w-10 h-11 rounded-xl border border-stone-300 bg-[#FAF8F5] hover:bg-stone-200 font-black text-stone-700 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[11px] text-stone-500">
                        Justifica faltas sin penalización ($0 bono)
                      </p>
                    </div>
                  </div>

                  {/* Calculated Bonus / Penalty Result Box with Optional Manual Override */}
                  <div
                    className={`rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      activeBonusNet > 0
                        ? 'bg-[#f7f8f2] border-[#dce4bf]'
                        : activeBonusNet < 0
                        ? 'bg-[#fbf2f4] border-[#ebccd4]'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span
                          className={
                            activeBonusNet > 0
                              ? 'text-[#535B28]'
                              : activeBonusNet < 0
                              ? 'text-[#5C1125]'
                              : 'text-stone-700'
                          }
                        >
                          Bono / Penalización resultante
                        </span>
                        <span className="text-stone-400">·</span>
                        <span className="text-stone-500 font-semibold">
                          {activeRow.manualBonusOverride ? 'Ajuste manual activo' : 'Cálculo automático'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">
                        {activeRow.manualBonusOverride
                          ? 'Monto editado manualmente por el administrador.'
                          : activeBonusEval?.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {activeRow.manualBonusOverride ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="text"
                            value={manualBonusInput}
                            onChange={(e) => handleManualBonusChange(e.target.value)}
                            placeholder="Ej. 150 o -150"
                            className="w-28 px-3 py-2 bg-white border border-[#5C1125] rounded-lg text-sm font-black text-right tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                          <button
                            type="button"
                            onClick={handleRevertAutoBonus}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                            title="Volver al cálculo automático"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Auto</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span
                            className={`text-xl font-black tabular-nums ${
                              activeBonusNet > 0
                                ? 'text-[#535B28]'
                                : activeBonusNet < 0
                                ? 'text-[#5C1125]'
                                : 'text-stone-700'
                            }`}
                          >
                            {fmtSignedMoney(activeBonusNet)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setManualBonusInput(String(activeBonusNet));
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                manualBonusOverride: true,
                              }));
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-bold text-stone-600 hover:text-[#5C1125] cursor-pointer"
                          >
                            Ajustar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </section>

                <hr className="border-stone-100" />

                {/* ==================== BLOQUE B: PERCEPCIONES ADICIONALES ==================== */}
                <section className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <h3 className="text-base font-extrabold text-[#000000]">
                        B. Percepciones Adicionales
                      </h3>
                      <p className="text-xs text-stone-500">
                        Fumigadas/aplicaciones, horas extras y lista dinámica de trabajos extras.
                      </p>
                    </div>
                    <div className="text-xs font-bold text-[#535B28] tabular-nums">
                      Subtotal percepciones: +{fmtMoney(activePerceptionsTotal)}
                    </div>
                  </div>

                  {/* Fumigadas & Horas Extras */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fumigadas / Aplicaciones */}
                    <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#000000]">
                          Fumigadas / Aplicaciones
                        </span>
                        <span className="text-[11px] font-semibold text-stone-500 tabular-nums">
                          Tarifa: {fmtMoney(rates.fumigadaRate || 20)} c/u
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Cantidad / Jornadas
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={activeRow.fumigadasQty ? String(activeRow.fumigadasQty) : ''}
                            placeholder="0"
                            onChange={(e) => {
                              const qty = parseDec(e.target.value);
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                fumigadasQty: qty,
                                fumigadasAmount: round2(qty * (rates.fumigadaRate || 20)),
                              }));
                            }}
                            className="no-spinner w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-bold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Subtotal ($)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              activeRow.fumigadasAmount ? String(activeRow.fumigadasAmount) : ''
                            }
                            placeholder="0.00"
                            onChange={(e) =>
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                fumigadasAmount: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-black text-right text-[#535B28] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Horas Extras */}
                    <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#000000]">Horas Extras</span>
                        <span className="text-[11px] font-semibold text-stone-500 tabular-nums">
                          Tarifa: {fmtMoney(rates.extraHourRate || 0)} / hr
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Horas trabajadas
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={activeRow.extraHoursQty ? String(activeRow.extraHoursQty) : ''}
                            placeholder="0"
                            onChange={(e) => {
                              const qty = parseDec(e.target.value);
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                extraHoursQty: qty,
                                extraHoursAmount:
                                  rates.extraHourRate > 0
                                    ? round2(qty * rates.extraHourRate)
                                    : row.extraHoursAmount,
                              }));
                            }}
                            className="no-spinner w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-bold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Monto ($)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              activeRow.extraHoursAmount ? String(activeRow.extraHoursAmount) : ''
                            }
                            placeholder="0.00"
                            onChange={(e) =>
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                extraHoursAmount: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-black text-right text-[#535B28] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trabajos Extras (Dynamic List) */}
                  <div className="p-4 rounded-xl bg-white border border-stone-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold text-[#000000]">
                          Trabajos Extras ({activeExtraItems.length})
                        </span>
                        <span className="text-xs text-stone-500 ml-2 tabular-nums">
                          Total: {fmtMoney(activeRow.extraWorkAmount)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddExtraWorkItem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#C3A25D]" />
                        <span>Agregar trabajo extra</span>
                      </button>
                    </div>

                    {activeExtraItems.length === 0 ? (
                      <p className="text-xs text-stone-500 py-2">
                        Sin trabajos extras registrados para {activeRow.employeeName} en esta semana.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeExtraItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                          >
                            <input
                              type="text"
                              value={item.concept}
                              onChange={(e) =>
                                handleChangeExtraWorkItem(item.id, { concept: e.target.value })
                              }
                              placeholder={`Concepto trabajo extra #${idx + 1} (ej. Reparación tubería, limpieza nave)...`}
                              className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                            />
                            <div className="flex items-center gap-2">
                              <div className="relative w-full sm:w-36">
                                <span className="absolute left-3 top-2 text-xs font-bold text-stone-500">
                                  $
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.amount ? String(item.amount) : ''}
                                  onChange={(e) =>
                                    handleChangeExtraWorkItem(item.id, {
                                      amount: parseDec(e.target.value),
                                    })
                                  }
                                  placeholder="0.00"
                                  className="no-spinner w-full pl-6 pr-3 py-2 border border-stone-300 rounded-lg text-xs sm:text-sm font-bold text-right text-[#535B28] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtraWorkItem(item.id)}
                                className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                                title="Quitar trabajo extra"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Optional Other Synced Concepts (Commissions / Cargadas / Destajos / Other Deductions) */}
                  <div className="rounded-xl border border-stone-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowOtherConcepts((s) => !s)}
                      className="w-full px-4 py-2.5 bg-[#FAF8F5] flex items-center justify-between text-xs font-bold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                    >
                      <span>
                        Otros conceptos (Comisiones, Bonos Productividad y Otros Descuentos)
                      </span>
                      {showOtherConcepts ? (
                        <ChevronUp className="w-4 h-4 text-stone-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-500" />
                      )}
                    </button>
                    {showOtherConcepts && (
                      <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-stone-100">
                        <div>
                          <label className="block text-[11px] font-bold text-[#535B28] mb-1">
                            Comisión / Bono Productividad (+)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              activeRow.commissionBonusAmount
                                ? String(activeRow.commissionBonusAmount)
                                : ''
                            }
                            placeholder="0.00"
                            onChange={(e) =>
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                commissionBonusAmount: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-bold text-right text-[#535B28] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-600 mb-1">
                            Motivo Comisión / Bono
                          </label>
                          <input
                            type="text"
                            value={activeRow.commissionBonusNotes || ''}
                            placeholder="Ej. Bono meta de corte..."
                            onChange={(e) =>
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                commissionBonusNotes: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-rose-700 mb-1">
                            Otros Descuentos (-)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              activeRow.otherDeductions ? String(activeRow.otherDeductions) : ''
                            }
                            placeholder="0.00"
                            onChange={(e) =>
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                otherDeductions: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-full px-3 py-2 border border-rose-200 rounded-lg text-sm font-bold text-right text-rose-700 tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <hr className="border-stone-100" />

                {/* ==================== BLOQUE C: CONTROL DE PRÉSTAMOS Y ABONOS ==================== */}
                <section className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <h3 className="text-base font-extrabold text-[#000000]">
                        C. Control de Préstamos y Abonos
                      </h3>
                      <p className="text-xs text-stone-500">
                        Lleva el saldo arrastrado, préstamos otorgados en la semana y el abono descontado en nómina.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Fecha del préstamo */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Fecha del préstamo
                      </label>
                      <input
                        type="date"
                        value={activeRow.loanDate || startDate || today}
                        onChange={(e) =>
                          onUpdateRow(activeRowIndex, (row) => ({
                            ...row,
                            loanDate: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                      />
                    </div>

                    {/* Saldo anterior */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700">Saldo anterior</label>
                        <button
                          type="button"
                          onClick={() => setIsEditingPrevLoan((v) => !v)}
                          className="text-[11px] font-bold text-stone-500 hover:text-[#5C1125] inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          {isEditingPrevLoan ? (
                            <>
                              <Lock className="w-3 h-3" /> Bloquear
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" /> Editar
                            </>
                          )}
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        readOnly={!isEditingPrevLoan}
                        value={
                          activeRow.loanPreviousBalance
                            ? String(activeRow.loanPreviousBalance)
                            : '0'
                        }
                        onChange={(e) =>
                          onUpdateRow(activeRowIndex, (row) => ({
                            ...row,
                            loanPreviousBalance: parseDec(e.target.value),
                          }))
                        }
                        className={`no-spinner w-full px-3 py-2.5 border rounded-xl text-sm font-bold text-right tabular-nums ${
                          isEditingPrevLoan
                            ? 'bg-white border-[#5C1125] text-[#000000] focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]'
                            : 'bg-stone-50 border-stone-200 text-stone-700 cursor-default'
                        }`}
                      />
                    </div>

                    {/* Préstamo de esta semana */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Préstamo de esta semana (+)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={activeRow.loanAddedAmount ? String(activeRow.loanAddedAmount) : ''}
                        placeholder="0.00"
                        onChange={(e) =>
                          onUpdateRow(activeRowIndex, (row) => ({
                            ...row,
                            loanAddedAmount: parseDec(e.target.value),
                          }))
                        }
                        className="no-spinner w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold text-right text-[#000000] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                      />
                    </div>

                    {/* Abono / Pago de préstamo */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-amber-900">
                          Abono / Pago (-)
                        </label>
                        {activeRow.loanPreviousBalance + (activeRow.loanAddedAmount || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRow(activeRowIndex, (row) => ({
                                ...row,
                                loanPayment: round2(
                                  Number(row.loanPreviousBalance || 0) +
                                    Number(row.loanAddedAmount || 0)
                                ),
                              }))
                            }
                            className="text-[11px] font-bold text-[#5C1125] hover:underline cursor-pointer"
                          >
                            Liquidar
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={activeRow.loanPayment ? String(activeRow.loanPayment) : ''}
                        placeholder="0.00"
                        onChange={(e) =>
                          onUpdateRow(activeRowIndex, (row) => ({
                            ...row,
                            loanPayment: parseDec(e.target.value),
                          }))
                        }
                        className="no-spinner w-full px-3 py-2.5 border border-amber-300 bg-amber-50/40 rounded-xl text-sm font-black text-right text-amber-900 tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#5C1125]"
                      />
                    </div>
                  </div>

                  {/* Saldo Pendiente Automático */}
                  <div className="px-4 py-3 rounded-xl bg-[#FAF8F5] border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs text-stone-600 tabular-nums">
                      Saldo anterior ({fmtMoney(activeRow.loanPreviousBalance)}) + Préstamo semana (
                      {fmtMoney(activeRow.loanAddedAmount || 0)}) - Abono (
                      {fmtMoney(activeRow.loanPayment)})
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-600">Saldo pendiente:</span>
                      <span className="text-lg font-black text-[#5C1125] tabular-nums">
                        {fmtMoney(activeRow.loanRemainingBalance)}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* ==================== 4. CIERRE, TOTALIZACIÓN Y ACCIONES ==================== */}
              <div className="bg-linear-to-br from-[#5C1125] via-[#4a0e1e] to-[#23060e] text-white rounded-2xl border border-[#C3A25D]/40 p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/15 pb-4">
                  <div>
                    <span className="text-xs font-semibold text-[#C3A25D]">
                      Cierre y Totalización · {activeRow.employeeName}
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
                      Desglose de Pago Semanal
                    </h3>
                  </div>
                  <span className="text-xs text-[#d6be83]">
                    {formatShortPeriodRange(startDate, endDate)} ·{' '}
                    {activeRow.paid ? 'Marcado como Pagado' : 'Pendiente de pago'}
                  </span>
                </div>

                {/* Exact Breakdown Requested */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-7 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-stone-200">
                        (+) Sueldo por días laborados ({activeRow.daysWorked}d)
                      </span>
                      <span className="font-bold text-white tabular-nums">
                        {fmtMoney(activeRow.weekPay)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-stone-200">(+/-) Bono / Penalización</span>
                      <span
                        className={`font-bold tabular-nums ${
                          activeBonusNet > 0
                            ? 'text-[#dce4bf]'
                            : activeBonusNet < 0
                            ? 'text-rose-300'
                            : 'text-stone-300'
                        }`}
                      >
                        {fmtSignedMoney(activeBonusNet)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-stone-200">
                        (+) Fumigadas y Horas/Trabajos extras
                      </span>
                      <span className="font-bold text-[#dce4bf] tabular-nums">
                        +{fmtMoney(activePerceptionsTotal)}
                      </span>
                    </div>

                    {Number(activeRow.otherDeductions || 0) > 0 && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-stone-200">(-) Otros descuentos</span>
                        <span className="font-bold text-rose-300 tabular-nums">
                          -{fmtMoney(activeRow.otherDeductions)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-stone-200">(-) Abono a préstamo</span>
                      <span className="font-bold text-amber-300 tabular-nums">
                        {activeRow.loanPayment > 0
                          ? `-${fmtMoney(activeRow.loanPayment)}`
                          : fmtMoney(0)}
                      </span>
                    </div>
                  </div>

                  {/* Dominant Focal Total */}
                  <div className="md:col-span-5 md:border-l md:border-white/15 md:pl-6 flex flex-col justify-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#C3A25D]">
                      Total Neto a Pagar
                    </span>
                    <p className="text-3xl sm:text-4xl font-black text-white tabular-nums mt-1">
                      {fmtMoney(activeRow.totalNetPay)}
                    </p>
                    {activeRow.loanRemainingBalance > 0 && (
                      <span className="text-xs text-[#d6be83] mt-1 tabular-nums">
                        Resta de préstamo: {fmtMoney(activeRow.loanRemainingBalance)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="pt-4 border-t border-white/15 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-stone-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncLoansOnSave}
                        onChange={(e) => onSyncLoansOnSaveChange(e.target.checked)}
                        className="rounded border-stone-400 text-[#C3A25D] focus:ring-[#C3A25D]"
                      />
                      <span>Actualizar saldos de préstamos e incidencias al guardar</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportEmployeePaySlipPdf(currentExportWeek, activeRow)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition whitespace-nowrap cursor-pointer"
                    >
                      <Receipt className="w-4 h-4 text-[#C3A25D]" />
                      <span>Recibo PDF</span>
                    </button>

                    <a
                      href={buildWorkerWhatsAppHref(activeRow)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold border border-[#C3A25D]/40 transition whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4 text-[#C3A25D]" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      disabled={isSavingWeek}
                      onClick={onSavePayrollWeek}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs sm:text-sm font-black shadow-md transition whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingWeek ? 'Guardando...' : 'Guardar Nómina'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODE 2: VISTA DE RESUMEN GENERAL / TOTAL NÓMINA ==================== */}
      {viewMode === 'resumen' && (
        <div className="space-y-5">
          {/* Concentrated KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <span className="text-xs font-semibold text-stone-500">Sueldo Base Semanal</span>
              <p className="text-xl font-black text-[#000000] mt-1 tabular-nums">
                {fmtMoney(weekTotals.totalWeekPay)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <span className="text-xs font-semibold text-stone-500">Bonos / Penaliz. Neto</span>
              <p
                className={`text-xl font-black mt-1 tabular-nums ${
                  weekTotals.totalBonus - weekTotals.totalAttendanceDiscounts >= 0
                    ? 'text-[#535B28]'
                    : 'text-[#5C1125]'
                }`}
              >
                {fmtSignedMoney(weekTotals.totalBonus - weekTotals.totalAttendanceDiscounts)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <span className="text-xs font-semibold text-stone-500">Fumig. + H.Ext + Extras</span>
              <p className="text-xl font-black text-[#535B28] mt-1 tabular-nums">
                {fmtMoney(
                  weekTotals.totalFumigadas +
                    weekTotals.totalExtraHours +
                    weekTotals.totalExtraWork +
                    weekTotals.totalCargadas +
                    weekTotals.totalDestajos +
                    weekTotals.totalCommissions
                )}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <span className="text-xs font-semibold text-stone-500">Abonos / Saldo Prést.</span>
              <p className="text-xl font-black text-amber-800 mt-1 tabular-nums">
                -{fmtMoney(weekTotals.totalLoanPayments)}
              </p>
              <span className="text-[11px] text-stone-500 tabular-nums">
                Saldo pend.: {fmtMoney(weekTotals.totalLoanRemaining)}
              </span>
            </div>
            <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-[#5C1125] text-white border border-[#C3A25D]/40">
              <span className="text-xs font-semibold text-[#C3A25D]">Gran Total Semana</span>
              <p className="text-2xl font-black mt-1 tabular-nums">
                {fmtMoney(weekTotals.grandTotalPay)}
              </p>
            </div>
          </div>

          {/* Clean Concentrated Worker Summary Table */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-[#FAF8F5] border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
                  Resumen General de Nómina — {formatShortPeriodRange(startDate, endDate)}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {rows.length} trabajadores · {paidWorkersCount} pagados · Haz clic en cualquier trabajador para abrir su ficha individual.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onPullMissingEmployees}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#535B28]" />
                  <span>Traer Faltantes</span>
                </button>
                <button
                  type="button"
                  onClick={onMarkAllPaid}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f7f8f2] border border-[#dce4bf] text-xs font-bold text-[#535B28] hover:bg-[#dce4bf]/60 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Marcar Todos Pagados</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse min-w-[820px]">
                <thead>
                  <tr className="bg-[#5C1125] text-white text-[11px] font-bold">
                    <th className="py-3 px-4 text-left">Trabajador</th>
                    <th className="py-3 px-2.5 text-center">Asistencia (D/R/P)</th>
                    <th className="py-3 px-2.5 text-right">Sueldo Base</th>
                    <th className="py-3 px-2.5 text-right">Bono / Penal.</th>
                    <th className="py-3 px-2.5 text-right">Fumig. y Extras</th>
                    <th className="py-3 px-2.5 text-right">Abono Prést.</th>
                    <th className="py-3 px-2.5 text-right">Saldo Prést.</th>
                    <th className="py-3 px-3.5 text-right bg-[#3f0918] text-[#C3A25D]">
                      Total Neto
                    </th>
                    <th className="py-3 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 tabular-nums">
                  {rows.map((r, idx) => {
                    const bonusNet = round2(
                      Number(r.attendanceBonus || 0) - Number(r.attendanceDiscount || 0)
                    );
                    const extrasSum = round2(
                      Number(r.fumigadasAmount || 0) +
                        Number(r.extraHoursAmount || 0) +
                        Number(r.extraWorkAmount || 0) +
                        Number(r.cargadasAmount || 0) +
                        Number(r.destajosAmount || 0) +
                        Number(r.commissionBonusAmount || 0)
                    );
                    return (
                      <tr
                        key={r.employeeId}
                        className={`hover:bg-[#FAF8F5] transition ${
                          r.paid ? 'bg-[#f7f8f2]/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={r.paid}
                              onChange={(e) =>
                                onUpdateRow(idx, (row) => ({ ...row, paid: e.target.checked }))
                              }
                              title="Marcar pagado"
                              className="rounded border-stone-300 text-[#535B28] focus:ring-[#535B28] cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => handleSelectWorker(r.employeeId)}
                              className="text-left group cursor-pointer"
                            >
                              <span className="font-extrabold text-[#000000] group-hover:text-[#5C1125] group-hover:underline">
                                {r.employeeName}
                              </span>
                              <span className="block text-[11px] text-stone-500">
                                {r.paid ? 'Pagado' : 'Pendiente'}
                              </span>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-2.5 text-center text-stone-700 font-semibold">
                          {r.daysWorked}d · {r.tardiesCount || 0}r · {r.permissionsCount || 0}p
                        </td>
                        <td className="py-3 px-2.5 text-right font-semibold text-stone-800">
                          {fmtMoney(r.weekPay)}
                        </td>
                        <td
                          className={`py-3 px-2.5 text-right font-bold ${
                            bonusNet > 0
                              ? 'text-[#535B28]'
                              : bonusNet < 0
                              ? 'text-rose-700'
                              : 'text-stone-500'
                          }`}
                        >
                          {fmtSignedMoney(bonusNet)}
                        </td>
                        <td className="py-3 px-2.5 text-right font-semibold text-[#535B28]">
                          {extrasSum > 0 ? `+${fmtMoney(extrasSum)}` : fmtMoney(0)}
                        </td>
                        <td className="py-3 px-2.5 text-right font-semibold text-amber-800">
                          {r.loanPayment > 0 ? `-${fmtMoney(r.loanPayment)}` : fmtMoney(0)}
                        </td>
                        <td className="py-3 px-2.5 text-right font-bold text-[#5C1125]">
                          {fmtMoney(r.loanRemainingBalance)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-black text-[#5C1125] bg-[#FAF8F5]">
                          {fmtMoney(r.totalNetPay)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSelectWorker(r.employeeId)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FAF8F5] border border-stone-300 text-xs font-bold text-stone-700 cursor-pointer"
                            >
                              Ficha
                            </button>
                            <button
                              type="button"
                              onClick={() => exportEmployeePaySlipPdf(currentExportWeek, r)}
                              className="p-1.5 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] border border-[#ebccd4] cursor-pointer"
                              title={`Recibo PDF de ${r.employeeName}`}
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#000000] text-[#C3A25D] font-extrabold text-xs sm:text-sm tabular-nums">
                    <td className="py-3.5 px-4">GRAN TOTAL ({rows.length} trabajadores)</td>
                    <td />
                    <td className="py-3.5 px-2.5 text-right">{fmtMoney(weekTotals.totalWeekPay)}</td>
                    <td className="py-3.5 px-2.5 text-right">
                      {fmtSignedMoney(weekTotals.totalBonus - weekTotals.totalAttendanceDiscounts)}
                    </td>
                    <td className="py-3.5 px-2.5 text-right">
                      +
                      {fmtMoney(
                        weekTotals.totalFumigadas +
                          weekTotals.totalExtraHours +
                          weekTotals.totalExtraWork +
                          weekTotals.totalCargadas +
                          weekTotals.totalDestajos +
                          weekTotals.totalCommissions
                      )}
                    </td>
                    <td className="py-3.5 px-2.5 text-right">
                      -{fmtMoney(weekTotals.totalLoanPayments)}
                    </td>
                    <td className="py-3.5 px-2.5 text-right">
                      {fmtMoney(weekTotals.totalLoanRemaining)}
                    </td>
                    <td className="py-3.5 px-3.5 text-right text-white bg-[#5C1125]">
                      {fmtMoney(weekTotals.grandTotalPay)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer Save Bar */}
            <div className="p-4 bg-[#FAF8F5] border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncLoansOnSave}
                    onChange={(e) => onSyncLoansOnSaveChange(e.target.checked)}
                    className="rounded border-stone-300 text-[#5C1125] focus:ring-[#5C1125]"
                  />
                  <span>Actualizar saldos de préstamos y marcar incidencias como aplicadas</span>
                </label>

                <select
                  value={weekStatus}
                  onChange={(e) => onWeekStatusChange(e.target.value as 'borrador' | 'pagada')}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold"
                >
                  <option value="borrador">Estatus: Borrador</option>
                  <option value="pagada">Estatus: Nómina Pagada</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedWeekId !== 'new' &&
                  (confirmDeleteWeekId === selectedWeekId ? (
                    <div className="flex items-center gap-2 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                      <span className="text-xs font-bold text-rose-800">¿Eliminar nómina?</span>
                      <button
                        type="button"
                        onClick={() => onConfirmDeleteWeek(selectedWeekId)}
                        className="text-xs font-extrabold text-rose-700 hover:underline cursor-pointer"
                      >
                        Sí, borrar
                      </button>
                      <button
                        type="button"
                        onClick={() => onRequestDeleteWeek(null)}
                        className="text-xs text-stone-500 hover:underline cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRequestDeleteWeek(selectedWeekId)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Semana</span>
                    </button>
                  ))}

                <button
                  type="button"
                  disabled={isSavingWeek}
                  onClick={onSavePayrollWeek}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4 text-[#C3A25D]" />
                  <span>{isSavingWeek ? 'Guardando...' : 'Guardar Nómina en Supabase'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
