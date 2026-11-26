import React, { useState, useMemo, useRef } from 'react';
import {
  Boxes,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Flower2,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  FileText,
  Camera,
  RotateCcw,
  Store,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { AromaProduct, ProductCaptureMode } from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
  exportProductsCatalogExcel,
  exportProductsCatalogPdf,
} from '../../utils/exportReports';
import {
  getPosProductMeta,
  compressProductImage,
} from '../../data/posProductImages';

export const AdminProductsView: React.FC = () => {
  const {
    aromaProducts,
    saveAromaProduct,
    deleteAromaProduct,
    setActiveView,
  } = useGreenhouse();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [captureMode, setCaptureMode] = useState<ProductCaptureMode>('lar_med_chi');
  const [sortOrderText, setSortOrderText] = useState<string>(() =>
    String(aromaProducts.length + 1)
  );
  const [active, setActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [priceLarText, setPriceLarText] = useState<string>('');
  const [priceMedText, setPriceMedText] = useState<string>('');
  const [priceChiText, setPriceChiText] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedProducts = useMemo(
    () => [...aromaProducts].sort((a, b) => a.sortOrder - b.sortOrder),
    [aromaProducts]
  );

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCaptureMode('lar_med_chi');
    setSortOrderText(String(aromaProducts.length + 1));
    setActive(true);
    setImageUrl('');
    setPriceLarText('');
    setPriceMedText('');
    setPriceChiText('');
    setErrorMsg(null);
  };

  const handleEdit = (p: AromaProduct) => {
    const meta = getPosProductMeta(p);
    setEditingId(p.id);
    setName(p.name);
    setCaptureMode(p.captureMode);
    setSortOrderText(String(p.sortOrder));
    setActive(p.active !== false);
    setImageUrl(p.imageUrl || '');
    setPriceLarText(String(p.priceLar || meta.priceLar));
    setPriceMedText(String(p.priceMed || meta.priceMed));
    setPriceChiText(String(p.priceChi || meta.priceChi));
    setErrorMsg(null);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressProductImage(file);
      setImageUrl(compressed);
      setErrorMsg(null);
    } catch {
      setErrorMsg('No se pudo cargar la imagen. Intenta con un archivo JPG o PNG.');
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    const parsedOrder = parseInt(sortOrderText.replace(/[^0-9]/g, ''), 10);
    const sortOrder = Number.isFinite(parsedOrder) && parsedOrder > 0 ? parsedOrder : aromaProducts.length + 1;
    const pLar = parseFloat(priceLarText);
    const pMed = parseFloat(priceMedText);
    const pChi = parseFloat(priceChiText);

    setIsSavingProduct(true);
    const res = await saveAromaProduct(
      {
        name,
        captureMode,
        sortOrder,
        active,
        imageUrl: imageUrl || '',
        priceLar: Number.isFinite(pLar) && pLar > 0 ? pLar : undefined,
        priceMed: Number.isFinite(pMed) && pMed > 0 ? pMed : undefined,
        priceChi: Number.isFinite(pChi) && pChi > 0 ? pChi : undefined,
      },
      editingId || undefined
    );
    setIsSavingProduct(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo guardar el producto.');
      return;
    }

    if (res.cloudSynced) {
      setFeedback(
        editingId
          ? `Producto "${name.trim().toUpperCase()}" actualizado en Supabase y sincronizado con POS y Producción.`
          : `Producto "${name.trim().toUpperCase()}" agregado en Supabase.`
      );
    } else {
      setErrorMsg(
        `Producto guardado localmente, pero pendiente en Supabase: ${res.cloudError || 'Sin conexión'}`
      );
    }
    resetForm();
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleToggleActive = async (p: AromaProduct) => {
    const res = await saveAromaProduct(
      {
        name: p.name,
        captureMode: p.captureMode,
        sortOrder: p.sortOrder,
        active: !p.active,
      },
      p.id
    );
    if (res.cloudSynced) {
      setFeedback(
        `${p.name} ${!p.active ? 'activado' : 'desactivado'} en Supabase para captura de empleados.`
      );
    } else {
      setErrorMsg(`Cambio guardado localmente. Pendiente en Supabase: ${res.cloudError || 'Sin conexión'}`);
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = async (id: string) => {
    await deleteAromaProduct(id);
    setConfirmDeleteId(null);
    setFeedback('Producto eliminado del catálogo y de Supabase.');
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Banner */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-[#C3A25D]/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <AromaFlowersLogo size="lg" className="shrink-0" />
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#C3A25D]">
              Rol Admin &bull; Catálogo Oficial
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
              Productos y Variedades
            </h1>
            <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
              Agrega, edita o elimina productos. Los empleados verán estos cambios al instante en Producción del Día e Inventario General.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveView('pos_caja')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs sm:text-sm font-black transition cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>Abrir POS</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('produccion_dia')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs sm:text-sm font-bold border border-[#C3A25D]/40 transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-[#C3A25D]" />
            <span>Ver Producción e Inventario</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Add / Edit Product */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 sm:p-6 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Flower2 className="w-4 h-4 text-[#5C1125]" />
              <h2 className="text-sm font-extrabold text-[#000000]">
                {editingId ? 'Editar Producto' : 'Registrar Nuevo Producto'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-[#5C1125] hover:underline cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>

          {feedback && (
            <div className="p-2.5 rounded-xl bg-[#f7f8f2] border border-[#dce4bf] text-[#535B28] text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-[#fbf2f4] border border-[#ebccd4] text-[#5C1125] text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Nombre del Producto / Variedad
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. EXPLORER"
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold uppercase text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Formato de Captura
            </label>
            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value as ProductCaptureMode)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold text-[#000000] bg-white focus:ring-2 focus:ring-[#5C1125]"
            >
              <option value="lar_med_chi">Por Calibres (LAR / MED / CHI)</option>
              <option value="direct_total">Monto Directo Único (Ej. STD Y MOL / MOLOTES)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Orden en Lista / POS
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={sortOrderText}
              onChange={(e) => setSortOrderText(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="1"
              className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
            />
          </div>

          {/* Photo Upload for POS */}
          <div className="space-y-2 pt-1 border-t border-stone-100">
            <label className="block text-xs font-bold text-stone-700">
              Fotografía del Producto (POS)
            </label>
            <div className="flex items-center gap-3">
              <img
                src={
                  imageUrl ||
                  getPosProductMeta({ name: name || 'COMBINADOS', imageUrl: '' }).imageSrc
                }
                alt={name || 'Vista previa'}
                referrerPolicy="no-referrer"
                className="w-20 h-16 rounded-xl object-cover border border-[#C3A25D]/50 bg-[#f8f2e2] shrink-0"
              />
              <div className="flex-1 space-y-1.5">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#C3A25D]" />
                  <span>Subir Foto Propia</span>
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="w-full flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Usar foto de estudio</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Precios Sugeridos POS */}
          <div className="space-y-1.5 pt-1 border-t border-stone-100">
            <label className="block text-xs font-bold text-stone-700">
              Precios Sugeridos POS (MXN por paquete)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="block text-[10px] font-bold text-stone-500 mb-0.5">
                  Largo (LAR)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceLarText}
                  onChange={(e) => setPriceLarText(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="180"
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold tabular-nums text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-stone-500 mb-0.5">
                  Mediano (MED)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceMedText}
                  onChange={(e) => setPriceMedText(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="150"
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold tabular-nums text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-stone-500 mb-0.5">
                  Chico (CHI)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceChiText}
                  onChange={(e) => setPriceChiText(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="120"
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold tabular-nums text-[#000000] focus:ring-2 focus:ring-[#5C1125]"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-stone-300 text-[#5C1125] focus:ring-[#5C1125]"
            />
            <span>Producto activo (visible para empleados y POS)</span>
          </label>

          <button
            type="submit"
            disabled={isSavingProduct}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-60"
          >
            <PlusCircle className="w-4 h-4 text-[#C3A25D]" />
            <span>
              {isSavingProduct
                ? 'Guardando en Supabase...'
                : editingId
                ? 'Actualizar Producto'
                : 'Agregar Producto'}
            </span>
          </button>
        </form>

        {/* Product List Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#5C1125]" />
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
                  Catálogo de Productos ({sortedProducts.length})
                </h2>
                <p className="text-[11px] text-stone-500">
                  Sincronizado con la tabla <code className="font-mono">app_products</code> en Supabase.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#f7f8f2] text-[#535B28] text-xs font-bold border border-[#dce4bf]">
                {sortedProducts.filter((p) => p.active !== false).length} activos
              </span>
              <button
                type="button"
                onClick={() => exportProductsCatalogExcel(sortedProducts)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => exportProductsCatalogPdf(sortedProducts)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs font-bold transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {sortedProducts.map((prod) => {
              const meta = getPosProductMeta(prod);
              return (
              <div
                key={prod.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/70 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[#5C1125]/10 text-[#5C1125] font-extrabold text-xs flex items-center justify-center shrink-0 tabular-nums">
                    {prod.sortOrder}
                  </span>
                  <img
                    src={meta.imageSrc}
                    alt={prod.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-9 rounded-lg object-cover border border-[#C3A25D]/45 shrink-0 bg-[#f8f2e2]"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-[#000000]">{prod.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          prod.captureMode === 'direct_total'
                            ? 'bg-[#C3A25D]/20 text-[#8a6d2b]'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {prod.captureMode === 'direct_total' ? 'Monto Directo' : 'LAR / MED / CHI'}
                      </span>
                      {prod.active === false && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
                      {prod.captureMode === 'direct_total'
                        ? `POS: $${meta.priceLar}`
                        : `POS · LAR $${meta.priceLar} · MED $${meta.priceMed} · CHI $${meta.priceChi}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(prod)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      prod.active !== false
                        ? 'bg-[#f7f8f2] text-[#535B28] border-[#dce4bf] hover:bg-[#ecf0dc]'
                        : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                    }`}
                  >
                    {prod.active !== false ? 'Activo' : 'Activar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEdit(prod)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] text-xs font-bold border border-[#ebccd4] transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  {confirmDeleteId === prod.id ? (
                    <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      <button
                        type="button"
                        onClick={() => handleDelete(prod.id)}
                        className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <span className="text-stone-300">|</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[11px] text-stone-500 hover:underline cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(prod.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
