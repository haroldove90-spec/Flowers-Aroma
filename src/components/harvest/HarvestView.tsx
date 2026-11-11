import React, { useState } from 'react';
import {
  Flower2,
  Boxes,
  Sparkles,
  ThermometerSnowflake,
  PlusCircle,
  AlertOctagon,
  CheckCircle2,
  PackageCheck,
  TrendingDown,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { HarvestRecord } from '../../types/greenhouse';

export const HarvestView: React.FC = () => {
  const {
    activeView,
    harvest,
    modules,
    addHarvest,
  } = useGreenhouse();

  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [hModule, setHModule] = useState(modules[0]?.code || 'M-01');
  const [hVariety, setHVariety] = useState('Rosa Freedom');
  const [hStemsCut, setHStemsCut] = useState('5000');
  const [hTeam, setHTeam] = useState('Cuadrilla Corte Mañana');
  const [hG40, setHG40] = useState('200');
  const [hG50, setHG50] = useState('800');
  const [hG60, setHG60] = useState('2000');
  const [hG70, setHG70] = useState('1500');
  const [hG80, setHG80] = useState('350');
  const [hWaste, setHWaste] = useState('150');
  const [hWasteReason, setHWasteReason] = useState('Tallo curvo, cáliz abierto');
  const [hColdRoom, setHColdRoom] = useState('Cámara Fría #1 (3.2°C)');

  const totalCut = harvest.reduce((acc, h) => acc + h.stemsCut, 0);
  const totalPackages25 = harvest.reduce((acc, h) => acc + h.packages25Stems, 0);
  const totalWaste = harvest.reduce((acc, h) => acc + h.stemsWaste, 0);
  const wasteRate = totalCut > 0 ? ((totalWaste / totalCut) * 100).toFixed(1) : '0';

  const handleCreateHarvest = (e: React.FormEvent) => {
    e.preventDefault();
    const cut = parseInt(hStemsCut) || 5000;
    const waste = parseInt(hWaste) || 0;
    const commercialStems = Math.max(0, cut - waste);
    const packages = Math.floor(commercialStems / 25);

    const newRecord: HarvestRecord = {
      id: `hrv-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      moduleId: modules.find((m) => m.code === hModule)?.id || 'mod-1',
      moduleCode: hModule,
      variety: hVariety,
      stemsCut: cut,
      harvesterTeam: hTeam,
      stemsGrade40cm: parseInt(hG40) || 0,
      stemsGrade50cm: parseInt(hG50) || 0,
      stemsGrade60cm: parseInt(hG60) || 0,
      stemsGrade70cm: parseInt(hG70) || 0,
      stemsGrade80cm: parseInt(hG80) || 0,
      stemsWaste: waste,
      wasteReason: hWasteReason,
      packages25Stems: packages,
      coldRoomCode: hColdRoom,
      solutionTreatment: 'Solución STS + Chrysal Professional 2',
      status: 'en_camara_fria',
    };
    addHarvest(newRecord);
    setShowAddModal(false);
  };

  // Determine current active view from sidebar without duplicate horizontal tabs
  const currentView =
    activeView === 'clasificacion'
      ? 'clasificacion'
      : activeView === 'merma'
      ? 'merma'
      : activeView === 'camara'
      ? 'camara'
      : 'corte';

  return (
    <div className="space-y-6">
      {/* Harvest Header (Clean, without horizontal duplicate tab bar) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Jefatura de Cosecha, Poscosecha y Empaque
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {currentView === 'clasificacion'
              ? 'Clasificación de Grados & Bonches de 25 Tallos'
              : currentView === 'merma'
              ? 'Control de Mermas, Rechazos & Causas de Descarte'
              : currentView === 'camara'
              ? 'Cámara Fría (3.2°C) & Tratamientos de Hidratación'
              : 'Registro Diario de Corte & Cosecha en Módulos'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentView === 'clasificacion'
              ? 'Conversión automática a paquetes estándar de 25 tallos por longitudes de 40 a 80 cm'
              : currentView === 'merma'
              ? 'Identificación de tallos quebrados, cabeza abierta o daño mecánico para reducir pérdidas'
              : currentView === 'camara'
              ? 'Monitoreo de temperatura (3.2°C), humedad (88%) y soluciones preservantes STS'
              : 'Trazabilidad de corte por fecha, módulo de origen, variedad y cuadrillas de campo'}
          </p>
        </div>

        <div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Corte & Empaque</span>
          </button>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Tallos Cortados Acumulados</span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
            {totalCut.toLocaleString()} tallos
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">Registrados en bitácora</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Bonches Comerciales (x25)</span>
          <span className="text-xl sm:text-2xl font-black text-rose-700 mt-1 block">
            {totalPackages25.toLocaleString()} bonches
          </span>
          <span className="text-[11px] text-slate-500">{(totalPackages25 * 25).toLocaleString()} tallos aptos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Índice de Merma / Descarte</span>
          <span className="text-xl sm:text-2xl font-black text-amber-600 mt-1 block">
            {wasteRate}%
          </span>
          <span className="text-[11px] text-slate-500">{totalWaste.toLocaleString()} tallos descartados</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Cámara Fría #1 & #2</span>
          <span className="text-xl sm:text-2xl font-black text-blue-600 mt-1 block flex items-center gap-1">
            <ThermometerSnowflake className="w-5 h-5 text-blue-500" /> 3.2°C / 88%
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">Hidratación STS Activa</span>
        </div>
      </div>

      {/* 1. View: Corte Diario */}
      {currentView === 'corte' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {harvest.map((h) => (
              <div
                key={h.id}
                className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                      {h.moduleCode}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{h.variety}</h3>
                      <span className="text-[10px] text-slate-500">{h.harvesterTeam} • {h.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                      {h.packages25Stems} Paquetes (25 tallos)
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                      {h.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                  <div><span className="text-slate-400 block text-[10px]">Total Tallos:</span> <strong>{h.stemsCut}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Merma Descarte:</span> <strong className="text-rose-600">{h.stemsWaste}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Cámara:</span> {h.coldRoomCode}</div>
                  <div><span className="text-slate-400 block text-[10px]">Tratamiento:</span> {h.solutionTreatment}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. View: Clasificación & Empaque */}
      {currentView === 'clasificacion' && (
        <div className="space-y-4">
          <div className="space-y-4">
            {harvest.map((h) => (
              <div key={h.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 text-sm">{h.moduleCode} - {h.variety}</span>
                  <span className="text-xs font-black text-rose-700">{h.packages25Stems} bonches de 25</span>
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Distribución de Grados por Longitud
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 block">40 cm</span>
                    <strong className="text-slate-800 text-sm">{h.stemsGrade40cm}</strong> tallos
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 block">50 cm</span>
                    <strong className="text-slate-800 text-sm">{h.stemsGrade50cm}</strong> tallos
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 block">60 cm</span>
                    <strong className="text-slate-800 text-sm">{h.stemsGrade60cm}</strong> tallos
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 block">70 cm</span>
                    <strong className="text-slate-800 text-sm">{h.stemsGrade70cm}</strong> tallos
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 block">80 cm Select</span>
                    <strong className="text-slate-800 text-sm">{h.stemsGrade80cm}</strong> tallos
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. View: Merma & Rechazo */}
      {currentView === 'merma' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Bitácora de Descarte y Causas de Merma</h3>
            <div className="space-y-3">
              {harvest.map((h) => (
                <div key={h.id} className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-slate-900 block">{h.moduleCode} - {h.variety}</strong>
                    <span className="text-amber-800 font-medium">Causa: {h.wasteReason}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-rose-700 block">{h.stemsWaste} tallos</span>
                    <span className="text-[10px] text-slate-400">({((h.stemsWaste / h.stemsCut) * 100).toFixed(1)}% del lote)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. View: Cámara Fría & Trazabilidad */}
      {currentView === 'camara' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 uppercase">Cámara Fría #1</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  En Rango Óptimo
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
                <ThermometerSnowflake className="w-7 h-7 text-blue-500" />
                3.2°C <span className="text-sm font-normal text-slate-400">/ 88% HR</span>
              </div>
              <p className="text-xs text-slate-600">
                Evaporador Bohn 5HP con recirculación constante. Capacidad: 1,800 bonches de 25.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 uppercase">Cámara Fría #2</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  En Rango Óptimo
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
                <ThermometerSnowflake className="w-7 h-7 text-blue-500" />
                3.5°C <span className="text-sm font-normal text-slate-400">/ 86% HR</span>
              </div>
              <p className="text-xs text-slate-600">
                Lotes de Gypsophila y Clavel en solución preservante Chrysal Professional 2.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Corte & Clasificación */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs text-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Registrar Lote de Corte, Clasificación & Empaque
            </h3>
            <form onSubmit={handleCreateHarvest} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Módulo de Origen</label>
                  <select
                    value={hModule}
                    onChange={(e) => {
                      setHModule(e.target.value);
                      const m = modules.find((mod) => mod.code === e.target.value);
                      if (m) setHVariety(m.variety);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {modules.map((m) => (
                      <option key={m.id} value={m.code}>{m.code} - {m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Variedad</label>
                  <input
                    type="text"
                    value={hVariety}
                    onChange={(e) => setHVariety(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Tallos Cortados</label>
                  <input
                    type="number"
                    value={hStemsCut}
                    onChange={(e) => setHStemsCut(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cuadrilla de Corte</label>
                  <input
                    type="text"
                    value={hTeam}
                    onChange={(e) => setHTeam(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="border border-slate-200 p-3 rounded-xl bg-slate-50 space-y-2">
                <span className="font-bold text-slate-700 block">Distribución de Grados por Longitud</span>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">40 cm</label>
                    <input
                      type="number"
                      value={hG40}
                      onChange={(e) => setHG40(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">50 cm</label>
                    <input
                      type="number"
                      value={hG50}
                      onChange={(e) => setHG50(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">60 cm</label>
                    <input
                      type="number"
                      value={hG60}
                      onChange={(e) => setHG60(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">70 cm</label>
                    <input
                      type="number"
                      value={hG70}
                      onChange={(e) => setHG70(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">80 cm</label>
                    <input
                      type="number"
                      value={hG80}
                      onChange={(e) => setHG80(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tallos Merma / Descarte</label>
                  <input
                    type="number"
                    value={hWaste}
                    onChange={(e) => setHWaste(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-rose-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Causas de Descarte</label>
                  <input
                    type="text"
                    value={hWasteReason}
                    onChange={(e) => setHWasteReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destino Cámara Fría</label>
                <select
                  value={hColdRoom}
                  onChange={(e) => setHColdRoom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="Cámara Fría #1 (3.2°C)">Cámara Fría #1 (3.2°C) - Rack A</option>
                  <option value="Cámara Fría #2 (3.5°C)">Cámara Fría #2 (3.5°C) - Rack B</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700"
                >
                  Guardar & Empacar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
