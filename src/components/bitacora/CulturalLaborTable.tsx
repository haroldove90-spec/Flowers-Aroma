import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Plus,
  Copy,
  Trash2,
  Check,
  Calendar,
  Filter,
  RotateCcw,
  CheckCircle2,
  ClipboardList,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  BITACORA_ACTIVITY_SUGGESTIONS,
  BITACORA_MODULES,
  BitacoraEntry,
  BitacoraStatus,
} from '../../types/greenhouse';
import { useGreenhouse } from '../../context/GreenhouseContext';

const getTodayLocalISO = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatReadableDate = (isoDate: string): string => {
  if (!isoDate) return 'Sin fecha';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const deriveStatus = (progressPercent: number): BitacoraStatus => {
  if (progressPercent >= 100) return 'terminado';
  if (progressPercent > 0) return 'en_proceso';
  return 'pendiente';
};

const getStatusLabel = (progressPercent: number): string => {
  if (progressPercent >= 100) return 'Terminado';
  if (progressPercent > 0) return 'En proceso';
  return 'Pendiente';
};

export const CulturalLaborTable: React.FC = () => {
  const {
    bitacoraEntries,
    saveBitacoraEntry,
    deleteBitacoraEntry,
    currentUser,
  } = useGreenhouse();

  const todayIso = useMemo(() => getTodayLocalISO(), []);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [showAllDates, setShowAllDates] = useState<boolean>(false);
  const [selectedModule, setSelectedModule] = useState<string>('TODOS');

  // Inline UI helpers
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeSuggestionRowId, setActiveSuggestionRowId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  // Local draft overrides for smooth typing without lag, synced debounced to context/Supabase
  const [drafts, setDrafts] = useState<Record<string, Partial<BitacoraEntry>>>({});
  const debounceTimersRef = useRef<Record<string, number>>({});
  const activityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach((timerId) =>
        window.clearTimeout(timerId)
      );
    };
  }, []);

  // Auto-focus activity input when a new row is added
  useEffect(() => {
    if (!newlyAddedId) return;
    const targetInput = activityInputRefs.current[newlyAddedId];
    if (targetInput) {
      targetInput.focus();
    }
    const clear = window.setTimeout(() => setNewlyAddedId(null), 500);
    return () => window.clearTimeout(clear);
  }, [newlyAddedId]);

  const showToast = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setFeedback({ text, tone });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 3200);
  };

  // All cultural labor rows merged with any active local typing draft
  const culturalEntries = useMemo(() => {
    return bitacoraEntries
      .filter((entry) => entry.category === 'labores_culturales')
      .map((entry) => {
        const draft = drafts[entry.id];
        return draft ? { ...entry, ...draft } : entry;
      })
      .sort((a, b) => {
        // Primary sort by date ascending when browsing all dates? Keep chronological or newest date first,
        // and within the same day strictly ascending by sortOrder so new rows append downward!
        if (a.entryDate !== b.entryDate) {
          return b.entryDate.localeCompare(a.entryDate);
        }
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
  }, [bitacoraEntries, drafts]);

  // Filtered rows according to active date & module filters
  const filteredEntries = useMemo(() => {
    return culturalEntries.filter((entry) => {
      if (!showAllDates && selectedDate && entry.entryDate !== selectedDate) {
        return false;
      }
      if (selectedModule !== 'TODOS' && entry.moduleName !== selectedModule) {
        return false;
      }
      return true;
    });
  }, [culturalEntries, showAllDates, selectedDate, selectedModule]);

  // Dynamic summary KPIs computed strictly from filteredEntries
  const summary = useMemo(() => {
    const count = filteredEntries.length;
    const totalPersonnel = filteredEntries.reduce(
      (acc, row) => acc + Math.max(0, Math.round(Number(row.personnelCount || 0))),
      0
    );
    const avgProgress =
      count > 0
        ? Math.round(
            filteredEntries.reduce(
              (acc, row) => acc + Math.max(0, Math.min(100, Number(row.progressPercent || 0))),
              0
            ) / count
          )
        : 0;
    const completedCount = filteredEntries.filter((r) => Number(r.progressPercent || 0) >= 100).length;
    const inProgressCount = filteredEntries.filter(
      (r) => Number(r.progressPercent || 0) > 0 && Number(r.progressPercent || 0) < 100
    ).length;

    return {
      count,
      totalPersonnel,
      avgProgress,
      completedCount,
      inProgressCount,
    };
  }, [filteredEntries]);

  // Persist helper (immediate or debounced)
  const commitRowUpdate = async (
    baseRow: BitacoraEntry,
    patch: Partial<BitacoraEntry>,
    immediate = false
  ) => {
    const merged: BitacoraEntry = { ...baseRow, ...patch };
    const pct = Math.max(0, Math.min(100, Math.round(Number(merged.progressPercent || 0))));
    merged.progressPercent = pct;
    merged.status = deriveStatus(pct);
    merged.personnelCount = Math.max(0, Math.round(Number(merged.personnelCount || 0)));

    setDrafts((prev) => ({
      ...prev,
      [baseRow.id]: { ...(prev[baseRow.id] || {}), ...patch, progressPercent: pct, status: merged.status },
    }));

    const executeSave = async () => {
      const res = await saveBitacoraEntry(
        {
          category: 'labores_culturales',
          entryDate: merged.entryDate,
          moduleName: merged.moduleName,
          activity: merged.activity,
          personnelCount: merged.personnelCount,
          progressPercent: merged.progressPercent,
          status: merged.status,
          notes: merged.notes || '',
          extraData: merged.extraData || {},
          createdBy: merged.createdBy || currentUser?.fullName || '',
          sortOrder: merged.sortOrder,
        },
        baseRow.id
      );

      setDrafts((prev) => {
        const next = { ...prev };
        delete next[baseRow.id];
        return next;
      });

      if (!res.cloudSynced && res.cloudError && !res.cloudError.includes('Sin conexión')) {
        showToast('Guardado local (pendiente sincronizar tabla en Supabase).', 'warn');
      }
    };

    if (debounceTimersRef.current[baseRow.id]) {
      window.clearTimeout(debounceTimersRef.current[baseRow.id]);
      delete debounceTimersRef.current[baseRow.id];
    }

    if (immediate) {
      await executeSave();
    } else {
      debounceTimersRef.current[baseRow.id] = window.setTimeout(() => {
        delete debounceTimersRef.current[baseRow.id];
        executeSave();
      }, 420);
    }
  };

  // Add new editable row downward preserving selected date & module
  const handleAddActivity = async () => {
    const targetDate = selectedDate || todayIso;
    const defaultModule =
      selectedModule !== 'TODOS' ? selectedModule : BITACORA_MODULES[0];
    const maxSortOrder = culturalEntries.reduce(
      (max, item) => Math.max(max, Number(item.sortOrder || 0)),
      0
    );

    const res = await saveBitacoraEntry({
      category: 'labores_culturales',
      entryDate: targetDate,
      moduleName: defaultModule,
      activity: '',
      personnelCount: 0,
      progressPercent: 0,
      status: 'pendiente',
      notes: '',
      extraData: {},
      createdBy: currentUser?.fullName || '',
      sortOrder: Math.max(Date.now(), maxSortOrder + 10),
    });

    if (res.entry) {
      setNewlyAddedId(res.entry.id);
      if (showAllDates === false && res.entry.entryDate !== selectedDate) {
        setSelectedDate(res.entry.entryDate);
      }
    }
    showToast(
      res.cloudSynced
        ? 'Nueva actividad agregada y sincronizada.'
        : 'Nueva actividad agregada localmente.',
      res.cloudSynced ? 'ok' : 'warn'
    );
  };

  // Duplicate existing row directly underneath (at bottom of day's list)
  const handleDuplicateRow = async (row: BitacoraEntry) => {
    const maxSortOrder = culturalEntries.reduce(
      (max, item) => Math.max(max, Number(item.sortOrder || 0)),
      0
    );
    const res = await saveBitacoraEntry({
      category: 'labores_culturales',
      entryDate: row.entryDate,
      moduleName: row.moduleName,
      activity: row.activity,
      personnelCount: row.personnelCount,
      progressPercent: row.progressPercent,
      status: row.status,
      notes: row.notes || '',
      extraData: row.extraData || {},
      createdBy: currentUser?.fullName || '',
      sortOrder: Math.max(Date.now(), maxSortOrder + 10),
    });
    if (res.entry) {
      setNewlyAddedId(res.entry.id);
    }
    showToast('Actividad duplicada.');
  };

  // Delete row cleanly
  const handleDeleteRow = async (id: string) => {
    if (debounceTimersRef.current[id]) {
      window.clearTimeout(debounceTimersRef.current[id]);
      delete debounceTimersRef.current[id];
    }
    setConfirmDeleteId(null);
    await deleteBitacoraEntry(id);
    showToast('Actividad eliminada.');
  };

  const handleResetFilters = () => {
    setSelectedDate(todayIso);
    setShowAllDates(false);
    setSelectedModule('TODOS');
  };

  const hasActiveCustomFilter =
    showAllDates || selectedDate !== todayIso || selectedModule !== 'TODOS';

  return (
    <div className="space-y-5">
      {/* Shared datalist for native browser autocomplete on Actividad */}
      <datalist id="bitacora-cultural-suggestions">
        {BITACORA_ACTIVITY_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {/* Dynamic Summary Strip (3 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Actividades del día */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-stone-500">
              {showAllDates ? 'Actividades registradas' : 'Actividades del día'}
            </span>
            <ClipboardList className="w-4 h-4 text-[#5C1125] shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-3xl font-extrabold text-[#000000] tabular-nums tracking-tight">
              {summary.count}
            </span>
            <span className="text-xs text-stone-500 tabular-nums">
              {summary.completedCount} terminadas · {summary.inProgressCount} en proceso
            </span>
          </div>
        </div>

        {/* KPI 2: Total de personal asignado */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-stone-500">
              Total de personal asignado
            </span>
            <Users className="w-4 h-4 text-[#535B28] shrink-0" />
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-3xl font-extrabold text-[#000000] tabular-nums tracking-tight">
              {summary.totalPersonnel.toLocaleString('es-MX')}
            </span>
            <span className="text-xs text-stone-500">
              {summary.totalPersonnel === 1 ? 'trabajador' : 'trabajadores'}
            </span>
          </div>
        </div>

        {/* KPI 3: Promedio de avance general */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-stone-500">
              Promedio de avance general
            </span>
            <TrendingUp className="w-4 h-4 text-[#C3A25D] shrink-0" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-3xl font-extrabold text-[#000000] tabular-nums tracking-tight">
                {summary.avgProgress}%
              </span>
              <span className="text-xs font-semibold text-[#535B28]">
                {summary.count === 0
                  ? 'Sin captura'
                  : summary.avgProgress >= 100
                  ? 'Jornada completa'
                  : 'En ejecución'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  summary.avgProgress >= 100
                    ? 'bg-[#535B28]'
                    : summary.avgProgress > 0
                    ? 'bg-[#C3A25D]'
                    : 'bg-stone-300'
                }`}
                style={{ width: `${summary.avgProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Surface: Filter Toolbar + Interactive Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {/* Top Filter & Primary Action Bar */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="bitacora-date-filter"
                className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Calendar className="w-3.5 h-3.5 text-[#5C1125]" />
                <span>Fecha</span>
              </label>
              <input
                id="bitacora-date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setShowAllDates(false);
                }}
                className={`h-10 px-3 rounded-xl border text-sm font-medium text-[#000000] bg-white focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] tabular-nums transition ${
                  showAllDates ? 'border-stone-200 text-stone-400' : 'border-stone-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowAllDates((prev) => !prev)}
                className={`h-10 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  showAllDates
                    ? 'bg-[#5C1125] text-white border-[#5C1125]'
                    : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {showAllDates ? 'Mostrando todas' : 'Ver todas'}
              </button>
            </div>

            {/* Module Filter */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="bitacora-module-filter"
                className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Filter className="w-3.5 h-3.5 text-[#535B28]" />
                <span>Módulo</span>
              </label>
              <select
                id="bitacora-module-filter"
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="h-10 px-3 pr-8 rounded-xl border border-stone-300 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] transition"
              >
                <option value="TODOS">Todos los módulos</option>
                {BITACORA_MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveCustomFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-10 px-3 rounded-xl text-xs font-semibold text-stone-600 hover:text-[#5C1125] hover:bg-stone-100 inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                title="Volver al filtro de hoy y todos los módulos"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Hoy</span>
              </button>
            )}
          </div>

          {/* Primary CTA: + Agregar actividad */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            {feedback && (
              <span
                className={`text-xs font-medium ${
                  feedback.tone === 'ok' ? 'text-[#535B28]' : 'text-amber-700'
                }`}
              >
                {feedback.text}
              </span>
            )}
            <button
              type="button"
              onClick={handleAddActivity}
              className="h-10 px-4 rounded-xl bg-[#5C1125] hover:bg-[#460c1b] active:scale-[0.99] text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#C3A25D] stroke-[2.5px]" />
              <span>+ Agregar actividad</span>
            </button>
          </div>
        </div>

        {/* Context sub-header line */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#FAF8F5] border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#000000]">Labores culturales</span>
            <span aria-hidden="true">·</span>
            <span>
              {showAllDates
                ? 'Historial completo de fechas'
                : formatReadableDate(selectedDate)}
            </span>
            {selectedModule !== 'TODOS' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#535B28]">{selectedModule}</span>
              </>
            )}
          </div>
          <span className="text-stone-500">
            Los cambios se guardan automáticamente
          </span>
        </div>

        {/* Empty State */}
        {filteredEntries.length === 0 ? (
          <div className="px-6 py-14 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center mx-auto">
              <ClipboardList className="w-6 h-6 text-[#5C1125]" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-[#000000]">
                Sin labores culturales registradas
              </h3>
              <p className="text-sm text-stone-500">
                {showAllDates
                  ? 'Aún no hay actividades capturadas para los filtros seleccionados.'
                  : `No hay actividades registradas para el ${formatReadableDate(selectedDate)}${
                      selectedModule !== 'TODOS' ? ` en ${selectedModule}` : ''
                    }.`}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleAddActivity}
                className="h-10 px-4 rounded-xl bg-[#5C1125] hover:bg-[#460c1b] text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-[#C3A25D]" />
                <span>+ Agregar primera actividad</span>
              </button>
              {culturalEntries.length > 0 && !showAllDates && (
                <button
                  type="button"
                  onClick={() => setShowAllDates(true)}
                  className="h-10 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-sm font-semibold transition cursor-pointer whitespace-nowrap"
                >
                  Ver historial ({culturalEntries.length})
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE (lg+) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-stone-200 text-xs font-bold text-stone-600">
                    <th className="py-3 pl-5 pr-3 w-[156px]">Fecha</th>
                    <th className="py-3 px-3 w-[215px]">Módulo</th>
                    <th className="py-3 px-3 min-w-[230px]">Actividad</th>
                    <th className="py-3 px-3 w-[120px] text-right">Personal</th>
                    <th className="py-3 px-3 w-[275px]">Status</th>
                    <th className="py-3 pl-3 pr-5 w-[108px] text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredEntries.map((row) => {
                    const pct = Math.max(
                      0,
                      Math.min(100, Math.round(Number(row.progressPercent || 0)))
                    );
                    const isDone = pct >= 100;
                    const statusLabel = getStatusLabel(pct);
                    const isConfirmingDelete = confirmDeleteId === row.id;

                    return (
                      <tr
                        key={row.id}
                        className="group hover:bg-[#FAF8F5]/70 transition-colors align-top"
                      >
                        {/* 1. Fecha */}
                        <td className="py-3 pl-5 pr-3">
                          <input
                            type="date"
                            aria-label="Fecha de actividad"
                            value={row.entryDate}
                            onChange={(e) =>
                              commitRowUpdate(row, { entryDate: e.target.value }, true)
                            }
                            className="w-full h-10 px-2.5 rounded-lg border border-stone-200 bg-white text-sm text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                          />
                        </td>

                        {/* 2. Módulo */}
                        <td className="py-3 px-3">
                          <select
                            aria-label="Módulo agrícola"
                            value={row.moduleName}
                            onChange={(e) =>
                              commitRowUpdate(row, { moduleName: e.target.value }, true)
                            }
                            className="w-full h-10 px-2.5 rounded-lg border border-stone-200 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                          >
                            {BITACORA_MODULES.map((mod) => (
                              <option key={mod} value={mod}>
                                {mod}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 3. Actividad (free text + autocomplete + quick suggestions on focus) */}
                        <td className="py-3 px-3">
                          <div className="relative">
                            <input
                              ref={(el) => {
                                activityInputRefs.current[row.id] = el;
                              }}
                              type="text"
                              list="bitacora-cultural-suggestions"
                              aria-label="Actividad realizada"
                              placeholder="Ej. Corte, Deshierbe, Poda..."
                              value={row.activity}
                              onFocus={() => setActiveSuggestionRowId(row.id)}
                              onBlur={() => {
                                window.setTimeout(() => {
                                  setActiveSuggestionRowId((cur) =>
                                    cur === row.id ? null : cur
                                  );
                                }, 180);
                              }}
                              onChange={(e) =>
                                commitRowUpdate(row, { activity: e.target.value }, false)
                              }
                              className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                            />
                            {activeSuggestionRowId === row.id && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {BITACORA_ACTIVITY_SUGGESTIONS.slice(0, 6).map((sug) => (
                                  <button
                                    key={sug}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      commitRowUpdate(row, { activity: sug }, true);
                                      setActiveSuggestionRowId(null);
                                    }}
                                    className="px-2 py-1 rounded-md text-[11px] font-medium bg-[#FAF8F5] hover:bg-[#5C1125] hover:text-white text-stone-700 border border-stone-200 transition cursor-pointer"
                                  >
                                    {sug}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 4. Personal */}
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            aria-label="Cantidad de personal asignado"
                            placeholder="0"
                            value={row.personnelCount === 0 ? '' : row.personnelCount}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsed = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0));
                              commitRowUpdate(row, { personnelCount: parsed }, false);
                            }}
                            className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm font-bold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>

                        {/* 5. Status (Terminado 100% toggle + numeric % + visual bar & label) */}
                        <td className="py-3 px-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  commitRowUpdate(
                                    row,
                                    {
                                      progressPercent: isDone ? 50 : 100,
                                      status: isDone ? 'en_proceso' : 'terminado',
                                    },
                                    true
                                  )
                                }
                                className={`h-10 px-3 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                                  isDone
                                    ? 'bg-[#535B28] text-white border-[#535B28]'
                                    : 'bg-white text-stone-700 border-stone-200 hover:border-[#535B28] hover:text-[#535B28]'
                                }`}
                                title={
                                  isDone
                                    ? 'Marcar en proceso (50%)'
                                    : 'Marcar como Terminado (100%)'
                                }
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Terminado</span>
                              </button>

                              <div className="relative w-20 shrink-0">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={5}
                                  inputMode="numeric"
                                  aria-label="Porcentaje de avance"
                                  value={pct}
                                  onChange={(e) => {
                                    const val = Math.max(
                                      0,
                                      Math.min(100, Math.round(Number(e.target.value) || 0))
                                    );
                                    commitRowUpdate(
                                      row,
                                      { progressPercent: val, status: deriveStatus(val) },
                                      false
                                    );
                                  }}
                                  className="w-full h-10 pl-2.5 pr-6 rounded-lg border border-stone-200 bg-white text-sm font-bold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400">
                                  %
                                </span>
                              </div>
                            </div>

                            {/* Progress bar + explicit state text */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-200 ${
                                    isDone
                                      ? 'bg-[#535B28]'
                                      : pct > 0
                                      ? 'bg-[#C3A25D]'
                                      : 'bg-stone-300'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span
                                className={`text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                                  isDone
                                    ? 'text-[#535B28]'
                                    : pct > 0
                                    ? 'text-amber-700'
                                    : 'text-stone-500'
                                }`}
                              >
                                {statusLabel} · {pct}%
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 6. Acciones */}
                        <td className="py-3 pl-3 pr-5">
                          <div className="flex items-center justify-end gap-1.5 h-10">
                            {isConfirmingDelete ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(row.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold hover:bg-[#420b1a] transition cursor-pointer"
                                >
                                  Borrar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-100 transition cursor-pointer"
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateRow(row)}
                                  className="w-9 h-9 rounded-lg border border-transparent hover:border-stone-200 hover:bg-white text-stone-500 hover:text-[#535B28] inline-flex items-center justify-center transition cursor-pointer"
                                  title="Duplicar actividad"
                                  aria-label="Duplicar actividad"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(row.id)}
                                  className="w-9 h-9 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 text-stone-500 hover:text-[#5C1125] inline-flex items-center justify-center transition cursor-pointer"
                                  title="Eliminar actividad"
                                  aria-label="Eliminar actividad"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE & TABLET RESPONSIVE CARDS (<lg) */}
            <div className="lg:hidden divide-y divide-stone-200">
              {filteredEntries.map((row, idx) => {
                const pct = Math.max(
                  0,
                  Math.min(100, Math.round(Number(row.progressPercent || 0)))
                );
                const isDone = pct >= 100;
                const statusLabel = getStatusLabel(pct);
                const isConfirmingDelete = confirmDeleteId === row.id;

                return (
                  <div key={row.id} className="p-4 space-y-3.5 bg-white">
                    {/* Row Header + Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-500 tabular-nums">
                        Actividad #{idx + 1} · {statusLabel} ({pct}%)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isConfirmingDelete ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                            >
                              Eliminar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(row)}
                              className="h-9 px-2.5 rounded-lg border border-stone-200 text-stone-600 hover:text-[#535B28] inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Duplicar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(row.id)}
                              className="h-9 w-9 rounded-lg border border-stone-200 text-stone-500 hover:text-[#5C1125] inline-flex items-center justify-center cursor-pointer"
                              aria-label="Eliminar actividad"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Fecha + Módulo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={row.entryDate}
                          onChange={(e) =>
                            commitRowUpdate(row, { entryDate: e.target.value }, true)
                          }
                          className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-sm text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                          Módulo
                        </label>
                        <select
                          value={row.moduleName}
                          onChange={(e) =>
                            commitRowUpdate(row, { moduleName: e.target.value }, true)
                          }
                          className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                        >
                          {BITACORA_MODULES.map((mod) => (
                            <option key={mod} value={mod}>
                              {mod}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Actividad + quick suggestions */}
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Actividad
                      </label>
                      <input
                        type="text"
                        list="bitacora-cultural-suggestions"
                        placeholder="Ej. Corte, Deshierbe, Poda..."
                        value={row.activity}
                        onChange={(e) =>
                          commitRowUpdate(row, { activity: e.target.value }, false)
                        }
                        className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-sm text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                      />
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {BITACORA_ACTIVITY_SUGGESTIONS.slice(0, 5).map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => commitRowUpdate(row, { activity: sug }, true)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                              row.activity === sug
                                ? 'bg-[#5C1125] text-white border-[#5C1125]'
                                : 'bg-[#FAF8F5] text-stone-700 border-stone-200'
                            }`}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Personal + Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                          Personal asignado
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          placeholder="0"
                          value={row.personnelCount === 0 ? '' : row.personnelCount}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0));
                            commitRowUpdate(row, { personnelCount: parsed }, false);
                          }}
                          className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-sm font-bold text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                          Status y avance (%)
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              commitRowUpdate(
                                row,
                                {
                                  progressPercent: isDone ? 50 : 100,
                                  status: isDone ? 'en_proceso' : 'terminado',
                                },
                                true
                              )
                            }
                            className={`flex-1 h-11 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                              isDone
                                ? 'bg-[#535B28] text-white border-[#535B28]'
                                : 'bg-white text-stone-700 border-stone-200'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Terminado</span>
                          </button>

                          <div className="relative w-24 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={5}
                              inputMode="numeric"
                              value={pct}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(100, Math.round(Number(e.target.value) || 0))
                                );
                                commitRowUpdate(
                                  row,
                                  { progressPercent: val, status: deriveStatus(val) },
                                  false
                                );
                              }}
                              className="w-full h-11 pl-3 pr-7 rounded-xl border border-stone-200 bg-white text-sm font-bold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400">
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          isDone
                            ? 'bg-[#535B28]'
                            : pct > 0
                            ? 'bg-[#C3A25D]'
                            : 'bg-stone-300'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom quick-add row footer for rapid multi-activity entry */}
            <div className="px-4 sm:px-5 py-3 bg-[#FAF8F5] border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAddActivity}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#5C1125] hover:text-[#420b1a] transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar otra actividad para esta fecha</span>
              </button>

              <div className="flex items-center gap-3 text-xs text-stone-600 tabular-nums">
                <span>
                  {summary.count} {summary.count === 1 ? 'actividad' : 'actividades'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Personal total:{' '}
                  <strong className="text-[#000000]">
                    {summary.totalPersonnel.toLocaleString('es-MX')}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Avance promedio:{' '}
                  <strong className="text-[#535B28]">{summary.avgProgress}%</strong>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
