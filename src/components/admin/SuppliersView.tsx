import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  FileSpreadsheet,
  FileText,
  Receipt,
  DollarSign,
  Phone,
  CreditCard,
  X,
  MessageCircle,
  ArrowUpRight,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  Supplier,
  SupplierPayment,
  SupplierPaymentCategory,
  SupplierPaymentMethod,
  SupplierPaymentStatus,
} from '../../types/greenhouse';
import {
  exportSupplierPaymentsExcel,
  exportSupplierPaymentsPdf,
  exportSuppliersSummaryExcel,
  exportSupplierStatementPdf,
} from '../../utils/exportReports';

const todayIso = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CATEGORY_LABELS: Record<SupplierPaymentCategory, string> = {
  agroquimicos: 'Agroquímicos y Fitosanitarios',
  fertilizantes: 'Fertilizantes y Nutrición',
  empaques: 'Empaques, Cartón y Capuchones',
  fletes_transporte: 'Fletes y Transporte',
  servicios: 'Servicios (Luz, Agua, Tel.)',
  renta: 'Renta / Arrendamiento',
  mantenimiento: 'Mantenimiento y Refacciones',
  otros: 'Otros Proveedores',
};

const METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  tarjeta: 'Tarjeta',
};

type SubTab = 'directorio' | 'pagos' | 'estado_cuenta';

