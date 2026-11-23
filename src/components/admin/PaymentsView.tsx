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
  exportEmployeeLoansExcel,
  exportEmployeeLoansPdf,
  exportEmployeePaySlipPdf,
  exportPayrollWeekExcel,
  exportPayrollWeekPdf,
  exportSupplierPaymentsExcel,
  exportSupplierPaymentsPdf,
} from '../../utils/exportReports';

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

const recalculateRow = (row: PayrollWeekRow, workDaysPerWeek = 6): PayrollWeekRow => {
  const baseDays = workDaysPerWeek > 0 ? workDaysPerWeek : 6;
  const weekPay = round2((Number(row.weeklySalary || 0) / baseDays) * Number(row.daysWorked || 0));
  const loanPrev = Math.max(0, round2(row.loanPreviousBalance));
  const loanPay = Math.max(0, round2(row.loanPayment));
  const loanRemaining = Math.max(0, round2(loanPrev - loanPay));
  const totalNetPay = round2(
    weekPay +
      Number(row.attendanceBonus || 0) +
      Number(row.fumigadasAmount || 0) +
      Number(row.cargadasAmount || 0) +
      Number(row.extraHoursAmount || 0) +
      Number(row.destajosAmount || 0) +
      Number(row.extraWorkAmount || 0) -
      loanPay -
      Number(row.otherDeductions || 0)
  );
  return {
    ...row,
    weekPay,
    loanPreviousBalance: loanPrev,
    loanPayment: loanPay,
    loanRemainingBalance: loanRemaining,
    totalNetPay,
  };
};

const computeWeekTotals = (rows: PayrollWeekRow[]) => {
  return rows.reduce(
    (acc, r) => {
      acc.totalWeekPay = round2(acc.totalWeekPay + Number(r.weekPay || 0));
      acc.totalBonus = round2(acc.totalBonus + Number(r.attendanceBonus || 0));
      acc.totalFumigadas = round2(acc.totalFumigadas + Number(r.fumigadasAmount || 0));
      acc.totalCargadas = round2(acc.totalCargadas + Number(r.cargadasAmount || 0));
      acc.totalExtraHours = round2(acc.totalExtraHours + Number(r.extraHoursAmount || 0));
      acc.totalDestajos = round2(acc.totalDestajos + Number(r.destajosAmount || 0));
      acc.totalExtraWork = round2(acc.totalExtraWork + Number(r.extraWorkAmount || 0));
      acc.totalOtherDeductions = round2(acc.totalOtherDeductions + Number(r.otherDeductions || 0));
      acc.totalLoanPayments = round2(acc.totalLoanPayments + Number(r.loanPayment || 0));
      acc.totalLoanRemaining = round2(acc.totalLoanRemaining + Number(r.loanRemainingBalance || 0));
      acc.grandTotalPay = round2(acc.grandTotalPay + Number(r.totalNetPay || 0));
      return acc;
    },
    {
      totalWeekPay: 0,
      totalBonus: 0,
      totalFumigadas: 0,
      totalCargadas: 0,
      totalExtraHours: 0,
      totalDestajos: 0,
      totalExtraWork: 0,
      totalOtherDeductions: 0,
      totalLoanPayments: 0,
      totalLoanRemaining: 0,
      grandTotalPay: 0,
    }
  );
};

