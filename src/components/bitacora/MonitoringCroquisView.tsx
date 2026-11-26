import React, { useMemo, useRef, useState } from 'react';
import {
  MapPin,
  CheckCircle2,
  Edit3,
  Trash2,
  Search,
  Calendar,
  FileDown,
  Crosshair,
  Save,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  CroquisUnitId,
  MONITORING_ACTION_SUGGESTIONS,
  MONITORING_FINDING_SUGGESTIONS,
  MonitoringPin,
  MonitoringSeverity,
  MonitoringStatus,
} from '../../types/greenhouse';
import {
  CROQUIS_UNITS,
  ORIGINAL_CROQUIS_PDF_PATH,
  describeAislePosition,
  getCroquisUnitById,
  getVarietyZoneForAisle,
} from '../../data/croquisData';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { getTodayLocalISO } from '../../utils/foliarCalculations';
import { CroquisClickTarget, CroquisMapCanvas } from './CroquisMapCanvas';

const SEVERITY_LABEL: Record<MonitoringSeverity, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const SEVERITY_TEXT_CLASS: Record<MonitoringSeverity, string> = {
  baja: 'text-[#16A34A]',
  media: 'text-[#D97706]',
  alta: 'text-[#DC2626]',
};

const SEVERITY_BAR_CLASS: Record<MonitoringSeverity, string> = {
  baja: 'bg-[#16A34A]',
  media: 'bg-[#D97706]',
  alta: 'bg-[#DC2626]',
};

const QUICK_INCIDENCE_STEPS = [5, 15, 30, 50, 75] as const;

const suggestSeverityFromIncidence = (pct: number): MonitoringSeverity => {
  if (pct >= 40) return 'alta';
  if (pct >= 15) return 'media';
  return 'baja';
};

