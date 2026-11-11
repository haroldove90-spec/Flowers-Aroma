import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  PlusCircle,
  Table,
  History,
  Download,
  Printer,
  Trash2,
  Edit3,
  CheckCircle2,
  Calendar,
  User,
  Sparkles,
  ArrowRight,
  Filter,
  Package,
  Layers,
  TrendingUp,
  Boxes,
  Scale,
  RefreshCw,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  AROMA_FLOWER_VARIETIES,
  AromaFlowerModuleType,
  AromaFlowerSheetEntry,
  VarietyQuantityRow,
} from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';

interface ModuleConfig {
  id: AromaFlowerModuleType;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultResponsable: string;
}

const MODULES_CONFIG: ModuleConfig[] = [
  {
    id: 'fi_general',
    title: 'FI-General',
    subtitle: 'Ficha Individual y Control General de Rosas',
    icon: FileSpreadsheet,
    defaultResponsable: 'Aroma Flowers Equipo General',
  },
  {
    id: 'produccion_aaron',
    title: 'Producción Aarón',
    subtitle: 'Corte y Cosecha Diaria por Productor',
    icon: Boxes,
    defaultResponsable: 'Aarón Hernández',
  },
  {
    id: 'suma_paquetes',
    title: 'Suma de Paquetes',
    subtitle: 'Consolidado Diario de Empaque y Cámara Fría',
    icon: Package,
    defaultResponsable: 'Mesa de Empaque y Clasificación',
  },
  {
    id: 'resumen_variedades',
    title: 'Resumen de Variedades',
    subtitle: 'Balance de Inventario y Existencias Activas',
    icon: Layers,
    defaultResponsable: 'Control de Inventarios',
  },
  {
    id: 'venta',
    title: 'Venta Diaria',
    subtitle: 'Salidas y Despachos Comerciales',
    icon: TrendingUp,
    defaultResponsable: 'Despacho Comercial',
  },
  {
    id: 'resumen_venta',
    title: 'Resumen de Venta',
    subtitle: 'Consolidado Comercial por Calibres Facturados',
    icon: Scale,
    defaultResponsable: 'Administración de Ventas',
  },
  {
    id: 'matriz_2026',
    title: 'Matriz Anual 2026',
    subtitle: 'Producción y Venta Global 2026',
    icon: Sparkles,
    defaultResponsable: 'Aarón / Dirección Comercial',
  },
];

