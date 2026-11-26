import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Banknote,
  CreditCard,
  Truck,
  BarChart3,
  PlusCircle,
  Save,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Receipt,
  Check,
  Users,
  Sliders,
  Search,
  RefreshCw,
  Calendar,
  Building2,
  Sparkles,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  EmployeeLoanMovementType,
  PayrollEmployee,
  PayrollRates,
  PayrollWeekEntry,
  PayrollWeekRow,
  SupplierPayment,
  SupplierPaymentCategory,
  SupplierPaymentMethod,
  SupplierPaymentStatus,
} from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
  AnnualPayrollSummaryRow,
  exportAnnualPayrollHistoryExcel,
  exportAnnualPayrollHistoryPdf,
  exportEmployeeLoansExcel,
  exportEmployeeLoansPdf,
  exportPayrollWeekExcel,
  exportPayrollWeekPdf,
  exportSupplierPaymentsExcel,
  exportSupplierPaymentsPdf,
} from '../../utils/exportReports';
import {
  DEFAULT_PAYROLL_RATES,
  WorkerPayrollWorkbench,
  evaluateAttendanceBonusRule,
  formatShortPeriodRange,
  normalizeRowExtraItems,
  recalculatePayrollRow,
} from './WorkerPayrollWorkbench';

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const parseDec = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const DEFAULT_RATES: PayrollRates = {
  fumigadaRate: 20,
  cargadaRate: 0,
  extraHourRate: 0,
  destajoRate: 0,
  defaultBonus: 150,
  workDaysPerWeek: 6,
};

const SUPPLIER_CATEGORIES: Array<{ value: SupplierPaymentCategory; label: string }> = [
  { value: 'agroquimicos', label: 'Agroquímicos / Fitosanitarios' },
  { value: 'fertilizantes', label: 'Fertilizantes y Nutrición' },
  { value: 'empaques', label: 'Empaques, Cartón y Capuchones' },
  { value: 'fletes_transporte', label: 'Fletes y Transporte CEDA' },
  { value: 'servicios', label: 'Servicios (Luz, Agua, Gas)' },
  { value: 'renta', label: 'Renta de Invernaderos / Local' },
  { value: 'mantenimiento', label: 'Mantenimiento y Refacciones' },
  { value: 'otros', label: 'Otros Proveedores / Gastos' },
];

const PAYMENT_METHODS: Array<{ value: SupplierPaymentMethod; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'tarjeta', label: 'Tarjeta' },
];

