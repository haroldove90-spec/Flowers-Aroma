import React, { useMemo, useState } from 'react';
import {
  HandCoins,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  X,
  MessageCircle,
  Users,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  EmployeeAdjustment,
  EmployeeAdjustmentType,
  EmployeeLoanMovementType,
} from '../../types/greenhouse';
import {
  exportEmployeeAdjustmentsExcel,
  exportEmployeeAdjustmentsPdf,
  exportEmployeeLoansExcel,
  exportEmployeeLoansPdf,
} from '../../utils/exportReports';

const todayIso = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const ADJUSTMENT_META: Record<
  EmployeeAdjustmentType,
  { label: string; shortLabel: string; direction: 'suma' | 'resta'; hint: string }
> = {
  descuento_falta: {
    label: 'Descuento por Falta / Retardo',
    shortLabel: 'Desc. Falta',
    direction: 'resta',
    hint: 'Se restará en la columna DESC. FALTAS / AyP de la nómina semanal.',
  },
  otro_descuento: {
    label: 'Otro Descuento (Vales, Daños, Herramienta)',
    shortLabel: 'Otro Desc.',
    direction: 'resta',
    hint: 'Se restará en la columna OTROS DESC. de la nómina semanal.',
  },
  bono_productividad: {
    label: 'Bono de Productividad / Meta Cumplida',
    shortLabel: 'Bono Prod.',
    direction: 'suma',
    hint: 'Se sumará en la columna COMISIÓN / BONO PROD. de la nómina semanal.',
  },
  comision: {
    label: 'Comisión (Ventas, Cosecha o Reparto)',
    shortLabel: 'Comisión',
    direction: 'suma',
    hint: 'Se sumará en la columna COMISIÓN / BONO PROD. de la nómina semanal.',
  },
  pago_adicional: {
    label: 'Pago Adicional / Gratificación',
    shortLabel: 'Pago Adicional',
    direction: 'suma',
    hint: 'Se sumará en la columna COMISIÓN / BONO PROD. de la nómina semanal.',
  },
};

type SubTab = 'incidencias' | 'prestamos';

