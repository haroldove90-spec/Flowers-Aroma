import React, { useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  MessageCircle,
  Copy,
  Check,
  Edit3,
  UserX,
  UserCheck,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Wallet,
  X,
  Phone,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { AppUser, AppUserRole, PayrollEmployee } from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
  exportEmployeesDirectoryExcel,
  exportEmployeesDirectoryPdf,
} from '../../utils/exportReports';

const parseDecimalInput = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const formatPhoneForWhatsApp = (rawPhone: string): string => {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `52${digits}`;
  return digits;
};

const generateSuggestedUsername = (fullName: string): string => {
  const base = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('_');
  return base || `emp_${Date.now().toString(36).slice(-4)}`;
};

const generateSecurePassword = (): string => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Aroma#${num}`;
};

const buildWhatsAppMessage = (params: {
  fullName: string;
  username: string;
  password: string;
  role: AppUserRole;
  appUrl: string;
}) => {
  const roleLabel = params.role === 'admin' ? 'Administrador' : 'Producción (CEDA CDMX)';
  return [
    `Hola *${params.fullName}*,`,
    `Tus credenciales de acceso al sistema *Aroma Flower* ya están activas:`,
    ``,
    `🔗 *Enlace:* ${params.appUrl}`,
    `👤 *Usuario:* ${params.username}`,
    `🔑 *Contraseña:* ${params.password}`,
    `🏷️ *Rol:* ${roleLabel}`,
    ``,
    `Al ingresar podrás consultar tus módulos y actualizar tu foto o datos en *Mi Perfil*.`,
  ].join('\n');
};

