import React, { useState } from 'react';
import {
  Tablet,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Scale,
  Activity,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { ROLES } from '../../types/greenhouse';

export const SystemView: React.FC = () => {
  const {
    activeView,
    isOnline,
    offlineQueue,
    syncOfflineQueue,
    auditLogs,
    modules,
    addHarvest,
    addIrrigation,
  } = useGreenhouse();

  // Field quick capture mode
  const [quickMode, setQuickMode] = useState<'corte' | 'riego'>('corte');
  const [fieldModule, setFieldModule] = useState(modules[0]?.code || 'M-01');
  const [tallyCount, setTallyCount] = useState<number>(0);
  const [phInputVal, setPhInputVal] = useState<string>('5.8');
  const [ecInputVal, setEcInputVal] = useState<string>('1.6');
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const handleQuickHarvestSubmit = () => {
    if (tallyCount <= 0) return;
    const pkgs = Math.floor(tallyCount / 25);
    addHarvest({
      id: `hrv-field-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      moduleId: modules.find((m) => m.code === fieldModule)?.id || 'mod-1',
      moduleCode: fieldModule,
      variety: 'Rosa Freedom',
      stemsCut: tallyCount,
      harvesterTeam: 'Captura Campo Táctil',
      stemsGrade40cm: 0,
      stemsGrade50cm: Math.round(tallyCount * 0.2),
      stemsGrade60cm: Math.round(tallyCount * 0.5),
      stemsGrade70cm: Math.round(tallyCount * 0.3),
      stemsGrade80cm: 0,
      stemsWaste: 0,
      wasteReason: 'Sin merma en corte directo',
      packages25Stems: pkgs,
      coldRoomCode: 'Cámara Fría #1',
      solutionTreatment: 'STS Básico',
      status: 'en_camara_fria',
    });

    setConfirmationNotice(`¡${tallyCount} tallos (${pkgs} bonches de 25) registrados en ${fieldModule}!`);
    setTallyCount(0);
    setTimeout(() => setConfirmationNotice(null), 3000);
  };

  const handleQuickIrrigationSubmit = () => {
    addIrrigation({
      id: `irg-field-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      moduleId: modules.find((m) => m.code === fieldModule)?.id || 'mod-1',
      moduleCode: fieldModule,
      sector: `Sector ${fieldModule.replace('M-0', '')}`,
      volumeM3: 10,
      durationMinutes: 30,
      phInput: parseFloat(phInputVal) || 5.8,
      phDrainage: 6.2,
      ecInput: parseFloat(ecInputVal) || 1.6,
      ecDrainage: 1.9,
      tensiometerCbar: 18,
      tankARecipe: 'Receta Automática A',
      tankBRecipe: 'Receta Automática B',
      operator: 'Operador en Campo',
    });

    setConfirmationNotice(`¡Lectura de pH ${phInputVal} y CE ${ecInputVal} guardada para ${fieldModule}!`);
    setTimeout(() => setConfirmationNotice(null), 3000);
  };

  const currentView =
    activeView === 'offline'
      ? 'offline'
      : activeView === 'auditoria'
      ? 'auditoria'
      : activeView === 'sensores'
      ? 'sensores'
      : 'campo';

  return (
    <div className="space-y-6">
      {/* System & Support Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-800">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Soporte Técnico, Tecnología & Operadores en Campo
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {currentView === 'offline'
              ? 'Sincronización & Almacenamiento Offline'
              : currentView === 'auditoria'
              ? 'Auditoría, Usuarios & Permisos RBAC'
              : currentView === 'sensores'
              ? 'Integración IoT, Sensores & Básculas Digitales'
              : 'Consola Táctil de Campo (Ergonomía Solar)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentView === 'offline'
              ? 'Gestión de registros almacenados localmente y sincronización con el servidor'
              : currentView === 'auditoria'
              ? 'Seguridad criptográfica, permisos por rol y bitácora inmutable de eventos'
              : currentView === 'sensores'
              ? 'Conexión a estaciones climáticas, tensiómetros Teros 12 y básculas de empaque'
              : 'Botones de alto contraste y respuesta táctil para operarios con guantes en surco'}
          </p>
        </div>

        {/* Online / Offline Sync badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-800">Conectado a Red</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-600" />
                <span className="text-amber-800">Modo Offline Activo</span>
              </>
            )}
          </div>

          {offlineQueue.length > 0 && (
            <button
              onClick={syncOfflineQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar ({offlineQueue.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. View: Consola Táctil de Campo */}
      {currentView === 'campo' && (
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Modo de Captura Rápida:
              </span>
            </div>

            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl">
              <button
                onClick={() => setQuickMode('corte')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  quickMode === 'corte' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Corte de Tallos
              </button>
              <button
                onClick={() => setQuickMode('riego')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  quickMode === 'riego' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Lectura pH/CE
              </button>
            </div>
          </div>

          {confirmationNotice && (
            <div className="p-3 bg-emerald-500/30 border border-emerald-400 rounded-xl text-xs sm:text-sm font-bold text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              {confirmationNotice}
            </div>
          )}

          {/* Module Selector Big Buttons */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-2">
              1. Selecciona el Invernadero / Módulo:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {modules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setFieldModule(m.code)}
                  className={`py-3 rounded-xl font-black text-sm transition-all border ${
                    fieldModule === m.code
                      ? 'bg-emerald-500 text-white border-emerald-300 shadow-lg scale-102'
                      : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
                  }`}
                >
                  {m.code}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Corte */}
          {quickMode === 'corte' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-white/10">
                <span className="text-xs font-bold text-slate-300 uppercase">Contador de Tallos:</span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-wider">
                  {tallyCount.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    ({Math.floor(tallyCount / 25)} paquetes de 25)
                  </span>
                </div>
              </div>

              {/* Big Numeric Bumpers */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {[+25, +50, +100, +250].map((inc) => (
                  <button
                    key={inc}
                    onClick={() => setTallyCount((prev) => prev + inc)}
                    className="py-4 bg-emerald-600/60 hover:bg-emerald-600 active:scale-95 text-white font-black text-lg rounded-xl border border-emerald-400/40 transition shadow-xs"
                  >
                    +{inc}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setTallyCount(0)}
                  className="py-3 px-5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Reiniciar
                </button>
                <button
                  onClick={handleQuickHarvestSubmit}
                  disabled={tallyCount === 0}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl transition shadow-lg"
                >
                  Guardar Corte de {tallyCount} Tallos en {fieldModule}
                </button>
              </div>
            </div>
          )}

          {/* Mode Riego & pH */}
          {quickMode === 'riego' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-black/30 p-4 rounded-xl border border-white/10 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">pH Entrada Gotero:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={phInputVal}
                      onChange={(e) => setPhInputVal(e.target.value)}
                      className="w-full text-2xl font-black bg-white/10 text-emerald-300 px-3 py-2 rounded-lg border border-white/20 text-center"
                    />
                    <span className="text-xs text-slate-400">(Meta: 5.8)</span>
                  </div>
                </div>

                <div className="bg-black/30 p-4 rounded-xl border border-white/10 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Conductividad CE (dS/m):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      value={ecInputVal}
                      onChange={(e) => setEcInputVal(e.target.value)}
                      className="w-full text-2xl font-black bg-white/10 text-emerald-300 px-3 py-2 rounded-lg border border-white/20 text-center"
                    />
                    <span className="text-xs text-slate-400">(Meta: 1.6)</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleQuickIrrigationSubmit}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm rounded-xl transition shadow-lg"
              >
                Registrar Lectura Nutricional en {fieldModule}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. View: Offline y Sincronización */}
      {currentView === 'offline' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Estado de Sincronización y Cola Local</h2>
              <p className="text-xs text-slate-500">
                Los datos se guardan en el dispositivo y se transmiten automáticamente
              </p>
            </div>
            <button
              onClick={syncOfflineQueue}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sincronizar Ahora</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="font-bold text-slate-900 text-xs block">Registros Pendientes en Cola</span>
                <span className="text-xs text-slate-500">
                  {offlineQueue.length === 0 ? 'Sin registros pendientes (100% sincronizado)' : `${offlineQueue.length} registros listos para enviar`}
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              {offlineQueue.length}
            </span>
          </div>
        </div>
      )}

      {/* 3. View: Auditoría y Roles */}
      {currentView === 'auditoria' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Control de Acceso Basado en Roles (RBAC)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ROLES.map((role) => (
                <div key={role.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <span className="text-xs font-bold text-slate-900 block">{role.title}</span>
                  <span className="text-[10px] text-slate-500 block">{role.badge}</span>
                  <span className="text-[10px] font-bold text-emerald-700 block">Acceso Acreditado</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Bitácora de Trazabilidad Técnica</h3>
            <div className="space-y-2">
              {auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-800 uppercase text-[10px] mr-2">[{log.userRole}]</span>
                    <strong className="text-slate-800">{log.action}</strong>
                    <p className="text-[11px] text-slate-500 mt-0.5">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                    {log.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. View: Sensores IoT y Básculas */}
      {currentView === 'sensores' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="p-2.5 bg-purple-50 text-purple-700 w-fit rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Sensores Climáticos en Naves</h3>
            <p className="text-xs text-slate-600">
              Integración con sensores de temperatura, humedad relativa y radiación solar en los módulos M-01 a M-06.
            </p>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block">
              Lectura en Tiempo Real Activa
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 w-fit rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Básculas de Empaque Digital</h3>
            <p className="text-xs text-slate-600">
              Pesaaje de paquetes de 25 tallos para certificar gramaje mínimo de exportación y calibración de tara.
            </p>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full inline-block">
              Puerto Serie / Bluetooth Activo
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 w-fit rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Integridad de Sensores</h3>
            <p className="text-xs text-slate-600">
              Verificación de continuidad en lecturas de pH y CE en cabezal de fertirrigación.
            </p>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full inline-block">
              Calibración al 100%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