const buildSpanishWeekLabel = (startIso: string, endIso: string): string => {
  const months = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
  ];
  const fmtPart = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d} DE ${months[m - 1] || ''}`;
  };
  return `DEL ${fmtPart(startIso)} AL ${fmtPart(endIso)}`;
};

const normalizeIncomingRow = (row: PayrollWeekRow, activeRates: PayrollRates): PayrollWeekRow => {
  const mergedRates: PayrollRates = { ...DEFAULT_PAYROLL_RATES, ...activeRates };
  const extraWorkItems = normalizeRowExtraItems(row);
  const hasExplicitNewFields =
    row.tardiesCount !== undefined ||
    row.permissionsCount !== undefined ||
    row.manualBonusOverride !== undefined;

  let manualBonusOverride = Boolean(row.manualBonusOverride);
  if (!hasExplicitNewFields) {
    const autoEval = evaluateAttendanceBonusRule(row.daysWorked, 0, 0, mergedRates);
    const savedNet = round2(Number(row.attendanceBonus || 0) - Number(row.attendanceDiscount || 0));
    if (savedNet !== autoEval.netAmount) {
      manualBonusOverride = true;
    }
  }

  return recalculatePayrollRow(
    {
      ...row,
      tardiesCount: row.tardiesCount ?? 0,
      permissionsCount: row.permissionsCount ?? 0,
      manualBonusOverride,
      extraWorkItems,
      loanAddedAmount: row.loanAddedAmount ?? 0,
    },
    mergedRates
  );
};

const computeWeekTotals = (rows: PayrollWeekRow[]) => {
  return rows.reduce(
    (acc, r) => {
      acc.totalWeekPay = round2(acc.totalWeekPay + Number(r.weekPay || 0));
      acc.totalBonus = round2(acc.totalBonus + Number(r.attendanceBonus || 0));
      acc.totalAttendanceDiscounts = round2(
        acc.totalAttendanceDiscounts + Number(r.attendanceDiscount || 0)
      );
      acc.totalFumigadas = round2(acc.totalFumigadas + Number(r.fumigadasAmount || 0));
      acc.totalCargadas = round2(acc.totalCargadas + Number(r.cargadasAmount || 0));
      acc.totalExtraHours = round2(acc.totalExtraHours + Number(r.extraHoursAmount || 0));
      acc.totalDestajos = round2(acc.totalDestajos + Number(r.destajosAmount || 0));
      acc.totalExtraWork = round2(acc.totalExtraWork + Number(r.extraWorkAmount || 0));
      acc.totalCommissions = round2(acc.totalCommissions + Number(r.commissionBonusAmount || 0));
      acc.totalOtherDeductions = round2(acc.totalOtherDeductions + Number(r.otherDeductions || 0));
      acc.totalNewLoans = round2(acc.totalNewLoans + Number(r.loanAddedAmount || 0));
      acc.totalLoanPayments = round2(acc.totalLoanPayments + Number(r.loanPayment || 0));
      acc.totalLoanRemaining = round2(acc.totalLoanRemaining + Number(r.loanRemainingBalance || 0));
      acc.grandTotalPay = round2(acc.grandTotalPay + Number(r.totalNetPay || 0));
      return acc;
    },
    {
      totalWeekPay: 0,
      totalBonus: 0,
      totalAttendanceDiscounts: 0,
      totalFumigadas: 0,
      totalCargadas: 0,
      totalExtraHours: 0,
      totalDestajos: 0,
      totalExtraWork: 0,
      totalCommissions: 0,
      totalOtherDeductions: 0,
      totalNewLoans: 0,
      totalLoanPayments: 0,
      totalLoanRemaining: 0,
      grandTotalPay: 0,
    }
  );
};

export const PaymentsView: React.FC = () => {
  const {
    payrollEmployees,
    savePayrollEmployee,
    payrollWeeks,
    savePayrollWeek,
    deletePayrollWeek,
    employeeLoans,
    addEmployeeLoanMovement,
    deleteEmployeeLoanMovement,
    employeeAdjustments,
    supplierPayments,
    saveSupplierPayment,
    deleteSupplierPayment,
  } = useGreenhouse();

  const today = new Date().toISOString().slice(0, 10);

  const [subTab, setSubTab] = useState<'nomina' | 'prestamos' | 'proveedores' | 'resumen' | 'anual'>('nomina');
  const [selectedYear, setSelectedYear] = useState<string>(today.slice(0, 4));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==================== TAB 1: WEEKLY PAYROLL STATE ====================
  const initialRates: PayrollRates = {
    ...DEFAULT_PAYROLL_RATES,
    ...(payrollWeeks[0]?.rates || {}),
  };
  const [selectedWeekId, setSelectedWeekId] = useState<string>(payrollWeeks[0]?.id || 'new');
  const [weekLabel, setWeekLabel] = useState<string>(
    payrollWeeks[0]?.weekLabel || formatShortPeriodRange(today, today)
  );
  const [startDate, setStartDate] = useState<string>(payrollWeeks[0]?.startDate || today);
  const [endDate, setEndDate] = useState<string>(payrollWeeks[0]?.endDate || today);
  const [teamGroup, setTeamGroup] = useState<string>(payrollWeeks[0]?.teamGroup || 'AARON');
  const [weekStatus, setWeekStatus] = useState<'borrador' | 'pagada'>(
    payrollWeeks[0]?.status || 'borrador'
  );
  const [weekNotes, setWeekNotes] = useState<string>(payrollWeeks[0]?.notes || '');
  const [rates, setRates] = useState<PayrollRates>(initialRates);
  const [rows, setRows] = useState<PayrollWeekRow[]>(() =>
    (payrollWeeks[0]?.rows || []).map((r) => normalizeIncomingRow(r, initialRates))
  );
  const [syncLoansOnSave, setSyncLoansOnSave] = useState<boolean>(true);
  const [isSavingWeek, setIsSavingWeek] = useState<boolean>(false);
  const [confirmDeleteWeekId, setConfirmDeleteWeekId] = useState<string | null>(null);

  // Sync editor when user picks an existing saved week
  const loadWeekIntoEditor = (week: PayrollWeekEntry) => {
    const mergedRates: PayrollRates = { ...DEFAULT_PAYROLL_RATES, ...(week.rates || {}) };
    setSelectedWeekId(week.id);
    setWeekLabel(week.weekLabel);
    setStartDate(week.startDate);
    setEndDate(week.endDate);
    setTeamGroup(week.teamGroup);
    setWeekStatus(week.status);
    setWeekNotes(week.notes || '');
    setRates(mergedRates);
    setRows((week.rows || []).map((r) => normalizeIncomingRow(r, mergedRates)));
  };

  const pendingAdjustments = useMemo(
    () => employeeAdjustments.filter((a) => a.status === 'pendiente'),
    [employeeAdjustments]
  );

  const applyPendingIncidentsToRows = (
    targetRows: PayrollWeekRow[],
    activeRates: PayrollRates,
    refreshLoans: boolean
  ) => {
    let appliedCount = 0;
    let loansSynced = 0;

    const updatedRows = targetRows.map((row) => {
      const empRef = payrollEmployees.find(
        (e) =>
          e.id === row.employeeId ||
          e.fullName.trim().toUpperCase() === row.employeeName.trim().toUpperCase()
      );
      const alreadyApplied = new Set(row.appliedAdjustmentIds || []);
      const matchingPending = pendingAdjustments.filter((adj) => {
        if (alreadyApplied.has(adj.id)) return false;
        return (
          adj.employeeId === row.employeeId ||
          adj.employeeName.trim().toUpperCase() === row.employeeName.trim().toUpperCase()
        );
      });

      let attendanceDiscount = Number(row.attendanceDiscount || 0);
      let otherDeductions = Number(row.otherDeductions || 0);
      let commissionBonusAmount = Number(row.commissionBonusAmount || 0);
      let manualBonusOverride = Boolean(row.manualBonusOverride);
      const notesList = row.commissionBonusNotes ? [row.commissionBonusNotes] : [];
      const nextAppliedIds = [...alreadyApplied];

      matchingPending.forEach((adj) => {
        const amt = Math.max(0, round2(adj.amount));
        if (amt <= 0) return;
        if (adj.adjustmentType === 'descuento_falta') {
          attendanceDiscount = round2(attendanceDiscount + amt);
          manualBonusOverride = true;
        } else if (adj.adjustmentType === 'otro_descuento') {
          otherDeductions = round2(otherDeductions + amt);
        } else {
          commissionBonusAmount = round2(commissionBonusAmount + amt);
          if (adj.concept) notesList.push(`${adj.concept} (+$${amt})`);
        }
        nextAppliedIds.push(adj.id);
        appliedCount += 1;
      });

      let loanPreviousBalance = Number(row.loanPreviousBalance || 0);
      if (refreshLoans && empRef && Number(empRef.loanBalance || 0) !== loanPreviousBalance) {
        loanPreviousBalance = Number(empRef.loanBalance || 0);
        loansSynced += 1;
      }

      return recalculatePayrollRow(
        {
          ...row,
          attendanceDiscount,
          manualBonusOverride,
          otherDeductions,
          commissionBonusAmount,
          commissionBonusNotes: notesList.join(' | '),
          appliedAdjustmentIds: nextAppliedIds,
          loanPreviousBalance,
        },
        activeRates
      );
    });

    return { updatedRows, appliedCount, loansSynced };
  };

  // Start a brand-new automated payroll week from active employees + live loan balances + pending adjustments
  const startNewAutomatedWeek = (filterGroup = 'AARON') => {
    const start = today;
    const endDt = new Date(today + 'T12:00:00');
    endDt.setDate(endDt.getDate() + 6);
    const end = endDt.toISOString().slice(0, 10);

    const activeEmps = payrollEmployees.filter((e) => {
      if (e.active === false) return false;
      if (filterGroup === 'TODOS') return true;
      return (e.teamGroup || 'AARON').toUpperCase() === filterGroup.toUpperCase();
    });
    const listToUse =
      activeEmps.length > 0 ? activeEmps : payrollEmployees.filter((e) => e.active !== false);

    const baseRows: PayrollWeekRow[] = listToUse.map((emp: PayrollEmployee) =>
      recalculatePayrollRow(
        {
          employeeId: emp.id,
          employeeName: emp.fullName,
          teamGroup: emp.teamGroup || 'AARON',
          daysWorked: rates.workDaysPerWeek || 6,
          tardiesCount: 0,
          permissionsCount: 0,
          manualBonusOverride: false,
          weeklySalary: Number(emp.weeklySalary || 0),
          weekPay: Number(emp.weeklySalary || 0),
          attendanceBonus: 0,
          attendanceDiscount: 0,
          fumigadasQty: 0,
          fumigadasAmount: 0,
          cargadasQty: 0,
          cargadasAmount: 0,
          extraHoursQty: 0,
          extraHoursAmount: 0,
          destajosQty: 0,
          destajosAmount: 0,
          extraWorkQty: 0,
          extraWorkAmount: 0,
          extraWorkDescription: '',
          extraWorkItems: [],
          commissionBonusAmount: 0,
          commissionBonusNotes: '',
          appliedAdjustmentIds: [],
          otherDeductions: 0,
          loanDate: start,
          loanPreviousBalance: Number(emp.loanBalance || 0),
          loanAddedAmount: 0,
          loanPayment: 0,
          loanRemainingBalance: Number(emp.loanBalance || 0),
          totalNetPay: 0,
          paid: false,
        },
        rates
      )
    );

    const { updatedRows, appliedCount } = applyPendingIncidentsToRows(baseRows, rates, false);

    setSelectedWeekId('new');
    setStartDate(start);
    setEndDate(end);
    setWeekLabel(formatShortPeriodRange(start, end));
    setTeamGroup(filterGroup);
    setWeekStatus('borrador');
    setWeekNotes('');
    setRows(updatedRows);
    setFeedback(
      `Nueva semana generada con ${updatedRows.length} trabajador(es), saldos vigentes de préstamos${
        appliedCount > 0 ? ` y ${appliedCount} incidencia(s)/comisión(es) sincronizada(s)` : ''
      }.`
    );
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleSyncPendingIncidents = () => {
    const { updatedRows, appliedCount, loansSynced } = applyPendingIncidentsToRows(
      rows,
      rates,
      true
    );
    setRows(updatedRows);
    if (appliedCount === 0 && loansSynced === 0) {
      setFeedback(
        'La nómina ya está al día con todos los préstamos, descuentos y comisiones pendientes.'
      );
    } else {
      setFeedback(
        `Sincronización aplicada: ${appliedCount} incidencia(s)/bono(s)/comisión(es) cargada(s) y ${loansSynced} saldo(s) de préstamo actualizado(s). Recuerda guardar la nómina para marcarlas como aplicadas.`
      );
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  // Load first week automatically if rows empty and weeks exist
  useEffect(() => {
    if (rows.length === 0 && payrollWeeks.length > 0 && selectedWeekId !== 'new') {
      loadWeekIntoEditor(payrollWeeks[0]);
    }
  }, [payrollWeeks.length]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>(['AARON']);
    payrollEmployees.forEach((e) => {
      if (e.teamGroup) set.add(e.teamGroup.toUpperCase());
    });
    return Array.from(set);
  }, [payrollEmployees]);

  const weekTotals = useMemo(() => computeWeekTotals(rows), [rows]);

  const updateRowField = (
    idx: number,
    updater: (row: PayrollWeekRow) => PayrollWeekRow
  ) => {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? recalculatePayrollRow(updater(row), rates) : row))
    );
  };

  const handleRateChange = (field: keyof PayrollRates, value: number) => {
    const nextRates: PayrollRates = { ...rates, [field]: value };
    if (field === 'attendanceBonusPart' || field === 'punctualityBonusPart') {
      nextRates.defaultBonus = round2(
        (nextRates.attendanceBonusPart ?? 100) + (nextRates.punctualityBonusPart ?? 50)
      );
    }
    setRates(nextRates);
    setRows((prev) =>
      prev.map((row) => {
        const nextRow = { ...row };
        if (field === 'fumigadaRate' && nextRow.fumigadasQty > 0) {
          nextRow.fumigadasAmount = round2(nextRow.fumigadasQty * value);
        }
        if (field === 'cargadaRate' && nextRow.cargadasQty > 0) {
          nextRow.cargadasAmount = round2(nextRow.cargadasQty * value);
        }
        if (field === 'extraHourRate' && nextRow.extraHoursQty > 0) {
          nextRow.extraHoursAmount = round2(nextRow.extraHoursQty * value);
        }
        if (field === 'destajoRate' && nextRow.destajosQty > 0) {
          nextRow.destajosAmount = round2(nextRow.destajosQty * value);
        }
        return recalculatePayrollRow(nextRow, nextRates);
      })
    );
  };

  const handleSaveEmployeeBaseSalary = async (employeeId: string, newSalary: number) => {
    const emp = payrollEmployees.find((e) => e.id === employeeId);
    if (!emp) return;
    const res = await savePayrollEmployee(
      {
        fullName: emp.fullName,
        teamGroup: emp.teamGroup,
        jobTitle: emp.jobTitle,
        phone: emp.phone,
        email: emp.email || '',
        weeklySalary: round2(newSalary),
        hasAttendanceBonus: emp.hasAttendanceBonus,
        defaultBonusAmount: emp.defaultBonusAmount,
        loanBalance: emp.loanBalance,
        hireDate: emp.hireDate,
        terminationDate: emp.terminationDate,
        terminationReason: emp.terminationReason,
        active: emp.active,
        linkedUserId: emp.linkedUserId,
        notes: emp.notes,
      },
      emp.id
    );
    setFeedback(
      res.cloudSynced
        ? `Sueldo base de ${emp.fullName} actualizado a ${fmtMoney(newSalary)} en Supabase.`
        : `Sueldo base de ${emp.fullName} actualizado localmente a ${fmtMoney(newSalary)}.`
    );
    setTimeout(() => setFeedback(null), 4000);
  };

  const handlePullMissingActiveEmployees = () => {
    const existingIds = new Set(rows.map((r) => r.employeeId));
    const missing = payrollEmployees.filter(
      (e) =>
        e.active !== false &&
        !existingIds.has(e.id) &&
        (teamGroup === 'TODOS' || e.teamGroup.toUpperCase() === teamGroup.toUpperCase())
    );
    if (missing.length === 0) {
      setFeedback('Todos los empleados activos de este equipo ya están incluidos en la nómina.');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    const additions = missing.map((emp) =>
      recalculatePayrollRow(
        {
          employeeId: emp.id,
          employeeName: emp.fullName,
          teamGroup: emp.teamGroup || 'AARON',
          daysWorked: rates.workDaysPerWeek || 6,
          tardiesCount: 0,
          permissionsCount: 0,
          manualBonusOverride: false,
          weeklySalary: Number(emp.weeklySalary || 0),
          weekPay: Number(emp.weeklySalary || 0),
          attendanceBonus: 0,
          attendanceDiscount: 0,
          fumigadasQty: 0,
          fumigadasAmount: 0,
          cargadasQty: 0,
          cargadasAmount: 0,
          extraHoursQty: 0,
          extraHoursAmount: 0,
          destajosQty: 0,
          destajosAmount: 0,
          extraWorkQty: 0,
          extraWorkAmount: 0,
          extraWorkDescription: '',
          extraWorkItems: [],
          commissionBonusAmount: 0,
          commissionBonusNotes: '',
          appliedAdjustmentIds: [],
          otherDeductions: 0,
          loanDate: startDate || today,
          loanPreviousBalance: Number(emp.loanBalance || 0),
          loanAddedAmount: 0,
          loanPayment: 0,
          loanRemainingBalance: Number(emp.loanBalance || 0),
          totalNetPay: 0,
          paid: false,
        },
        rates
      )
    );
    setRows((prev) => [...prev, ...additions]);
    setFeedback(`Se agregaron ${additions.length} trabajador(es) nuevos a esta nómina.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleMarkAllPaid = () => {
    setRows((prev) => prev.map((r) => ({ ...r, paid: true })));
    setWeekStatus('pagada');
  };

  const buildCurrentWeekObject = (): Omit<PayrollWeekEntry, 'id' | 'createdAt' | 'updatedAt'> => ({
    weekLabel: weekLabel.trim() || formatShortPeriodRange(startDate, endDate),
    startDate,
    endDate,
    teamGroup: teamGroup || 'AARON',
    rates,
    rows,
    totalWeekPay: weekTotals.totalWeekPay,
    totalBonus: weekTotals.totalBonus,
    totalAttendanceDiscounts: weekTotals.totalAttendanceDiscounts,
    totalFumigadas: weekTotals.totalFumigadas,
    totalCargadas: weekTotals.totalCargadas,
    totalExtraHours: weekTotals.totalExtraHours,
    totalDestajos: weekTotals.totalDestajos,
    totalExtraWork: weekTotals.totalExtraWork,
    totalCommissions: weekTotals.totalCommissions,
    totalOtherDeductions: round2(weekTotals.totalOtherDeductions + weekTotals.totalAttendanceDiscounts),
    totalNewLoans: weekTotals.totalNewLoans,
    totalLoanPayments: weekTotals.totalLoanPayments,
    totalLoanRemaining: weekTotals.totalLoanRemaining,
    grandTotalPay: weekTotals.grandTotalPay,
    status: weekStatus,
    notes: weekNotes.trim() || undefined,
  });

  const handleSavePayrollWeek = async () => {
    if (rows.length === 0) {
      setErrorMsg('Agrega al menos un empleado antes de guardar la nómina.');
      return;
    }
    setErrorMsg(null);
    setIsSavingWeek(true);
    const payload = buildCurrentWeekObject();
    const res = await savePayrollWeek(
      payload,
      selectedWeekId === 'new' ? undefined : selectedWeekId,
      syncLoansOnSave
    );
    setIsSavingWeek(false);
    setSelectedWeekId(res.entry.id);
    setFeedback(
      res.cloudSynced
        ? `Nómina "${res.entry.weekLabel}" guardada en Supabase (${fmtMoney(res.entry.grandTotalPay)}).${
            syncLoansOnSave ? ' Saldos de préstamos actualizados automáticamente.' : ''
          }`
        : `Nómina guardada localmente. Pendiente en Supabase: ${res.cloudError || 'Ejecuta el SQL actualizado'}.`
    );
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleDeleteWeek = async (id: string) => {
    await deletePayrollWeek(id);
    setConfirmDeleteWeekId(null);
    const remaining = payrollWeeks.filter((w) => w.id !== id);
    if (remaining.length > 0) {
      loadWeekIntoEditor(remaining[0]);
    } else {
      startNewAutomatedWeek('AARON');
    }
    setFeedback('Nómina semanal eliminada.');
    setTimeout(() => setFeedback(null), 3500);
  };

  // ==================== TAB 2: LOANS & DEDUCTIONS STATE ====================
  const [loanEmpId, setLoanEmpId] = useState<string>(payrollEmployees[0]?.id || '');
  const [loanType, setLoanType] = useState<EmployeeLoanMovementType>('prestamo');
  const [loanDate, setLoanDate] = useState<string>(today);
  const [loanAmountStr, setLoanAmountStr] = useState<string>('');
  const [loanConcept, setLoanConcept] = useState<string>('');
  const [loanNotes, setLoanNotes] = useState<string>('');
  const [isSavingLoan, setIsSavingLoan] = useState<boolean>(false);
  const [confirmDeleteLoanId, setConfirmDeleteLoanId] = useState<string | null>(null);

  const handleAddLoanMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const emp = payrollEmployees.find((item) => item.id === loanEmpId);
    if (!emp) {
      setErrorMsg('Selecciona un empleado.');
      return;
    }
    const amt = parseDec(loanAmountStr);
    if (amt <= 0) {
      setErrorMsg('Ingresa un monto mayor a 0.');
      return;
    }

    setIsSavingLoan(true);
    const res = await addEmployeeLoanMovement({
      employeeId: emp.id,
      employeeName: emp.fullName,
      movementDate: loanDate || today,
      movementType: loanType,
      amount: amt,
      concept:
        loanConcept.trim() ||
        (loanType === 'prestamo'
          ? 'Préstamo personal otorgado'
          : loanType === 'abono'
          ? 'Abono directo a préstamo'
          : 'Descuento aplicado'),
      notes: loanNotes.trim() || undefined,
    });
    setIsSavingLoan(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo registrar el movimiento.');
      return;
    }

    setLoanAmountStr('');
    setLoanConcept('');
    setLoanNotes('');
    setFeedback(
      res.cloudSynced
        ? `Movimiento registrado en Supabase. Nuevo saldo de ${emp.fullName}: ${fmtMoney(
            res.movement?.balanceAfter || 0
          )}.`
        : `Movimiento guardado localmente. Pendiente sincronizar en Supabase.`
    );
    setTimeout(() => setFeedback(null), 4500);
  };

  // ==================== TAB 3: SUPPLIER PAYMENTS STATE ====================
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supDate, setSupDate] = useState<string>(today);
  const [supName, setSupName] = useState<string>('');
  const [supCategory, setSupCategory] = useState<SupplierPaymentCategory>('agroquimicos');
  const [supConcept, setSupConcept] = useState<string>('');
  const [supReference, setSupReference] = useState<string>('');
  const [supAmountStr, setSupAmountStr] = useState<string>('');
  const [supPaidStr, setSupPaidStr] = useState<string>('');
  const [supMethod, setSupMethod] = useState<SupplierPaymentMethod>('transferencia');
  const [supStatus, setSupStatus] = useState<SupplierPaymentStatus>('pagado');
  const [supNotes, setSupNotes] = useState<string>('');
  const [isSavingSup, setIsSavingSup] = useState<boolean>(false);
  const [supSearch, setSupSearch] = useState<string>('');
  const [supStatusFilter, setSupStatusFilter] = useState<'all' | SupplierPaymentStatus>('all');
  const [confirmDeleteSupId, setConfirmDeleteSupId] = useState<string | null>(null);

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupDate(today);
    setSupName('');
    setSupCategory('agroquimicos');
    setSupConcept('');
    setSupReference('');
    setSupAmountStr('');
    setSupPaidStr('');
    setSupMethod('transferencia');
    setSupStatus('pagado');
    setSupNotes('');
  };

  const handleLoadSupplierEdit = (p: SupplierPayment) => {
    setEditingSupplierId(p.id);
    setSupDate(p.paymentDate);
    setSupName(p.supplierName);
    setSupCategory(p.category);
    setSupConcept(p.concept);
    setSupReference(p.reference || '');
    setSupAmountStr(String(p.amount || 0));
    setSupPaidStr(String(p.paidAmount || 0));
    setSupMethod(p.paymentMethod);
    setSupStatus(p.status);
    setSupNotes(p.notes || '');
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const amount = parseDec(supAmountStr);
    if (!supName.trim() || !supConcept.trim() || amount <= 0) {
      setErrorMsg('Ingresa proveedor, concepto y monto mayor a cero.');
      return;
    }
    setIsSavingSup(true);
    const res = await saveSupplierPayment(
      {
        paymentDate: supDate || today,
        supplierName: supName,
        category: supCategory,
        concept: supConcept,
        reference: supReference.trim(),
        amount,
        paidAmount: supStatus === 'parcial' ? parseDec(supPaidStr) : supStatus === 'pagado' ? amount : 0,
        paymentMethod: supMethod,
        status: supStatus,
        notes: supNotes.trim() || undefined,
      },
      editingSupplierId || undefined
    );
    setIsSavingSup(false);
    resetSupplierForm();
    setFeedback(
      res.cloudSynced
        ? `Pago a "${res.entry.supplierName}" guardado en Supabase.`
        : `Pago guardado localmente. Pendiente sincronizar en Supabase.`
    );
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleQuickMarkSupplierPaid = async (p: SupplierPayment) => {
    await saveSupplierPayment(
      {
        paymentDate: p.paymentDate,
        supplierName: p.supplierName,
        category: p.category,
        concept: p.concept,
        reference: p.reference,
        amount: p.amount,
        paidAmount: p.amount,
        paymentMethod: p.paymentMethod,
        status: 'pagado',
        notes: p.notes,
      },
      p.id
    );
    setFeedback(`Pago a "${p.supplierName}" marcado como PAGADO.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const filteredSuppliers = useMemo(() => {
    const q = supSearch.trim().toLowerCase();
    return [...supplierPayments]
      .filter((p) => {
        if (supStatusFilter !== 'all' && p.status !== supStatusFilter) return false;
        if (!q) return true;
        return (
          p.supplierName.toLowerCase().includes(q) ||
          p.concept.toLowerCase().includes(q) ||
          (p.reference || '').toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [supplierPayments, supSearch, supStatusFilter]);

  // ==================== CONSOLIDATED SUMMARY KPIs ====================
  const summaryStats = useMemo(() => {
    const totalPayrollPaid = payrollWeeks.reduce((acc, w) => acc + Number(w.grandTotalPay || 0), 0);
    const totalSuppliersPaid = supplierPayments.reduce((acc, s) => acc + Number(s.paidAmount || 0), 0);
    const totalSuppliersPending = supplierPayments.reduce(
      (acc, s) => acc + Math.max(0, Number(s.amount || 0) - Number(s.paidAmount || 0)),
      0
    );
    const totalLoansOutstanding = payrollEmployees.reduce(
      (acc, e) => acc + Number(e.loanBalance || 0),
      0
    );
    const totalLoanGranted = employeeLoans
      .filter((l) => l.movementType === 'prestamo')
      .reduce((acc, l) => acc + Number(l.amount || 0), 0);
    const totalLoanRecovered = employeeLoans
      .filter((l) => l.movementType === 'abono' || l.movementType === 'descuento')
      .reduce((acc, l) => acc + Number(l.amount || 0), 0);

    return {
      totalPayrollPaid,
      totalSuppliersPaid,
      totalSuppliersPending,
      totalLoansOutstanding,
      totalLoanGranted,
      totalLoanRecovered,
      grandTotalOutflows: round2(totalPayrollPaid + totalSuppliersPaid),
    };
  }, [payrollWeeks, supplierPayments, payrollEmployees, employeeLoans]);

  const availableYears = useMemo(() => {
    const set = new Set<string>([today.slice(0, 4)]);
    payrollWeeks.forEach((w) => {
      const y = (w.startDate || w.endDate || '').slice(0, 4);
      if (y && /^\d{4}$/.test(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [payrollWeeks, today]);

  const annualHistory = useMemo<AnnualPayrollSummaryRow[]>(() => {
    const map = new Map<string, AnnualPayrollSummaryRow>();
    const filteredWeeks = payrollWeeks.filter((w) => {
      if (selectedYear === 'ALL') return true;
      return (w.startDate || w.endDate || '').startsWith(selectedYear);
    });

    filteredWeeks.forEach((w) => {
      (w.rows || []).forEach((r) => {
        const key = r.employeeId || r.employeeName.toUpperCase();
        const existing = map.get(key) || {
          employeeName: r.employeeName,
          teamGroup: r.teamGroup || w.teamGroup || 'AARON',
          weeksCount: 0,
          totalDaysWorked: 0,
          totalBasePay: 0,
          totalBonusesAndExtras: 0,
          totalFumigadasCount: 0,
          totalExtraHours: 0,
          totalDeductionsAndLoans: 0,
          totalNetPaid: 0,
        };
        existing.weeksCount += 1;
        existing.totalDaysWorked = round2(existing.totalDaysWorked + Number(r.daysWorked || 0));
        existing.totalBasePay = round2(existing.totalBasePay + Number(r.weekPay || 0));
        existing.totalFumigadasCount = round2(
          existing.totalFumigadasCount + Number(r.fumigadasQty || 0)
        );
        existing.totalExtraHours = round2(
          existing.totalExtraHours + Number(r.extraHoursQty || 0)
        );
        existing.totalBonusesAndExtras = round2(
          existing.totalBonusesAndExtras +
            Number(r.attendanceBonus || 0) +
            Number(r.fumigadasAmount || 0) +
            Number(r.cargadasAmount || 0) +
            Number(r.extraHoursAmount || 0) +
            Number(r.destajosAmount || 0) +
            Number(r.extraWorkAmount || 0) +
            Number(r.commissionBonusAmount || 0)
        );
        existing.totalDeductionsAndLoans = round2(
          existing.totalDeductionsAndLoans +
            Number(r.attendanceDiscount || 0) +
            Number(r.otherDeductions || 0) +
            Number(r.loanPayment || 0)
        );
        existing.totalNetPaid = round2(existing.totalNetPaid + Number(r.totalNetPay || 0));
        map.set(key, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalNetPaid - a.totalNetPaid);
  }, [payrollWeeks, selectedYear]);

  const annualTotals = useMemo(
    () =>
      annualHistory.reduce(
        (acc, r) => {
          acc.days = round2(acc.days + r.totalDaysWorked);
          acc.base = round2(acc.base + r.totalBasePay);
          acc.fumigadasCount = round2(acc.fumigadasCount + r.totalFumigadasCount);
          acc.extraHours = round2(acc.extraHours + r.totalExtraHours);
          acc.bonusesExtras = round2(acc.bonusesExtras + r.totalBonusesAndExtras);
          acc.deductions = round2(acc.deductions + r.totalDeductionsAndLoans);
          acc.net = round2(acc.net + r.totalNetPaid);
          return acc;
        },
        { days: 0, base: 0, fumigadasCount: 0, extraHours: 0, bonusesExtras: 0, deductions: 0, net: 0 }
      ),
    [annualHistory]
  );

  const currentExportWeek: PayrollWeekEntry = useMemo(
    () => ({
      ...buildCurrentWeekObject(),
      id: selectedWeekId === 'new' ? 'draft' : selectedWeekId,
      createdAt: today,
    }),
    [weekLabel, startDate, endDate, teamGroup, rates, rows, weekTotals, weekStatus, weekNotes, selectedWeekId]
  );

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
                  Módulo Administración &bull; Tesorería
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#535B28] text-white">
                  Nómina Automatizada + Préstamos + Proveedores
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                Pagos, Nómina y Préstamos
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                Control automatizado de sueldos semanales (base 6 días), bonos, fumigadas, préstamos, descuentos y pagos a proveedores.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {(
          [
            { id: 'nomina', label: 'Nómina Semanal', icon: Banknote, badge: `${payrollWeeks.length}` },
            {
              id: 'anual',
              label: 'Historial Anual',
              icon: Calendar,
              badge: `${annualTotals.days} días`,
            },
            {
              id: 'prestamos',
              label: 'Préstamos y Desc.',
              icon: CreditCard,
              badge: fmtMoney(summaryStats.totalLoansOutstanding),
            },
            {
              id: 'proveedores',
              label: 'Proveedores y Gastos',
              icon: Truck,
              badge: `${supplierPayments.length}`,
            },
            { id: 'resumen', label: 'Resumen Pagos', icon: BarChart3, badge: 'KPIs' },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
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

      {/* Feedback / Error */}
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

      {/* ==================== SUB-TAB 1: NÓMINA SEMANAL (FICHA INDIVIDUAL POR TRABAJADOR) ==================== */}
      {subTab === 'nomina' && (
        <WorkerPayrollWorkbench
          today={today}
          payrollEmployees={payrollEmployees}
          payrollWeeks={payrollWeeks}
          selectedWeekId={selectedWeekId}
          weekLabel={weekLabel}
          startDate={startDate}
          endDate={endDate}
          teamGroup={teamGroup}
          weekStatus={weekStatus}
          rates={rates}
          rows={rows}
          weekTotals={weekTotals}
          availableGroups={availableGroups}
          pendingAdjustmentsCount={pendingAdjustments.length}
          syncLoansOnSave={syncLoansOnSave}
          isSavingWeek={isSavingWeek}
          confirmDeleteWeekId={confirmDeleteWeekId}
          currentExportWeek={currentExportWeek}
          onSelectWeek={(val) => {
            if (val === 'new') {
              startNewAutomatedWeek(teamGroup || 'AARON');
            } else {
              const found = payrollWeeks.find((w) => w.id === val);
              if (found) loadWeekIntoEditor(found);
            }
          }}
          onStartNewWeek={startNewAutomatedWeek}
          onWeekLabelChange={setWeekLabel}
          onStartDateChange={(val) => {
            setStartDate(val);
            setWeekLabel(formatShortPeriodRange(val, endDate));
          }}
          onEndDateChange={(val) => {
            setEndDate(val);
            setWeekLabel(formatShortPeriodRange(startDate, val));
          }}
          onTeamGroupChange={setTeamGroup}
          onWeekStatusChange={setWeekStatus}
          onRateChange={handleRateChange}
          onUpdateRow={updateRowField}
          onSyncPendingIncidents={handleSyncPendingIncidents}
          onPullMissingEmployees={handlePullMissingActiveEmployees}
          onMarkAllPaid={handleMarkAllPaid}
          onSyncLoansOnSaveChange={setSyncLoansOnSave}
          onSavePayrollWeek={handleSavePayrollWeek}
          onRequestDeleteWeek={setConfirmDeleteWeekId}
          onConfirmDeleteWeek={handleDeleteWeek}
          onSaveEmployeeBaseSalary={handleSaveEmployeeBaseSalary}
        />
      )}

      {/* ==================== SUB-TAB 2: PRÉSTAMOS Y DESCUENTOS ==================== */}
      {subTab === 'prestamos' && (
        <div className="space-y-5">
          {/* Loan KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-[#5C1125]">Saldo por Cobrar</span>
              <p className="text-2xl font-black text-[#5C1125] mt-1">
                {fmtMoney(summaryStats.totalLoansOutstanding)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-stone-600">Total Prestado</span>
              <p className="text-2xl font-black text-[#000000] mt-1">
                {fmtMoney(summaryStats.totalLoanGranted)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-[#535B28]">Total Recuperado</span>
              <p className="text-2xl font-black text-[#535B28] mt-1">
                {fmtMoney(summaryStats.totalLoanRecovered)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase text-stone-500">Exportar Cartera</span>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => exportEmployeeLoansExcel(payrollEmployees, employeeLoans)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#535B28] text-white text-xs font-bold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() => exportEmployeeLoansPdf(payrollEmployees, employeeLoans)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                  PDF
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form: Register Loan / Abono */}
            <form
              onSubmit={handleAddLoanMovement}
              className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4 h-fit"
            >
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <CreditCard className="w-4 h-4 text-[#5C1125]" />
                <h2 className="text-sm font-extrabold text-[#000000]">
                  Registrar Préstamo o Abono
                </h2>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Empleado *</label>
                <select
                  value={loanEmpId}
                  onChange={(e) => setLoanEmpId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                >
                  {payrollEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.teamGroup}) — Saldo: {fmtMoney(emp.loanBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Tipo</label>
                  <select
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value as EmployeeLoanMovementType)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                  >
                    <option value="prestamo">Nuevo Préstamo (+)</option>
                    <option value="abono">Abono / Pago (-)</option>
                    <option value="descuento">Descuento (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Monto ($ MXN) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={loanAmountStr}
                  onChange={(e) => setLoanAmountStr(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Ej. 500"
                  required
                  className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-extrabold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Concepto</label>
                <input
                  type="text"
                  value={loanConcept}
                  onChange={(e) => setLoanConcept(e.target.value)}
                  placeholder="Ej. Préstamo personal, adelanto, abono efectivo..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Notas</label>
                <input
                  type="text"
                  value={loanNotes}
                  onChange={(e) => setLoanNotes(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingLoan}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
              >
                <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
                <span>{isSavingLoan ? 'Registrando...' : 'Guardar Movimiento'}</span>
              </button>
            </form>

            {/* Balances & History */}
            <div className="lg:col-span-8 space-y-5">
              {/* Active Balances */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-stone-200">
                  <h3 className="text-sm font-extrabold text-[#000000]">
                    Saldos Vigentes por Empleado (Se arrastran automáticamente a la Nómina)
                  </h3>
                </div>
                <div className="divide-y divide-stone-100">
                  {payrollEmployees.filter((e) => Number(e.loanBalance || 0) > 0).length === 0 ? (
                    <div className="p-6 text-center text-xs text-stone-500">
                      Actualmente ningún empleado tiene saldo pendiente de préstamo.
                    </div>
                  ) : (
                    payrollEmployees
                      .filter((e) => Number(e.loanBalance || 0) > 0)
                      .map((emp) => (
                        <div
                          key={emp.id}
                          className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#FAF8F5]/70"
                        >
                          <div>
                            <span className="text-sm font-extrabold text-[#000000]">
                              {emp.fullName}
                            </span>
                            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF8F5] text-[#535B28] border border-[#dce4bf]">
                              {emp.teamGroup}
                            </span>
                            <p className="text-xs text-stone-500">
                              Sueldo semanal: {fmtMoney(emp.weeklySalary)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="block text-[10px] font-bold uppercase text-stone-400">
                                Saldo Pendiente
                              </span>
                              <span className="text-base font-black text-[#5C1125]">
                                {fmtMoney(emp.loanBalance)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setLoanEmpId(emp.id);
                                setLoanType('abono');
                                setLoanConcept('Abono directo a préstamo');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#f7f8f2] hover:bg-[#dce4bf] text-[#535B28] text-xs font-bold border border-[#dce4bf] cursor-pointer"
                            >
                              Abonar
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Movements History */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#000000]">
                    Historial de Préstamos y Abonos ({employeeLoans.length})
                  </h3>
                </div>
                <div className="divide-y divide-stone-100">
                  {employeeLoans.length === 0 ? (
                    <div className="p-6 text-center text-xs text-stone-500">
                      Sin movimientos registrados.
                    </div>
                  ) : (
                    employeeLoans.map((m) => (
                      <div
                        key={m.id}
                        className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FAF8F5]/60"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-extrabold text-[#000000]">
                              {m.employeeName}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                m.movementType === 'prestamo'
                                  ? 'bg-[#fbf2f4] text-[#5C1125]'
                                  : 'bg-[#f7f8f2] text-[#535B28]'
                              }`}
                            >
                              {m.movementType}
                            </span>
                            <span className="text-[11px] text-stone-400">{m.movementDate}</span>
                          </div>
                          <p className="text-xs text-stone-600 mt-0.5">{m.concept}</p>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right">
                            <span
                              className={`text-sm font-black ${
                                m.movementType === 'prestamo' ? 'text-[#5C1125]' : 'text-[#535B28]'
                              }`}
                            >
                              {m.movementType === 'prestamo' ? '+' : '-'} {fmtMoney(m.amount)}
                            </span>
                            <span className="block text-[10px] text-stone-500">
                              Saldo: {fmtMoney(m.balanceAfter)}
                            </span>
                          </div>

                          {confirmDeleteLoanId === m.id ? (
                            <div className="flex items-center gap-1.5 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteEmployeeLoanMovement(m.id);
                                  setConfirmDeleteLoanId(null);
                                  setFeedback('Movimiento eliminado y saldo ajustado.');
                                  setTimeout(() => setFeedback(null), 3500);
                                }}
                                className="text-[11px] font-bold text-rose-700 cursor-pointer"
                              >
                                Sí
                              </button>
                              <span className="text-stone-300">|</span>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteLoanId(null)}
                                className="text-[11px] text-stone-500 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteLoanId(m.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                              title="Eliminar y revertir saldo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: PROVEEDORES Y GASTOS ==================== */}
      {subTab === 'proveedores' && (
        <div className="space-y-5">
          {/* Supplier KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-[#535B28]">Pagado Proveedores</span>
              <p className="text-2xl font-black text-[#535B28] mt-1">
                {fmtMoney(summaryStats.totalSuppliersPaid)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-[#5C1125]">Por Pagar</span>
              <p className="text-2xl font-black text-[#5C1125] mt-1">
                {fmtMoney(summaryStats.totalSuppliersPending)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-stone-600">Total Facturado</span>
              <p className="text-2xl font-black text-[#000000] mt-1">
                {fmtMoney(summaryStats.totalSuppliersPaid + summaryStats.totalSuppliersPending)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase text-stone-500">Exportar Proveedores</span>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => exportSupplierPaymentsExcel(filteredSuppliers)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#535B28] text-white text-xs font-bold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() => exportSupplierPaymentsPdf(filteredSuppliers)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                  PDF
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Supplier Payment Form */}
            <form
              onSubmit={handleSaveSupplier}
              className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3.5 h-fit"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#5C1125]" />
                  <h2 className="text-sm font-extrabold text-[#000000]">
                    {editingSupplierId ? 'Editar Pago' : 'Registrar Pago a Proveedor'}
                  </h2>
                </div>
                {editingSupplierId && (
                  <button
                    type="button"
                    onClick={resetSupplierForm}
                    className="text-xs font-bold text-[#5C1125] hover:underline cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={supDate}
                    onChange={(e) => setSupDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Categoría</label>
                  <select
                    value={supCategory}
                    onChange={(e) => setSupCategory(e.target.value as SupplierPaymentCategory)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                  >
                    {SUPPLIER_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Proveedor / Beneficiario *
                </label>
                <input
                  type="text"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="Ej. Agroquímicos del Valle"
                  required
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Concepto *</label>
                <input
                  type="text"
                  value={supConcept}
                  onChange={(e) => setSupConcept(e.target.value)}
                  placeholder="Ej. Fertilizante, flete CEDA, renta..."
                  required
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Monto Total ($) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={supAmountStr}
                    onChange={(e) => setSupAmountStr(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    required
                    className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-extrabold focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Factura / Folio</label>
                  <input
                    type="text"
                    value={supReference}
                    onChange={(e) => setSupReference(e.target.value)}
                    placeholder="Ej. FAC-1042"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Método de Pago</label>
                  <select
                    value={supMethod}
                    onChange={(e) => setSupMethod(e.target.value as SupplierPaymentMethod)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Estatus</label>
                  <select
                    value={supStatus}
                    onChange={(e) => setSupStatus(e.target.value as SupplierPaymentStatus)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                  >
                    <option value="pagado">Pagado</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="parcial">Pago Parcial</option>
                  </select>
                </div>
              </div>

              {supStatus === 'parcial' && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Monto Abonado ($)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={supPaidStr}
                    onChange={(e) => setSupPaidStr(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Notas</label>
                <input
                  type="text"
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingSup}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4 text-[#C3A25D]" />
                <span>
                  {isSavingSup
                    ? 'Guardando...'
                    : editingSupplierId
                    ? 'Actualizar Pago'
                    : 'Guardar Pago'}
                </span>
              </button>
            </form>

            {/* Supplier Payments List */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-stone-200 bg-[#FAF8F5] flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={supSearch}
                    onChange={(e) => setSupSearch(e.target.value)}
                    placeholder="Buscar proveedor, concepto o factura..."
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
                <div className="flex gap-1.5">
                  {(['all', 'pagado', 'pendiente', 'parcial'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSupStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                        supStatusFilter === st
                          ? 'bg-[#5C1125] text-white'
                          : 'bg-white border border-stone-300 text-stone-600'
                      }`}
                    >
                      {st === 'all' ? 'Todos' : st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-stone-100">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-500">
                    No hay pagos a proveedores registrados con este filtro.
                  </div>
                ) : (
                  filteredSuppliers.map((p) => {
                    const pending = Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0));
                    return (
                      <div
                        key={p.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/70"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-extrabold text-[#000000]">
                              {p.supplierName}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                p.status === 'pagado'
                                  ? 'bg-[#535B28] text-white'
                                  : p.status === 'pendiente'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {p.status}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                              {p.paymentDate}
                            </span>
                            {p.reference && (
                              <span className="text-[10px] font-mono text-stone-500">
                                #{p.reference}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-600 mt-0.5">{p.concept}</p>
                          <p className="text-[11px] text-stone-400">
                            Método: {p.paymentMethod} &bull; Categoría: {p.category}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                          <div className="text-right mr-1">
                            <span className="text-sm font-black text-[#000000]">
                              {fmtMoney(p.amount)}
                            </span>
                            {pending > 0 && (
                              <span className="block text-[10px] font-bold text-rose-700">
                                Resta: {fmtMoney(pending)}
                              </span>
                            )}
                          </div>

                          {p.status !== 'pagado' && (
                            <button
                              type="button"
                              onClick={() => handleQuickMarkSupplierPaid(p)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#f7f8f2] hover:bg-[#dce4bf] text-[#535B28] text-xs font-bold border border-[#dce4bf] cursor-pointer"
                            >
                              Liquidar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleLoadSupplierEdit(p)}
                            className="p-1.5 rounded-lg bg-[#fbf2f4] text-[#5C1125] hover:bg-[#ebccd4] cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeleteSupId === p.id ? (
                            <div className="flex items-center gap-1.5 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteSupplierPayment(p.id);
                                  setConfirmDeleteSupId(null);
                                  setFeedback('Pago eliminado.');
                                  setTimeout(() => setFeedback(null), 3000);
                                }}
                                className="text-[11px] font-bold text-rose-700 cursor-pointer"
                              >
                                Borrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSupId(null)}
                                className="text-[11px] text-stone-500 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSupId(p.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 4: RESUMEN CONSOLIDADO ==================== */}
      {subTab === 'resumen' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#5C1125] text-white border border-[#C3A25D]/40 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-[#C3A25D]">
                Total Egresos Pagados
              </span>
              <p className="text-2xl font-black mt-1">
                {fmtMoney(summaryStats.grandTotalOutflows)}
              </p>
              <span className="text-[11px] text-[#d6be83]">Nóminas + Proveedores liquidados</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-[#000000]">
                Total Nóminas Semanales
              </span>
              <p className="text-2xl font-black text-[#000000] mt-1">
                {fmtMoney(summaryStats.totalPayrollPaid)}
              </p>
              <span className="text-[11px] text-stone-500">{payrollWeeks.length} semana(s) registradas</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-[#535B28]">
                Pagos a Proveedores
              </span>
              <p className="text-2xl font-black text-[#535B28] mt-1">
                {fmtMoney(summaryStats.totalSuppliersPaid)}
              </p>
              <span className="text-[11px] text-rose-700 font-semibold">
                Pendiente: {fmtMoney(summaryStats.totalSuppliersPending)}
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-amber-800">
                Préstamos por Recuperar
              </span>
              <p className="text-2xl font-black text-[#5C1125] mt-1">
                {fmtMoney(summaryStats.totalLoansOutstanding)}
              </p>
              <span className="text-[11px] text-stone-500">
                Recuperado: {fmtMoney(summaryStats.totalLoanRecovered)}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#5C1125]" />
                <h3 className="text-sm font-extrabold text-[#000000]">
                  Histórico de Nóminas Semanales
                </h3>
              </div>
            </div>
            <div className="divide-y divide-stone-100">
              {payrollWeeks.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  No hay nóminas semanales guardadas aún.
                </div>
              ) : (
                payrollWeeks.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/70"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-[#000000]">
                          {w.weekLabel}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF8F5] text-[#535B28] border border-[#dce4bf]">
                          {w.teamGroup}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            w.status === 'pagada'
                              ? 'bg-[#535B28] text-white'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {w.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {w.rows.length} empleados &bull; Sueldo: {fmtMoney(w.totalWeekPay)} &bull; Bonos: {fmtMoney(w.totalBonus)} &bull; Fumigadas: {fmtMoney(w.totalFumigadas)} &bull; Abonos Préstamo: {fmtMoney(w.totalLoanPayments)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="text-base font-black text-[#5C1125] mr-2">
                        {fmtMoney(w.grandTotalPay)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          loadWeekIntoEditor(w);
                          setSubTab('nomina');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] text-xs font-bold border border-[#ebccd4] cursor-pointer"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={() => exportPayrollWeekExcel(w)}
                        className="p-1.5 rounded-lg bg-[#535B28] text-white cursor-pointer"
                        title="Exportar Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportPayrollWeekPdf(w)}
                        className="p-1.5 rounded-lg bg-[#5C1125] text-white cursor-pointer"
                        title="Exportar PDF"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 5: HISTORIAL ANUAL (DÍAS Y PAGOS) ==================== */}
      {subTab === 'anual' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#000000] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#5C1125]" />
                <span>Historial Anual por Trabajador (Días Trabajados y Pagos Acumulados)</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Consolidado automático de todas las nóminas semanales guardadas por año para control de antigüedad, aguinaldo y costo anual de mano de obra.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-[#FAF8F5] text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Año {yr}
                  </option>
                ))}
                <option value="ALL">Todo el Historial</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  exportAnnualPayrollHistoryExcel(
                    selectedYear === 'ALL' ? 'HISTORICO' : selectedYear,
                    annualHistory
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportAnnualPayrollHistoryPdf(
                    selectedYear === 'ALL' ? 'HISTORICO' : selectedYear,
                    annualHistory
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-bold cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-stone-500">Trabajadores en Periodo</span>
              <p className="text-2xl font-black text-[#000000] mt-0.5">{annualHistory.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-[#535B28]">Total Días Trabajados</span>
              <p className="text-2xl font-black text-[#535B28] mt-0.5">{annualTotals.days.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-amber-800">Bonos + Fumig. + Extras</span>
              <p className="text-2xl font-black text-amber-800 mt-0.5">
                {fmtMoney(annualTotals.bonusesExtras)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#5C1125] text-white border border-[#C3A25D]/40 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-[#C3A25D]">Total Pagado en el Año</span>
              <p className="text-2xl font-black mt-0.5">{fmtMoney(annualTotals.net)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#5C1125] text-white text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-3 text-left">Trabajador</th>
                    <th className="py-3 px-2 text-center">Equipo</th>
                    <th className="py-3 px-2 text-center">Semanas</th>
                    <th className="py-3 px-2 text-center">Días Trabajados</th>
                    <th className="py-3 px-2 text-right">Sueldo Base</th>
                    <th className="py-3 px-2 text-center">Tambos 200L</th>
                    <th className="py-3 px-2 text-center">Hrs Extra</th>
                    <th className="py-3 px-2 text-right">Bonos y Extras ($)</th>
                    <th className="py-3 px-2 text-right">Desc. / Prést.</th>
                    <th className="py-3 px-3 text-right bg-[#3f0918] text-[#C3A25D]">Total Anual Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {annualHistory.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-stone-500">
                        No hay nóminas guardadas en {selectedYear === 'ALL' ? 'el historial' : `el año ${selectedYear}`}.
                      </td>
                    </tr>
                  ) : (
                    annualHistory.map((row) => (
                      <tr key={`${row.employeeName}-${row.teamGroup}`} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-3 font-extrabold text-[#000000]">{row.employeeName}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-stone-200 text-[10px] font-bold text-[#535B28]">
                            {row.teamGroup}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold">{row.weeksCount}</td>
                        <td className="py-2.5 px-2 text-center font-black text-[#535B28]">
                          {row.totalDaysWorked}
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold">{fmtMoney(row.totalBasePay)}</td>
                        <td className="py-2.5 px-2 text-center font-semibold">{row.totalFumigadasCount}</td>
                        <td className="py-2.5 px-2 text-center font-semibold">{row.totalExtraHours}</td>
                        <td className="py-2.5 px-2 text-right font-semibold text-[#535B28]">
                          {fmtMoney(row.totalBonusesAndExtras)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold text-rose-700">
                          -{fmtMoney(row.totalDeductionsAndLoans)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#5C1125] bg-[#FAF8F5]">
                          {fmtMoney(row.totalNetPaid)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {annualHistory.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#000000] text-[#C3A25D] font-extrabold text-xs">
                      <td className="py-3 px-3" colSpan={3}>
                        TOTAL ACUMULADO ({annualHistory.length} trabajadores)
                      </td>
                      <td className="py-3 px-2 text-center text-white">{annualTotals.days}</td>
                      <td className="py-3 px-2 text-right">{fmtMoney(annualTotals.base)}</td>
                      <td className="py-3 px-2 text-center">{annualTotals.fumigadasCount}</td>
                      <td className="py-3 px-2 text-center">{annualTotals.extraHours}</td>
                      <td className="py-3 px-2 text-right">{fmtMoney(annualTotals.bonusesExtras)}</td>
                      <td className="py-3 px-2 text-right text-rose-300">-{fmtMoney(annualTotals.deductions)}</td>
                      <td className="py-3 px-3 text-right text-sm text-white bg-[#5C1125]">
                        {fmtMoney(annualTotals.net)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