export const SuppliersView: React.FC = () => {
  const {
    suppliers,
    saveSupplier,
    deleteSupplier,
    supplierPayments,
    saveSupplierPayment,
    deleteSupplierPayment,
    setActiveView,
  } = useGreenhouse();

  const [subTab, setSubTab] = useState<SubTab>('directorio');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<{ kind: 'supplier' | 'payment'; id: string } | null>(null);

  // Supplier form state
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supRfc, setSupRfc] = useState('');
  const [supCategory, setSupCategory] = useState<SupplierPaymentCategory>('agroquimicos');
  const [supBank, setSupBank] = useState('');
  const [supCreditDays, setSupCreditDays] = useState('15');
  const [supCreditLimit, setSupCreditLimit] = useState('0');
  const [supNotes, setSupNotes] = useState('');
  const [supActive, setSupActive] = useState(true);

  // Invoice / Payment form state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(todayIso());
  const [paySupplierId, setPaySupplierId] = useState<string>('');
  const [paySupplierCustom, setPaySupplierCustom] = useState('');
  const [payCategory, setPayCategory] = useState<SupplierPaymentCategory>('agroquimicos');
  const [payConcept, setPayConcept] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payPaidAmount, setPayPaidAmount] = useState('');
  const [payMethod, setPayMethod] = useState<SupplierPaymentMethod>('transferencia');
  const [payStatus, setPayStatus] = useState<SupplierPaymentStatus>('pendiente');
  const [payNotes, setPayNotes] = useState('');

  // Quick abono modal state
  const [abonoTarget, setAbonoTarget] = useState<SupplierPayment | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState<SupplierPaymentMethod>('transferencia');

  // Statement view selected supplier
  const [selectedStatementSupplierId, setSelectedStatementSupplierId] = useState<string>(
    suppliers[0]?.id || ''
  );

  const showToast = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  };

  // Match payments to suppliers by supplierId OR case-insensitive name
  const getPaymentsForSupplier = (sup: Supplier) =>
    supplierPayments
      .filter(
        (p) =>
          p.supplierId === sup.id ||
          p.supplierName.trim().toLowerCase() === sup.name.trim().toLowerCase()
      )
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  // Aggregated metrics per supplier
  const supplierMetrics = useMemo(() => {
    return suppliers.map((s) => {
      const list = getPaymentsForSupplier(s);
      const billed = list.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const paid = list.reduce((acc, p) => acc + Number(p.paidAmount || 0), 0);
      const pending = Math.max(0, Number((billed - paid).toFixed(2)));
      const pendingDocs = list.filter(
        (p) => Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0)) > 0.01
      ).length;
      return { supplier: s, payments: list, billed, paid, pending, pendingDocs };
    });
  }, [suppliers, supplierPayments]);

  // Global KPIs
  const kpis = useMemo(() => {
    const activeCount = suppliers.filter((s) => s.active !== false).length;
    const totalBilled = supplierPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const totalPaid = supplierPayments.reduce((acc, p) => acc + Number(p.paidAmount || 0), 0);
    const totalDebt = supplierPayments.reduce(
      (acc, p) => acc + Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0)),
      0
    );
    const suppliersWithDebt = supplierMetrics.filter((m) => m.pending > 0.01).length;
    return { activeCount, totalBilled, totalPaid, totalDebt, suppliersWithDebt };
  }, [suppliers, supplierPayments, supplierMetrics]);

  const filteredSupplierMetrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return supplierMetrics
      .filter((m) => {
        if (categoryFilter !== 'ALL' && m.supplier.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          m.supplier.name.toLowerCase().includes(q) ||
          (m.supplier.contactName || '').toLowerCase().includes(q) ||
          (m.supplier.phone || '').toLowerCase().includes(q) ||
          (m.supplier.rfc || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.pending - a.pending || a.supplier.name.localeCompare(b.supplier.name));
  }, [supplierMetrics, search, categoryFilter]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...supplierPayments]
      .filter((p) => {
        if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        if (!q) return true;
        return (
          p.supplierName.toLowerCase().includes(q) ||
          p.concept.toLowerCase().includes(q) ||
          (p.reference || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [supplierPayments, search, categoryFilter, statusFilter]);

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupEmail('');
    setSupRfc('');
    setSupCategory('agroquimicos');
    setSupBank('');
    setSupCreditDays('15');
    setSupCreditLimit('0');
    setSupNotes('');
    setSupActive(true);
    setShowSupplierForm(false);
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplierId(s.id);
    setSupName(s.name);
    setSupContact(s.contactName || '');
    setSupPhone(s.phone || '');
    setSupEmail(s.email || '');
    setSupRfc(s.rfc || '');
    setSupCategory(s.category);
    setSupBank(s.bankInfo || '');
    setSupCreditDays(String(s.creditDays || 0));
    setSupCreditLimit(String(s.creditLimit || 0));
    setSupNotes(s.notes || '');
    setSupActive(s.active !== false);
    setShowSupplierForm(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveSupplier(
      {
        name: supName,
        contactName: supContact,
        phone: supPhone,
        email: supEmail,
        rfc: supRfc,
        category: supCategory,
        bankInfo: supBank,
        creditDays: Number(supCreditDays || 0),
        creditLimit: Number(supCreditLimit || 0),
        notes: supNotes,
        active: supActive,
      },
      editingSupplierId || undefined
    );
    if (!res.ok) {
      showToast('err', res.error || 'No se pudo guardar el proveedor.');
      return;
    }
    showToast(
      'ok',
      editingSupplierId
        ? `Proveedor "${supName.trim()}" actualizado.`
        : `Proveedor "${supName.trim()}" registrado correctamente.`
    );
    if (res.entry && !selectedStatementSupplierId) {
      setSelectedStatementSupplierId(res.entry.id);
    }
    resetSupplierForm();
  };

  const resetPaymentForm = () => {
    setEditingPaymentId(null);
    setPayDate(todayIso());
    setPaySupplierId('');
    setPaySupplierCustom('');
    setPayCategory('agroquimicos');
    setPayConcept('');
    setPayRef('');
    setPayAmount('');
    setPayPaidAmount('');
    setPayMethod('transferencia');
    setPayStatus('pendiente');
    setPayNotes('');
  };

  const handleSelectSupplierInPaymentForm = (id: string) => {
    setPaySupplierId(id);
    const found = suppliers.find((s) => s.id === id);
    if (found) {
      setPaySupplierCustom(found.name);
      setPayCategory(found.category);
    }
  };

  const openQuickPaymentForSupplier = (s: Supplier) => {
    resetPaymentForm();
    setPaySupplierId(s.id);
    setPaySupplierCustom(s.name);
    setPayCategory(s.category);
    setSubTab('pagos');
  };

  const openEditPayment = (p: SupplierPayment) => {
    setEditingPaymentId(p.id);
    setPayDate(p.paymentDate);
    setPaySupplierId(p.supplierId || '');
    setPaySupplierCustom(p.supplierName);
    setPayCategory(p.category);
    setPayConcept(p.concept);
    setPayRef(p.reference || '');
    setPayAmount(String(p.amount));
    setPayPaidAmount(String(p.paidAmount));
    setPayMethod(p.paymentMethod);
    setPayStatus(p.status);
    setPayNotes(p.notes || '');
    setSubTab('pagos');
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenSupplier = suppliers.find((s) => s.id === paySupplierId);
    const supplierName = (chosenSupplier?.name || paySupplierCustom).trim();
    const amountNum = Number(payAmount || 0);
    if (!supplierName) {
      showToast('err', 'Selecciona o escribe el nombre del proveedor.');
      return;
    }
    if (!payConcept.trim()) {
      showToast('err', 'Escribe el concepto de la compra o factura.');
      return;
    }
    if (amountNum <= 0) {
      showToast('err', 'El monto total debe ser mayor a $0.');
      return;
    }
    const paidNum =
      payStatus === 'pagado'
        ? amountNum
        : payStatus === 'pendiente'
        ? 0
        : Math.min(amountNum, Math.max(0, Number(payPaidAmount || 0)));

    await saveSupplierPayment(
      {
        supplierId: chosenSupplier?.id || undefined,
        paymentDate: payDate,
        supplierName,
        category: payCategory,
        concept: payConcept,
        reference: payRef,
        amount: amountNum,
        paidAmount: paidNum,
        paymentMethod: payMethod,
        status: payStatus,
        notes: payNotes,
      },
      editingPaymentId || undefined
    );
    showToast(
      'ok',
      editingPaymentId
        ? `Movimiento de ${supplierName} actualizado.`
        : `Movimiento registrado para ${supplierName} (${fmtMoney(amountNum)}).`
    );
    resetPaymentForm();
  };

  const handleConfirmAbono = async () => {
    if (!abonoTarget) return;
    const addAmt = Number(abonoAmount || 0);
    if (addAmt <= 0) {
      showToast('err', 'Ingresa un monto de abono mayor a $0.');
      return;
    }
    const nextPaid = Math.min(abonoTarget.amount, Number((abonoTarget.paidAmount + addAmt).toFixed(2)));
    const remaining = Math.max(0, Number((abonoTarget.amount - nextPaid).toFixed(2)));
    const nextStatus: SupplierPaymentStatus =
      remaining <= 0.01 ? 'pagado' : nextPaid > 0 ? 'parcial' : 'pendiente';
    const noteLine = `[Abono ${todayIso()}: ${fmtMoney(addAmt)} vía ${METHOD_LABELS[abonoMethod]}]`;
    await saveSupplierPayment(
      {
        supplierId: abonoTarget.supplierId,
        paymentDate: abonoTarget.paymentDate,
        supplierName: abonoTarget.supplierName,
        category: abonoTarget.category,
        concept: abonoTarget.concept,
        reference: abonoTarget.reference,
        amount: abonoTarget.amount,
        paidAmount: nextPaid,
        paymentMethod: abonoMethod,
        status: nextStatus,
        notes: [abonoTarget.notes, noteLine].filter(Boolean).join(' • '),
      },
      abonoTarget.id
    );
    showToast(
      'ok',
      nextStatus === 'pagado'
        ? `Factura ${abonoTarget.reference || abonoTarget.supplierName} liquidada al 100%.`
        : `Abono de ${fmtMoney(addAmt)} aplicado. Saldo restante: ${fmtMoney(remaining)}.`
    );
    setAbonoTarget(null);
    setAbonoAmount('');
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    if (confirmDeleteId.kind === 'supplier') {
      await deleteSupplier(confirmDeleteId.id);
      showToast('ok', 'Proveedor eliminado del directorio.');
    } else {
      await deleteSupplierPayment(confirmDeleteId.id);
      showToast('ok', 'Registro de pago eliminado.');
    }
    setConfirmDeleteId(null);
  };

  const activeStatementMetric = useMemo(() => {
    if (!supplierMetrics.length) return null;
    return (
      supplierMetrics.find((m) => m.supplier.id === selectedStatementSupplierId) ||
      supplierMetrics[0]
    );
  }, [supplierMetrics, selectedStatementSupplierId]);

  const buildWhatsappHref = (sup: Supplier, billed: number, paid: number, pending: number) => {
    const cleanDigits = (sup.phone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hola ${sup.contactName || sup.name}, compartimos el resumen de cuenta en Aroma Flower:\n` +
        `• Proveedor: ${sup.name}\n` +
        `• Total facturado: ${fmtMoney(billed)}\n` +
        `• Total pagado: ${fmtMoney(paid)}\n` +
        `• Saldo pendiente: ${fmtMoney(pending)}\n` +
        `Saludos — Administración Aroma Flower.`
    );
    return cleanDigits
      ? `https://wa.me/52${cleanDigits}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] tracking-tight">
            Proveedores y Cuentas por Pagar
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Directorio formal de proveedores, registro de facturas, abonos parciales y saldo exacto que debemos a cada uno.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportSuppliersSummaryExcel(suppliers, supplierPayments)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#535B28]" />
            Excel Proveedores
          </button>
          <button
            type="button"
            onClick={() => exportSupplierPaymentsPdf(supplierPayments)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#5C1125]" />
            PDF Pagos
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin_costos')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#C3A25D]/50 bg-[#FAF8F5] text-[#5C1125] hover:bg-[#f2ece2] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ver en Costos
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              resetSupplierForm();
              setSubTab('directorio');
              setShowSupplierForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proveedor
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
            Proveedores Activos
          </p>
          <p className="text-2xl font-bold text-[#000000] mt-1 tabular-nums">
            {kpis.activeCount}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {suppliers.length} registrados · {kpis.suppliersWithDebt} con saldo
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Total Compras / Facturado
          </p>
          <p className="text-2xl font-bold text-[#000000] mt-1 tabular-nums">
            {fmtMoney(kpis.totalBilled)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {supplierPayments.length} facturas y cargos registrados
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#535B28]">
            Total Pagado a Proveedores
          </p>
          <p className="text-2xl font-bold text-[#535B28] mt-1 tabular-nums">
            {fmtMoney(kpis.totalPaid)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Conectado al módulo de Control de Costos
          </p>
        </div>

        <div className="bg-[#5C1125] border border-[#430c1b] rounded-xl p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C3A25D]">
            Total que Debemos (Por Pagar)
          </p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">
            {fmtMoney(kpis.totalDebt)}
          </p>
          <p className="text-xs text-white/75 mt-1">
            {kpis.suppliersWithDebt === 0
              ? 'Al corriente sin adeudos pendientes'
              : `Distribuido en ${kpis.suppliersWithDebt} proveedor(es)`}
          </p>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('directorio')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'directorio'
                ? 'bg-[#5C1125] text-white'
                : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Directorio y Deudas ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('pagos')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'pagos'
                ? 'bg-[#5C1125] text-white'
                : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Facturas y Pagos ({supplierPayments.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('estado_cuenta')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'estado_cuenta'
                ? 'bg-[#5C1125] text-white'
                : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Estado de Cuenta por Proveedor
          </button>
        </div>

        {subTab !== 'estado_cuenta' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proveedor, factura..."
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] w-56"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
            >
              <option value="ALL">Todas las categorías</option>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            {subTab === 'pagos' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
              >
                <option value="ALL">Todos los estatus</option>
                <option value="pendiente">Pendiente (Por pagar)</option>
                <option value="parcial">Abono Parcial</option>
                <option value="pagado">Pagado</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: DIRECTORIO Y DEUDAS */}
      {subTab === 'directorio' && (
        <div className="space-y-5">
          {showSupplierForm && (
            <form
              onSubmit={handleSaveSupplier}
              className="bg-white border border-[#C3A25D]/60 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h2 className="text-sm font-bold text-[#5C1125]">
                  {editingSupplierId ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
                </h2>
                <button
                  type="button"
                  onClick={resetSupplierForm}
                  className="text-neutral-500 hover:text-neutral-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Nombre / Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="Ej. Agroquímicos del Valle"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Categoría Principal
                  </label>
                  <select
                    value={supCategory}
                    onChange={(e) => setSupCategory(e.target.value as SupplierPaymentCategory)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] bg-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="Ej. Ing. Roberto Salazar"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="Ej. 55 4120 8890"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    placeholder="ventas@proveedor.mx"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    RFC (Opcional)
                  </label>
                  <input
                    type="text"
                    value={supRfc}
                    onChange={(e) => setSupRfc(e.target.value.toUpperCase())}
                    placeholder="RFC123456ABC"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Banco / CLABE Interbancaria
                  </label>
                  <input
                    type="text"
                    value={supBank}
                    onChange={(e) => setSupBank(e.target.value)}
                    placeholder="Ej. BBVA CLABE 012180..."
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Días Crédito
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={supCreditDays}
                      onChange={(e) => setSupCreditDays(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Límite Crédito ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={supCreditLimit}
                      onChange={(e) => setSupCreditLimit(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Notas / Productos que surte
                  </label>
                  <input
                    type="text"
                    value={supNotes}
                    onChange={(e) => setSupNotes(e.target.value)}
                    placeholder="Ej. Entrega los martes en invernadero Santa Cruz."
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 mr-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supActive}
                      onChange={(e) => setSupActive(e.target.checked)}
                      className="accent-[#5C1125]"
                    />
                    Activo
                  </label>
                  <button
                    type="button"
                    onClick={resetSupplierForm}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#5C1125] hover:bg-[#430c1b] text-white cursor-pointer"
                  >
                    {editingSupplierId ? 'Guardar Cambios' : 'Registrar Proveedor'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Directory Table */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#5C1125] text-white text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Proveedor</th>
                    <th className="py-3 px-3 font-semibold">Contacto / Cuenta</th>
                    <th className="py-3 px-3 font-semibold text-right">Facturado</th>
                    <th className="py-3 px-3 font-semibold text-right">Pagado</th>
                    <th className="py-3 px-4 font-semibold text-right">Saldo que Debemos</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-xs">
                  {filteredSupplierMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-neutral-500">
                        No hay proveedores que coincidan con el filtro. Usa "Nuevo Proveedor" para registrar uno.
                      </td>
                    </tr>
                  ) : (
                    filteredSupplierMetrics.map(({ supplier, payments, billed, paid, pending, pendingDocs }) => (
                      <tr key={supplier.id} className="hover:bg-[#FAF8F5]">
                        <td className="py-3 px-4 align-top">
                          <div className="font-bold text-[#000000] flex items-center gap-2">
                            <span>{supplier.name}</span>
                            {supplier.active === false && (
                              <span className="text-[10px] font-semibold text-neutral-500">
                                (Inactivo)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            {CATEGORY_LABELS[supplier.category]} · Crédito {supplier.creditDays}d
                            {supplier.rfc ? ` · RFC ${supplier.rfc}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top text-neutral-700">
                          <div>{supplier.contactName || '—'}</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
                            {supplier.phone && (
                              <>
                                <Phone className="w-3 h-3" />
                                <span>{supplier.phone}</span>
                              </>
                            )}
                          </div>
                          {supplier.bankInfo && (
                            <div className="text-[11px] text-neutral-500 mt-0.5 truncate max-w-[230px]">
                              {supplier.bankInfo}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top text-right tabular-nums font-medium text-neutral-800">
                          {fmtMoney(billed)}
                          <div className="text-[10px] text-neutral-400">{payments.length} mov.</div>
                        </td>
                        <td className="py-3 px-3 align-top text-right tabular-nums font-semibold text-[#535B28]">
                          {fmtMoney(paid)}
                        </td>
                        <td className="py-3 px-4 align-top text-right tabular-nums">
                          <span
                            className={`text-sm font-bold ${
                              pending > 0.01 ? 'text-[#5C1125]' : 'text-[#535B28]'
                            }`}
                          >
                            {fmtMoney(pending)}
                          </span>
                          <div className="text-[10px] text-neutral-500">
                            {pending > 0.01
                              ? `${pendingDocs} doc(s) pendiente(s)`
                              : 'Al corriente'}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openQuickPaymentForSupplier(supplier)}
                              className="px-2.5 py-1.5 rounded-md bg-[#5C1125] hover:bg-[#430c1b] text-white text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                            >
                              + Factura / Pago
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStatementSupplierId(supplier.id);
                                setSubTab('estado_cuenta');
                              }}
                              className="px-2.5 py-1.5 rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                            >
                              Edo. Cuenta
                            </button>
                            <a
                              href={buildWhatsappHref(supplier, billed, paid, pending)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enviar estado por WhatsApp"
                              className="p-1.5 rounded-md border border-neutral-300 bg-white hover:bg-emerald-50 text-emerald-700"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => openEditSupplier(supplier)}
                              title="Editar proveedor"
                              className="p-1.5 rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId({ kind: 'supplier', id: supplier.id })}
                              title="Eliminar proveedor"
                              className="p-1.5 rounded-md border border-neutral-300 bg-white hover:bg-red-50 text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* TAB 2: FACTURAS Y PAGOS */}
      {subTab === 'pagos' && (
        <div className="space-y-5">
          {/* Form */}
          <form
            onSubmit={handleSavePayment}
            className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#5C1125]">
                  {editingPaymentId ? 'Editar Factura / Pago a Proveedor' : 'Registrar Factura, Compra a Crédito o Pago a Proveedor'}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Registra una compra como Pendiente (crédito), Parcial (con anticipo) o Pagado (liquidado al momento).
                </p>
              </div>
              {editingPaymentId && (
                <button
                  type="button"
                  onClick={resetPaymentForm}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 cursor-pointer"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Proveedor del Directorio *
                </label>
                <select
                  value={paySupplierId}
                  onChange={(e) => handleSelectSupplierInPaymentForm(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] bg-white"
                >
                  <option value="">-- Seleccionar proveedor --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Nombre Proveedor (o eventual)
                </label>
                <input
                  type="text"
                  value={paySupplierCustom}
                  onChange={(e) => {
                    setPaySupplierCustom(e.target.value);
                    if (paySupplierId) setPaySupplierId('');
                  }}
                  placeholder="Nombre del proveedor"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Categoría
                </label>
                <select
                  value={payCategory}
                  onChange={(e) => setPayCategory(e.target.value as SupplierPaymentCategory)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] bg-white"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Concepto / Descripción de Compra *
                </label>
                <input
                  type="text"
                  required
                  value={payConcept}
                  onChange={(e) => setPayConcept(e.target.value)}
                  placeholder="Ej. Fungicidas semanales, 500 capuchones, flete CDMX..."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Factura / Folio / Remisión
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Ej. FAC-4821"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Monto Total Factura ($ MXN) *
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Estatus de Pago
                </label>
                <select
                  value={payStatus}
                  onChange={(e) => setPayStatus(e.target.value as SupplierPaymentStatus)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] bg-white"
                >
                  <option value="pendiente">Pendiente (Compra a Crédito — Debemos todo)</option>
                  <option value="parcial">Abono Parcial (Queda saldo pendiente)</option>
                  <option value="pagado">Pagado (Liquidado al 100%)</option>
                </select>
              </div>

              {payStatus === 'parcial' && (
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Monto Abonado Hoy ($ MXN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payPaidAmount}
                    onChange={(e) => setPayPaidAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs border border-[#535B28] rounded-lg focus:outline-none focus:border-[#5C1125] font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Método de Pago
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as SupplierPaymentMethod)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] bg-white"
                >
                  {Object.entries(METHOD_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={payStatus === 'parcial' ? '' : 'lg:col-span-2'}>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Detalles adicionales, vencimiento..."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-semibold cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                {editingPaymentId ? 'Guardar Cambios' : 'Registrar Factura / Pago'}
              </button>
            </div>
          </form>

          {/* Payments Ledger Table */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#5C1125] text-white text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Fecha</th>
                    <th className="py-3 px-3 font-semibold">Proveedor / Factura</th>
                    <th className="py-3 px-3 font-semibold">Concepto</th>
                    <th className="py-3 px-3 font-semibold text-right">Total</th>
                    <th className="py-3 px-3 font-semibold text-right">Pagado</th>
                    <th className="py-3 px-3 font-semibold text-right">Saldo Debemos</th>
                    <th className="py-3 px-3 font-semibold">Estatus</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-xs">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-neutral-500">
                        Sin facturas o pagos registrados bajo estos filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const remaining = Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0));
                      return (
                        <tr key={p.id} className="hover:bg-[#FAF8F5]">
                          <td className="py-3 px-4 tabular-nums text-neutral-700 whitespace-nowrap">
                            {p.paymentDate}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#000000]">{p.supplierName}</div>
                            <div className="text-[11px] text-neutral-500">
                              {p.reference ? `Ref. ${p.reference} · ` : ''}
                              {METHOD_LABELS[p.paymentMethod]}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-neutral-700 max-w-xs">
                            <div>{p.concept}</div>
                            {p.notes && (
                              <div className="text-[11px] text-neutral-500 truncate">{p.notes}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-medium">
                            {fmtMoney(p.amount)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#535B28]">
                            {fmtMoney(p.paidAmount)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-[#5C1125]">
                            {fmtMoney(remaining)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block text-[11px] font-bold uppercase ${
                                p.status === 'pagado'
                                  ? 'text-[#535B28]'
                                  : p.status === 'parcial'
                                  ? 'text-amber-700'
                                  : 'text-[#5C1125]'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {remaining > 0.01 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAbonoTarget(p);
                                    setAbonoAmount(String(remaining));
                                    setAbonoMethod(p.paymentMethod);
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-[#535B28] hover:bg-[#3f461e] text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Abonar / Liquidar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditPayment(p)}
                                title="Editar"
                                className="p-1.5 rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId({ kind: 'payment', id: p.id })}
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

      {/* TAB 3: ESTADO DE CUENTA POR PROVEEDOR */}
      {subTab === 'estado_cuenta' && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-neutral-700 whitespace-nowrap">
                Seleccionar Proveedor:
              </label>
              <select
                value={activeStatementMetric?.supplier.id || ''}
                onChange={(e) => setSelectedStatementSupplierId(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-white border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125] min-w-[240px]"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {activeStatementMetric && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openQuickPaymentForSupplier(activeStatementMetric.supplier)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Registrar Factura / Abono
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportSupplierStatementPdf(
                      activeStatementMetric.supplier,
                      activeStatementMetric.payments
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#5C1125]" />
                  Estado de Cuenta PDF
                </button>
                <a
                  href={buildWhatsappHref(
                    activeStatementMetric.supplier,
                    activeStatementMetric.billed,
                    activeStatementMetric.paid,
                    activeStatementMetric.pending
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </div>
            )}
          </div>

          {activeStatementMetric ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 rounded-xl p-4 md:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Datos Bancarios y Crédito
                  </p>
                  <p className="text-sm font-bold text-[#000000] mt-1">
                    {activeStatementMetric.supplier.name}
                  </p>
                  <p className="text-xs text-neutral-600 mt-1">
                    {activeStatementMetric.supplier.contactName || 'Sin contacto'} ·{' '}
                    {activeStatementMetric.supplier.phone || 'Sin tel.'}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1.5">
                    {activeStatementMetric.supplier.bankInfo || 'Sin CLABE registrada'}
                  </p>
                </div>
                <div className="bg-white border border-neutral-200 rounded-xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Total Facturado
                  </p>
                  <p className="text-2xl font-bold text-[#000000] mt-1 tabular-nums">
                    {fmtMoney(activeStatementMetric.billed)}
                  </p>
                </div>
                <div className="bg-white border border-neutral-200 rounded-xl p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#535B28]">
                    Total Pagado
                  </p>
                  <p className="text-2xl font-bold text-[#535B28] mt-1 tabular-nums">
                    {fmtMoney(activeStatementMetric.paid)}
                  </p>
                </div>
                <div className="bg-[#5C1125] rounded-xl p-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C3A25D]">
                    Saldo que Debemos Hoy
                  </p>
                  <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                    {fmtMoney(activeStatementMetric.pending)}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#5C1125] text-white text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4 font-semibold">Fecha</th>
                        <th className="py-3 px-3 font-semibold">Factura / Folio</th>
                        <th className="py-3 px-3 font-semibold">Concepto</th>
                        <th className="py-3 px-3 font-semibold text-right">Facturado</th>
                        <th className="py-3 px-3 font-semibold text-right">Pagado</th>
                        <th className="py-3 px-3 font-semibold text-right">Saldo Pendiente</th>
                        <th className="py-3 px-4 font-semibold text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-xs">
                      {activeStatementMetric.payments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-neutral-500">
                            Este proveedor todavía no tiene facturas ni pagos registrados.
                          </td>
                        </tr>
                      ) : (
                        activeStatementMetric.payments.map((p) => {
                          const rem = Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0));
                          return (
                            <tr key={p.id} className="hover:bg-[#FAF8F5]">
                              <td className="py-3 px-4 tabular-nums">{p.paymentDate}</td>
                              <td className="py-3 px-3 font-semibold">{p.reference || '—'}</td>
                              <td className="py-3 px-3">
                                <div>{p.concept}</div>
                                {p.notes && (
                                  <div className="text-[11px] text-neutral-500">{p.notes}</div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums">{fmtMoney(p.amount)}</td>
                              <td className="py-3 px-3 text-right tabular-nums text-[#535B28] font-semibold">
                                {fmtMoney(p.paidAmount)}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums font-bold text-[#5C1125]">
                                {fmtMoney(rem)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {rem > 0.01 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAbonoTarget(p);
                                      setAbonoAmount(String(rem));
                                      setAbonoMethod(p.paymentMethod);
                                    }}
                                    className="px-2.5 py-1 rounded-md bg-[#535B28] hover:bg-[#3f461e] text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Abonar / Liquidar
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-semibold text-[#535B28]">
                                    Liquidado
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center text-sm text-neutral-500">
              Registra primero un proveedor para consultar su estado de cuenta.
            </div>
          )}
        </div>
      )}

      {/* Quick Abono / Liquidar Modal */}
      {abonoTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-[#5C1125]">
                Registrar Abono / Liquidación
              </h3>
              <button
                type="button"
                onClick={() => setAbonoTarget(null)}
                className="text-neutral-500 hover:text-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#FAF8F5] border border-neutral-200 rounded-lg p-3 text-xs space-y-1">
              <div className="font-bold text-[#000000]">{abonoTarget.supplierName}</div>
              <div className="text-neutral-600">
                {abonoTarget.concept} {abonoTarget.reference ? `(${abonoTarget.reference})` : ''}
              </div>
              <div className="flex justify-between pt-1.5 border-t border-neutral-200 mt-1.5 tabular-nums">
                <span>Saldo pendiente actual:</span>
                <strong className="text-[#5C1125]">
                  {fmtMoney(Math.max(0, abonoTarget.amount - abonoTarget.paidAmount))}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Monto a Pagar ($ MXN)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-neutral-300 rounded-lg focus:outline-none focus:border-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Método de Pago
                </label>
                <select
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as SupplierPaymentMethod)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-[#5C1125]"
                >
                  {Object.entries(METHOD_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAbonoTarget(null)}
                className="px-3.5 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAbono}
                className="px-4 py-2 rounded-lg bg-[#535B28] hover:bg-[#3f461e] text-white text-xs font-semibold cursor-pointer"
              >
                Aplicar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#000000]">¿Confirmar eliminación?</h3>
            <p className="text-xs text-neutral-600">
              {confirmDeleteId.kind === 'supplier'
                ? 'Se eliminará este proveedor del directorio (sus pagos históricos permanecerán en el historial).'
                : 'Se eliminará este registro de factura/pago y se recalculará el saldo pendiente.'}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
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