export const EmployeeIncidentsView: React.FC = () => {
  const {
    payrollEmployees,
    employeeLoans,
    addEmployeeLoanMovement,
    deleteEmployeeLoanMovement,
    employeeAdjustments,
    saveEmployeeAdjustment,
    deleteEmployeeAdjustment,
  } = useGreenhouse();

  const [subTab, setSubTab] = useState<SubTab>('incidencias');
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'adj' | 'loan'; id: string } | null>(null);

  // Adjustment Form
  const [editingAdjId, setEditingAdjId] = useState<string | null>(null);
  const [adjEmpId, setAdjEmpId] = useState<string>(payrollEmployees[0]?.id || '');
  const [adjDate, setAdjDate] = useState(todayIso());
  const [adjType, setAdjType] = useState<EmployeeAdjustmentType>('descuento_falta');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjConcept, setAdjConcept] = useState('');
  const [adjNotes, setAdjNotes] = useState('');

  // Loan Form
  const [loanEmpId, setLoanEmpId] = useState<string>(payrollEmployees[0]?.id || '');
  const [loanDate, setLoanDate] = useState(todayIso());
  const [loanType, setLoanType] = useState<EmployeeLoanMovementType>('prestamo');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanConcept, setLoanConcept] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  const showToast = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  };

  const activeEmployees = useMemo(
    () => [...payrollEmployees].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [payrollEmployees]
  );

  // Global KPIs
  const kpis = useMemo(() => {
    const totalLoans = payrollEmployees.reduce((acc, e) => acc + Number(e.loanBalance || 0), 0);
    const pendingAdj = employeeAdjustments.filter((a) => a.status === 'pendiente');
    const pendingDeductions = pendingAdj
      .filter((a) => a.direction === 'resta')
      .reduce((acc, a) => acc + Number(a.amount || 0), 0);
    const pendingBonuses = pendingAdj
      .filter((a) => a.direction === 'suma')
      .reduce((acc, a) => acc + Number(a.amount || 0), 0);
    const affectedEmployeeIds = new Set<string>();
    payrollEmployees.forEach((e) => {
      if (Number(e.loanBalance || 0) > 0) affectedEmployeeIds.add(e.id);
    });
    pendingAdj.forEach((a) => affectedEmployeeIds.add(a.employeeId));
    return {
      totalLoans,
      pendingDeductions,
      pendingBonuses,
      pendingCount: pendingAdj.length,
      affectedCount: affectedEmployeeIds.size,
    };
  }, [payrollEmployees, employeeAdjustments]);

  const filteredAdjustments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...employeeAdjustments]
      .filter((a) => {
        if (employeeFilter !== 'ALL' && a.employeeId !== employeeFilter) return false;
        if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
        if (directionFilter !== 'ALL' && a.direction !== directionFilter) return false;
        if (!q) return true;
        return (
          a.employeeName.toLowerCase().includes(q) ||
          a.concept.toLowerCase().includes(q) ||
          ADJUSTMENT_META[a.adjustmentType].label.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.adjustmentDate.localeCompare(a.adjustmentDate));
  }, [employeeAdjustments, employeeFilter, statusFilter, directionFilter, search]);

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...employeeLoans]
      .filter((l) => {
        if (employeeFilter !== 'ALL' && l.employeeId !== employeeFilter) return false;
        if (!q) return true;
        return (
          l.employeeName.toLowerCase().includes(q) ||
          l.concept.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.movementDate.localeCompare(a.movementDate));
  }, [employeeLoans, employeeFilter, search]);

  const employeeOverview = useMemo(() => {
    return activeEmployees.map((emp) => {
      const pend = employeeAdjustments.filter(
        (a) => a.employeeId === emp.id && a.status === 'pendiente'
      );
      const pendDesc = pend
        .filter((a) => a.direction === 'resta')
        .reduce((s, a) => s + a.amount, 0);
      const pendBon = pend
        .filter((a) => a.direction === 'suma')
        .reduce((s, a) => s + a.amount, 0);
      return { emp, pendDesc, pendBon, pendCount: pend.length };
    });
  }, [activeEmployees, employeeAdjustments]);

  const resetAdjForm = () => {
    setEditingAdjId(null);
    setAdjDate(todayIso());
    setAdjType('descuento_falta');
    setAdjAmount('');
    setAdjConcept('');
    setAdjNotes('');
  };

  const handleEditAdj = (a: EmployeeAdjustment) => {
    setEditingAdjId(a.id);
    setAdjEmpId(a.employeeId);
    setAdjDate(a.adjustmentDate);
    setAdjType(a.adjustmentType);
    setAdjAmount(String(a.amount));
    setAdjConcept(a.concept);
    setAdjNotes(a.notes || '');
    setSubTab('incidencias');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = payrollEmployees.find((p) => p.id === adjEmpId);
    if (!emp) {
      showToast('err', 'Selecciona un empleado válido.');
      return;
    }
    const amt = Number(adjAmount || 0);
    if (amt <= 0) {
      showToast('err', 'Ingresa un monto mayor a $0.');
      return;
    }
    const meta = ADJUSTMENT_META[adjType];
    const res = await saveEmployeeAdjustment(
      {
        employeeId: emp.id,
        employeeName: emp.fullName,
        adjustmentDate: adjDate,
        adjustmentType: adjType,
        direction: meta.direction,
        amount: amt,
        concept: adjConcept.trim() || meta.label,
        status: 'pendiente',
        notes: adjNotes.trim(),
      },
      editingAdjId || undefined
    );
    if (!res.ok) {
      showToast('err', res.error || 'No se pudo guardar el movimiento.');
      return;
    }
    showToast(
      'ok',
      `${meta.direction === 'suma' ? '+' : '-'}${fmtMoney(amt)} registrado para ${emp.fullName}. Listo para sincronizar en Nómina Semanal.`
    );
    resetAdjForm();
  };

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = payrollEmployees.find((p) => p.id === loanEmpId);
    if (!emp) {
      showToast('err', 'Selecciona un empleado válido.');
      return;
    }
    const amt = Number(loanAmount || 0);
    if (amt <= 0) {
      showToast('err', 'Ingresa un monto mayor a $0.');
      return;
    }
    const res = await addEmployeeLoanMovement({
      employeeId: emp.id,
      employeeName: emp.fullName,
      movementDate: loanDate,
      movementType: loanType,
      amount: amt,
      concept:
        loanConcept.trim() ||
        (loanType === 'prestamo'
          ? 'Préstamo personal entregado'
          : loanType === 'abono'
          ? 'Abono directo a préstamo'
          : 'Descuento aplicado a préstamo'),
      notes: loanNotes.trim(),
    });
    if (!res.ok) {
      showToast('err', res.error || 'Error al registrar el movimiento.');
      return;
    }
    showToast(
      'ok',
      `${loanType === 'prestamo' ? 'Préstamo' : 'Abono'} de ${fmtMoney(amt)} registrado para ${emp.fullName}. Nuevo saldo: ${fmtMoney(res.movement?.balanceAfter || 0)}.`
    );
    setLoanAmount('');
    setLoanConcept('');
    setLoanNotes('');
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.kind === 'adj') {
      await deleteEmployeeAdjustment(confirmDelete.id);
      showToast('ok', 'Incidencia eliminada.');
    } else {
      await deleteEmployeeLoanMovement(confirmDelete.id);
      showToast('ok', 'Movimiento de préstamo eliminado y saldo recalculado.');
    }
    setConfirmDelete(null);
  };

  const buildEmployeeWhatsappHref = (
    name: string,
    phone: string,
    loanBal: number,
    pendDesc: number,
    pendBon: number
  ) => {
    const digits = (phone || '').replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hola ${name}, te compartimos tu resumen actual en Aroma Flower:\n` +
        `• Saldo de préstamo pendiente: ${fmtMoney(loanBal)}\n` +
        `• Descuentos pendientes p/ próxima nómina: -${fmtMoney(pendDesc)}\n` +
        `• Bonos / comisiones pendientes p/ próxima nómina: +${fmtMoney(pendBon)}\n` +
        `Administración Aroma Flower.`
    );
    return digits ? `https://wa.me/52${digits}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  const selectedTypeMeta = ADJUSTMENT_META[adjType];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] tracking-tight">
            Préstamos, Descuentos y Comisiones
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Registra préstamos, descuentos por faltas, bonos de productividad y comisiones. Todo se sincroniza automáticamente con la Nómina Semanal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              subTab === 'incidencias'
                ? exportEmployeeAdjustmentsExcel(employeeAdjustments, payrollEmployees)
                : exportEmployeeLoansExcel(payrollEmployees, employeeLoans)
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#535B28]" />
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={() =>
              subTab === 'incidencias'
                ? exportEmployeeAdjustmentsPdf(employeeAdjustments, payrollEmployees)
                : exportEmployeeLoansPdf(payrollEmployees, employeeLoans)
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#5C1125]" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-sm font-medium ${
            feedback.type === 'ok'
              ? 'bg-[#535B28]/10 border-[#535B28]/30 text-[#3c421d]'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Saldo Préstamos por Cobrar
          </p>
          <p className="text-2xl font-bold text-[#000000] mt-1 tabular-nums">
            {fmtMoney(kpis.totalLoans)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Sincronizado en vivo con Nómina
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C1125]">
            Descuentos Pendientes (-)
          </p>
          <p className="text-2xl font-bold text-[#5C1125] mt-1 tabular-nums">
            - {fmtMoney(kpis.pendingDeductions)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Faltas y descuentos listos p/ próxima nómina
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#535B28]">
            Bonos y Comisiones Pendientes (+)
          </p>
          <p className="text-2xl font-bold text-[#535B28] mt-1 tabular-nums">
            + {fmtMoney(kpis.pendingBonuses)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Productividad, comisiones y pagos extra
          </p>
        </div>

        <div className="bg-[#5C1125] rounded-xl p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C3A25D]">
            Empleados con Movimientos
          </p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">
            {kpis.affectedCount}
          </p>
          <p className="text-xs text-white/75 mt-1">
            {kpis.pendingCount} incidencia(s) por aplicar en nómina
          </p>
        </div>
      </div>

      {/* Sub-Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('incidencias')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'incidencias'
                ? 'bg-[#5C1125] text-white'
                : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Descuentos, Faltas, Bonos y Comisiones ({employeeAdjustments.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('prestamos')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'prestamos'
                ? 'bg-[#5C1125] text-white'
                : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <HandCoins className="w-4 h-4" />
            Préstamos y Saldos por Empleado ({employeeLoans.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado o concepto..."
              className="pl-9 pr-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] w-52"
            />
          </div>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
          >
            <option value="ALL">Todos los empleados</option>
            {activeEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName}
              </option>
            ))}
          </select>
          {subTab === 'incidencias' && (
            <>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
              >
                <option value="ALL">Sumas y Restas</option>
                <option value="resta">Solo Descuentos (-)</option>
                <option value="suma">Solo Bonos / Comisiones (+)</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
              >
                <option value="ALL">Todos los estatus</option>
                <option value="pendiente">Pendiente de aplicar</option>
                <option value="aplicado">Ya aplicado en nómina</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: DESCUENTOS, FALTAS, BONOS Y COMISIONES */}
      {subTab === 'incidencias' && (
        <div className="space-y-5">
          {/* Capture Form */}
          <form
            onSubmit={handleSaveAdjustment}
            className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#5C1125]">
                  {editingAdjId
                    ? 'Editar Movimiento de Empleado'
                    : 'Registrar Descuento por Falta, Bono de Productividad o Comisión'}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">{selectedTypeMeta.hint}</p>
              </div>
              <div
                className={`text-xs font-bold px-3 py-1 rounded-md border ${
                  selectedTypeMeta.direction === 'suma'
                    ? 'bg-[#535B28]/10 border-[#535B28]/30 text-[#535B28]'
                    : 'bg-[#5C1125]/10 border-[#5C1125]/30 text-[#5C1125]'
                }`}
              >
                {selectedTypeMeta.direction === 'suma'
                  ? '+ SUMA al pago neto semanal'
                  : '- RESTA del pago neto semanal'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Empleado *
                </label>
                <select
                  value={adjEmpId}
                  onChange={(e) => setAdjEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-[#5C1125]"
                >
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.teamGroup})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Tipo de Movimiento *
                </label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as EmployeeAdjustmentType)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-[#5C1125]"
                >
                  <optgroup label="Deducciones (Restan del pago semanal)">
                    <option value="descuento_falta">Descuento por Falta / Retardo (-)</option>
                    <option value="otro_descuento">Otro Descuento: Daños / Vales (-)</option>
                  </optgroup>
                  <optgroup label="Pagos Adicionales (Suman al pago semanal)">
                    <option value="bono_productividad">Bono de Productividad (+)</option>
                    <option value="comision">Comisión de Ventas / Reparto (+)</option>
                    <option value="pago_adicional">Pago Adicional / Gratificación (+)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={adjDate}
                  onChange={(e) => setAdjDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Monto ($ MXN) *
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="0.00"
                  className={`w-full px-3 py-2 text-xs font-bold border rounded-lg focus:outline-none ${
                    selectedTypeMeta.direction === 'suma'
                      ? 'border-[#535B28] text-[#535B28]'
                      : 'border-[#5C1125] text-[#5C1125]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Motivo / Concepto *
                </label>
                <input
                  type="text"
                  required
                  value={adjConcept}
                  onChange={(e) => setAdjConcept(e.target.value)}
                  placeholder={
                    selectedTypeMeta.direction === 'resta'
                      ? 'Ej. Falta día martes sin aviso'
                      : 'Ej. Meta de corte superada'
                  }
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="text"
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                placeholder="Notas internas opcionales..."
                className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
              />
              <div className="flex items-center gap-2">
                {editingAdjId && (
                  <button
                    type="button"
                    onClick={resetAdjForm}
                    className="px-3.5 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {editingAdjId ? 'Guardar Cambios' : 'Registrar Movimiento'}
                </button>
              </div>
            </div>
          </form>

          {/* Ledger Table */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#5C1125] text-white text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Fecha</th>
                    <th className="py-3 px-3 font-semibold">Empleado</th>
                    <th className="py-3 px-3 font-semibold">Tipo</th>
                    <th className="py-3 px-3 font-semibold">Concepto</th>
                    <th className="py-3 px-3 font-semibold text-right">Impacto Nómina</th>
                    <th className="py-3 px-3 font-semibold">Estado Sincronización</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-xs">
                  {filteredAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-neutral-500">
                        Sin descuentos, bonos o comisiones registrados con estos filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredAdjustments.map((a) => {
                      const meta = ADJUSTMENT_META[a.adjustmentType];
                      return (
                        <tr key={a.id} className="hover:bg-[#FAF8F5]">
                          <td className="py-3 px-4 tabular-nums whitespace-nowrap text-neutral-700">
                            {a.adjustmentDate}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#000000]">
                            {a.employeeName}
                          </td>
                          <td className="py-3 px-3 text-neutral-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              {a.direction === 'suma' ? (
                                <TrendingUp className="w-3.5 h-3.5 text-[#535B28]" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 text-[#5C1125]" />
                              )}
                              {meta.shortLabel}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-neutral-700 max-w-xs">
                            <div>{a.concept}</div>
                            {a.notes && (
                              <div className="text-[11px] text-neutral-500">{a.notes}</div>
                            )}
                          </td>
                          <td
                            className={`py-3 px-3 text-right tabular-nums font-bold whitespace-nowrap ${
                              a.direction === 'suma' ? 'text-[#535B28]' : 'text-[#5C1125]'
                            }`}
                          >
                            {a.direction === 'suma' ? '+' : '-'} {fmtMoney(a.amount)}
                          </td>
                          <td className="py-3 px-3">
                            {a.status === 'aplicado' ? (
                              <div>
                                <span className="text-[11px] font-bold text-[#535B28]">
                                  APLICADO EN NÓMINA
                                </span>
                                {a.appliedWeekLabel && (
                                  <div className="text-[10px] text-neutral-500 truncate max-w-[180px]">
                                    {a.appliedWeekLabel}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-amber-700">
                                PENDIENTE (Se aplica al sincronizar nómina)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {a.status === 'pendiente' && (
                                <button
                                  type="button"
                                  onClick={() => handleEditAdj(a)}
                                  title="Editar"
                                  className="p-1.5 rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmDelete({ kind: 'adj', id: a.id })}
                                title="Eliminar"
                                className="p-1.5 rounded-md border border-neutral-300 bg-white hover:bg-red-50 text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRÉSTAMOS Y SALDOS POR EMPLEADO */}
      {subTab === 'prestamos' && (
        <div className="space-y-5">
          {/* Loan Movement Form */}
          <form
            onSubmit={handleAddLoan}
            className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4"
          >
            <div className="border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-bold text-[#5C1125]">
                Registrar Nuevo Préstamo o Abono Directo
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Al otorgar un préstamo, el saldo del trabajador aumenta automáticamente y aparecerá en su próxima nómina semanal para descontarlo en abonos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Empleado *
                </label>
                <select
                  value={loanEmpId}
                  onChange={(e) => setLoanEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-[#5C1125]"
                >
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} (Saldo: {fmtMoney(emp.loanBalance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Tipo de Movimiento *
                </label>
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value as EmployeeLoanMovementType)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-[#5C1125]"
                >
                  <option value="prestamo">Nuevo Préstamo (+ Aumenta Deuda)</option>
                  <option value="abono">Abono en Efectivo (- Baja Deuda)</option>
                  <option value="descuento">Descuento Especial (- Baja Deuda)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Monto ($ MXN) *
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs font-bold border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Concepto
                </label>
                <input
                  type="text"
                  value={loanConcept}
                  onChange={(e) => setLoanConcept(e.target.value)}
                  placeholder="Ej. Adelanto médico / quincena"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="text"
                value={loanNotes}
                onChange={(e) => setLoanNotes(e.target.value)}
                placeholder="Acuerdo de pagos semanales (ej. descontar $250 por semana)..."
                className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <HandCoins className="w-4 h-4" />
                Registrar en Cuenta del Empleado
              </button>
            </div>
          </form>

          {/* Employee Summary Table */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#5C1125]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Resumen Consolidado por Empleado (Préstamos + Pendientes p/ Próxima Nómina)
                </h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#5C1125] text-white text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-semibold">Empleado</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Sueldo Semanal</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Saldo Préstamo</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Desc. Pendientes (-)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Bonos / Com. Pend. (+)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-xs">
                  {employeeOverview.map(({ emp, pendDesc, pendBon }) => (
                    <tr key={emp.id} className="hover:bg-[#FAF8F5]">
                      <td className="py-2.5 px-4 font-bold text-[#000000]">
                        {emp.fullName}{' '}
                        <span className="font-normal text-[11px] text-neutral-500">
                          · {emp.teamGroup}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-neutral-700">
                        {fmtMoney(emp.weeklySalary)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                          emp.loanBalance > 0 ? 'text-[#5C1125]' : 'text-neutral-400'
                        }`}
                      >
                        {fmtMoney(emp.loanBalance)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                          pendDesc > 0 ? 'text-[#5C1125]' : 'text-neutral-400'
                        }`}
                      >
                        {pendDesc > 0 ? `- ${fmtMoney(pendDesc)}` : '$0.00'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                          pendBon > 0 ? 'text-[#535B28]' : 'text-neutral-400'
                        }`}
                      >
                        {pendBon > 0 ? `+ ${fmtMoney(pendBon)}` : '$0.00'}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <a
                          href={buildEmployeeWhatsappHref(
                            emp.fullName,
                            emp.phone,
                            emp.loanBalance,
                            pendDesc,
                            pendBon
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Loan Movement Ledger */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Historial de Préstamos y Abonos (Incluye Descuentos Automáticos de Nómina)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-900 text-[#C3A25D] text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-semibold">Fecha</th>
                    <th className="py-2.5 px-3 font-semibold">Empleado</th>
                    <th className="py-2.5 px-3 font-semibold">Tipo</th>
                    <th className="py-2.5 px-3 font-semibold">Concepto</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Monto</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Saldo Después</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-xs">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        Sin movimientos de préstamos registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((m) => (
                      <tr key={m.id} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-4 tabular-nums">{m.movementDate}</td>
                        <td className="py-2.5 px-3 font-bold text-[#000000]">{m.employeeName}</td>
                        <td className="py-2.5 px-3 uppercase font-semibold text-[11px]">
                          <span
                            className={
                              m.movementType === 'prestamo' ? 'text-[#5C1125]' : 'text-[#535B28]'
                            }
                          >
                            {m.movementType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-700">
                          <div>{m.concept}</div>
                          {m.notes && <div className="text-[11px] text-neutral-500">{m.notes}</div>}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                            m.movementType === 'prestamo' ? 'text-[#5C1125]' : 'text-[#535B28]'
                          }`}
                        >
                          {m.movementType === 'prestamo' ? '+' : '-'} {fmtMoney(m.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                          {fmtMoney(m.balanceAfter)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ kind: 'loan', id: m.id })}
                            className="p-1.5 rounded-md border border-neutral-300 bg-white hover:bg-red-50 text-red-600 cursor-pointer"
                            title="Eliminar y revertir saldo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#000000]">¿Confirmar eliminación?</h3>
            <p className="text-xs text-neutral-600">
              {confirmDelete.kind === 'adj'
                ? 'Se eliminará este descuento/bono/comisión del historial.'
                : 'Se eliminará este movimiento y el saldo de préstamo del empleado se recalculará automáticamente.'}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