export const PaymentsView: React.FC = () => {
  const {
    payrollEmployees,
    payrollWeeks,
    savePayrollWeek,
    deletePayrollWeek,
    employeeLoans,
    addEmployeeLoanMovement,
    deleteEmployeeLoanMovement,
    supplierPayments,
    saveSupplierPayment,
    deleteSupplierPayment,
    setActiveView,
  } = useGreenhouse();

  const today = new Date().toISOString().slice(0, 10);

  const [subTab, setSubTab] = useState<'nomina' | 'prestamos' | 'proveedores' | 'resumen'>('nomina');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==================== TAB 1: WEEKLY PAYROLL STATE ====================
  const [selectedWeekId, setSelectedWeekId] = useState<string>(payrollWeeks[0]?.id || 'new');
  const [weekLabel, setWeekLabel] = useState<string>(
    payrollWeeks[0]?.weekLabel || buildSpanishWeekLabel(today, today)
  );
  const [startDate, setStartDate] = useState<string>(payrollWeeks[0]?.startDate || today);
  const [endDate, setEndDate] = useState<string>(payrollWeeks[0]?.endDate || today);
  const [teamGroup, setTeamGroup] = useState<string>(payrollWeeks[0]?.teamGroup || 'AARON');
  const [weekStatus, setWeekStatus] = useState<'borrador' | 'pagada'>(
    payrollWeeks[0]?.status || 'borrador'
  );
  const [weekNotes, setWeekNotes] = useState<string>(payrollWeeks[0]?.notes || '');
  const [rates, setRates] = useState<PayrollRates>(payrollWeeks[0]?.rates || DEFAULT_RATES);
  const [showRatesPanel, setShowRatesPanel] = useState<boolean>(false);
  const [rows, setRows] = useState<PayrollWeekRow[]>(payrollWeeks[0]?.rows || []);
  const [syncLoansOnSave, setSyncLoansOnSave] = useState<boolean>(true);
  const [isSavingWeek, setIsSavingWeek] = useState<boolean>(false);
  const [confirmDeleteWeekId, setConfirmDeleteWeekId] = useState<string | null>(null);

  // Sync editor when user picks an existing saved week
  const loadWeekIntoEditor = (week: PayrollWeekEntry) => {
    setSelectedWeekId(week.id);
    setWeekLabel(week.weekLabel);
    setStartDate(week.startDate);
    setEndDate(week.endDate);
    setTeamGroup(week.teamGroup);
    setWeekStatus(week.status);
    setWeekNotes(week.notes || '');
    setRates(week.rates || DEFAULT_RATES);
    setRows(week.rows.map((r) => recalculateRow(r, week.rates?.workDaysPerWeek || 6)));
  };

  // Start a brand-new automated payroll week from active employees + live loan balances
  const startNewAutomatedWeek = (filterGroup = 'AARON') => {
    const start = today;
    const endDt = new Date(today + 'T12:00:00');
    endDt.setDate(endDt.getDate() + 5);
    const end = endDt.toISOString().slice(0, 10);

    const activeEmps = payrollEmployees.filter((e) => {
      if (e.active === false) return false;
      if (filterGroup === 'TODOS') return true;
      return (e.teamGroup || 'AARON').toUpperCase() === filterGroup.toUpperCase();
    });
    const listToUse =
      activeEmps.length > 0 ? activeEmps : payrollEmployees.filter((e) => e.active !== false);

    const newRows: PayrollWeekRow[] = listToUse.map((emp: PayrollEmployee) =>
      recalculateRow(
        {
          employeeId: emp.id,
          employeeName: emp.fullName,
          teamGroup: emp.teamGroup || 'AARON',
          daysWorked: rates.workDaysPerWeek || 6,
          weeklySalary: Number(emp.weeklySalary || 0),
          weekPay: Number(emp.weeklySalary || 0),
          attendanceBonus: emp.hasAttendanceBonus
            ? Number(emp.defaultBonusAmount || rates.defaultBonus || 150)
            : 0,
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
          otherDeductions: 0,
          loanPreviousBalance: Number(emp.loanBalance || 0),
          loanPayment: 0,
          loanRemainingBalance: Number(emp.loanBalance || 0),
          totalNetPay: 0,
          paid: false,
        },
        rates.workDaysPerWeek || 6
      )
    );

    setSelectedWeekId('new');
    setStartDate(start);
    setEndDate(end);
    setWeekLabel(buildSpanishWeekLabel(start, end));
    setTeamGroup(filterGroup);
    setWeekStatus('borrador');
    setWeekNotes('');
    setRows(newRows);
    setFeedback(
      `Nueva nómina generada automáticamente con ${newRows.length} empleado(s) activos y sus saldos vigentes de préstamos.`
    );
    setTimeout(() => setFeedback(null), 4000);
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
      prev.map((row, i) =>
        i === idx ? recalculateRow(updater(row), rates.workDaysPerWeek || 6) : row
      )
    );
  };

  const handleRateChange = (field: keyof PayrollRates, value: number) => {
    const nextRates = { ...rates, [field]: value };
    setRates(nextRates);
    // Recalculate rows with updated unit rates when qty > 0
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
        return recalculateRow(nextRow, nextRates.workDaysPerWeek || 6);
      })
    );
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
      recalculateRow(
        {
          employeeId: emp.id,
          employeeName: emp.fullName,
          teamGroup: emp.teamGroup || 'AARON',
          daysWorked: rates.workDaysPerWeek || 6,
          weeklySalary: Number(emp.weeklySalary || 0),
          weekPay: Number(emp.weeklySalary || 0),
          attendanceBonus: emp.hasAttendanceBonus
            ? Number(emp.defaultBonusAmount || rates.defaultBonus || 150)
            : 0,
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
          otherDeductions: 0,
          loanPreviousBalance: Number(emp.loanBalance || 0),
          loanPayment: 0,
          loanRemainingBalance: Number(emp.loanBalance || 0),
          totalNetPay: 0,
          paid: false,
        },
        rates.workDaysPerWeek || 6
      )
    );
    setRows((prev) => [...prev, ...additions]);
    setFeedback(`Se agregaron ${additions.length} empleado(s) nuevos a esta nómina.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleMarkAllPaid = () => {
    setRows((prev) => prev.map((r) => ({ ...r, paid: true })));
    setWeekStatus('pagada');
  };

  const buildCurrentWeekObject = (): Omit<PayrollWeekEntry, 'id' | 'createdAt' | 'updatedAt'> => ({
    weekLabel: weekLabel.trim() || buildSpanishWeekLabel(startDate, endDate),
    startDate,
    endDate,
    teamGroup: teamGroup || 'AARON',
    rates,
    rows,
    ...weekTotals,
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('admin_empleados')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Administrar Empleados ({payrollEmployees.filter((e) => e.active !== false).length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(
          [
            { id: 'nomina', label: 'Nómina Semanal', icon: Banknote, badge: `${payrollWeeks.length}` },
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

      {/* ==================== SUB-TAB 1: NÓMINA SEMANAL ==================== */}
      {subTab === 'nomina' && (
        <div className="space-y-5">
          {/* Week Selector & Actions Bar */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="text-xs font-extrabold text-stone-700 uppercase">
                  Semana Registrada:
                </label>
                <select
                  value={selectedWeekId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'new') {
                      startNewAutomatedWeek(teamGroup || 'AARON');
                    } else {
                      const found = payrollWeeks.find((w) => w.id === val);
                      if (found) loadWeekIntoEditor(found);
                    }
                  }}
                  className="px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-[#FAF8F5] text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
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

                <button
                  type="button"
                  onClick={() => startNewAutomatedWeek(teamGroup || 'AARON')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
                  <span>Nueva Semana Automática</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRatesPanel((s) => !s)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-200 text-[#000000] text-xs font-bold border border-stone-300 transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#5C1125]" />
                  <span>Tarifas (${rates.fumigadaRate}/fumig.)</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportPayrollWeekExcel(currentExportWeek)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportPayrollWeekPdf(currentExportWeek)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-bold transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Period Metadata Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-stone-100">
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  Título / Periodo de Nómina
                </label>
                <input
                  type="text"
                  value={weekLabel}
                  onChange={(e) => setWeekLabel(e.target.value.toUpperCase())}
                  placeholder="DEL 9 DE NOVIEMBRE AL 14 DE NOVIEMBRE"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold uppercase focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setWeekLabel(buildSpanishWeekLabel(e.target.value, endDate));
                  }}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setWeekLabel(buildSpanishWeekLabel(startDate, e.target.value));
                  }}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  Equipo / Encargado
                </label>
                <select
                  value={teamGroup}
                  onChange={(e) => setTeamGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                >
                  {availableGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  <option value="TODOS">TODOS LOS EQUIPOS</option>
                </select>
              </div>
            </div>

            {/* Configurable Unit Rates Panel */}
            {showRatesPanel && (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#C3A25D]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#5C1125]">
                    Tarifas Automáticas de Cálculo (editables)
                  </span>
                  <span className="text-[11px] text-stone-500">
                    Al cambiar una tarifa se recalculan las filas que tengan cantidad capturada.
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(
                    [
                      ['fumigadaRate', 'Fumigada ($/u)'],
                      ['cargadaRate', 'Cargada ($/u)'],
                      ['extraHourRate', 'Hora Extra ($/h)'],
                      ['destajoRate', 'Destajo ($/u)'],
                      ['defaultBonus', 'Bono AyP ($)'],
                      ['workDaysPerWeek', 'Días Base Sem.'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        {label}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(rates[key])}
                        onChange={(e) => handleRateChange(key, parseDec(e.target.value))}
                        className="no-spinner w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-stone-500">Sueldo Semana</span>
              <p className="text-lg font-black text-[#000000] mt-0.5">{fmtMoney(weekTotals.totalWeekPay)}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-[#535B28]">Bonos + Extras</span>
              <p className="text-lg font-black text-[#535B28] mt-0.5">
                {fmtMoney(
                  weekTotals.totalBonus +
                    weekTotals.totalFumigadas +
                    weekTotals.totalCargadas +
                    weekTotals.totalExtraHours +
                    weekTotals.totalDestajos +
                    weekTotals.totalExtraWork
                )}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-amber-700">Abonos Préstamo</span>
              <p className="text-lg font-black text-amber-800 mt-0.5">
                - {fmtMoney(weekTotals.totalLoanPayments + weekTotals.totalOtherDeductions)}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-stone-500">Resta Préstamos</span>
              <p className="text-lg font-black text-[#5C1125] mt-0.5">
                {fmtMoney(weekTotals.totalLoanRemaining)}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-[#5C1125] text-white border border-[#C3A25D]/40 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-[#C3A25D]">Total Neto a Pagar</span>
              <p className="text-xl font-black mt-0.5">{fmtMoney(weekTotals.grandTotalPay)}</p>
            </div>
          </div>

          {/* Automated Payroll Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-[#FAF8F5] border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-[#000000]">
                  Planilla Semanal — {teamGroup} ({rows.length} empleados)
                </h2>
                <p className="text-[11px] text-stone-500">
                  Captura manual sin flechitas. Todos los totales y restas de préstamos se calculan en tiempo real.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePullMissingActiveEmployees}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#535B28]" />
                  <span>Traer Empleados Faltantes</span>
                </button>
                <button
                  type="button"
                  onClick={handleMarkAllPaid}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f7f8f2] border border-[#dce4bf] text-xs font-bold text-[#535B28] hover:bg-[#dce4bf]/50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Marcar Todos Pagados</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[1380px]">
                <thead>
                  <tr className="bg-[#5C1125] text-white text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-2.5 text-left sticky left-0 bg-[#5C1125] z-10 min-w-[130px]">
                      Nombre
                    </th>
                    <th className="py-2.5 px-1.5 text-center w-14">Días</th>
                    <th className="py-2.5 px-1.5 text-right w-24">P/ Semanal</th>
                    <th className="py-2.5 px-2 text-right w-24">Semana</th>
                    <th className="py-2.5 px-1.5 text-right w-20">Bono/AyP</th>
                    <th className="py-2.5 px-1.5 text-center w-28">
                      Fumig. (Cant / $)
                    </th>
                    <th className="py-2.5 px-1.5 text-center w-28">
                      Carg. (Cant / $)
                    </th>
                    <th className="py-2.5 px-1.5 text-center w-28">
                      H.Ext (Cant / $)
                    </th>
                    <th className="py-2.5 px-1.5 text-center w-28">
                      Destajo (Cant / $)
                    </th>
                    <th className="py-2.5 px-1.5 text-right w-24">Trab. Extra ($)</th>
                    <th className="py-2.5 px-1.5 text-right w-20">Desc. ($)</th>
                    <th className="py-2.5 px-1.5 text-right w-24">Pago Prést.</th>
                    <th className="py-2.5 px-1.5 text-right w-24">Préstamo</th>
                    <th className="py-2.5 px-2 text-right w-24">Resta Prést.</th>
                    <th className="py-2.5 px-2.5 text-right bg-[#3f0918] text-[#C3A25D] w-28">
                      Total Neto
                    </th>
                    <th className="py-2.5 px-2 text-center w-20">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((r, idx) => (
                    <tr
                      key={`${r.employeeId}-${idx}`}
                      className={`hover:bg-[#FAF8F5] ${r.paid ? 'bg-[#f7f8f2]/35' : ''}`}
                    >
                      <td className="py-2 px-2.5 font-extrabold text-[#000000] sticky left-0 bg-white border-r border-stone-100">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={r.paid}
                            onChange={(e) =>
                              updateRowField(idx, (row) => ({ ...row, paid: e.target.checked }))
                            }
                            title="Marcar pagado"
                            className="rounded border-stone-300 text-[#535B28] focus:ring-[#535B28] cursor-pointer"
                          />
                          <span className="truncate">{r.employeeName}</span>
                        </div>
                      </td>

                      {/* DIAS */}
                      <td className="py-1.5 px-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.daysWorked ? String(r.daysWorked) : ''}
                          placeholder="0"
                          onChange={(e) => {
                            const nextDays = parseDec(e.target.value);
                            const empRef = payrollEmployees.find((em) => em.id === r.employeeId);
                            updateRowField(idx, (row) => ({
                              ...row,
                              daysWorked: nextDays,
                              attendanceBonus:
                                empRef?.hasAttendanceBonus && nextDays >= (rates.workDaysPerWeek || 6)
                                  ? Number(empRef.defaultBonusAmount || rates.defaultBonus || 150)
                                  : nextDays < (rates.workDaysPerWeek || 6)
                                  ? 0
                                  : row.attendanceBonus,
                            }));
                          }}
                          className="no-spinner w-full text-center px-1.5 py-1 border border-stone-200 rounded-lg font-bold focus:ring-1 focus:ring-[#5C1125]"
                        />
                      </td>

                      {/* P/ SEMANAL */}
                      <td className="py-1.5 px-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.weeklySalary ? String(r.weeklySalary) : ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateRowField(idx, (row) => ({
                              ...row,
                              weeklySalary: parseDec(e.target.value),
                            }))
                          }
                          className="no-spinner w-full text-right px-1.5 py-1 border border-stone-200 rounded-lg font-semibold focus:ring-1 focus:ring-[#5C1125]"
                        />
                      </td>

                      {/* SEMANA (Auto) */}
                      <td className="py-1.5 px-2 text-right font-bold text-stone-800 whitespace-nowrap">
                        {fmtMoney(r.weekPay)}
                      </td>

                      {/* BONO/AyP */}
                      <td className="py-1.5 px-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.attendanceBonus ? String(r.attendanceBonus) : ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateRowField(idx, (row) => ({
                              ...row,
                              attendanceBonus: parseDec(e.target.value),
                            }))
                          }
                          className="no-spinner w-full text-right px-1.5 py-1 border border-stone-200 rounded-lg font-semibold text-[#535B28] focus:ring-1 focus:ring-[#5C1125]"
                        />
                      </td>

                      {/* FUMIGADAS (Qty + $) */}
                      <td className="py-1.5 px-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.fumigadasQty ? String(r.fumigadasQty) : ''}
                            placeholder="Cant"
                            onChange={(e) => {
                              const qty = parseDec(e.target.value);
                              updateRowField(idx, (row) => ({
                                ...row,
                                fumigadasQty: qty,
                                fumigadasAmount: round2(qty * (rates.fumigadaRate || 20)),
                              }));
                            }}
                            className="no-spinner w-12 text-center px-1 py-1 border border-stone-200 rounded-lg text-[11px] focus:ring-1 focus:ring-[#5C1125]"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.fumigadasAmount ? String(r.fumigadasAmount) : ''}
                            placeholder="$"
                            onChange={(e) =>
                              updateRowField(idx, (row) => ({
                                ...row,
                                fumigadasAmount: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-14 text-right px-1 py-1 border border-stone-200 rounded-lg text-[11px] font-semibold focus:ring-1 focus:ring-[#5C1125]"
                          />
                        </div>
                      </td>

                      {/* CARGADAS (Qty + $) */}
                      <td className="py-1.5 px-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.cargadasQty ? String(r.cargadasQty) : ''}
                            placeholder="Cant"
                            onChange={(e) => {
                              const qty = parseDec(e.target.value);
                              updateRowField(idx, (row) => ({
                                ...row,
                                cargadasQty: qty,
                                cargadasAmount:
                                  rates.cargadaRate > 0 ? round2(qty * rates.cargadaRate) : row.cargadasAmount,
                              }));
                            }}
                            className="no-spinner w-12 text-center px-1 py-1 border border-stone-200 rounded-lg text-[11px] focus:ring-1 focus:ring-[#5C1125]"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.cargadasAmount ? String(r.cargadasAmount) : ''}
                            placeholder="$"
                            onChange={(e) =>
                              updateRowField(idx, (row) => ({
                                ...row,
                                cargadasAmount: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-14 text-right px-1 py-1 border border-stone-200 rounded-lg text-[11px] font-semibold focus:ring-1 focus:ring-[#5C1125]"
                          />
                        </div>
                      </td>

                      {/* HORAS EXTRAS (Qty + $) */}
                      <td className="py-1.5 px-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.extraHoursQty ? String(r.extraHoursQty) : ''}
                            placeholder="Hrs"
                            onChange={(e) => {
                              const qty = parseDec(e.target.value);
                              updateRowField(idx, (row) => ({
                                ...row,
                                extraHoursQty: qty,
                                extraHoursAmount:
                                  rates.extraHourRate > 0 ? round2(qty * rates.extraHourRate) : row.extraHoursAmount,
                              }));
                            }}
                            className="no-spinner w-12 text-center px-1 py-1 border border-stone-200 rounded-lg text-[11px] focus:ring-1 focus:ring-[#5C1125]"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.extraHoursAmount ? String(r.extraHoursAmount) : ''}
                            placeholder="$"
                            onChange={(e) =>
                              updateRowField(idx, (row) => ({
                                ...row,
                                extraHoursAmount: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-14 text-right px-1 py-1 border border-stone-200 rounded-lg text-[11px] font-semibold focus:ring-1 focus:ring-[#5C1125]"
                          />
                        </div>
                      </td>

                      {/* DESTAJOS (Qty + $) */}
                      <td className="py-1.5 px-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.destajosQty ? String(r.destajosQty) : ''}
                            placeholder="Cant"
                            onChange={(e) => {
                              const qty = parseDec(e.target.value);
                              updateRowField(idx, (row) => ({
                                ...row,
                                destajosQty: qty,
                                destajosAmount:
                                  rates.destajoRate > 0 ? round2(qty * rates.destajoRate) : row.destajosAmount,
                              }));
                            }}
                            className="no-spinner w-12 text-center px-1 py-1 border border-stone-200 rounded-lg text-[11px] focus:ring-1 focus:ring-[#5C1125]"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={r.destajosAmount ? String(r.destajosAmount) : ''}
                            placeholder="$"
                            onChange={(e) =>
                              updateRowField(idx, (row) => ({
                                ...row,
                                destajosAmount: parseDec(e.target.value),
                              }))
                            }
                            className="no-spinner w-14 text-right px-1 py-1 border border-stone-200 rounded-lg text-[11px] font-semibold focus:ring-1 focus:ring-[#5C1125]"
                          />
                        </div>
                      </td>

                      {/* TRABAJO EXTRA */}
                      <td className="py-1.5 px-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.extraWorkAmount ? String(r.extraWorkAmount) : ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateRowField(idx, (row) => ({
                              ...row,
                              extraWorkAmount: parseDec(e.target.value),
                            }))
                          }
                          className="no-spinner w-full text-right px-1.5 py-1 border border-stone-200 rounded-lg font-semibold focus:ring-1 focus:ring-[#5C1125]"
                        />
                      </td>

                      {/* OTROS DESCUENTOS */}
                      <td className="py-1.5 px-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.otherDeductions ? String(r.otherDeductions) : ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateRowField(idx, (row) => ({
                              ...row,
                              otherDeductions: parseDec(e.target.value),
                            }))
                          }
                          className="no-spinner w-full text-right px-1.5 py-1 border border-rose-200 rounded-lg font-semibold text-rose-700 focus:ring-1 focus:ring-[#5C1125]"
                        />
                      </td>

                      {/* PAGO DE PRESTAMO */}
                      <td className="py-1.5 px-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.loanPayment ? String(r.loanPayment) : ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateRowField(idx, (row) => ({
                              ...row,
                              loanPayment: parseDec(e.target.value),
                            }))
                          }
                          className="no-spinner w-full text-right px-1.5 py-1 border border-amber-300 bg-amber-50/40 rounded-lg font-bold text-amber-900 focus:ring-1 focus:ring-[#5C1125]"
                        />
                      </td>

                      {/* PRESTAMO ANTERIOR */}
                      <td className="py-1.5 px-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.loanPreviousBalance ? String(r.loanPreviousBalance) : ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateRowField(idx, (row) => ({
                              ...row,
                              loanPreviousBalance: parseDec(e.target.value),
                            }))
                          }
                          className="no-spinner w-full text-right px-1.5 py-1 border border-stone-200 rounded-lg font-semibold text-stone-700 focus:ring-1 focus:ring-[#5C1125]"
                        />
                      </td>

                      {/* RESTA DEL PRESTAMO */}
                      <td className="py-1.5 px-2 text-right font-extrabold text-[#5C1125] whitespace-nowrap">
                        {fmtMoney(r.loanRemainingBalance)}
                      </td>

                      {/* TOTAL NETO */}
                      <td className="py-1.5 px-2.5 text-right font-black text-[#000000] bg-[#FAF8F5] whitespace-nowrap">
                        {fmtMoney(r.totalNetPay)}
                      </td>

                      {/* RECIBO PDF */}
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => exportEmployeePaySlipPdf(currentExportWeek, r)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] text-[11px] font-bold border border-[#ebccd4] cursor-pointer"
                          title={`Descargar recibo PDF de ${r.employeeName}`}
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Recibo</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#000000] text-[#C3A25D] font-extrabold text-xs">
                    <td className="py-3 px-2.5 sticky left-0 bg-[#000000]">TOTALES ({rows.length})</td>
                    <td />
                    <td />
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalWeekPay)}
                    </td>
                    <td className="py-3 px-1.5 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalBonus)}
                    </td>
                    <td className="py-3 px-1.5 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalFumigadas)}
                    </td>
                    <td className="py-3 px-1.5 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalCargadas)}
                    </td>
                    <td className="py-3 px-1.5 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalExtraHours)}
                    </td>
                    <td className="py-3 px-1.5 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalDestajos)}
                    </td>
                    <td className="py-3 px-1.5 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalExtraWork)}
                    </td>
                    <td className="py-3 px-1.5 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalOtherDeductions)}
                    </td>
                    <td className="py-3 px-1.5 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalLoanPayments)}
                    </td>
                    <td />
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      {fmtMoney(weekTotals.totalLoanRemaining)}
                    </td>
                    <td className="py-3 px-2.5 text-right text-sm text-white bg-[#5C1125] whitespace-nowrap">
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
                    onChange={(e) => setSyncLoansOnSave(e.target.checked)}
                    className="rounded border-stone-300 text-[#5C1125] focus:ring-[#5C1125]"
                  />
                  <span>Descontar automáticamente los abonos del saldo de préstamos</span>
                </label>

                <select
                  value={weekStatus}
                  onChange={(e) => setWeekStatus(e.target.value as 'borrador' | 'pagada')}
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
                        onClick={() => handleDeleteWeek(selectedWeekId)}
                        className="text-xs font-extrabold text-rose-700 hover:underline cursor-pointer"
                      >
                        Sí, borrar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteWeekId(null)}
                        className="text-xs text-stone-500 hover:underline cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteWeekId(selectedWeekId)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Semana</span>
                    </button>
                  ))}

                <button
                  type="button"
                  disabled={isSavingWeek}
                  onClick={handleSavePayrollWeek}
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
    </div>
  );
};
