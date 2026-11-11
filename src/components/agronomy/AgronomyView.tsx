import React, { useState } from 'react';
import {
  Sprout,
  Droplet,
  ShieldAlert,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  FlaskConical,
  Activity,
  Calendar,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { CulturalTask, IrrigationLog, PestMonitoring, PhytosanitaryApplication } from '../../types/greenhouse';

export const AgronomyView: React.FC = () => {
  const {
    activeView,
    modules,
    tasks,
    irrigation,
    pestMonitoring,
    applications,
    addTask,
    updateTask,
    addIrrigation,
    addPestMonitoring,
    addApplication,
  } = useGreenhouse();

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showIrrigationModal, setShowIrrigationModal] = useState(false);
  const [showMonitoringModal, setShowMonitoringModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);

  // Task form
  const [taskModule, setTaskModule] = useState(modules[0]?.code || 'M-01');
  const [taskType, setTaskType] = useState<CulturalTask['taskType']>('tutoreo');
  const [taskName, setTaskName] = useState('');
  const [taskTeam, setTaskTeam] = useState('Cuadrilla A');
  const [taskBeds, setTaskBeds] = useState('38');

  // Irrigation form
  const [irgModule, setIrgModule] = useState(modules[0]?.code || 'M-01');
  const [irgVolume, setIrgVolume] = useState('14.0');
  const [irgDuration, setIrgDuration] = useState('45');
  const [irgPhIn, setIrgPhIn] = useState('5.8');
  const [irgPhOut, setIrgPhOut] = useState('6.2');
  const [irgEcIn, setIrgEcIn] = useState('1.65');
  const [irgEcOut, setIrgEcOut] = useState('1.95');
  const [irgTensiometer, setIrgTensiometer] = useState('18');
  const [irgTankA, setIrgTankA] = useState('Nitrato de Calcio (40kg) + Fe-EDDHA (1kg)');
  const [irgTankB, setIrgTankB] = useState('Fosfato Monopotásico (18kg) + Sulfato de Mg (22kg)');

  // Monitoring form
  const [monModule, setMonModule] = useState(modules[0]?.code || 'M-01');
  const [monPest, setMonPest] = useState<PestMonitoring['pestName']>('Araña Roja (Tetranychus)');
  const [monSeverity, setMonSeverity] = useState<PestMonitoring['severity']>('media');
  const [monIncidence, setMonIncidence] = useState('7.5');
  const [monNotes, setMonNotes] = useState('');

  // Application form
  const [appModule, setAppModule] = useState(modules[0]?.code || 'M-01');
  const [appTarget, setAppTarget] = useState('Araña Roja (Tetranychus)');
  const [appProduct, setAppProduct] = useState('Abamectina 1.8% EC');
  const [appIngredient, setAppIngredient] = useState('Abamectina');
  const [appDose, setAppDose] = useState('75 ml / 100L');
  const [appVolume, setAppVolume] = useState('800');
  const [appReentry, setAppReentry] = useState('24');
  const [appCost, setAppCost] = useState('1850');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const newTask: CulturalTask = {
      id: `tsk-${Date.now()}`,
      moduleId: modules.find((m) => m.code === taskModule)?.id || 'mod-1',
      moduleCode: taskModule,
      taskType,
      taskName: taskName.trim() || `Labor de ${taskType} en ${taskModule}`,
      date: new Date().toISOString().slice(0, 10),
      assignedTeam: taskTeam,
      scheduledBeds: parseInt(taskBeds) || 30,
      executedBeds: 0,
      status: 'pendiente',
    };
    addTask(newTask);
    setShowTaskModal(false);
  };

  const handleCreateIrrigation = (e: React.FormEvent) => {
    e.preventDefault();
    const newLog: IrrigationLog = {
      id: `irg-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      moduleId: modules.find((m) => m.code === irgModule)?.id || 'mod-1',
      moduleCode: irgModule,
      sector: `Sector ${irgModule.replace('M-0', '')}`,
      volumeM3: parseFloat(irgVolume) || 12,
      durationMinutes: parseInt(irgDuration) || 40,
      phInput: parseFloat(irgPhIn) || 5.8,
      phDrainage: parseFloat(irgPhOut) || 6.2,
      ecInput: parseFloat(irgEcIn) || 1.6,
      ecDrainage: parseFloat(irgEcOut) || 1.9,
      tensiometerCbar: parseInt(irgTensiometer) || 18,
      tankARecipe: irgTankA,
      tankBRecipe: irgTankB,
      operator: 'Mateo Rangel',
    };
    addIrrigation(newLog);
    setShowIrrigationModal(false);
  };

  const handleCreateMonitoring = (e: React.FormEvent) => {
    e.preventDefault();
    const newMon: PestMonitoring = {
      id: `pst-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      moduleId: modules.find((m) => m.code === monModule)?.id || 'mod-1',
      moduleCode: monModule,
      section: 'Camas centrales',
      pestName: monPest,
      severity: monSeverity,
      incidencePercent: parseFloat(monIncidence) || 5,
      status: monSeverity === 'alta' || monSeverity === 'critica' ? 'requiere_aplicacion' : 'vigilancia',
      notes: monNotes || 'Monitoreo de rutina registrado',
    };
    addPestMonitoring(newMon);
    setShowMonitoringModal(false);
  };

  const handleCreateApplication = (e: React.FormEvent) => {
    e.preventDefault();
    const newApp: PhytosanitaryApplication = {
      id: `app-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      moduleId: modules.find((m) => m.code === appModule)?.id || 'mod-1',
      moduleCode: appModule,
      targetPest: appTarget,
      productName: appProduct,
      activeIngredient: appIngredient,
      dosePer100L: appDose,
      waterVolumeLiters: parseInt(appVolume) || 800,
      treatedAreaM2: 5000,
      operator: 'Juan Pablo Ortiz',
      safetyEquipment: 'Overol Tyvek, Mascarilla con filtros ABEK1P3, Guantes nitrilo',
      reentryHours: parseInt(appReentry) || 24,
      costTotal: parseFloat(appCost) || 1500,
      status: 'aplicada',
      efficacyPercent: 95,
    };
    addApplication(newApp);
    setShowAppModal(false);
  };

  // Determine current active view from sidebar without duplicate horizontal tabs
  const currentView = activeView === 'riego' ? 'riego' : activeView === 'sanidad' ? 'sanidad' : 'labores';

  return (
    <div className="space-y-6">
      {/* Agronomy Header (Clean, without horizontal duplicate tab bar) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Ingeniería Agronómica & Sanidad Vegetal
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {currentView === 'riego'
              ? 'Riego, Fertirrigación & Nutrición Vegetal'
              : currentView === 'sanidad'
              ? 'Sanidad Vegetal & Control Fitosanitario'
              : 'Labores Culturales & Manejo del Cultivo'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentView === 'riego'
              ? 'Monitoreo de pH, CE de drenaje, tensiómetros en cbars y tanques concentrados A y B'
              : currentView === 'sanidad'
              ? 'Monitoreo de plagas, severidad, recetas fitosanitarias y periodos de reingreso'
              : 'Tutoreo, desahije, desbotonado/pinch, poda, toque de hoja y avance de camas'}
          </p>
        </div>

        {/* Action Button for Current View */}
        <div>
          {currentView === 'labores' && (
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Programar Labor</span>
            </button>
          )}

          {currentView === 'riego' && (
            <button
              onClick={() => setShowIrrigationModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Riego & Nutrición</span>
            </button>
          )}

          {currentView === 'sanidad' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMonitoringModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Monitorear Plaga</span>
              </button>
              <button
                onClick={() => setShowAppModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-semibold transition border border-slate-200"
              >
                <FlaskConical className="w-4 h-4 text-emerald-600" />
                <span>Aplicación Fitosanitaria</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. View: Labores Culturales */}
      {currentView === 'labores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Programación y Avance de Labores en Módulos ({tasks.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((t) => {
              const progressPct = t.scheduledBeds > 0 ? Math.round((t.executedBeds / t.scheduledBeds) * 100) : 0;
              return (
                <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {t.moduleCode} • {t.taskType}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        t.status === 'completado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'en_progreso'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">{t.taskName}</h3>
                  <p className="text-[11px] text-slate-500">Asignado a: {t.assignedTeam} ({t.date})</p>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                      <span>Camas: {t.executedBeds} / {t.scheduledBeds}</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {t.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {t.notes}
                    </p>
                  )}

                  {t.status !== 'completado' && (
                    <button
                      onClick={() =>
                        updateTask({
                          ...t,
                          executedBeds: t.scheduledBeds,
                          status: 'completado',
                        })
                      }
                      className="w-full py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                    >
                      Marcar 100% Completado
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. View: Riego & Fertirrigación */}
      {currentView === 'riego' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block font-medium">Volumen Total Aplicado</span>
              <span className="text-xl font-black text-blue-700 mt-1 block">
                {irrigation.reduce((acc, i) => acc + i.volumeM3, 0).toFixed(1)} m³
              </span>
              <span className="text-[10px] text-slate-400">En todos los sectores</span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block font-medium">pH Promedio Entrada</span>
              <span className="text-xl font-black text-emerald-800 mt-1 block">5.8</span>
              <span className="text-[10px] text-emerald-700 font-semibold">Rango óptimo para Rosa</span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block font-medium">Conductividad CE</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">1.65 dS/m</span>
              <span className="text-[10px] text-slate-400">Drenaje en 1.95 dS/m</span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block font-medium">Tensiómetros Suelo</span>
              <span className="text-xl font-black text-emerald-800 mt-1 block">18 cbars</span>
              <span className="text-[10px] text-slate-400">Capacidad de campo</span>
            </div>
          </div>

          <div className="space-y-3">
            {irrigation.map((irg) => (
              <div
                key={irg.id}
                className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {irg.moduleCode}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{irg.sector}</span>
                    <span className="text-xs text-slate-400">({irg.date} a las {irg.time})</span>
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    Volumen: <strong className="text-blue-700">{irg.volumeM3} m³</strong> en {irg.durationMinutes} min
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">pH Entrada / Drenaje</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {irg.phInput} <span className="text-slate-400 font-normal">➔</span> {irg.phDrainage}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">CE Entrada / Drenaje</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {irg.ecInput} <span className="text-slate-400 font-normal">➔</span> {irg.ecDrainage} dS/m
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Tensiómetro Suelo</span>
                    <span className="font-bold text-emerald-800 text-sm">
                      {irg.tensiometerCbar} cbars (Óptimo)
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Operador Cabezal</span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">{irg.operator}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <p><strong>Tanque A (Calcio / Nitrógeno):</strong> {irg.tankARecipe}</p>
                  <p><strong>Tanque B (Fósforo / Potasio / Magnesio):</strong> {irg.tankBRecipe}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. View: Sanidad Vegetal */}
      {currentView === 'sanidad' && (
        <div className="space-y-5">
          {/* Monitoreo Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-500">
              Monitoreo Activo de Plagas y Enfermedades
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pestMonitoring.map((pm) => (
                <div
                  key={pm.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {pm.moduleCode} • {pm.section}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">{pm.pestName}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                        pm.severity === 'alta' || pm.severity === 'critica'
                          ? 'bg-rose-100 text-rose-800'
                          : pm.severity === 'media'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      Severidad: {pm.severity} ({pm.incidencePercent}%)
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {pm.notes}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Fecha: {pm.date}</span>
                    <span className="font-semibold text-emerald-700 capitalize">Estado: {pm.status.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aplicaciones Fitosanitarias Realizadas */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-500">
              Aplicaciones Fitosanitarias y Tratamientos Ejecutados
            </h3>
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-emerald-800 text-sm">
                      {app.moduleCode} • {app.productName}
                    </span>
                    <span className="font-bold text-slate-900">
                      Costo: ${app.costTotal.toLocaleString()} MXN
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
                    <div><span className="text-slate-400 block text-[10px]">Blanco Biológico:</span> {app.targetPest}</div>
                    <div><span className="text-slate-400 block text-[10px]">Ingrediente Activo:</span> {app.activeIngredient}</div>
                    <div><span className="text-slate-400 block text-[10px]">Dosis / 100L:</span> {app.dosePer100L}</div>
                    <div><span className="text-slate-400 block text-[10px]">Reingreso Seguro:</span> {app.reentryHours} horas</div>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
                    <span>Aplicador: {app.operator} (EPI completo)</span>
                    <span className="text-emerald-700 font-bold">Eficacia Evaluada: {app.efficacyPercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Programar Labor */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs text-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Programar Labor Cultural
            </h3>
            <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Módulo</label>
                <select
                  value={taskModule}
                  onChange={(e) => setTaskModule(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.code}>
                      {m.code} - {m.name} ({m.variety})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Labor</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="tutoreo">Tutoreo / Elevación de mallas</option>
                  <option value="desahije">Desahije / Raleo basal</option>
                  <option value="desbotonado_pinch">Desbotonado (Pinch lateral)</option>
                  <option value="toque_hoja">Toque de hoja / Defoliación</option>
                  <option value="poda">Poda de renovación</option>
                  <option value="desmalezado">Desmalezado manual de pasillos</option>
                  <option value="manejo_cortinas">Manejo de cortinas climáticas</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre Descriptivo</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Desbotonado lateral en botón principal"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cuadrilla Asignada</label>
                  <input
                    type="text"
                    value={taskTeam}
                    onChange={(e) => setTaskTeam(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Camas Programadas</label>
                  <input
                    type="number"
                    value={taskBeds}
                    onChange={(e) => setTaskBeds(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                >
                  Guardar Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Riego */}
      {showIrrigationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs text-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Registrar Evento de Fertirrigación
            </h3>
            <form onSubmit={handleCreateIrrigation} className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Módulo</label>
                  <select
                    value={irgModule}
                    onChange={(e) => setIrgModule(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {modules.map((m) => (
                      <option key={m.id} value={m.code}>{m.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Volumen (m³)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={irgVolume}
                    onChange={(e) => setIrgVolume(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duración (min)</label>
                  <input
                    type="number"
                    value={irgDuration}
                    onChange={(e) => setIrgDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">pH Entrada</label>
                  <input
                    type="number"
                    step="0.1"
                    value={irgPhIn}
                    onChange={(e) => setIrgPhIn(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">pH Drenaje</label>
                  <input
                    type="number"
                    step="0.1"
                    value={irgPhOut}
                    onChange={(e) => setIrgPhOut(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CE Entrada</label>
                  <input
                    type="number"
                    step="0.05"
                    value={irgEcIn}
                    onChange={(e) => setIrgEcIn(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tensiómetro</label>
                  <input
                    type="number"
                    value={irgTensiometer}
                    onChange={(e) => setIrgTensiometer(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receta Tanque A (Calcio / N)</label>
                <input
                  type="text"
                  value={irgTankA}
                  onChange={(e) => setIrgTankA(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receta Tanque B (P / K / Mg)</label>
                <input
                  type="text"
                  value={irgTankB}
                  onChange={(e) => setIrgTankB(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIrrigationModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                >
                  Guardar Lectura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Monitoreo */}
      {showMonitoringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs text-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Registrar Monitoreo Fitosanitario
            </h3>
            <form onSubmit={handleCreateMonitoring} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Módulo</label>
                <select
                  value={monModule}
                  onChange={(e) => setMonModule(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.code}>{m.code} - {m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plaga o Enfermedad</label>
                <select
                  value={monPest}
                  onChange={(e) => setMonPest(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="Araña Roja (Tetranychus)">Araña Roja (Tetranychus urticae)</option>
                  <option value="Trips (Frankliniella)">Trips (Frankliniella occidentalis)</option>
                  <option value="Oídio / Cenicilla">Oídio / Cenicilla (Podosphaera)</option>
                  <option value="Botrytis">Botrytis cinerea (Moho gris)</option>
                  <option value="Mosca Blanca">Mosca Blanca (Bemisia tabaci)</option>
                  <option value="Pulgón">Pulgón (Macrosiphum)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Severidad</label>
                  <select
                    value={monSeverity}
                    onChange={(e) => setMonSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Incidencia (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={monIncidence}
                    onChange={(e) => setMonIncidence(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={monNotes}
                  onChange={(e) => setMonNotes(e.target.value)}
                  placeholder="Focos detectados, condiciones ambientales..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMonitoringModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                >
                  Guardar Monitoreo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Aplicación Fitosanitaria */}
      {showAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs text-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Programar Aplicación Fitosanitaria
            </h3>
            <form onSubmit={handleCreateApplication} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Módulo</label>
                <select
                  value={appModule}
                  onChange={(e) => setAppModule(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.code}>{m.code} - {m.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plaga Objetivo</label>
                  <input
                    type="text"
                    value={appTarget}
                    onChange={(e) => setAppTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Producto Comercial</label>
                  <input
                    type="text"
                    value={appProduct}
                    onChange={(e) => setAppProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ingrediente Activo</label>
                  <input
                    type="text"
                    value={appIngredient}
                    onChange={(e) => setAppIngredient(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dosis por 100L</label>
                  <input
                    type="text"
                    value={appDose}
                    onChange={(e) => setAppDose(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Caldo Total (L)</label>
                  <input
                    type="number"
                    value={appVolume}
                    onChange={(e) => setAppVolume(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reingreso (hrs)</label>
                  <input
                    type="number"
                    value={appReentry}
                    onChange={(e) => setAppReentry(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Costo ($ MXN)</label>
                  <input
                    type="number"
                    value={appCost}
                    onChange={(e) => setAppCost(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAppModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                >
                  Guardar Aplicación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
