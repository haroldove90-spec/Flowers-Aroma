import React, { useState, useEffect, useRef } from 'react';
import {
  UserCog,
  Camera,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Mail,
  Phone,
  Briefcase,
  Building,
  User,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { getUserRoleDisplayInfo } from '../../types/greenhouse';

const compressAvatarImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 320;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height >= width && height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = () => reject(new Error('Archivo de imagen inválido'));
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
};

export const ProfileView: React.FC = () => {
  const {
    currentUser,
    activeRole,
    updateCurrentProfile,
    setActiveRole,
    setActiveView,
  } = useGreenhouse();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [notes, setNotes] = useState(currentUser?.notes || '');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser?.avatarUrl);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Only hydrate form fields when switching logged-in user (never clobber user typing during 15s polling)
  useEffect(() => {
    if (!currentUser) {
      loadedUserIdRef.current = null;
      return;
    }
    if (loadedUserIdRef.current !== currentUser.id) {
      loadedUserIdRef.current = currentUser.id;
      setFullName(currentUser.fullName || '');
      setUsername(currentUser.username || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setJobTitle(currentUser.jobTitle || '');
      setDepartment(currentUser.department || '');
      setNotes(currentUser.notes || '');
      setAvatarUrl(currentUser.avatarUrl);
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const initials = currentUser.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setErrorMsg(null);
      setIsSaving(true);
      const dataUrl = await compressAvatarImage(file);
      setAvatarUrl(dataUrl);
      const res = await updateCurrentProfile({ avatarUrl: dataUrl });
      if (res.ok) {
        if (res.cloudSynced) {
          setSuccessMsg('Fotografía de perfil guardada en Supabase.');
        } else {
          setErrorMsg(
            `Fotografía guardada localmente, pero no se sincronizó en Supabase: ${res.cloudError || 'Sin conexión'}`
          );
        }
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.error || 'No se pudo guardar la fotografía.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al cargar la fotografía.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setAvatarUrl(undefined);
    const res = await updateCurrentProfile({ avatarUrl: undefined });
    setIsSaving(false);
    if (res.ok && res.cloudSynced) {
      setSuccessMsg('Fotografía removida y actualizada en Supabase.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } else if (res.ok) {
      setErrorMsg(
        `Fotografía removida localmente. Pendiente en Supabase: ${res.cloudError || 'Sin conexión'}`
      );
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim() || !username.trim()) {
      setErrorMsg('El nombre completo y el usuario son obligatorios.');
      return;
    }

    const cleanEmail = email.trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Ingresa un correo electrónico válido (ej. nombre@dominio.com).');
      return;
    }

    let nextPassword = currentUser.password;
    if (newPassword || confirmPassword || currentPassword) {
      if (currentPassword !== currentUser.password) {
        setErrorMsg('La contraseña actual no coincide.');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('La confirmación de la nueva contraseña no coincide.');
        return;
      }
      nextPassword = newPassword;
    }

    setIsSaving(true);
    const res = await updateCurrentProfile({
      fullName: fullName.trim(),
      username: username.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      jobTitle: jobTitle.trim(),
      department: department.trim(),
      notes: notes.trim(),
      avatarUrl,
      password: nextPassword,
    });
    setIsSaving(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo actualizar el perfil.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    if (res.cloudSynced) {
      setSuccessMsg('Datos personales, correo y fotografía guardados en Supabase correctamente.');
    } else {
      setErrorMsg(
        `Guardado localmente, pero falló la subida a Supabase: ${res.cloudError || 'Sin conexión'}`
      );
    }
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Hero Banner */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-[#C3A25D]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-[#C3A25D]/40 flex items-center justify-center">
            <UserCog className="w-6 h-6 text-[#C3A25D]" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#C3A25D]">
              Módulo Perfil &bull;{' '}
              {activeRole === 'admin'
                ? 'Rol Admin'
                : activeRole === 'ventas'
                ? 'Rol Ventas'
                : activeRole === 'bitacora'
                ? 'Rol Bitácora'
                : getUserRoleDisplayInfo(currentUser).label}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Mi Perfil y Credenciales
            </h1>
            <p className="text-xs text-[#d6be83]">
              Modifica tu fotografía, datos personales y contraseña de acceso.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {getUserRoleDisplayInfo(currentUser).roleId === 'admin' && (
            <button
              type="button"
              onClick={() => {
                setActiveRole('admin');
                setActiveView('admin_panel');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C3A25D] text-[#000000] text-xs font-bold hover:bg-[#d6be83] transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Panel Admin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-[#f7f8f2] border border-[#dce4bf] text-[#535B28] text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-[#fbf2f4] border border-[#ebccd4] text-[#5C1125] text-xs sm:text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card: Photo & Role Summary */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-32 h-32 rounded-full object-cover border-4 border-[#C3A25D]/60 shadow-md"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-[#5C1125] text-white flex items-center justify-center text-3xl font-black border-4 border-[#C3A25D]/60 shadow-md">
                {initials || <User className="w-12 h-12" />}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 p-2.5 rounded-full bg-[#000000] text-[#C3A25D] hover:bg-[#5C1125] hover:text-white shadow-lg border border-white transition cursor-pointer"
              title="Cambiar fotografía"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-[#000000]">{fullName || currentUser.fullName}</h2>
            <p className="text-xs font-semibold text-stone-500">@{username || currentUser.username}</p>
            <span
              className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                getUserRoleDisplayInfo(currentUser).roleId === 'admin'
                  ? 'bg-[#fbf2f4] text-[#5C1125] border border-[#ebccd4]'
                  : getUserRoleDisplayInfo(currentUser).roleId === 'ventas'
                  ? 'bg-[#fcfaf4] text-[#8a6d2b] border border-[#C3A25D]/60'
                  : 'bg-[#f7f8f2] text-[#535B28] border border-[#dce4bf]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {getUserRoleDisplayInfo(currentUser).label}
            </span>
          </div>

          <div className="w-full pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 border border-stone-300 text-xs font-bold text-[#5C1125] flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#C3A25D]" />
              <span>Subir / Cambiar Fotografía</span>
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar Fotografía</span>
              </button>
            )}
          </div>

          <div className="w-full pt-3 border-t border-stone-100 text-[11px] text-stone-500 text-left space-y-1">
            <p>
              <strong>Alta:</strong> {currentUser.createdAt}
            </p>
            {currentUser.updatedAt && (
              <p>
                <strong>Última edición:</strong>{' '}
                {Number.isNaN(Date.parse(currentUser.updatedAt))
                  ? currentUser.updatedAt
                  : new Date(currentUser.updatedAt).toLocaleString('es-MX')}
              </p>
            )}
          </div>
        </div>

        {/* Right Form: Personal Info & Password */}
        <form
          noValidate
          onSubmit={handleSaveProfile}
          className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-5"
        >
          <div>
            <h3 className="text-sm font-extrabold text-[#5C1125] uppercase tracking-wider mb-3">
              Datos Personales
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nombre Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Usuario de Acceso
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@aromaflower.com"
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Teléfono / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 55 1234 5678"
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Puesto / Cargo
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ej. Supervisor de Corte"
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Área / Departamento
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ej. Invernadero Norte"
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Notas Personales / Biografía
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Información adicional de contacto o funciones..."
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-stone-200">
            <h3 className="text-sm font-extrabold text-[#535B28] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              <span>Cambiar Contraseña (Opcional)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  Confirmar Nueva
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir contraseña"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-sm font-bold shadow-md transition cursor-pointer border border-[#C3A25D]/40 disabled:opacity-60"
            >
              <Save className="w-4 h-4 text-[#C3A25D]" />
              <span>{isSaving ? 'Guardando en Supabase...' : 'Guardar Cambios de Perfil'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