export const AromaFlowersRoleView: React.FC = () => {
  const { aromaSheets, saveAromaSheet, deleteAromaSheet, activeView, setActiveView } = useGreenhouse();

  // Active module inside Aroma Flowers
  const currentModuleId: AromaFlowerModuleType = useMemo(() => {
    const valid = MODULES_CONFIG.find((m) => m.id === activeView);
    return valid ? valid.id : 'fi_general';
  }, [activeView]);

  const activeModuleConfig = MODULES_CONFIG.find((m) => m.id === currentModuleId) || MODULES_CONFIG[0];

  // Active sub-tab: 'planilla' (Excel-style spreadsheet), 'individual' (single entry form), or 'historial' (records)
  const [activeTab, setActiveTab] = useState<'planilla' | 'individual' | 'historial'>('planilla');

  // Sheet draft form state
  const [sheetDate, setSheetDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [responsable, setResponsable] = useState<string>(activeModuleConfig.defaultResponsable);
  const [sheetNotes, setSheetNotes] = useState<string>('');
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize draft rows for all 16 varieties
  const initializeEmptyRows = (): VarietyQuantityRow[] => {
    return AROMA_FLOWER_VARIETIES.map((v) => ({
      variedad: v,
      lar: 0,
      med: 0,
      chi: 0,
      total: 0,
    }));
  };

  const [draftRows, setDraftRows] = useState<VarietyQuantityRow[]>(() => {
    // If a saved sheet exists for this module, prepopulate or initialize
    const existing = aromaSheets.find((s) => s.moduleType === currentModuleId);
    if (existing && existing.rows?.length > 0) {
      return JSON.parse(JSON.stringify(existing.rows));
    }
    return initializeEmptyRows();
  });

  // Single form state for Tab 'individual'
  const [singleVariety, setSingleVariety] = useState<string>(AROMA_FLOWER_VARIETIES[0]);
  const [singleLar, setSingleLar] = useState<number>(0);
  const [singleMed, setSingleMed] = useState<number>(0);
  const [singleChi, setSingleChi] = useState<number>(0);

  // History search/filter
  const [historySearchDate, setHistorySearchDate] = useState<string>('');

  // Handle cell edits in spreadsheet mode
  const handleCellChange = (
    index: number,
    field: 'lar' | 'med' | 'chi',
    value: number
  ) => {
    const val = isNaN(value) || value < 0 ? 0 : value;
    setDraftRows((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target[field] = val;
      target.total = target.lar + target.med + target.chi;
      copy[index] = target;
      return copy;
    });
  };

  // Quick totals calculated live
  const calculatedTotals = useMemo(() => {
    let sumLar = 0;
    let sumMed = 0;
    let sumChi = 0;
    draftRows.forEach((r) => {
      sumLar += Number(r.lar || 0);
      sumMed += Number(r.med || 0);
      sumChi += Number(r.chi || 0);
    });
    return {
      lar: sumLar,
      med: sumMed,
      chi: sumChi,
      grandTotal: sumLar + sumMed + sumChi,
    };
  }, [draftRows]);

  // Save full sheet
  const handleSaveSheet = () => {
    saveAromaSheet(
      {
        moduleType: currentModuleId,
        date: sheetDate,
        responsable: responsable.trim() || activeModuleConfig.defaultResponsable,
        title: `AROMA FLOWERS - ${activeModuleConfig.title.toUpperCase()}`,
        rows: draftRows,
        totalLar: calculatedTotals.lar,
        totalMed: calculatedTotals.med,
        totalChi: calculatedTotals.chi,
        grandTotal: calculatedTotals.grandTotal,
        notes: sheetNotes.trim(),
      },
      editingSheetId || undefined
    );

    setEditingSheetId(null);
    setToastMessage(`Planilla "${activeModuleConfig.title}" guardada exitosamente.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load an existing record to edit
  const handleLoadSheetForEdit = (sheet: AromaFlowerSheetEntry) => {
    setDraftRows(JSON.parse(JSON.stringify(sheet.rows)));
    setSheetDate(sheet.date);
    setResponsable(sheet.responsable);
    setSheetNotes(sheet.notes || '');
    setEditingSheetId(sheet.id);
    setActiveTab('planilla');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setToastMessage(`Cargada planilla del ${sheet.date} para edición.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Clear draft
  const handleResetDraft = () => {
    setDraftRows(initializeEmptyRows());
    setEditingSheetId(null);
    setToastMessage('Planilla reiniciada en ceros.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Add individual variety row
  const handleAddSingleRow = (e: React.FormEvent) => {
    e.preventDefault();
    const calculatedTotal = singleLar + singleMed + singleChi;
    setDraftRows((prev) => {
      const idx = prev.findIndex((r) => r.variedad === singleVariety);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          variedad: singleVariety,
          lar: singleLar,
          med: singleMed,
          chi: singleChi,
          total: calculatedTotal,
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            variedad: singleVariety,
            lar: singleLar,
            med: singleMed,
            chi: singleChi,
            total: calculatedTotal,
          },
        ];
      }
    });

    setToastMessage(`Variedad ${singleVariety} actualizada (${calculatedTotal} total).`);
    setTimeout(() => setToastMessage(null), 2500);
    // Reset inputs
    setSingleLar(0);
    setSingleMed(0);
    setSingleChi(0);
  };

  // Export sheet to CSV matching the user's Excel format
  const exportToCsv = (sheet: AromaFlowerSheetEntry) => {
    let csv = `AROMA FLOWERS - ${sheet.title}\n`;
    csv += `Fecha: ${sheet.date} | Responsable: ${sheet.responsable}\n\n`;
    csv += `VARIEDAD,LAR,MED,CHI,TOTAL\n`;
    sheet.rows.forEach((r) => {
      csv += `${r.variedad},${r.lar},${r.med},${r.chi},${r.total}\n`;
    });
    csv += `TOTAL,${sheet.totalLar},${sheet.totalMed},${sheet.totalChi},${sheet.grandTotal}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AromaFlowers_${sheet.moduleType}_${sheet.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered sheets for this module
  const moduleSheets = useMemo(() => {
    return aromaSheets
      .filter((s) => s.moduleType === currentModuleId)
      .filter((s) => (historySearchDate ? s.date === historySearchDate : true))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [aromaSheets, currentModuleId, historySearchDate]);

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#5C1125] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#C3A25D]/50 flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-slideDown">
          <CheckCircle2 className="w-4 h-4 text-[#C3A25D] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Institutional Hero Banner */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-[#C3A25D]/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AromaFlowersLogo size="lg" className="shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C3A25D]">
                  Rol Operativo &bull; Aroma Flowers
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#535B28] text-white">
                  7 Módulos Excel
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                {activeModuleConfig.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                {activeModuleConfig.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-black/30 p-2.5 rounded-xl border border-white/10">
            <User className="w-4 h-4 text-[#C3A25D]" />
            <div className="text-left text-xs">
              <span className="text-stone-400 block text-[10px] uppercase font-semibold">Responsable</span>
              <span className="font-bold text-white">{responsable}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Selector (7 Excel Sheets) */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {MODULES_CONFIG.map((mod) => {
            const Icon = mod.icon;
            const isSelected = mod.id === currentModuleId;
            return (
              <button
                key={mod.id}
                onClick={() => {
                  setActiveView(mod.id);
                  setEditingSheetId(null);
                  setResponsable(mod.defaultResponsable);
                  // Load data if available
                  const found = aromaSheets.find((s) => s.moduleType === mod.id);
                  if (found) {
                    setDraftRows(JSON.parse(JSON.stringify(found.rows)));
                    setSheetDate(found.date);
                  } else {
                    setDraftRows(initializeEmptyRows());
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#5C1125] text-white shadow-md border border-[#C3A25D]/40'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-[#C3A25D]' : 'text-stone-400'}`} />
                <span>{mod.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Cards of Current Sheet */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#535B28] uppercase tracking-wider">Largo (LAR)</span>
            <span className="w-2 h-2 rounded-full bg-[#535B28]" />
          </div>
          <p className="mt-1 text-2xl font-black text-[#000000]">{calculatedTotals.lar}</p>
          <span className="text-[10px] text-stone-500">Tallos / Paquetes largos</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#C3A25D] uppercase tracking-wider">Mediano (MED)</span>
            <span className="w-2 h-2 rounded-full bg-[#C3A25D]" />
          </div>
          <p className="mt-1 text-2xl font-black text-[#000000]">{calculatedTotals.med}</p>
          <span className="text-[10px] text-stone-500">Tallos / Paquetes medianos</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5C1125] uppercase tracking-wider">Chico (CHI)</span>
            <span className="w-2 h-2 rounded-full bg-[#5C1125]" />
          </div>
          <p className="mt-1 text-2xl font-black text-[#000000]">{calculatedTotals.chi}</p>
          <span className="text-[10px] text-stone-500">Tallos / Paquetes chicos</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#fbf2f4] border border-[#ebccd4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-[#5C1125] uppercase tracking-wider">Gran Total</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#5C1125] animate-pulse" />
          </div>
          <p className="mt-1 text-2xl font-black text-[#5C1125]">{calculatedTotals.grandTotal}</p>
          <span className="text-[10px] text-stone-600 font-semibold">16 Variedades contabilizadas</span>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Workspace Tab Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 border-b border-stone-200 bg-[#FAF8F5]">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('planilla')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
                activeTab === 'planilla'
                  ? 'border-[#5C1125] text-[#5C1125]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Planilla Completa (Excel)</span>
            </button>

            <button
              onClick={() => setActiveTab('individual')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
                activeTab === 'individual'
                  ? 'border-[#5C1125] text-[#5C1125]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Formulario Individual</span>
            </button>

            <button
              onClick={() => setActiveTab('historial')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
                activeTab === 'historial'
                  ? 'border-[#5C1125] text-[#5C1125]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Registros e Historial ({moduleSheets.length})</span>
            </button>
          </div>

          {editingSheetId && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-[#5C1125] text-white font-bold mb-2">
              Modo Edición
            </span>
          )}
        </div>

        {/* TAB 1: Planilla de Captura Estilo Excel */}
        {activeTab === 'planilla' && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Metadata Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs sm:text-sm">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  Fecha de Registro
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={sheetDate}
                    onChange={(e) => setSheetDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs sm:text-sm font-semibold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  Responsable / Encargado
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    placeholder="Nombre del responsable"
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs sm:text-sm font-semibold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  Observaciones / Lote
                </label>
                <input
                  type="text"
                  value={sheetNotes}
                  onChange={(e) => setSheetNotes(e.target.value)}
                  placeholder="Ej. Corte turno matutino, nave norte..."
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs sm:text-sm text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>

            {/* Interactive Grid Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-xl shadow-xs">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#5C1125] text-white">
                    <th className="py-2.5 px-3 sm:px-4 font-bold border-b border-[#3f0918]">VARIEDAD</th>
                    <th className="py-2.5 px-3 font-bold text-center w-24 sm:w-28 border-b border-[#3f0918]">
                      LAR <span className="text-[10px] font-normal opacity-80">(Largo)</span>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-center w-24 sm:w-28 border-b border-[#3f0918]">
                      MED <span className="text-[10px] font-normal opacity-80">(Mediano)</span>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-center w-24 sm:w-28 border-b border-[#3f0918]">
                      CHI <span className="text-[10px] font-normal opacity-80">(Chico)</span>
                    </th>
                    <th className="py-2.5 px-3 sm:px-4 font-bold text-right w-24 sm:w-28 border-b border-[#3f0918] bg-[#430c1b]">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {draftRows.map((row, idx) => (
                    <tr
                      key={row.variedad}
                      className={idx % 2 === 0 ? 'bg-white hover:bg-[#FAF8F5]' : 'bg-stone-50/60 hover:bg-[#FAF8F5]'}
                    >
                      <td className="py-2 px-3 sm:px-4 font-bold text-[#000000]">
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#535B28]" />
                          {row.variedad}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.lar}
                          onChange={(e) => handleCellChange(idx, 'lar', parseInt(e.target.value) || 0)}
                          className="w-full py-1 text-center font-bold text-stone-900 border border-stone-200 rounded focus:border-[#5C1125] focus:ring-1 focus:ring-[#5C1125] bg-white"
                        />
                      </td>
                      <td className="py-1 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.med}
                          onChange={(e) => handleCellChange(idx, 'med', parseInt(e.target.value) || 0)}
                          className="w-full py-1 text-center font-bold text-stone-900 border border-stone-200 rounded focus:border-[#5C1125] focus:ring-1 focus:ring-[#5C1125] bg-white"
                        />
                      </td>
                      <td className="py-1 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.chi}
                          onChange={(e) => handleCellChange(idx, 'chi', parseInt(e.target.value) || 0)}
                          className="w-full py-1 text-center font-bold text-stone-900 border border-stone-200 rounded focus:border-[#5C1125] focus:ring-1 focus:ring-[#5C1125] bg-white"
                        />
                      </td>
                      <td className="py-2 px-3 sm:px-4 font-black text-right text-[#5C1125] bg-[#FAF8F5]">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#FAF8F5] font-black text-sm border-t-2 border-[#5C1125] text-[#000000]">
                    <td className="py-3 px-3 sm:px-4 uppercase tracking-wider text-[#5C1125]">
                      TOTAL GENERAL
                    </td>
                    <td className="py-3 px-2 text-center text-[#535B28]">{calculatedTotals.lar}</td>
                    <td className="py-3 px-2 text-center text-[#C3A25D]">{calculatedTotals.med}</td>
                    <td className="py-3 px-2 text-center text-[#5C1125]">{calculatedTotals.chi}</td>
                    <td className="py-3 px-3 sm:px-4 text-right text-base text-[#5C1125] bg-[#fbf2f4]">
                      {calculatedTotals.grandTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="px-3.5 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
                >
                  Limpiar a Ceros
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSheet}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer border border-[#C3A25D]/40"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#C3A25D]" />
                  <span>{editingSheetId ? 'Actualizar Planilla' : 'Guardar Planilla del Día'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Formulario Individual de Variedad */}
        {activeTab === 'individual' && (
          <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-5">
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 text-xs text-stone-600">
              Captura o ajusta una variedad individualmente. Los valores se reflejarán instantáneamente en la planilla activa.
            </div>

            <form onSubmit={handleAddSingleRow} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Variedad de Rosa
                </label>
                <select
                  value={singleVariety}
                  onChange={(e) => setSingleVariety(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                >
                  {AROMA_FLOWER_VARIETIES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#535B28] uppercase mb-1">
                    Largo (LAR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={singleLar}
                    onChange={(e) => setSingleLar(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-center text-base font-bold bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#C3A25D] uppercase mb-1">
                    Mediano (MED)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={singleMed}
                    onChange={(e) => setSingleMed(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-center text-base font-bold bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C1125] uppercase mb-1">
                    Chico (CHI)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={singleChi}
                    onChange={(e) => setSingleChi(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-center text-base font-bold bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#5C1125]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#fbf2f4] rounded-xl border border-[#ebccd4] flex items-center justify-between text-sm">
                <span className="font-bold text-stone-700">Total Calculado:</span>
                <span className="font-black text-lg text-[#5C1125]">
                  {singleLar + singleMed + singleChi}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer border border-[#C3A25D]/40"
              >
                Actualizar Variedad en Planilla
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: Historial y Registros Guardados */}
        {activeTab === 'historial' && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-stone-200">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-[#5C1125]" />
                <span className="text-xs font-bold text-stone-700">Filtrar por Fecha:</span>
                <input
                  type="date"
                  value={historySearchDate}
                  onChange={(e) => setHistorySearchDate(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white border border-stone-300 rounded-lg text-[#000000]"
                />
                {historySearchDate && (
                  <button
                    onClick={() => setHistorySearchDate('')}
                    className="text-xs text-[#5C1125] font-semibold underline cursor-pointer"
                  >
                    Ver Todas
                  </button>
                )}
              </div>

              <span className="text-xs text-stone-500 font-medium">
                {moduleSheets.length} registros guardados en {activeModuleConfig.title}
              </span>
            </div>

            {moduleSheets.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-50 text-[#5C1125]" />
                <p className="text-sm font-bold text-stone-600">No hay registros guardados con este filtro</p>
                <p className="text-xs text-stone-400 mt-1">
                  Ingresa datos en la pestaña &quot;Planilla Completa&quot; y pulsa &quot;Guardar Planilla del Día&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {moduleSheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-[#5C1125]/60 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#5C1125]">{sheet.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#535B28]/15 text-[#535B28]">
                            Fecha: {sheet.date}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Responsable: <strong>{sheet.responsable}</strong> &bull; Guardado: {sheet.createdAt}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          onClick={() => exportToCsv(sheet)}
                          title="Descargar en formato Excel CSV"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-stone-200 text-stone-700 text-xs font-semibold border border-stone-300 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[#5C1125]" />
                          <span>Exportar CSV</span>
                        </button>

                        <button
                          onClick={() => handleLoadSheetForEdit(sheet)}
                          title="Cargar planilla para editar"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] text-xs font-bold border border-[#ebccd4] transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => deleteAromaSheet(sheet.id)}
                          title="Eliminar registro"
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Summary row */}
                    <div className="grid grid-cols-4 gap-2 text-center py-2 bg-[#FAF8F5] rounded-xl text-xs">
                      <div>
                        <span className="text-stone-500 block text-[10px] font-semibold">Largo (LAR)</span>
                        <span className="font-black text-[#535B28]">{sheet.totalLar}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[10px] font-semibold">Mediano (MED)</span>
                        <span className="font-black text-[#C3A25D]">{sheet.totalMed}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[10px] font-semibold">Chico (CHI)</span>
                        <span className="font-black text-[#5C1125]">{sheet.totalChi}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[10px] font-semibold">Gran Total</span>
                        <span className="font-black text-sm text-[#5C1125]">{sheet.grandTotal}</span>
                      </div>
                    </div>

                    {/* Compact Variety Badges list */}
                    <div className="pt-1">
                      <details className="text-xs text-stone-600 cursor-pointer">
                        <summary className="font-bold text-[#5C1125] hover:underline">
                          Ver detalle de las 16 variedades ▼
                        </summary>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-100">
                          {sheet.rows.map((r) => (
                            <div key={r.variedad} className="p-2 rounded bg-stone-50 border border-stone-200/70">
                              <span className="font-bold text-stone-800 block truncate">{r.variedad}</span>
                              <span className="text-[10px] text-stone-500">
                                L:{r.lar} | M:{r.med} | C:{r.chi} = <strong className="text-[#5C1125]">{r.total}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>

                    {sheet.notes && (
                      <p className="text-xs text-stone-500 italic bg-stone-50 p-2 rounded">
                        Notas: {sheet.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
