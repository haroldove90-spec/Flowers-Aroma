import React, { useState } from 'react';
import {
  Building2,
  Users,
  Boxes,
  Settings,
  PlusCircle,
  AlertTriangle,
  MapPin,
  Search,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { GreenhouseModule, Worker, InventoryItem, EquipmentAsset } from '../../types/greenhouse';

export const OperationsView: React.FC = () => {
  const {
    activeView,
    modules,
    workers,
    inventory,
    equipment,
    addModule,
    addWorker,
    updateWorkerAttendance,
    addInventoryItem,
  } = useGreenhouse();

  // Modals
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);

  // New Module Form State
  const [modCode, setModCode] = useState('');
  const [modName, setModName] = useState('');
  const [modVariety, setModVariety] = useState('Rosa Freedom (Roja)');
  const [modArea, setModArea] = useState('4500');
  const [modBeds, setModBeds] = useState('36');
  const [modPlants, setModPlants] = useState('34000');
  const [modDensity, setModDensity] = useState('7.5');
  const [modTenure, setModTenure] = useState<'propiedad' | 'arrendamiento' | 'asociacion'>('propiedad');
  const [modSupervisor, setModSupervisor] = useState('Ing. Carlos Mendoza');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    const newMod: GreenhouseModule = {
      id: `mod-${Date.now()}`,
      code: modCode.trim() || `M-0${modules.length + 1}`,
      name: modName.trim() || `Invernadero ${modVariety}`,
      variety: modVariety,
      areaM2: parseFloat(modArea) || 4000,
      bedsCount: parseInt(modBeds) || 30,
      plantsCount: parseInt(modPlants) || 30000,
      densityPerM2: parseFloat(modDensity) || 7.5,
      plantingDate: new Date().toISOString().slice(0, 10),
      expectedYieldStems: (parseInt(modPlants) || 30000) * 1.2,
      status: 'vegetativo',
      irrigationSector: `Sector ${modules.length + 1}`,
      tenure: modTenure,
      location: 'Predio El Rosal, Bloque B',
      coordinates: '19.4328° N, 99.1315° W',
      supervisor: modSupervisor,
    };
    addModule(newMod);
    setShowAddModuleModal(false);
  };

  // Determine current active subview from sidebar without duplicate horizontal tabs
  const currentView =
    activeView === 'personal'
      ? 'personal'
      : activeView === 'almacen'
      ? 'almacen'
      : activeView === 'activos'
      ? 'activos'
      : 'modulos';

  return (
    <div className="space-y-6">
      {/* Operations Header (Clean, without horizontal duplicate tab bar) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Administración & Jefatura de Operaciones
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {currentView === 'personal'
              ? 'Personal, Nómina & Cuadrillas de Trabajo'
              : currentView === 'almacen'
              ? 'Compras, Almacén & Catálogo de Insumos'
              : currentView === 'activos'
              ? 'Activos, Infraestructura & Mantenimiento'
              : 'Unidades de Producción (Módulos & Camas)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentView === 'personal'
              ? 'Registro de asistencia diaria, salarios, bonos y productividad de cuadrillas'
              : currentView === 'almacen'
              ? 'Existencias mínimas, lotes, caducidades, insumos y asignación de costos'
              : currentView === 'activos'
              ? 'Cámaras frías, cabezales de riego automatizado, maquinaria y bitácoras'
              : 'Predios, naves M-01 a M-06, superficies m², densidades y variedades de flor'}
          </p>
        </div>

        {/* Action Button for Current View */}
        <div>
          {currentView === 'modulos' && (
            <button
              onClick={() => setShowAddModuleModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Módulo</span>
            </button>
          )}

          {currentView === 'personal' && (
            <div className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
              {workers.filter((w) => w.attendanceToday === 'presente').length} de {workers.length} Presentes Hoy
            </div>
          )}

          {currentView === 'almacen' && (
            <input
              type="text"
              placeholder="Buscar insumo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          )}
        </div>
      </div>

      {/* 1. View: Módulos de Producción */}
      {currentView === 'modulos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                      {m.code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{m.name}</h3>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      m.status === 'cosecha'
                        ? 'bg-rose-100 text-rose-800'
                        : m.status === 'floracion'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Variedad</span>
                    <span className="font-bold text-slate-800">{m.variety}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Superficie</span>
                    <span className="font-bold text-slate-800">{m.areaM2.toLocaleString()} m²</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Población</span>
                    <span className="font-bold text-slate-800">{m.plantsCount.toLocaleString()} plantas</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Densidad</span>
                    <span className="font-bold text-slate-800">{m.densityPerM2} pl/m² ({m.bedsCount} camas)</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{m.location} ({m.tenure})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Supervisor: {m.supervisor}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. View: Personal y Nómina */}
      {currentView === 'personal' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-2 font-bold">Código / Nombre</th>
                  <th className="pb-2 font-bold">Puesto & Equipo</th>
                  <th className="pb-2 font-bold">Tarifa Diaria</th>
                  <th className="pb-2 font-bold">Rendimiento</th>
                  <th className="pb-2 font-bold text-center">Asistencia Hoy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 font-bold text-slate-900">
                      {w.name}
                      <span className="block text-[10px] font-normal text-slate-400">{w.code} • Tel: {w.phone}</span>
                    </td>
                    <td className="py-3 text-slate-600">
                      <span className="font-semibold block">{w.role}</span>
                      <span className="text-[10px] text-slate-400">{w.team}</span>
                    </td>
                    <td className="py-3 text-slate-800 font-bold whitespace-nowrap">
                      ${w.dailyRate} MXN
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-emerald-600 h-1.5 rounded-full"
                            style={{ width: `${w.efficiencyRating}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-700 text-[11px]">{w.efficiencyRating}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px]">
                        {(['presente', 'retardo', 'falta', 'permiso'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => updateWorkerAttendance(w.id, status)}
                            className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                              w.attendanceToday === status
                                ? status === 'presente'
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : status === 'falta'
                                  ? 'bg-rose-600 text-white font-bold'
                                  : 'bg-amber-500 text-white font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. View: Compras y Almacén */}
      {currentView === 'almacen' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory
              .filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((item) => {
                const isLowStock = item.stock <= item.minStock;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition ${
                      isLowStock ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                        {item.category}
                      </span>
                      {isLowStock && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Reorden
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm mt-2">{item.name}</h3>
                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <span className="text-lg font-black text-slate-900">{item.stock}</span>
                        <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        ${item.avgCost} / {item.unit}
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                      <span>Lote: {item.lastLot}</span>
                      <span>Caduca: {item.expirationDate}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 4. View: Activos e Infraestructura */}
      {currentView === 'activos' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipment.map((eq) => (
              <div key={eq.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{eq.code} • {eq.type}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {eq.status}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{eq.name}</h3>
                <p className="text-xs text-slate-600">{eq.brandModel}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200">
                  <div>
                    <span>Valor Activo: </span>
                    <strong className="text-slate-800">${eq.value.toLocaleString()} MXN</strong>
                  </div>
                  <div>
                    <span>Próximo Servicio: </span>
                    <strong className="text-emerald-700">{eq.nextMaintenance}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Nuevo Módulo */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-xs">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Alta de Nuevo Módulo de Invernadero
            </h3>
            <form onSubmit={handleCreateModule} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Código (ej. M-07)</label>
                  <input
                    type="text"
                    required
                    value={modCode}
                    onChange={(e) => setModCode(e.target.value)}
                    placeholder="M-07"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nombre Descriptivo</label>
                  <input
                    type="text"
                    required
                    value={modName}
                    onChange={(e) => setModName(e.target.value)}
                    placeholder="Nave Sur Nueva"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Variedad de Flor Asignada</label>
                <select
                  value={modVariety}
                  onChange={(e) => setModVariety(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Rosa Freedom (Roja)">Rosa Freedom (Roja)</option>
                  <option value="Rosa Mondial (Blanca)">Rosa Mondial (Blanca)</option>
                  <option value="Rosa Explorer (Terciopelo)">Rosa Explorer (Terciopelo)</option>
                  <option value="Gypsophila Million Stars">Gypsophila Million Stars</option>
                  <option value="Clavel Standard Diana">Clavel Standard Diana</option>
                  <option value="Lilium Oriental Siberia">Lilium Oriental Siberia</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Superficie (m²)</label>
                  <input
                    type="number"
                    value={modArea}
                    onChange={(e) => setModArea(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Camas</label>
                  <input
                    type="number"
                    value={modBeds}
                    onChange={(e) => setModBeds(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Población (plantas)</label>
                  <input
                    type="number"
                    value={modPlants}
                    onChange={(e) => setModPlants(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tenencia</label>
                  <select
                    value={modTenure}
                    onChange={(e) => setModTenure(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="propiedad">Propiedad</option>
                    <option value="arrendamiento">Arrendamiento</option>
                    <option value="asociacion">Asociación</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supervisor de Módulo</label>
                  <input
                    type="text"
                    value={modSupervisor}
                    onChange={(e) => setModSupervisor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModuleModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                >
                  Dar de Alta Módulo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
