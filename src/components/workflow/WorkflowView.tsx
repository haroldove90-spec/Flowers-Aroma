import React, { useState } from 'react';
import {
  GitBranch,
  Building2,
  Sprout,
  Droplet,
  Flower2,
  TrendingUp,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Clock,
  ArrowDown,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { UserRole } from '../../types/greenhouse';

export const WorkflowView: React.FC = () => {
  const {
    modules,
    tasks,
    irrigation,
    applications,
    harvest,
    orders,
    movements,
    setActiveRole,
    setActiveView,
  } = useGreenhouse();

  const [selectedStage, setSelectedStage] = useState<number>(1);

  // Live metrics for workflow
  const totalArea = modules.reduce((acc, m) => acc + m.areaM2, 0);
  const totalPlants = modules.reduce((acc, m) => acc + m.plantsCount, 0);
  const pendingTasks = tasks.filter((t) => t.status !== 'completado').length;
  const completedTasks = tasks.filter((t) => t.status === 'completado').length;
  const totalWaterUsed = irrigation.reduce((acc, i) => acc + i.volumeM3, 0);
  const recentAppsCount = applications.length;
  const totalStemsInStock = harvest.reduce((acc, h) => acc + (h.packages25Stems * 25), 0);
  const activeOrdersCount = orders.filter((o) => o.status !== 'entregado' && o.status !== 'pagado').length;
  const totalRevenue = orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalExpenses = movements.filter((m) => m.type === 'egreso' && m.scope === 'empresarial').reduce((acc, m) => acc + m.amount, 0);

  const stages = [
    {
      id: 1,
      title: 'Planificación & Configuración',
      subtitle: 'Administración de Infraestructura',
      icon: Building2,
      roleTarget: 'operaciones' as UserRole,
      viewTarget: 'principal',
      color: 'emerald',
      badge: `${modules.length} Módulos Activos`,
      summary: 'El Administrador da de alta la estructura física (predios, módulos, camas) y asigna las variedades de flor y densidades de plantación. Se registran activos, maquinaria, catálogo de insumos y accesos.',
      liveData: [
        { label: 'Superficie Invernadero', value: `${totalArea.toLocaleString()} m²` },
        { label: 'Población Vegetal', value: `${totalPlants.toLocaleString()} plantas` },
        { label: 'Variedades en Producción', value: 'Freedom, Mondial, Explorer, Gypso' },
      ],
    },
    {
      id: 2,
      title: 'Operación & Labores Culturales',
      subtitle: 'Ejecución en Campo',
      icon: Sprout,
      roleTarget: 'agronomo' as UserRole,
      viewTarget: 'principal',
      color: 'teal',
      badge: `${pendingTasks} Labores en Curso`,
      summary: 'El Ingeniero Agrónomo programa actividades de campo (tutoreo, poda, desahije, desbotonado). Los operarios registran avances, incidencias y evidencias fotográficas desde campo con soporte offline.',
      liveData: [
        { label: 'Labores Completadas', value: `${completedTasks} actividades` },
        { label: 'Pendientes / Hoy', value: `${pendingTasks} tareas programadas` },
        { label: 'Cuadrillas Asignadas', value: 'Cuadrillas A, B, C' },
      ],
    },
    {
      id: 3,
      title: 'Nutrición, Riego & Sanidad',
      subtitle: 'Fertirrigación y Fitoprotección',
      icon: Droplet,
      roleTarget: 'agronomo' as UserRole,
      viewTarget: 'riego',
      color: 'blue',
      badge: `${totalWaterUsed.toFixed(1)} m³ Aplicados`,
      summary: 'Se ejecutan los programas de fertirrigación monitoreando pH (5.8) y CE (1.6 dS/m). Sanidad monitorea plagas, programa aplicaciones fitosanitarias y descuenta insumos del almacén calculando costos.',
      liveData: [
        { label: 'Agua Aplicada', value: `${totalWaterUsed.toFixed(1)} m³` },
        { label: 'Tanques de Nutrición', value: 'A (Calcio/N) y B (P/K/Mg)' },
        { label: 'Tratamientos Fitosanitarios', value: `${recentAppsCount} aplicaciones` },
      ],
    },
    {
      id: 4,
      title: 'Cosecha, Poscosecha & Empaque',
      subtitle: 'Corte, Selección y Cadena de Frío',
      icon: Flower2,
      roleTarget: 'cosecha' as UserRole,
      viewTarget: 'principal',
      color: 'rose',
      badge: `${(totalStemsInStock / 25).toFixed(0)} Paquetes Listos`,
      summary: 'Se registra el corte diario por tallos, operario y módulo. En empaque la flor se clasifica por longitud (50-80cm), se arma en paquetes estándar de 25 tallos, se hidrata y pasa a cámara fría.',
      liveData: [
        { label: 'Tallos en Inventario Frío', value: `${totalStemsInStock.toLocaleString()} tallos` },
        { label: 'Presentación Estándar', value: 'Bonches de 25 tallos' },
        { label: 'Cámaras Frías', value: 'Cámara #1 y #2 a 3.2°C' },
      ],
    },
    {
      id: 5,
      title: 'Comercialización & Ventas',
      subtitle: 'Despacho y Cuentas por Cobrar',
      icon: TrendingUp,
      roleTarget: 'ventas' as UserRole,
      viewTarget: 'principal',
      color: 'amber',
      badge: `${orders.length} Pedidos Procesados`,
      summary: 'Captura de pedidos de clientes y canales (Central de Abasto, Florerías, Exportación). Notas de venta, descuento automático de inventario terminado y control de cobranza de contado y crédito.',
      liveData: [
        { label: 'Total Facturado', value: `$${totalRevenue.toLocaleString()} MXN` },
        { label: 'Pedidos Activos', value: `${activeOrdersCount} pedidos` },
        { label: 'Canales de Venta', value: 'Central de Abasto, Local, Exportación' },
      ],
    },
    {
      id: 6,
      title: 'Control Financiero & Costos',
      subtitle: 'Rentabilidad y Toma de Decisiones',
      icon: Wallet,
      roleTarget: 'director' as UserRole,
      viewTarget: 'principal',
      color: 'purple',
      badge: `$${(totalRevenue - totalExpenses).toLocaleString()} Margen Operativo`,
      summary: 'Todas las operaciones alimentan en tiempo real Compras, Finanzas y Costos. Se calcula el costo real por m², variedad y tallo, permitiendo a Dirección General visualizar flujo proyectado y rentabilidad.',
      liveData: [
        { label: 'Ingresos Operativos', value: `$${totalRevenue.toLocaleString()} MXN` },
        { label: 'Gastos Empresariales', value: `$${totalExpenses.toLocaleString()} MXN` },
        { label: 'Utilidad Operativa', value: `$${(totalRevenue - totalExpenses).toLocaleString()} MXN` },
      ],
    },
  ];

  const currentStageInfo = stages.find((s) => s.id === selectedStage) || stages[0];

  const handleJumpToStage = (role: UserRole, view: string) => {
    setActiveRole(role);
    setActiveView(view);
  };

  return (
    <div className="space-y-6">
      {/* View Title */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-6 rounded-2xl shadow-sm border border-[#C3A25D]/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs">
              <GitBranch className="w-6 h-6 text-[#C3A25D]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Flujo de Trabajo Integral &bull; Aroma Flower
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                Ciclo de vida operativo completo del invernadero conectado en tiempo real
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-[#535B28] border border-[#dce4bf]/40 text-white">
            6 Etapas Interconectadas
          </span>
        </div>
      </div>

      {/* Interactive Workflow Diagram Pipeline */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs">
        <h2 className="text-sm font-bold text-[#000000] mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#5C1125]" />
          Pipeline Operativo (Haz clic en cualquier etapa para inspeccionar):
        </h2>

        {/* 2x3 Grid Pipeline Flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Row 1: Stage 1 and Stage 2 */}
          <div className="space-y-4">
            {/* Stage 1 */}
            <div
              onClick={() => setSelectedStage(1)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedStage === 1
                  ? 'border-[#5C1125] bg-[#fbf2f4] shadow-md ring-2 ring-[#C3A25D]/30'
                  : 'border-stone-200 hover:border-stone-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#535B28]/15 text-[#535B28] flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-[#000000] text-sm">Planificación y Configuración</h3>
                    <p className="text-xs text-stone-500">Módulos, camas, densidades y variedades</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-[#535B28]/15 text-[#535B28] rounded-full">
                  {modules.length} Módulos
                </span>
              </div>
            </div>

            <div className="flex justify-center text-stone-400">
              <ArrowDown className="w-5 h-5 text-[#C3A25D]" />
            </div>

            {/* Stage 3 */}
            <div
              onClick={() => setSelectedStage(3)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedStage === 3
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Nutrición, Riego y Sanidad</h3>
                    <p className="text-xs text-slate-500">pH, CE, Tanques A/B y fitoprotección</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {totalWaterUsed.toFixed(0)} m³ Riego
                </span>
              </div>
            </div>

            <div className="flex justify-center text-slate-400">
              <ArrowDown className="w-5 h-5 text-emerald-500" />
            </div>

            {/* Stage 5 */}
            <div
              onClick={() => setSelectedStage(5)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedStage === 5
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                    5
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Comercialización y Ventas</h3>
                    <p className="text-xs text-slate-500">Pedidos, despacho y cuentas por cobrar</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
                  {orders.length} Pedidos
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Stage 2, 4, 6 */}
          <div className="space-y-4">
            {/* Stage 2 */}
            <div
              onClick={() => setSelectedStage(2)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedStage === 2
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Operación y Labores Culturales</h3>
                    <p className="text-xs text-slate-500">Tutoreo, poda, desbotonado y avances</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-teal-100 text-teal-800 rounded-full">
                  {completedTasks} Hechas
                </span>
              </div>
            </div>

            <div className="flex justify-center text-slate-400">
              <ArrowDown className="w-5 h-5 text-emerald-500" />
            </div>

            {/* Stage 4 */}
            <div
              onClick={() => setSelectedStage(4)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedStage === 4
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Cosecha, Poscosecha y Empaque</h3>
                    <p className="text-xs text-slate-500">Corte, clasificación y bonches de 25</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full">
                  {(totalStemsInStock / 25).toFixed(0)} Bonches
                </span>
              </div>
            </div>

            <div className="flex justify-center text-slate-400">
              <ArrowDown className="w-5 h-5 text-emerald-500" />
            </div>

            {/* Stage 6 */}
            <div
              onClick={() => setSelectedStage(6)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedStage === 6
                  ? 'border-[#5C1125] bg-[#fbf2f4] shadow-md ring-2 ring-[#C3A25D]/30'
                  : 'border-stone-200 hover:border-stone-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#5C1125]/15 text-[#5C1125] flex items-center justify-center font-bold text-sm">
                    6
                  </div>
                  <div>
                    <h3 className="font-bold text-[#000000] text-sm">Control Financiero y Costos</h3>
                    <p className="text-xs text-stone-500">Costo por tallo, m² y rentabilidad</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-[#C3A25D]/20 text-[#5C1125] rounded-full">
                  $3.85 / Tallo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Detail Card */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#fbf2f4] text-[#5C1125]">
              <currentStageInfo.icon className="w-6 h-6 text-[#5C1125]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#535B28]">
                Etapa {currentStageInfo.id} de 6
              </span>
              <h3 className="text-lg font-bold text-[#000000]">{currentStageInfo.title}</h3>
              <p className="text-xs text-stone-500">{currentStageInfo.subtitle}</p>
            </div>
          </div>

          <button
            onClick={() => handleJumpToStage(currentStageInfo.roleTarget, currentStageInfo.viewTarget)}
            className="flex items-center gap-2 px-4 py-2 bg-[#5C1125] hover:bg-[#430c1b] text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs self-start sm:self-auto cursor-pointer border border-[#C3A25D]/40"
          >
            <span>Ir al Módulo de Operación</span>
            <ArrowRight className="w-4 h-4 text-[#C3A25D]" />
          </button>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          {currentStageInfo.summary}
        </p>

        {/* Live Data Highlights */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Métricas Reales del Invernadero en esta Etapa
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currentStageInfo.liveData.map((d, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">{d.label}</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
