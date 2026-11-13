import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Database,
  RefreshCw,
  Copy,
  Check,
  Download,
  Upload,
  AlertTriangle,
  X,
  ShieldCheck,
  Server,
  CloudUpload,
  PlugZap,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataManagementModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const {
    demoDataCleared,
    clearAllDemoData,
    restoreDemoData,
    neverShowDemoAgain,
    setNeverShowDemoAgain,
    supabaseConfig,
    supabaseStatus,
    supabaseMessage,
    isSyncingSupabase,
    saveSupabaseConfig,
    testSupabase,
    syncAllToSupabase,
    generateSupabaseSql,
    generateSupabaseCleanupSql,
    exportDataJson,
    importDataJson,
  } = useGreenhouse();

  const [activeTab, setActiveTab] = useState<'demo' | 'supabase' | 'backup'>('demo');
  const [supabaseUrl, setSupabaseUrl] = useState(supabaseConfig.url || '');
  const [supabaseKey, setSupabaseKey] = useState(supabaseConfig.anonKey || '');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setSupabaseUrl(supabaseConfig.url || '');
    setSupabaseKey(supabaseConfig.anonKey || '');
  }, [supabaseConfig.url, supabaseConfig.anonKey]);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleConfirmClear = () => {
    clearAllDemoData();
    setShowConfirmClear(false);
    setActionMessage('¡Todos los datos de muestra han sido eliminados de Aroma Flower!');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleRestore = () => {
    restoreDemoData();
    setActionMessage('Datos de demostración restaurados correctamente.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setIsTesting(true);
    const res = await testSupabase(supabaseUrl, supabaseKey);
    setIsTesting(false);
    if (res.ok && res.tablesReady) {
      setActionMessage(res.message);
    } else if (res.ok && !res.tablesReady) {
      setActionMessage(res.message);
    } else {
      setErrorMessage(res.message);
    }
    setTimeout(() => {
      setActionMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  const handleTestConnection = async () => {
    setErrorMessage(null);
    setIsTesting(true);
    const res = await testSupabase(supabaseUrl, supabaseKey);
    setIsTesting(false);
    if (res.ok) {
      setActionMessage(res.message);
    } else {
      setErrorMessage(res.message);
    }
    setTimeout(() => {
      setActionMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  const handleSyncAll = async () => {
    setErrorMessage(null);
    const res = await syncAllToSupabase();
    if (res.ok) {
      setActionMessage(res.message);
    } else {
      setErrorMessage(res.message);
    }
    setTimeout(() => {
      setActionMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDataJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aroma_flower_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importDataJson(content);
      if (success) {
        setActionMessage('Copia de respaldo de Aroma Flower importada con éxito.');
        setErrorMessage(null);
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        setErrorMessage('El archivo seleccionado no tiene el formato JSON válido de Aroma Flower.');
        setTimeout(() => setErrorMessage(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3f0918] bg-[#5C1125] text-white">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-[#C3A25D]" />
            <div>
              <h3 className="font-bold text-base sm:text-lg">Gestión de Datos &bull; Aroma Flower</h3>
              <p className="text-xs text-[#d6be83]">Control de base de datos, modo offline y respaldos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-300 hover:text-white hover:bg-[#430c1b] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {actionMessage && (
          <div className="bg-[#f7f8f2] border-b border-[#dce4bf] px-6 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#535B28] animate-fadeIn">
            <Check className="w-4 h-4 text-[#535B28]" />
            {actionMessage}
          </div>
        )}

        {/* Error alert */}
        {errorMessage && (
          <div className="bg-[#fbf2f4] border-b border-[#ebccd4] px-6 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#5C1125] animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-[#5C1125]" />
            {errorMessage}
          </div>
        )}

        {/* Confirmation Banner for Clear Demo */}
        {showConfirmClear && (
          <div className="bg-[#fbf2f4] border-b border-[#ebccd4] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-[#5C1125]">
            <span>¿Confirmas vaciar todos los registros demo para comenzar en blanco con datos reales?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirmClear}
                className="px-3 py-1.5 rounded-lg bg-[#5C1125] text-white font-bold text-xs hover:bg-[#430c1b]"
              >
                Confirmar Borrado
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-3 py-1.5 rounded-lg bg-stone-200 text-stone-700 font-semibold text-xs hover:bg-stone-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 bg-[#FAF8F5] px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('demo')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'demo'
                ? 'border-[#5C1125] text-[#5C1125]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Datos de Muestra
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'supabase'
                ? 'border-[#5C1125] text-[#5C1125]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Conexión Supabase
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'backup'
                ? 'border-[#5C1125] text-[#5C1125]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Respaldos JSON
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 text-sm text-slate-700 max-h-[70vh] overflow-y-auto">
          {activeTab === 'demo' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-rose-900">Borrar datos de muestra del todo el sistema</h4>
                    <p className="text-xs text-rose-700 mt-1">
                      Esta acción vacía todos los registros de prueba (invernaderos, lotes, registros de riego, monitoreos, cosechas, clientes, ventas y contabilidad) para dejar la plataforma en blanco lista para ingresar los datos reales de tu invernadero.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-rose-200/60">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="neverShowToggle"
                      checked={neverShowDemoAgain}
                      onChange={(e) => setNeverShowDemoAgain(e.target.checked)}
                      className="rounded border-stone-300 text-[#5C1125] focus:ring-[#5C1125] h-4 w-4"
                    />
                    <label htmlFor="neverShowToggle" className="text-xs font-medium text-stone-700">
                      No volver a cargar datos de muestra al reiniciar el navegador
                    </label>
                  </div>

                  <button
                    onClick={() => setShowConfirmClear(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#5C1125] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#430c1b] active:scale-95 transition shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-[#C3A25D]" />
                    Borrar Datos de Muestra
                  </button>
                </div>
              </div>

              {demoDataCleared && (
                <div className="p-4 rounded-xl border border-[#dce4bf] bg-[#f7f8f2] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#535B28]" />
                    <span className="text-xs font-semibold text-[#535B28]">
                      El sistema se encuentra en blanco (modo producción sin datos demo).
                    </span>
                  </div>
                  <button
                    onClick={handleRestore}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#5C1125] bg-white border border-[#C3A25D]/60 rounded-lg hover:bg-[#FAF8F5] transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Restaurar Demo
                  </button>
                </div>
              )}

              <div className="bg-[#FAF8F5] p-4 rounded-xl border border-stone-200 space-y-2">
                <h5 className="font-semibold text-xs uppercase tracking-wider text-[#535B28]">
                  Estado Actual de Almacenamiento &bull; Aroma Flower
                </h5>
                <p className="text-xs text-stone-600">
                  La información capturada se almacena localmente de forma persistente y continuará funcionando aún sin conexión a internet (modo offline). Al configurar Supabase, podrás sincronizar en tiempo real a la nube.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'supabase' && (
            <div className="space-y-5">
              {/* Live status indicator */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  supabaseStatus === 'connected'
                    ? 'bg-[#f7f8f2] border-[#dce4bf] text-[#535B28]'
                    : supabaseStatus === 'missing_tables'
                    ? 'bg-[#fbf7eb] border-[#e7d4a5] text-[#7c5b16]'
                    : supabaseStatus === 'error'
                    ? 'bg-[#fbf2f4] border-[#ebccd4] text-[#5C1125]'
                    : 'bg-stone-50 border-stone-200 text-stone-600'
                }`}
              >
                <div className="flex items-start gap-2">
                  <Server className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">
                      {supabaseStatus === 'connected'
                        ? 'Supabase Conectado y Operativo'
                        : supabaseStatus === 'missing_tables'
                        ? 'Proyecto Vinculado (Tablas SQL Pendientes)'
                        : supabaseStatus === 'connecting'
                        ? 'Verificando conexión con Supabase...'
                        : supabaseStatus === 'error'
                        ? 'Error de Conexión'
                        : 'Sin verificar'}
                    </p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {supabaseMessage || 'Proyecto: syrchvrxkkwvwynvtzfq'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncingSupabase || !supabaseConfig.isConnected}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#535B28] text-white font-semibold hover:bg-[#3e441d] disabled:opacity-50 transition cursor-pointer shrink-0"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-[#C3A25D]" />
                  {isSyncingSupabase ? 'Sincronizando...' : 'Subir Datos a Supabase'}
                </button>
              </div>

              <form onSubmit={handleSaveSupabase} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://syrchvrxkkwvwynvtzfq.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#5C1125] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Supabase Publishable / Anon Key
                  </label>
                  <input
                    type="password"
                    placeholder="sb_publishable_..."
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#5C1125] focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-3 py-2 border border-stone-300 bg-white text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50 transition cursor-pointer"
                  >
                    <PlugZap className="w-3.5 h-3.5 text-[#C3A25D]" />
                    {isTesting ? 'Probando...' : 'Probar Conexión'}
                  </button>
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="px-4 py-2 bg-[#5C1125] text-white rounded-lg text-xs font-semibold hover:bg-[#430c1b] transition cursor-pointer"
                  >
                    Guardar Conexión
                  </button>
                </div>
              </form>

              {/* SQL Generation Scripts */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-xs text-stone-700 block">
                      1. Script SQL Actualizado (Solo Rol Activo Aroma Flowers):
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Deja únicamente la tabla aroma_flower_sheets (7 módulos Excel) con RLS y limpia tablas de roles desactivados.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(generateSupabaseSql(), 'schema')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#5C1125] bg-[#fbf2f4] border border-[#ebccd4] rounded-md hover:bg-[#f5e4e8] cursor-pointer shrink-0"
                  >
                    {copiedType === 'schema' ? <Check className="w-3.5 h-3.5 text-[#535B28]" /> : <Copy className="w-3.5 h-3.5 text-[#C3A25D]" />}
                    {copiedType === 'schema' ? 'Copiado' : 'Copiar Esquema SQL'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-stone-700">
                    2. Script SQL de Limpieza Supabase (Borrar registros de prueba):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(generateSupabaseCleanupSql(), 'clean')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#5C1125] bg-[#fbf2f4] border border-[#ebccd4] rounded-md hover:bg-[#f5e4e8] cursor-pointer shrink-0"
                  >
                    {copiedType === 'clean' ? <Check className="w-3.5 h-3.5 text-[#535B28]" /> : <Copy className="w-3.5 h-3.5 text-[#C3A25D]" />}
                    {copiedType === 'clean' ? 'Copiado' : 'Copiar Limpieza SQL'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF8F5] space-y-3">
                  <Download className="w-6 h-6 text-[#5C1125]" />
                  <h4 className="font-bold text-[#000000] text-sm">Descargar Respaldo JSON</h4>
                  <p className="text-xs text-stone-600">
                    Genera un archivo seguro con todos los módulos, cosechas, clientes, movimientos y registros del invernadero Aroma Flower.
                  </p>
                  <button
                    onClick={handleDownloadBackup}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#5C1125] text-white rounded-lg text-xs font-semibold hover:bg-[#430c1b] transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#C3A25D]" />
                    Exportar Base de Datos
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF8F5] space-y-3">
                  <Upload className="w-6 h-6 text-[#535B28]" />
                  <h4 className="font-bold text-[#000000] text-sm">Importar Copia de Respaldo</h4>
                  <p className="text-xs text-stone-600">
                    Restaura una copia de seguridad previa en formato JSON de Aroma Flower para continuar operando.
                  </p>
                  <label className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#535B28] text-white rounded-lg text-xs font-semibold hover:bg-[#3b411c] transition cursor-pointer">
                    <Upload className="w-4 h-4 text-[#C3A25D]" />
                    Seleccionar Archivo JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#FAF8F5] border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs sm:text-sm font-bold text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
