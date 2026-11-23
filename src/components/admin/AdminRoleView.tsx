import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  PackageCheck,
  Users,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  UserCog,
  KeyRound,
  Eye,
  EyeOff,
  Boxes,
  Layers,
  TrendingUp,
  Wallet,
  Truck,
  Sprout,
  Calculator,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { AppUser, AppUserRole } from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
  exportAllAdminRecordsExcel,
  exportAllAdminRecordsPdf,
} from '../../utils/exportReports';

export const AdminRoleView: React.FC = () => {
  const {
    currentUser,
    appUsers,
    saveAppUser,
    deleteAppUser,
    aromaProducts,
    dailyProductions,
    dailySales,
    payrollEmployees,
    payrollWeeks,
    supplierPayments,
    setActiveRole,
    setActiveView,
  } = useGreenhouse();

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppUserRole>('produccion');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [active, setActive] = useState(true);
  const [showPass, setShowPass] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const todayEntries = dailyProductions.filter((d) => d.productionDate === today);
    const totalHoy = todayEntries.reduce((acc, d) => acc + Number(d.grandTotal || 0), 0);
    const totalProductos = aromaProducts.filter((p) => p.active !== false).length;
    const totalAdmins = appUsers.filter((u) => u.role === 'admin' && u.active !== false).length;
    const totalProd = appUsers.filter((u) => u.role === 'produccion' && u.active !== false).length;
    const activeEmployees = payrollEmployees.filter((e) => e.active !== false).length;
    const totalLoanPending = payrollEmployees
      .filter((e) => e.active !== false)
      .reduce((acc, e) => acc + Number(e.loanBalance || 0), 0);
    const lastWeekTotal = payrollWeeks[0]?.grandTotalPay || 0;
    const pendingSuppliers = supplierPayments
      .filter((s) => s.status !== 'pagado')
      .reduce((acc, s) => acc + Math.max(0, Number(s.amount || 0) - Number(s.paidAmount || 0)), 0);
    return {
      totalHoy,
      empleadosHoy: todayEntries.length,
      totalProductos,
      totalAdmins,
      totalProd,
      activeEmployees,
      totalLoanPending,
      lastWeekTotal,
      pendingSuppliers,
    };
  }, [dailyProductions, aromaProducts, appUsers, payrollEmployees, payrollWeeks, supplierPayments, today]);

  const resetForm = () => {
    setEditingUserId(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setRole('produccion');
    setJobTitle('');
    setDepartment('');
    setActive(true);
  };

  const handleLoadEdit = (u: AppUser) => {
    setEditingUserId(u.id);
    setFullName(u.fullName);
    setUsername(u.username);
    setPassword(u.password);
    setRole(u.role);
    setJobTitle(u.jobTitle || '');
    setDepartment(u.department || '');
    setActive(u.active !== false);
    setErrorMsg(null);
  };

  const [isSavingUser, setIsSavingUser] = useState(false);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    setIsSavingUser(true);
    const res = await saveAppUser(
      {
        fullName,
        username,
        password,
        role,
        jobTitle,
        department,
        active,
      },
      editingUserId || undefined
    );
    setIsSavingUser(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo guardar el usuario.');
      return;
    }

    if (res.cloudSynced) {
      setFeedback(
        editingUserId
          ? `Usuario "${username}" actualizado y guardado en Supabase.`
          : `Usuario "${username}" creado (${role.toUpperCase()}) y guardado en Supabase.`
      );
    } else {
      setErrorMsg(
        `Usuario guardado localmente, pero pendiente en Supabase: ${res.cloudError || 'Sin conexión'}`
      );
    }
    resetForm();
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleDeleteUser = async (id: string) => {
    const res = await deleteAppUser(id);
    setConfirmDeleteId(null);
    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo eliminar.');
      return;
    }
    setFeedback('Usuario eliminado del sistema y de Supabase.');
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Admin Hero Banner */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-[#C3A25D]/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AromaFlowersLogo size="lg" className="shrink-0" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C3A25D]">
                  Rol Administrador &bull; Acceso Dual
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#535B28] text-white">
                  Admin + Producción
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                Panel General de Administración
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                Sesión activa: <strong className="text-white">{currentUser?.fullName}</strong> (@{currentUser?.username})
              </p>
            </div>
          </div>

          {/* Direct module buttons inside Admin + switch to Producción */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('admin_pagos')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>Pagos y Nómina</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('admin_empleados')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer border border-[#C3A25D]/40"
            >
              <Users className="w-4 h-4 text-[#C3A25D]" />
              <span>Empleados ({kpis.activeEmployees})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('produccion_dia')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer border border-[#C3A25D]/40"
            >
              <Layers className="w-4 h-4 text-[#C3A25D]" />
              <span>Producción e Inventario</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('ventas_operacion')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-bold border border-[#C3A25D]/40 transition cursor-pointer"
            >
              <Truck className="w-4 h-4 text-[#C3A25D]" />
              <span>Ventas y Remisiones</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('admin_insumos')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/15 transition cursor-pointer"
            >
              <Sprout className="w-4 h-4 text-[#C3A25D]" />
              <span>Insumos y Aplicaciones</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('admin_costos')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/15 transition cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-[#C3A25D]" />
              <span>Costos y Utilidad</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('admin_productos')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/15 transition cursor-pointer"
            >
              <Boxes className="w-4 h-4 text-[#C3A25D]" />
              <span>Productos ({kpis.totalProductos})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveRole('produccion');
                setActiveView('produccion_dia');
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/15 transition cursor-pointer"
            >
              <PackageCheck className="w-4 h-4 text-[#C3A25D]" />
              <span>Rol Producción</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveView('mi_perfil')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/15 transition cursor-pointer"
            >
              <UserCog className="w-4 h-4 text-[#C3A25D]" />
              <span>Mi Perfil</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setActiveView('produccion_dia')}
          className="text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#5C1125] shadow-xs transition cursor-pointer"
        >
          <span className="text-[11px] font-bold text-[#5C1125] uppercase tracking-wider">
            Producción Hoy
          </span>
          <p className="mt-1 text-2xl font-black text-[#000000]">
            {kpis.totalHoy.toLocaleString()}
          </p>
          <span className="text-[10px] text-stone-500">
            {kpis.empleadosHoy} empleado(s) hoy
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('admin_pagos')}
          className="text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#C3A25D] shadow-xs transition cursor-pointer"
        >
          <span className="text-[11px] font-bold text-[#8a6d2b] uppercase tracking-wider">
            Última Nómina
          </span>
          <p className="mt-1 text-2xl font-black text-[#000000]">
            ${kpis.lastWeekTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-stone-500">
            Préstamos: ${kpis.totalLoanPending.toLocaleString('es-MX', { minimumFractionDigits: 2 })} &bull; Prov. pend: ${kpis.pendingSuppliers.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('admin_empleados')}
          className="text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#535B28] shadow-xs transition cursor-pointer"
        >
          <span className="text-[11px] font-bold text-[#535B28] uppercase tracking-wider">
            Empleados Activos
          </span>
          <p className="mt-1 text-2xl font-black text-[#000000]">{kpis.activeEmployees}</p>
          <span className="text-[10px] text-stone-500">
            Alta, bajas, credenciales y WhatsApp
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('admin_productos')}
          className="text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#5C1125] shadow-xs transition cursor-pointer"
        >
          <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
            Productos / Cuentas
          </span>
          <p className="mt-1 text-2xl font-black text-[#000000]">
            {kpis.totalProductos} <span className="text-sm font-bold text-stone-400">/ {kpis.totalAdmins + kpis.totalProd}</span>
          </p>
          <span className="text-[10px] text-stone-500">
            {kpis.totalAdmins} Admin &bull; {kpis.totalProd} Producción
          </span>
        </button>
      </div>

      {/* Export All Admin Records Bar (Excel & PDF) */}
      <div className="bg-white rounded-2xl border border-[#C3A25D]/40 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
            Exportar Todos los Registros (Admin)
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Descarga el historial completo de producción ({dailyProductions.length} planillas), ventas ({dailySales.length} reg.), consolidados por fecha, catálogo y usuarios en Excel o PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              exportAllAdminRecordsExcel(dailyProductions, aromaProducts, appUsers, dailySales);
              setFeedback('Archivo Excel (.xlsx) con todos los registros descargado.');
              setTimeout(() => setFeedback(null), 3500);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#C3A25D]" />
            <span>Exportar Todo en Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exportAllAdminRecordsPdf(dailyProductions, aromaProducts, appUsers, dailySales);
              setFeedback('Archivo PDF con todos los registros descargado.');
              setTimeout(() => setFeedback(null), 3500);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#C3A25D]" />
            <span>Exportar Todo en PDF</span>
          </button>
        </div>
      </div>

      {/* User & Credential Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Create / Edit User */}
        <form
          onSubmit={handleSaveUser}
          className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#5C1125]" />
              <h2 className="text-sm font-extrabold text-[#000000]">
                {editingUserId ? 'Editar Credencial' : 'Nueva Credencial de Acceso'}
              </h2>
            </div>
            {editingUserId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-[#5C1125] hover:underline cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>

          {feedback && (
            <div className="p-2.5 rounded-xl bg-[#f7f8f2] border border-[#dce4bf] text-[#535B28] text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-[#fbf2f4] border border-[#ebccd4] text-[#5C1125] text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Nombre Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. Harold Anguiano Morales"
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. haroldo90"
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-3 pr-9 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#5C1125]"
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
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Rol Asignado</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppUserRole)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] bg-white focus:ring-2 focus:ring-[#5C1125]"
            >
              <option value="admin">Admin (Acceso a Admin + Producción + Perfil)</option>
              <option value="produccion">Producción (Acceso a Producción + Perfil)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Cargo</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ej. Supervisor"
                className="w-full px-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Área</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ej. Empaque"
                className="w-full px-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-stone-300 text-[#5C1125] focus:ring-[#5C1125]"
            />
            <span>Usuario activo (puede iniciar sesión)</span>
          </label>

          <button
            type="submit"
            disabled={isSavingUser}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
          >
            <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
            <span>
              {isSavingUser
                ? 'Guardando en Supabase...'
                : editingUserId
                ? 'Actualizar Usuario'
                : 'Guardar Credencial'}
            </span>
          </button>
        </form>

        {/* Table: Registered Users */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#5C1125]" />
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
                  Usuarios y Credenciales del Sistema
                </h2>
                <p className="text-[11px] text-stone-500">
                  Sincronizado con la tabla <code className="font-mono">app_users</code> en Supabase.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#fbf2f4] text-[#5C1125] text-xs font-bold border border-[#ebccd4]">
              {appUsers.length} usuarios
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {appUsers.map((u) => {
              const isSelf = currentUser?.id === u.id;
              return (
                <div
                  key={u.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/70 transition"
                >
                  <div className="flex items-center gap-3">
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt={u.fullName}
                        className="w-11 h-11 rounded-full object-cover border border-[#C3A25D]"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#5C1125]/10 text-[#5C1125] font-extrabold text-sm flex items-center justify-center border border-[#5C1125]/20">
                        {u.fullName
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p) => p[0].toUpperCase())
                          .join('')}
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-[#000000]">{u.fullName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            u.role === 'admin'
                              ? 'bg-[#5C1125] text-white'
                              : 'bg-[#535B28] text-white'
                          }`}
                        >
                          {u.role === 'admin' ? 'Admin' : 'Producción'}
                        </span>
                        {u.active === false && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                            Inactivo
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C3A25D]/20 text-[#8a6d2b]">
                            Tú
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Usuario: <strong className="text-stone-700">{u.username}</strong>
                        {u.jobTitle ? ` • ${u.jobTitle}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleLoadEdit(u)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] text-xs font-bold border border-[#ebccd4] transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {!isSelf &&
                      (confirmDeleteId === u.id ? (
                        <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                          >
                            Confirmar
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
                          onClick={() => setConfirmDeleteId(u.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