export const MonitoringCroquisView: React.FC = () => {
  const {
    monitoringPins,
    saveMonitoringPin,
    deleteMonitoringPin,
    currentUser,
  } = useGreenhouse();

  const mapSectionRef = useRef<HTMLDivElement | null>(null);

  // Active unit blueprint & selection state
  const [activeUnitId, setActiveUnitId] = useState<CroquisUnitId>('santa_cruz');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState<CroquisClickTarget | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'activo' | 'todos' | 'controlado'>('activo');
  const [severityFilter, setSeverityFilter] = useState<'todas' | MonitoringSeverity>('todas');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tableScope, setTableScope] = useState<'unidad' | 'todas'>('todas');

  // Form state for new / edited monitoring mark
  const [monitoringDate, setMonitoringDate] = useState<string>(getTodayLocalISO);
  const [pestOrFinding, setPestOrFinding] = useState<string>('');
  const [incidencePercent, setIncidencePercent] = useState<number>(15);
  const [severity, setSeverity] = useState<MonitoringSeverity>('media');
  const [recommendedAction, setRecommendedAction] = useState<string>('');
  const [status, setStatus] = useState<MonitoringStatus>('activo');
  const [inspectorName, setInspectorName] = useState<string>(currentUser?.fullName || '');
  const [notes, setNotes] = useState<string>('');

  // UI feedback & inline delete confirm
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  const activeUnit = useMemo(() => getCroquisUnitById(activeUnitId), [activeUnitId]);

  const showNotice = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setFeedback({ tone, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4200);
  };

  // Count active foci per unit for quick navigation visibility
  const activeCountByUnit = useMemo(() => {
    const counts: Record<CroquisUnitId, number> = {
      santa_cruz: 0,
      saul: 0,
      tlapizaco: 0,
    };
    monitoringPins.forEach((p) => {
      if (p.status === 'activo') {
        counts[p.unitId] = (counts[p.unitId] || 0) + 1;
      }
    });
    return counts;
  }, [monitoringPins]);

  // Global summary KPIs
  const summary = useMemo(() => {
    const active = monitoringPins.filter((p) => p.status === 'activo');
    const high = active.filter((p) => p.severity === 'alta');
    const controlled = monitoringPins.filter((p) => p.status === 'controlado');
    const avgIncidence =
      active.length > 0
        ? Math.round(
            active.reduce((sum, p) => sum + Math.max(0, Number(p.incidencePercent || 0)), 0) /
              active.length
          )
        : 0;
    return {
      activeCount: active.length,
      highCount: high.length,
      avgIncidence,
      controlledCount: controlled.length,
    };
  }, [monitoringPins]);

  // Pins matching active filters
  const filteredPinsAllUnits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return monitoringPins.filter((p) => {
      if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
      if (severityFilter !== 'todas' && p.severity !== severityFilter) return false;
      if (dateFilter && p.monitoringDate !== dateFilter) return false;
      if (q) {
        const haystack = [
          p.unitName,
          p.moduleName,
          `seccion ${p.section}`,
          `pasillo ${p.aisleNumber}`,
          p.variety,
          p.pestOrFinding,
          p.recommendedAction || '',
          p.inspectorName || '',
          p.notes || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [monitoringPins, statusFilter, severityFilter, dateFilter, searchTerm]);

  const pinsOnActiveUnit = useMemo(
    () => filteredPinsAllUnits.filter((p) => p.unitId === activeUnitId),
    [filteredPinsAllUnits, activeUnitId]
  );

  const tablePins = useMemo(
    () =>
      tableScope === 'unidad'
        ? pinsOnActiveUnit
        : filteredPinsAllUnits,
    [tableScope, pinsOnActiveUnit, filteredPinsAllUnits]
  );

  const selectedPin = useMemo(
    () => (selectedPinId ? monitoringPins.find((p) => p.id === selectedPinId) || null : null),
    [monitoringPins, selectedPinId]
  );

  const isFormOpen = Boolean(draftTarget);

  const resetFormFields = () => {
    setMonitoringDate(getTodayLocalISO());
    setPestOrFinding('');
    setIncidencePercent(15);
    setSeverity('media');
    setRecommendedAction('');
    setStatus('activo');
    setInspectorName(currentUser?.fullName || '');
    setNotes('');
    setEditingPinId(null);
  };

  // User clicked directly on an aisle of the croquis
  const handleSelectSpot = (target: CroquisClickTarget) => {
    setSelectedPinId(null);
    setConfirmDeleteId(null);
    if (!editingPinId) {
      resetFormFields();
    }
    setDraftTarget(target);
  };

  // User clicked an existing pin on the croquis
  const handleSelectPin = (pin: MonitoringPin) => {
    setDraftTarget(null);
    setEditingPinId(null);
    setConfirmDeleteId(null);
    setSelectedPinId(pin.id);
  };

  // Open an existing pin for editing (preserving exact aisle & position)
  const handleStartEditPin = (pin: MonitoringPin) => {
    const zone = getVarietyZoneForAisle(
      pin.unitId,
      pin.moduleNumber,
      pin.section,
      pin.aisleNumber
    );
    setActiveUnitId(pin.unitId);
    setSelectedPinId(null);
    setEditingPinId(pin.id);
    setDraftTarget({
      unitId: pin.unitId,
      unitName: pin.unitName,
      moduleNumber: pin.moduleNumber,
      moduleName: pin.moduleName,
      section: pin.section,
      aisleNumber: pin.aisleNumber,
      variety: pin.variety || zone.variety,
      lengthMeters: zone.lengthMeters,
      positionPercent: pin.positionPercent,
      positionMeters:
        pin.positionMeters ??
        Math.round(((pin.positionPercent / 100) * zone.lengthMeters) * 10) / 10,
    });
    setMonitoringDate(pin.monitoringDate || getTodayLocalISO());
    setPestOrFinding(pin.pestOrFinding || '');
    setIncidencePercent(Math.max(0, Math.min(100, Number(pin.incidencePercent || 0))));
    setSeverity(pin.severity || 'media');
    setRecommendedAction(pin.recommendedAction || '');
    setStatus(pin.status || 'activo');
    setInspectorName(pin.inspectorName || currentUser?.fullName || '');
    setNotes(pin.notes || '');
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Locate pin from bottom history table directly on its unit's croquis
  const handleLocateOnMap = (pin: MonitoringPin) => {
    setActiveUnitId(pin.unitId);
    if (statusFilter === 'activo' && pin.status === 'controlado') {
      setStatusFilter('todos');
    } else if (statusFilter === 'controlado' && pin.status === 'activo') {
      setStatusFilter('todos');
    }
    setDraftTarget(null);
    setEditingPinId(null);
    setSelectedPinId(pin.id);
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleIncidenceChange = (nextVal: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(nextVal)));
    setIncidencePercent(clamped);
    setSeverity(suggestSeverityFromIncidence(clamped));
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTarget) return;
    if (!pestOrFinding.trim()) {
      showNotice('Indica la plaga, enfermedad o hallazgo antes de guardar el marcador.', 'warn');
      return;
    }

    setSaving(true);
    const res = await saveMonitoringPin(
      {
        monitoringDate,
        unitId: draftTarget.unitId,
        unitName: draftTarget.unitName,
        moduleNumber: draftTarget.moduleNumber,
        moduleName: draftTarget.moduleName,
        section: draftTarget.section,
        aisleNumber: draftTarget.aisleNumber,
        variety: draftTarget.variety,
        positionPercent: draftTarget.positionPercent,
        positionMeters: draftTarget.positionMeters,
        pestOrFinding: pestOrFinding.trim(),
        severity,
        incidencePercent: Math.max(0, Math.min(100, Math.round(Number(incidencePercent || 0)))),
        recommendedAction: recommendedAction.trim() || undefined,
        status,
        inspectorName: inspectorName.trim() || currentUser?.fullName || undefined,
        notes: notes.trim() || undefined,
        createdBy: currentUser?.fullName || '',
      },
      editingPinId || undefined
    );
    setSaving(false);

    if (res.ok && res.entry) {
      setDraftTarget(null);
      setEditingPinId(null);
      setSelectedPinId(res.entry.id);
      if (statusFilter === 'activo' && res.entry.status === 'controlado') {
        setStatusFilter('todos');
      }
      showNotice(
        res.cloudSynced
          ? `Marcador guardado en ${res.entry.moduleName} · Sec. ${res.entry.section} · Pasillo ${res.entry.aisleNumber} (${res.entry.variety}).`
          : `Marcador guardado localmente en ${res.entry.moduleName} · Pasillo ${res.entry.aisleNumber}.`,
        res.cloudSynced ? 'ok' : 'warn'
      );
    }
  };

  const handleToggleControlled = async (pin: MonitoringPin) => {
    const nextStatus: MonitoringStatus = pin.status === 'activo' ? 'controlado' : 'activo';
    const res = await saveMonitoringPin(
      {
        monitoringDate: pin.monitoringDate,
        unitId: pin.unitId,
        unitName: pin.unitName,
        moduleNumber: pin.moduleNumber,
        moduleName: pin.moduleName,
        section: pin.section,
        aisleNumber: pin.aisleNumber,
        variety: pin.variety,
        positionPercent: pin.positionPercent,
        positionMeters: pin.positionMeters,
        pestOrFinding: pin.pestOrFinding,
        severity: pin.severity,
        incidencePercent: pin.incidencePercent,
        recommendedAction: pin.recommendedAction,
        status: nextStatus,
        inspectorName: pin.inspectorName,
        notes: pin.notes,
        createdBy: pin.createdBy,
      },
      pin.id
    );
    if (res.ok) {
      showNotice(
        nextStatus === 'controlado'
          ? `Foco en ${pin.moduleName} Pasillo ${pin.aisleNumber} marcado como controlado.`
          : `Foco en ${pin.moduleName} Pasillo ${pin.aisleNumber} reabierto para seguimiento.`
      );
    }
  };

  const handleDeletePin = async (id: string) => {
    setConfirmDeleteId(null);
    await deleteMonitoringPin(id);
    if (selectedPinId === id) {
      setSelectedPinId(null);
    }
    showNotice('Marcador de monitoreo eliminado.');
  };

  const hasFilters =
    statusFilter !== 'activo' ||
    severityFilter !== 'todas' ||
    Boolean(dateFilter) ||
    Boolean(searchTerm.trim());

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Shared datalists for fast field entry */}
      <datalist id="monitoring-findings-list">
        {MONITORING_FINDING_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="monitoring-actions-list">
        {MONITORING_ACTION_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {/* 1. Compact 4-KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
          <div className="text-xs font-semibold text-stone-500">Focos activos</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#000000] tabular-nums">
              {summary.activeCount}
            </span>
            <span className="text-xs text-stone-500">en seguimiento</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
          <div className="text-xs font-semibold text-stone-500">Severidad alta</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#DC2626] tabular-nums">
              {summary.highCount}
            </span>
            <span className="text-xs text-stone-500">atención prioritaria</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
          <div className="text-xs font-semibold text-stone-500">Incidencia promedio</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#5C1125] tabular-nums">
              {summary.avgIncidence}%
            </span>
            <span className="text-xs text-stone-500">focos activos</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
          <div className="text-xs font-semibold text-stone-500">Controlados</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#535B28] tabular-nums">
              {summary.controlledCount}
            </span>
            <span className="text-xs text-stone-500">resueltos</span>
          </div>
        </div>
      </div>

      {/* 2. Unit Selector & Filters Bar */}
      <div
        ref={mapSectionRef}
        className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Unit Segmented Switcher */}
          <div
            role="tablist"
            aria-label="Seleccionar croquis por unidad de producción"
            className="flex flex-wrap items-center gap-1.5"
          >
            {CROQUIS_UNITS.map((unit) => {
              const isSelected = unit.id === activeUnitId;
              const activeInUnit = activeCountByUnit[unit.id] || 0;
              return (
                <button
                  key={unit.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setActiveUnitId(unit.id);
                    setDraftTarget(null);
                    setEditingPinId(null);
                    setSelectedPinId(null);
                  }}
                  className={`h-10 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[#5C1125] text-white'
                      : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  {unit.shortName}
                  {activeInUnit > 0 ? ` (${activeInUnit})` : ''}
                </button>
              );
            })}
          </div>

          {/* Right: Original PDF download link */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={ORIGINAL_CROQUIS_PDF_PATH}
              download="croquis_unidades_produccion_aroma_flower.pdf"
              className="h-10 px-3.5 rounded-xl border border-stone-200 bg-white hover:bg-[#FAF8F5] text-stone-700 hover:text-[#5C1125] text-xs font-bold inline-flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
            >
              <FileDown className="w-4 h-4 text-[#535B28]" />
              <span>Descargar croquis PDF</span>
            </a>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2.5">
          {/* Status segmented buttons */}
          <div className="inline-flex items-center p-1 bg-[#FAF8F5] border border-stone-200 rounded-xl">
            {(
              [
                { id: 'activo', label: 'Activos' },
                { id: 'todos', label: 'Todos' },
                { id: 'controlado', label: 'Controlados' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  statusFilter === opt.id
                    ? 'bg-white text-[#5C1125] font-bold shadow-xs'
                    : 'text-stone-600 hover:text-[#000000]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Severity filter */}
          <select
            aria-label="Filtrar por severidad"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'todas' | MonitoringSeverity)}
            className="h-9 px-3 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25"
          >
            <option value="todas">Severidad: Todas</option>
            <option value="alta">Severidad: Alta</option>
            <option value="media">Severidad: Media</option>
            <option value="baja">Severidad: Baja</option>
          </select>

          {/* Date filter */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              aria-label="Filtrar por fecha"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 pl-8 pr-2.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25"
            />
          </div>

          {/* Search input */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar variedad, plaga, pasillo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-xl border border-stone-200 bg-white text-xs text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('activo');
                setSeverityFilter('todas');
                setDateFilter('');
                setSearchTerm('');
              }}
              className="h-9 px-3 rounded-xl text-xs font-semibold text-stone-600 hover:text-[#5C1125] hover:bg-stone-100 inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {feedback && (
          <div
            className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
              feedback.tone === 'ok'
                ? 'bg-[#f7f8f2] border-[#dce4bf] text-[#535B28]'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}
      </div>

      {/* 3. Main Interactive Workspace: Left Blueprint + Right Capture/Inspector Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
        {/* Dominant Focal Anchor: Interactive Croquis SVG */}
        <CroquisMapCanvas
          unit={activeUnit}
          pins={pinsOnActiveUnit}
          selectedPinId={selectedPinId}
          draftTarget={draftTarget}
          onSelectSpot={handleSelectSpot}
          onSelectPin={handleSelectPin}
        />

        {/* Contextual Side Panel */}
        <aside className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          {isFormOpen && draftTarget ? (
            /* MODE A: Capture / Edit Monitoring Pin */
            <form onSubmit={handleSavePin} className="divide-y divide-stone-100">
              <div className="px-5 py-4 bg-[#FAF8F5] flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-[#000000]">
                    {editingPinId ? 'Editar marcador de monitoreo' : 'Nuevo marcador en croquis'}
                  </h2>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {draftTarget.unitName} · Módulo {draftTarget.moduleNumber} · Sección{' '}
                    {draftTarget.section} · Pasillo {draftTarget.aisleNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDraftTarget(null);
                    setEditingPinId(null);
                  }}
                  className="w-8 h-8 rounded-lg text-stone-500 hover:text-[#5C1125] hover:bg-white inline-flex items-center justify-center cursor-pointer"
                  aria-label="Cerrar formulario"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Auto-detected exact location summary (clean, unboxed typographic grid) */}
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-stone-500 font-medium">Variedad detectada</span>
                    <strong className="text-sm text-[#5C1125]">{draftTarget.variety}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-stone-500 font-medium">Ubicación en pasillo</span>
                    <span className="font-semibold text-[#000000] tabular-nums">
                      {describeAislePosition(
                        draftTarget.positionPercent,
                        draftTarget.lengthMeters
                      )}
                    </span>
                  </div>
                </div>

                {/* Date & Inspector */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="mon-date"
                      className="block text-xs font-bold text-stone-700 mb-1"
                    >
                      Fecha *
                    </label>
                    <input
                      id="mon-date"
                      type="date"
                      required
                      value={monitoringDate}
                      onChange={(e) => setMonitoringDate(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="mon-inspector"
                      className="block text-xs font-bold text-stone-700 mb-1"
                    >
                      Responsable
                    </label>
                    <input
                      id="mon-inspector"
                      type="text"
                      placeholder="Nombre..."
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-xs text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                    />
                  </div>
                </div>

                {/* Plaga / Enfermedad / Hallazgo */}
                <div>
                  <label
                    htmlFor="mon-finding"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Plaga, enfermedad o hallazgo *
                  </label>
                  <input
                    id="mon-finding"
                    type="text"
                    required
                    list="monitoring-findings-list"
                    placeholder="Ej. Araña roja, Trips, Cenicilla, Peronospora..."
                    value={pestOrFinding}
                    onChange={(e) => setPestOrFinding(e.target.value)}
                    autoFocus
                    className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                  />
                </div>

                {/* Porcentaje de incidencia (0 - 100%) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="mon-incidence"
                      className="text-xs font-bold text-stone-700"
                    >
                      Porcentaje de incidencia (%) *
                    </label>
                    <div className="relative w-20">
                      <input
                        id="mon-incidence"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        inputMode="numeric"
                        value={incidencePercent}
                        onChange={(e) =>
                          handleIncidenceChange(Number(e.target.value) || 0)
                        }
                        className="w-full h-8 pl-2 pr-6 rounded-lg border border-stone-300 bg-white text-xs font-extrabold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                        %
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    aria-label="Selector deslizante de porcentaje de incidencia"
                    value={incidencePercent}
                    onChange={(e) => handleIncidenceChange(Number(e.target.value))}
                    className="w-full accent-[#5C1125] cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-1">
                    {QUICK_INCIDENCE_STEPS.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleIncidenceChange(val)}
                        className={`flex-1 py-1 rounded-lg border text-[11px] font-bold tabular-nums transition cursor-pointer ${
                          incidencePercent === val
                            ? 'bg-[#5C1125] text-white border-[#5C1125]'
                            : 'bg-[#FAF8F5] text-stone-600 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severidad */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-stone-700">
                    Nivel de severidad *
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'baja', label: 'Baja', activeClass: 'bg-[#16A34A] text-white border-[#16A34A]' },
                        { id: 'media', label: 'Media', activeClass: 'bg-[#D97706] text-white border-[#D97706]' },
                        { id: 'alta', label: 'Alta', activeClass: 'bg-[#DC2626] text-white border-[#DC2626]' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSeverity(opt.id)}
                        className={`h-9 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          severity === opt.id
                            ? opt.activeClass
                            : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Acción recomendada */}
                <div>
                  <label
                    htmlFor="mon-action"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Acción recomendada
                  </label>
                  <input
                    id="mon-action"
                    type="text"
                    list="monitoring-actions-list"
                    placeholder="Ej. Parchoneo localizado, Aplicación general..."
                    value={recommendedAction}
                    onChange={(e) => setRecommendedAction(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-xs text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                  />
                </div>

                {/* Estado */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('activo')}
                    className={`h-9 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      status === 'activo'
                        ? 'bg-[#5C1125] text-white border-[#5C1125]'
                        : 'bg-[#FAF8F5] text-stone-700 border-stone-200'
                    }`}
                  >
                    Foco activo
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('controlado')}
                    className={`h-9 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      status === 'controlado'
                        ? 'bg-[#535B28] text-white border-[#535B28]'
                        : 'bg-[#FAF8F5] text-stone-700 border-stone-200'
                    }`}
                  >
                    Controlado
                  </button>
                </div>

                {/* Observaciones */}
                <div>
                  <label
                    htmlFor="mon-notes"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Observaciones de campo
                  </label>
                  <textarea
                    id="mon-notes"
                    rows={2}
                    placeholder="Detalles de brote, follaje afectado, notas para el aplicador..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                  />
                </div>

                {/* Submit / Cancel */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 h-10 px-4 rounded-xl bg-[#5C1125] hover:bg-[#460c1b] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    <Save className="w-4 h-4 text-[#C3A25D]" />
                    <span>
                      {saving
                        ? 'Guardando...'
                        : editingPinId
                        ? 'Actualizar marcador'
                        : 'Guardar marcador'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTarget(null);
                      setEditingPinId(null);
                    }}
                    className="h-10 px-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          ) : selectedPin ? (
            /* MODE B: Saved Pin Detail Inspector */
            <div className="divide-y divide-stone-100">
              <div className="px-5 py-4 bg-[#FAF8F5] flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-stone-500">
                    {selectedPin.unitName} · Módulo {selectedPin.moduleNumber} · Sección{' '}
                    {selectedPin.section} · Pasillo {selectedPin.aisleNumber}
                  </div>
                  <h2 className="text-base font-extrabold text-[#000000] mt-0.5">
                    {selectedPin.pestOrFinding}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPinId(null)}
                  className="w-8 h-8 rounded-lg text-stone-500 hover:text-[#5C1125] hover:bg-white inline-flex items-center justify-center cursor-pointer"
                  aria-label="Cerrar detalle"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Key facts (clean hairline rows, zero pill clutter) */}
                <dl className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-stone-500">Variedad</dt>
                    <dd className="font-extrabold text-[#5C1125] text-sm">
                      {selectedPin.variety}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-stone-500">Fecha</dt>
                    <dd className="font-semibold text-[#000000] tabular-nums">
                      {selectedPin.monitoringDate}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-stone-500">Posición exacta</dt>
                    <dd className="font-semibold text-[#000000] tabular-nums">
                      {describeAislePosition(
                        selectedPin.positionPercent,
                        getVarietyZoneForAisle(
                          selectedPin.unitId,
                          selectedPin.moduleNumber,
                          selectedPin.section,
                          selectedPin.aisleNumber
                        ).lengthMeters
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-stone-500">Severidad y estado</dt>
                    <dd className="font-bold">
                      <span className={SEVERITY_TEXT_CLASS[selectedPin.severity]}>
                        {SEVERITY_LABEL[selectedPin.severity]}
                      </span>
                      <span className="text-stone-400 mx-1.5">·</span>
                      <span
                        className={
                          selectedPin.status === 'controlado'
                            ? 'text-[#535B28]'
                            : 'text-[#5C1125]'
                        }
                      >
                        {selectedPin.status === 'controlado' ? 'Controlado' : 'Activo'}
                      </span>
                    </dd>
                  </div>
                </dl>

                {/* Incidence progress bar */}
                <div className="pt-2 border-t border-stone-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-600">Incidencia reportada</span>
                    <span className="font-extrabold text-[#000000] tabular-nums">
                      {selectedPin.incidencePercent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        selectedPin.status === 'controlado'
                          ? 'bg-slate-400'
                          : SEVERITY_BAR_CLASS[selectedPin.severity]
                      }`}
                      style={{
                        width: `${Math.max(4, Math.min(100, selectedPin.incidencePercent))}%`,
                      }}
                    />
                  </div>
                </div>

                {selectedPin.recommendedAction && (
                  <div className="pt-2 border-t border-stone-100 text-xs">
                    <div className="text-stone-500 font-medium">Acción recomendada</div>
                    <div className="font-bold text-[#000000] mt-0.5">
                      {selectedPin.recommendedAction}
                    </div>
                  </div>
                )}

                {selectedPin.inspectorName && (
                  <div className="text-xs flex items-center justify-between gap-2">
                    <span className="text-stone-500">Responsable</span>
                    <span className="font-semibold text-stone-800">
                      {selectedPin.inspectorName}
                    </span>
                  </div>
                )}

                {selectedPin.notes && (
                  <div className="pt-2 border-t border-stone-100 text-xs">
                    <div className="text-stone-500 font-medium">Observaciones</div>
                    <p className="text-stone-700 mt-0.5 leading-relaxed">
                      {selectedPin.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 border-t border-stone-100 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleToggleControlled(selectedPin)}
                    className={`w-full h-10 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      selectedPin.status === 'activo'
                        ? 'bg-[#535B28] hover:bg-[#3f461d] text-white'
                        : 'bg-[#FAF8F5] hover:bg-stone-100 text-[#5C1125] border border-stone-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selectedPin.status === 'activo'
                        ? 'Marcar como controlado'
                        : 'Reabrir como foco activo'}
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartEditPin(selectedPin)}
                      className="flex-1 h-9 px-3 rounded-xl border border-stone-200 bg-white hover:bg-[#FAF8F5] text-stone-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {confirmDeleteId === selectedPin.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeletePin(selectedPin.id)}
                          className="h-9 px-3 rounded-xl bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-9 px-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selectedPin.id)}
                        className="h-9 px-3 rounded-xl border border-stone-200 hover:border-rose-200 hover:bg-rose-50 text-stone-500 hover:text-[#5C1125] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* MODE C: Guidance + Quick Hotspot List for Active Unit */
            <div className="divide-y divide-stone-100">
              <div className="px-5 py-4 bg-[#FAF8F5]">
                <h2 className="text-sm font-extrabold text-[#000000]">
                  Marcadores en {activeUnit.shortName} ({pinsOnActiveUnit.length})
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Toca cualquier pasillo del croquis para registrar un nuevo punto de monitoreo o elige un marcador existente.
                </p>
              </div>

              {pinsOnActiveUnit.length === 0 ? (
                <div className="p-6 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-stone-200 text-[#5C1125] flex items-center justify-center mx-auto">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-bold text-[#000000]">
                    Sin marcadores visibles en {activeUnit.shortName}
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Haz clic directamente sobre el pasillo que deseas monitorear en el croquis de la izquierda para señalar el área exacta.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 max-h-[580px] overflow-y-auto">
                  {pinsOnActiveUnit.map((pin) => (
                    <button
                      key={pin.id}
                      type="button"
                      onClick={() => handleSelectPin(pin)}
                      className="w-full px-5 py-3.5 text-left hover:bg-[#FAF8F5] transition cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#000000] truncate">
                          {pin.pestOrFinding}
                        </span>
                        <span
                          className={`text-xs font-extrabold tabular-nums shrink-0 ${
                            pin.status === 'controlado'
                              ? 'text-slate-500'
                              : SEVERITY_TEXT_CLASS[pin.severity]
                          }`}
                        >
                          {pin.incidencePercent}% ·{' '}
                          {pin.status === 'controlado'
                            ? 'Controlado'
                            : SEVERITY_LABEL[pin.severity]}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-600 flex flex-wrap items-center gap-x-1.5">
                        <span className="font-semibold text-[#5C1125]">{pin.variety}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Mód. {pin.moduleNumber} · Sec. {pin.section} · Pasillo {pin.aisleNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums text-stone-500">
                          {pin.monitoringDate}
                        </span>
                      </div>
                      {pin.recommendedAction && (
                        <div className="text-[11px] text-[#535B28] font-medium truncate">
                          Acción: {pin.recommendedAction}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* 4. Filterable Monitoring History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#000000]">
              Historial de Monitoreos en Croquis ({tablePins.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Pulsa «Ver en croquis» en cualquier registro para señalar su ubicación exacta sobre el mapa.
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-[#FAF8F5] border border-stone-200 rounded-xl">
            <button
              type="button"
              onClick={() => setTableScope('todas')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                tableScope === 'todas'
                  ? 'bg-white text-[#5C1125] font-bold shadow-xs'
                  : 'text-stone-600'
              }`}
            >
              Todas las unidades
            </button>
            <button
              type="button"
              onClick={() => setTableScope('unidad')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                tableScope === 'unidad'
                  ? 'bg-white text-[#5C1125] font-bold shadow-xs'
                  : 'text-stone-600'
              }`}
            >
              Solo {activeUnit.shortName}
            </button>
          </div>
        </div>

        {tablePins.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-stone-500">
            No hay registros de monitoreo para los filtros seleccionados. Haz clic en cualquier pasillo del croquis superior para crear el primero.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-stone-200 text-xs font-bold text-stone-600">
                  <th className="py-3 pl-5 pr-3">Fecha</th>
                  <th className="py-3 px-3">Ubicación exacta</th>
                  <th className="py-3 px-3">Variedad</th>
                  <th className="py-3 px-3">Plaga / Hallazgo</th>
                  <th className="py-3 px-3 text-right">Incidencia</th>
                  <th className="py-3 px-3">Severidad / Estado</th>
                  <th className="py-3 px-3">Acción recomendada</th>
                  <th className="py-3 pl-3 pr-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tablePins.map((pin) => {
                  const isLocated = selectedPinId === pin.id;
                  return (
                    <tr
                      key={pin.id}
                      className={`transition-colors ${
                        isLocated ? 'bg-[#fbf2f4]/60' : 'hover:bg-[#FAF8F5]/70'
                      }`}
                    >
                      <td className="py-3 pl-5 pr-3 font-semibold text-[#000000] tabular-nums whitespace-nowrap text-xs">
                        {pin.monitoringDate}
                      </td>
                      <td className="py-3 px-3 text-xs text-stone-700 whitespace-nowrap">
                        <div className="font-bold text-[#000000]">
                          {pin.unitName} · Mód. {pin.moduleNumber}
                        </div>
                        <div className="text-[11px] text-stone-500 tabular-nums">
                          Sección {pin.section} · Pasillo {pin.aisleNumber}
                          {pin.positionMeters != null ? ` (${pin.positionMeters} m)` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-[#5C1125] text-xs whitespace-nowrap">
                        {pin.variety}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <div className="font-bold text-[#000000]">{pin.pestOrFinding}</div>
                        {pin.notes && (
                          <div className="text-[11px] text-stone-500 max-w-[220px] truncate">
                            {pin.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-[#000000] tabular-nums text-xs whitespace-nowrap">
                        {pin.incidencePercent}%
                      </td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        <span className={`font-bold ${SEVERITY_TEXT_CLASS[pin.severity]}`}>
                          {SEVERITY_LABEL[pin.severity]}
                        </span>
                        <span className="text-stone-400 mx-1.5">·</span>
                        <span
                          className={`font-semibold ${
                            pin.status === 'controlado'
                              ? 'text-[#535B28]'
                              : 'text-stone-700'
                          }`}
                        >
                          {pin.status === 'controlado' ? 'Controlado' : 'Activo'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-stone-600">
                        {pin.recommendedAction || '—'}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLocateOnMap(pin)}
                            className="h-8 px-2.5 rounded-lg border border-stone-200 hover:border-[#5C1125] bg-white text-stone-700 hover:text-[#5C1125] text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            title="Ubicar y señalar en el croquis"
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                            <span>Ver en croquis</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleControlled(pin)}
                            className="w-8 h-8 rounded-lg border border-stone-200 hover:border-[#535B28] text-stone-500 hover:text-[#535B28] inline-flex items-center justify-center transition cursor-pointer"
                            title={
                              pin.status === 'activo'
                                ? 'Marcar como controlado'
                                : 'Reabrir foco'
                            }
                            aria-label="Cambiar estado de control"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditPin(pin)}
                            className="w-8 h-8 rounded-lg border border-stone-200 hover:border-[#C3A25D] text-stone-500 hover:text-[#000000] inline-flex items-center justify-center transition cursor-pointer"
                            title="Editar monitoreo"
                            aria-label="Editar monitoreo"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === pin.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeletePin(pin.id)}
                              className="h-8 px-2 rounded-lg bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                            >
                              Borrar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(pin.id)}
                              className="w-8 h-8 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 text-stone-400 hover:text-[#5C1125] inline-flex items-center justify-center transition cursor-pointer"
                              title="Eliminar monitoreo"
                              aria-label="Eliminar monitoreo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