export const EmployeesView: React.FC = () => {
  const {
    currentUser,
    appUsers,
    saveAppUser,
    payrollEmployees,
    savePayrollEmployee,
    setPayrollEmployeeActive,
    deletePayrollEmployee,
    setActiveView,
  } = useGreenhouse();

  const today = new Date().toISOString().slice(0, 10);
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://aromaflower.app';

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [teamGroup, setTeamGroup] = useState('AARON');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [weeklySalaryStr, setWeeklySalaryStr] = useState('2400');
  const [hasAttendanceBonus, setHasAttendanceBonus] = useState(true);
  const [defaultBonusStr, setDefaultBonusStr] = useState('150');
  const [hireDate, setHireDate] = useState(today);
  const [notes, setNotes] = useState('');

  // Embedded Credential Creation / Editing
  const [enableCredentials, setEnableCredentials] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<string | undefined>(undefined);
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credRole, setCredRole] = useState<AppUserRole>('produccion');
  const [showPass, setShowPass] = useState(false);

  // Filters & UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'with_access'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline termination / delete confirmation
  const [bajaTargetId, setBajaTargetId] = useState<string | null>(null);
  const [bajaReason, setBajaReason] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // WhatsApp Share Modal state
  const [whatsappModal, setWhatsappModal] = useState<{
    fullName: string;
    phone: string;
    username: string;
    password: string;
    role: AppUserRole;
  } | null>(null);
  const [waPhoneOverride, setWaPhoneOverride] = useState('');
  const [copiedWa, setCopiedWa] = useState(false);

  const usersById = useMemo(() => {
    const map = new Map<string, AppUser>();
    appUsers.forEach((u) => map.set(u.id, u));
    return map;
  }, [appUsers]);

  const kpis = useMemo(() => {
    const activeList = payrollEmployees.filter((e) => e.active !== false);
    const inactiveCount = payrollEmployees.length - activeList.length;
    const withAccessCount = payrollEmployees.filter(
      (e) => e.linkedUserId && usersById.has(e.linkedUserId)
    ).length;
    const baseWeeklyTotal = activeList.reduce((acc, e) => acc + Number(e.weeklySalary || 0), 0);
    const totalLoanBalance = payrollEmployees.reduce((acc, e) => acc + Number(e.loanBalance || 0), 0);
    return {
      total: payrollEmployees.length,
      activeCount: activeList.length,
      inactiveCount,
      withAccessCount,
      baseWeeklyTotal,
      totalLoanBalance,
    };
  }, [payrollEmployees, usersById]);

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...payrollEmployees]
      .filter((e) => {
        if (statusFilter === 'active' && e.active === false) return false;
        if (statusFilter === 'inactive' && e.active !== false) return false;
        if (statusFilter === 'with_access' && !(e.linkedUserId && usersById.has(e.linkedUserId)))
          return false;
        if (!q) return true;
        const linked = e.linkedUserId ? usersById.get(e.linkedUserId) : undefined;
        return (
          e.fullName.toLowerCase().includes(q) ||
          e.teamGroup.toLowerCase().includes(q) ||
          (e.jobTitle || '').toLowerCase().includes(q) ||
          (e.phone || '').toLowerCase().includes(q) ||
          (linked?.username || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [payrollEmployees, searchTerm, statusFilter, usersById]);

  const unlinkedSystemUsers = useMemo(() => {
    const linkedIds = new Set(
      payrollEmployees.map((e) => e.linkedUserId).filter(Boolean) as string[]
    );
    return appUsers.filter((u) => !linkedIds.has(u.id));
  }, [appUsers, payrollEmployees]);

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setTeamGroup('AARON');
    setJobTitle('');
    setPhone('');
    setEmail('');
    setWeeklySalaryStr('2400');
    setHasAttendanceBonus(true);
    setDefaultBonusStr('150');
    setHireDate(today);
    setNotes('');
    setEnableCredentials(false);
    setLinkedUserId(undefined);
    setCredUsername('');
    setCredPassword('');
    setCredRole('produccion');
    setShowPass(false);
  };

  const handleLoadEdit = (emp: PayrollEmployee) => {
    setEditingId(emp.id);
    setFullName(emp.fullName);
    setTeamGroup(emp.teamGroup || 'AARON');
    setJobTitle(emp.jobTitle || '');
    setPhone(emp.phone || '');
    setEmail(emp.email || '');
    setWeeklySalaryStr(String(emp.weeklySalary || 0));
    setHasAttendanceBonus(Boolean(emp.hasAttendanceBonus));
    setDefaultBonusStr(String(emp.defaultBonusAmount ?? 150));
    setHireDate(emp.hireDate || today);
    setNotes(emp.notes || '');

    const linked = emp.linkedUserId ? usersById.get(emp.linkedUserId) : undefined;
    if (linked) {
      setEnableCredentials(true);
      setLinkedUserId(linked.id);
      setCredUsername(linked.username);
      setCredPassword(linked.password);
      setCredRole(linked.role);
    } else {
      setEnableCredentials(false);
      setLinkedUserId(undefined);
      setCredUsername(generateSuggestedUsername(emp.fullName));
      setCredPassword(generateSecurePassword());
      setCredRole('produccion');
    }
    setErrorMsg(null);
  };

  const handleToggleCredentials = (checked: boolean) => {
    setEnableCredentials(checked);
    if (checked) {
      if (!credUsername && fullName.trim()) {
        setCredUsername(generateSuggestedUsername(fullName));
      }
      if (!credPassword) {
        setCredPassword(generateSecurePassword());
      }
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    if (!fullName.trim()) {
      setErrorMsg('Ingresa el nombre del empleado.');
      return;
    }

    setIsSaving(true);
    let finalLinkedUserId = linkedUserId;
    let savedUserObj: AppUser | undefined;

    // 1. If credentials toggle is enabled, create/update AppUser first
    if (enableCredentials) {
      if (!credUsername.trim() || !credPassword.trim()) {
        setIsSaving(false);
        setErrorMsg('Ingresa usuario y contraseña para crear las credenciales de acceso.');
        return;
      }

      const existingLinked = linkedUserId ? usersById.get(linkedUserId) : undefined;
      const userRes = await saveAppUser(
        {
          fullName: fullName.trim(),
          username: credUsername.trim(),
          password: credPassword,
          role: credRole,
          email: email.trim(),
          phone: phone.trim(),
          jobTitle: jobTitle.trim() || 'Empleado',
          department: teamGroup.trim().toUpperCase() || 'AARON',
          notes: notes.trim(),
          avatarUrl: existingLinked?.avatarUrl,
          active: existingLinked ? existingLinked.active : true,
        },
        linkedUserId
      );

      if (!userRes.ok) {
        setIsSaving(false);
        setErrorMsg(userRes.error || 'No se pudieron guardar las credenciales del empleado.');
        return;
      }
      finalLinkedUserId = userRes.user?.id || linkedUserId;
      savedUserObj = userRes.user;
    }

    // 2. Save employee record in payroll_employees
    const existingEmp = editingId ? payrollEmployees.find((item) => item.id === editingId) : undefined;
    const empRes = await savePayrollEmployee(
      {
        fullName: fullName.trim(),
        teamGroup: teamGroup.trim() || 'AARON',
        jobTitle: jobTitle.trim(),
        phone: phone.trim(),
        email: email.trim(),
        weeklySalary: parseDecimalInput(weeklySalaryStr),
        hasAttendanceBonus,
        defaultBonusAmount: parseDecimalInput(defaultBonusStr) || 150,
        loanBalance: existingEmp?.loanBalance ?? 0,
        hireDate: hireDate || today,
        terminationDate: existingEmp?.terminationDate,
        terminationReason: existingEmp?.terminationReason,
        active: existingEmp ? existingEmp.active : true,
        linkedUserId: finalLinkedUserId,
        notes: notes.trim(),
      },
      editingId || undefined
    );

    setIsSaving(false);

    if (!empRes.ok) {
      setErrorMsg(empRes.error || 'No se pudo guardar el empleado.');
      return;
    }

    setFeedback(
      empRes.cloudSynced
        ? editingId
          ? `Empleado "${empRes.employee?.fullName}" actualizado y sincronizado en Supabase.`
          : `Empleado "${empRes.employee?.fullName}" registrado en Supabase.`
        : `Empleado guardado localmente. Pendiente sincronizar en Supabase: ${empRes.cloudError || 'Ejecuta el SQL actualizado'}.`
    );

    // If new credentials were created, open WhatsApp share modal automatically for convenience!
    if (enableCredentials && savedUserObj && !editingId) {
      openWhatsAppModal({
        fullName: savedUserObj.fullName,
        phone: phone.trim(),
        username: savedUserObj.username,
        password: savedUserObj.password,
        role: savedUserObj.role,
      });
    }

    resetForm();
    setTimeout(() => setFeedback(null), 5000);
  };

  const openWhatsAppModal = (payload: {
    fullName: string;
    phone: string;
    username: string;
    password: string;
    role: AppUserRole;
  }) => {
    setWhatsappModal(payload);
    setWaPhoneOverride(payload.phone || '');
    setCopiedWa(false);
  };

  const handleConfirmBaja = async (emp: PayrollEmployee) => {
    await setPayrollEmployeeActive(emp.id, false, bajaReason || 'Baja administrativa');
    setBajaTargetId(null);
    setBajaReason('');
    setFeedback(
      `Empleado "${emp.fullName}" dado de baja.${emp.linkedUserId ? ' Su acceso al sistema también fue desactivado.' : ''}`
    );
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleReactivate = async (emp: PayrollEmployee) => {
    await setPayrollEmployeeActive(emp.id, true);
    setFeedback(
      `Empleado "${emp.fullName}" reactivado.${emp.linkedUserId ? ' Su acceso al sistema fue restaurado.' : ''}`
    );
    setTimeout(() => setFeedback(null), 4000);
  };

  const handlePermanentDelete = async (id: string) => {
    await deletePayrollEmployee(id);
    setConfirmDeleteId(null);
    setFeedback('Registro de empleado eliminado permanentemente.');
    setTimeout(() => setFeedback(null), 3500);
  };

  const waMessageText = whatsappModal
    ? buildWhatsAppMessage({
        fullName: whatsappModal.fullName,
        username: whatsappModal.username,
        password: whatsappModal.password,
        role: whatsappModal.role,
        appUrl,
      })
    : '';

  const waLinkHref = whatsappModal
    ? (() => {
        const cleanDigits = formatPhoneForWhatsApp(waPhoneOverride);
        const encoded = encodeURIComponent(waMessageText);
        return cleanDigits ? `https://wa.me/${cleanDigits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
      })()
    : '#';

  const handleCopyWaMessage = () => {
    if (!waMessageText) return;
    navigator.clipboard.writeText(waMessageText);
    setCopiedWa(true);
    setTimeout(() => setCopiedWa(false), 2500);
  };

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
                  Módulo Administración &bull; Personal
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#535B28] text-white">
                  Credenciales + WhatsApp
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                Gestión de Empleados y Accesos
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                Registra trabajadores, asigna sueldo semanal, crea sus credenciales de ingreso, compártelas por WhatsApp y gestiona bajas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('admin_pagos')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>Ir a Módulo Pagos</span>
            </button>
            <button
              type="button"
              onClick={() => exportEmployeesDirectoryExcel(payrollEmployees, appUsers)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold border border-[#C3A25D]/40 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#C3A25D]" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportEmployeesDirectoryPdf(payrollEmployees, appUsers)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#C3A25D]" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-[#5C1125] uppercase tracking-wider">
            Empleados Activos
          </span>
          <p className="mt-1 text-2xl font-black text-[#000000]">{kpis.activeCount}</p>
          <span className="text-[10px] text-stone-500">
            {kpis.inactiveCount} baja(s) &bull; {kpis.total} total
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-[#535B28] uppercase tracking-wider">
            Con Credenciales
          </span>
          <p className="mt-1 text-2xl font-black text-[#000000]">{kpis.withAccessCount}</p>
          <span className="text-[10px] text-stone-500">
            +{unlinkedSystemUsers.length} cuentas sistema
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-[#C3A25D] uppercase tracking-wider">
            Nómina Base Semanal
          </span>
          <p className="mt-1 text-2xl font-black text-[#000000]">
            ${kpis.baseWeeklyTotal.toLocaleString('es-MX')}
          </p>
          <span className="text-[10px] text-stone-500">Sueldo base 6 días</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
            Saldo Préstamos
          </span>
          <p className="mt-1 text-2xl font-black text-[#5C1125]">
            ${kpis.totalLoanBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-stone-500">Por descontar en nómina</span>
        </div>
      </div>

      {/* Global Feedback / Error */}
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

      {/* Main Split: Form + Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form: Register / Edit Employee + Credentials */}
        <form
          onSubmit={handleSaveEmployee}
          className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#5C1125]" />
              <h2 className="text-sm font-extrabold text-[#000000]">
                {editingId ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-[#5C1125] hover:underline cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. SAMUEL MARTÍNEZ"
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Equipo / Grupo
              </label>
              <input
                type="text"
                value={teamGroup}
                onChange={(e) => setTeamGroup(e.target.value)}
                placeholder="Ej. AARON"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold uppercase focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Puesto / Cargo</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ej. Operario"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                WhatsApp / Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10 dígitos (ej. 5512345678)"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Fecha Ingreso
              </label>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>
          </div>

          {/* Payroll base settings */}
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-3">
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#535B28]">
              Configuración de Nómina (Módulo Pagos)
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Sueldo Semanal ($)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={weeklySalaryStr}
                  onChange={(e) => setWeeklySalaryStr(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="2400"
                  className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] bg-white focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Bono AyP ($)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={defaultBonusStr}
                  onChange={(e) => setDefaultBonusStr(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="150"
                  disabled={!hasAttendanceBonus}
                  className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] bg-white disabled:bg-stone-100 disabled:text-stone-400 focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAttendanceBonus}
                onChange={(e) => setHasAttendanceBonus(e.target.checked)}
                className="rounded border-stone-300 text-[#5C1125] focus:ring-[#5C1125]"
              />
              <span>Aplica Bono de Asistencia y Puntualidad (AyP)</span>
            </label>
          </div>

          {/* Credentials toggle */}
          <div className="p-3.5 rounded-xl bg-[#fbf2f4]/60 border border-[#ebccd4] space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 text-xs font-extrabold text-[#5C1125]">
                <KeyRound className="w-4 h-4" />
                <span>Crear / Editar Credenciales de Acceso</span>
              </span>
              <input
                type="checkbox"
                checked={enableCredentials}
                onChange={(e) => handleToggleCredentials(e.target.checked)}
                className="rounded border-stone-300 text-[#5C1125] focus:ring-[#5C1125] w-4 h-4"
              />
            </label>

            {enableCredentials && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Usuario de Acceso
                  </label>
                  <input
                    type="text"
                    value={credUsername}
                    onChange={(e) => setCredUsername(e.target.value)}
                    placeholder="ej. samuel_af"
                    required={enableCredentials}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">Contraseña</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCredPassword(generateSecurePassword());
                        setShowPass(true);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#5C1125] hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Generar clave
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      placeholder="Contraseña de acceso"
                      required={enableCredentials}
                      className="w-full pl-3 pr-9 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-[#5C1125]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute right-2.5 top-2 text-stone-400 hover:text-[#5C1125] cursor-pointer"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Rol de Acceso</label>
                  <select
                    value={credRole}
                    onChange={(e) => setCredRole(e.target.value as AppUserRole)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-[#5C1125]"
                  >
                    <option value="produccion">Producción (CEDA CDMX + Ventas + Perfil)</option>
                    <option value="admin">Admin (Acceso Total)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Notas (Opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Turno matutino, contacto de emergencia..."
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
          >
            <UserPlus className="w-4 h-4 text-[#C3A25D]" />
            <span>
              {isSaving
                ? 'Guardando en Supabase...'
                : editingId
                ? 'Actualizar Empleado'
                : 'Guardar Empleado'}
            </span>
          </button>
        </form>

        {/* Directory List */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            {/* Search & Filter bar */}
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-[#FAF8F5] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#5C1125]" />
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
                      Plantilla de Empleados ({filteredEmployees.length})
                    </h2>
                    <p className="text-[11px] text-stone-500">
                      Sincronizado automáticamente con Nómina Semanal y credenciales de acceso.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, equipo, puesto, teléfono o usuario..."
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['all', 'Todos'],
                      ['active', 'Activos'],
                      ['inactive', 'Bajas'],
                      ['with_access', 'Con Acceso'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatusFilter(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        statusFilter === key
                          ? 'bg-[#5C1125] text-white'
                          : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Employees List */}
            <div className="divide-y divide-stone-100">
              {filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-xs sm:text-sm text-stone-500">
                  No se encontraron empleados con el filtro seleccionado.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const linked = emp.linkedUserId ? usersById.get(emp.linkedUserId) : undefined;
                  const isBaja = emp.active === false;

                  return (
                    <div
                      key={emp.id}
                      className={`p-4 space-y-3 transition ${
                        isBaja ? 'bg-stone-50/90 opacity-85' : 'hover:bg-[#FAF8F5]/70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-11 h-11 rounded-full font-extrabold text-sm flex items-center justify-center shrink-0 border ${
                              isBaja
                                ? 'bg-stone-200 text-stone-500 border-stone-300'
                                : 'bg-[#5C1125]/10 text-[#5C1125] border-[#5C1125]/25'
                            }`}
                          >
                            {emp.fullName
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0])
                              .join('')}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-extrabold text-[#000000]">
                                {emp.fullName}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF8F5] text-[#535B28] border border-[#dce4bf]">
                                {emp.teamGroup}
                              </span>
                              {isBaja ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                                  BAJA {emp.terminationDate ? `(${emp.terminationDate})` : ''}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#535B28] text-white">
                                  ACTIVO
                                </span>
                              )}
                              {linked && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#5C1125] text-white">
                                  @{linked.username}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-600">
                              <span>{emp.jobTitle || 'Operario'}</span>
                              <span>&bull;</span>
                              <span className="font-bold text-[#000000]">
                                ${Number(emp.weeklySalary || 0).toLocaleString('es-MX')}/sem
                              </span>
                              {emp.hasAttendanceBonus && (
                                <>
                                  <span>&bull;</span>
                                  <span className="text-[#535B28] font-semibold">
                                    Bono ${emp.defaultBonusAmount || 150}
                                  </span>
                                </>
                              )}
                              {Number(emp.loanBalance || 0) > 0 && (
                                <>
                                  <span>&bull;</span>
                                  <span className="text-[#5C1125] font-bold">
                                    Préstamo: ${Number(emp.loanBalance).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </span>
                                </>
                              )}
                              {emp.phone && (
                                <>
                                  <span>&bull;</span>
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-stone-400" />
                                    {emp.phone}
                                  </span>
                                </>
                              )}
                            </div>

                            {isBaja && emp.terminationReason && (
                              <p className="text-[11px] text-rose-700 italic">
                                Motivo de baja: {emp.terminationReason}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                          {linked && !isBaja && (
                            <button
                              type="button"
                              onClick={() =>
                                openWhatsAppModal({
                                  fullName: emp.fullName,
                                  phone: emp.phone || linked.phone || '',
                                  username: linked.username,
                                  password: linked.password,
                                  role: linked.role,
                                })
                              }
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] text-xs font-bold border border-[#25D366]/40 transition cursor-pointer"
                              title="Compartir credenciales por WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleLoadEdit(emp)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] text-xs font-bold border border-[#ebccd4] transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{linked ? 'Editar' : 'Editar / Clave'}</span>
                          </button>

                          {!isBaja ? (
                            <button
                              type="button"
                              onClick={() => {
                                setBajaTargetId(emp.id);
                                setBajaReason('');
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 transition cursor-pointer"
                              title="Dar de baja al empleado"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Dar de Baja</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivate(emp)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f7f8f2] hover:bg-[#dce4bf] text-[#535B28] text-xs font-bold border border-[#dce4bf] transition cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Reactivar</span>
                            </button>
                          )}

                          {confirmDeleteId === emp.id ? (
                            <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
                              <button
                                type="button"
                                onClick={() => handlePermanentDelete(emp.id)}
                                className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                              >
                                Borrar
                              </button>
                              <span className="text-stone-300">|</span>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[11px] text-stone-500 hover:underline cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(emp.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                              title="Eliminar definitivamente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Baja confirmation */}
                      {bajaTargetId === emp.id && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <div className="flex-1">
                            <p className="text-xs font-bold text-amber-900">
                              Confirmar baja de {emp.fullName}
                              {emp.linkedUserId ? ' (se bloqueará también su acceso al sistema)' : ''}
                            </p>
                            <input
                              type="text"
                              value={bajaReason}
                              onChange={(e) => setBajaReason(e.target.value)}
                              placeholder="Motivo de baja (opcional, ej. Renuncia voluntaria, fin de temporada)..."
                              className="mt-1.5 w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleConfirmBaja(emp)}
                              className="px-3 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold hover:bg-[#430c1b] cursor-pointer"
                            >
                              Confirmar Baja
                            </button>
                            <button
                              type="button"
                              onClick={() => setBajaTargetId(null)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-600 text-xs font-semibold hover:bg-stone-100 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Unlinked System Users (Aaron, David, Admins) — quick WhatsApp share */}
          {unlinkedSystemUsers.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#5C1125]" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#000000]">
                      Otras Credenciales del Sistema (Compartir por WhatsApp)
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Cuentas de acceso existentes ({unlinkedSystemUsers.length}) listas para enviar por WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-stone-100">
                {unlinkedSystemUsers.map((u) => (
                  <div
                    key={u.id}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FAF8F5]/60"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-[#000000]">
                          {u.fullName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            u.role === 'admin'
                              ? 'bg-[#5C1125] text-white'
                              : 'bg-[#535B28] text-white'
                          }`}
                        >
                          {u.role === 'admin' ? 'Admin' : 'Producción'}
                        </span>
                        {currentUser?.id === u.id && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C3A25D]/20 text-[#8a6d2b]">
                            Tú
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500">
                        Usuario: <strong className="text-stone-700">@{u.username}</strong>
                        {u.phone ? ` • Tel: ${u.phone}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openWhatsAppModal({
                          fullName: u.fullName,
                          phone: u.phone || '',
                          username: u.username,
                          password: u.password,
                          role: u.role,
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] text-xs font-bold border border-[#25D366]/40 transition cursor-pointer self-end sm:self-center"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Enviar por WhatsApp</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Share Credentials Modal */}
      {whatsappModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-5 py-4 bg-[#5C1125] text-white border-b border-[#3f0918]">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    Compartir Credenciales por WhatsApp
                  </h3>
                  <p className="text-[11px] text-[#d6be83]">{whatsappModal.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappModal(null)}
                className="p-1 rounded-lg text-stone-300 hover:text-white hover:bg-[#430c1b] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Número de WhatsApp (Opcional — si lo dejas vacío podrás elegir contacto en WhatsApp)
                </label>
                <input
                  type="tel"
                  value={waPhoneOverride}
                  onChange={(e) => setWaPhoneOverride(e.target.value)}
                  placeholder="Ej. 5512345678 (se agrega +52 automáticamente)"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Vista previa del mensaje
                </label>
                <pre className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200 text-xs text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">
                  {waMessageText}
                </pre>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <a
                  href={waLinkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#128C7E] hover:bg-[#0e7266] text-white text-xs sm:text-sm font-bold shadow-sm transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Abrir y Enviar en WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyWaMessage}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-200 text-[#000000] text-xs sm:text-sm font-bold border border-stone-300 transition cursor-pointer"
                >
                  {copiedWa ? (
                    <>
                      <Check className="w-4 h-4 text-[#535B28]" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#5C1125]" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
