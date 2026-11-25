import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Calculator,
  CheckCircle2,
  Calendar,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  AROMA_FLOWER_VARIETIES,
  FOLIAR_DOSE_UNITS,
  FOLIAR_OBJECTIVE_SUGGESTIONS,
  FOLIAR_PARCHONEO_MODULES,
  FoliarDoseUnit,
  SupplyItem,
} from '../../types/greenhouse';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  calculateParchoneoRuleOfThree,
  formatMoneyMXN,
  getMinimumUnitCost,
  getTodayLocalISO,
  inferPresentation,
  resolveEffectivePurchaseCost,
  round2,
} from '../../utils/foliarCalculations';

export const ParchoneoCalculatorView: React.FC = () => {
  const {
    supplyItems,
    supplyPurchases,
    aromaProducts,
    foliarParchoneos,
    saveFoliarParchoneo,
    deleteFoliarParchoneo,
    currentUser,
  } = useGreenhouse();

  const agrochemicals = useMemo(
    () =>
      supplyItems
        .filter((s) => s.active !== false && s.area === 'invernadero')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [supplyItems]
  );

  const varietySuggestions = useMemo(() => {
    const set = new Set<string>();
    aromaProducts
      .filter((p) => p.active !== false)
      .forEach((p) => set.add(p.name));
    AROMA_FLOWER_VARIETIES.forEach((v) => {
      // Friendly Title Case alongside catalog names
      const formatted = v
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      set.add(formatted);
    });
    return Array.from(set);
  }, [aromaProducts]);

  // Form state (10 fields per specification)
  const [applicationDate, setApplicationDate] = useState<string>(() => getTodayLocalISO());
  const [moduleName, setModuleName] = useState<string>(FOLIAR_PARCHONEO_MODULES[0]);
  const [variety, setVariety] = useState<string>('');
  const [waterLiters, setWaterLiters] = useState<string>('30');
  const [productId, setProductId] = useState<string>(() => agrochemicals[0]?.id || '');
  const [objective, setObjective] = useState<string>('');
  const [baseDoseAmount, setBaseDoseAmount] = useState<string>('50');
  const [baseDoseUnit, setBaseDoseUnit] = useState<FoliarDoseUnit>('ml');
  const [baseWaterLiters, setBaseWaterLiters] = useState<string>('200');

  // History filters & UI feedback
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('TODOS');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);

  const selectedProduct: SupplyItem | undefined = useMemo(
    () => agrochemicals.find((p) => p.id === productId),
    [agrochemicals, productId]
  );

  const handleProductChange = (nextId: string) => {
    setProductId(nextId);
    const prod = agrochemicals.find((p) => p.id === nextId);
    if (prod) {
      const pres = inferPresentation(prod);
      setBaseDoseUnit(pres === 'polvo' ? 'g' : 'ml');
    }
  };

  // Real-time Rule-of-Three & Cost Calculation
  const calc = useMemo(
    () =>
      calculateParchoneoRuleOfThree({
        waterLiters: Number(waterLiters || 0),
        baseDoseAmount: Number(baseDoseAmount || 0),
        baseWaterLiters: Number(baseWaterLiters || 0),
        baseDoseUnit,
        product: selectedProduct,
        purchases: supplyPurchases,
      }),
    [waterLiters, baseDoseAmount, baseWaterLiters, baseDoseUnit, selectedProduct, supplyPurchases]
  );

  const showNotice = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setFeedback({ text, tone });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 3600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      showNotice('Selecciona un producto agroquímico del catálogo.', 'warn');
      return;
    }
    if (Number(waterLiters || 0) <= 0 || Number(baseDoseAmount || 0) <= 0 || Number(baseWaterLiters || 0) <= 0) {
      showNotice('Ingresa valores mayores a cero en volumen de agua y dosis recomendada base.', 'warn');
      return;
    }

    setSaving(true);
    const res = await saveFoliarParchoneo({
      applicationDate,
      moduleName,
      variety: variety.trim() || 'General',
      waterLiters: Number(waterLiters || 0),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      objective: objective.trim() || selectedProduct.purpose || 'Control fitosanitario',
      baseDoseAmount: Number(baseDoseAmount || 0),
      baseDoseUnit,
      baseWaterLiters: Number(baseWaterLiters || 200),
      calculatedDose: calc.calculatedDose,
      unitCostApplied: calc.costPerDoseUnit,
      calculatedCost: calc.calculatedCost,
      createdBy: currentUser?.fullName || '',
    });
    setSaving(false);

    showNotice(
      res.cloudSynced
        ? `Parchoneo registrado (${calc.calculatedDose} ${baseDoseUnit} · ${formatMoneyMXN(calc.calculatedCost)}) en Supabase.`
        : `Parchoneo registrado localmente (${calc.calculatedDose} ${baseDoseUnit}).`,
      res.cloudSynced ? 'ok' : 'warn'
    );
  };

  const filteredHistory = useMemo(() => {
    return foliarParchoneos.filter((entry) => {
      if (filterDate && entry.applicationDate !== filterDate) return false;
      if (filterModule !== 'TODOS' && entry.moduleName !== filterModule) return false;
      return true;
    });
  }, [foliarParchoneos, filterDate, filterModule]);

  const historySummary = useMemo(() => {
    const totalCost = round2(
      filteredHistory.reduce((acc, p) => acc + Number(p.calculatedCost || 0), 0)
    );
    const totalWater = round2(
      filteredHistory.reduce((acc, p) => acc + Number(p.waterLiters || 0), 0)
    );
    return { count: filteredHistory.length, totalCost, totalWater };
  }, [filteredHistory]);

  return (
    <div className="space-y-6">
      <datalist id="parchoneo-variety-suggestions">
        {varietySuggestions.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="parchoneo-objective-suggestions">
        {FOLIAR_OBJECTIVE_SUGGESTIONS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      {/* Calculator & Registration Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
      >
        <div className="px-5 sm:px-6 py-4 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-[#5C1125]" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#000000]">
                Calculadora de Parchoneo (Regla de Tres)
              </h2>
              <p className="text-xs text-stone-500">
                Calcula la dosis exacta y el costo proporcional según el volumen de agua utilizado
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Row 1: Fecha, Módulo, Variedad, Volumen de agua */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Fecha */}
            <div>
              <label
                htmlFor="parchoneo-date"
                className="block text-xs font-semibold text-stone-600 mb-1.5"
              >
                1. Fecha
              </label>
              <input
                id="parchoneo-date"
                type="date"
                required
                value={applicationDate}
                onChange={(e) => setApplicationDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-medium text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
              />
            </div>

            {/* 2. Módulo */}
            <div>
              <label
                htmlFor="parchoneo-module"
                className="block text-xs font-semibold text-stone-600 mb-1.5"
              >
                2. Módulo
              </label>
              <select
                id="parchoneo-module"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
              >
                {FOLIAR_PARCHONEO_MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Variedad */}
            <div>
              <label
                htmlFor="parchoneo-variety"
                className="block text-xs font-semibold text-stone-600 mb-1.5"
              >
                3. Variedad
              </label>
              <input
                id="parchoneo-variety"
                type="text"
                list="parchoneo-variety-suggestions"
                placeholder="Ej. Hermosa, Freedom..."
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
              />
            </div>

            {/* 4. Volumen de agua utilizado (L) */}
            <div>
              <label
                htmlFor="parchoneo-water"
                className="block text-xs font-semibold text-stone-600 mb-1.5"
              >
                4. Volumen de agua utilizado (L)
              </label>
              <div className="relative">
                <input
                  id="parchoneo-water"
                  type="number"
                  min={0}
                  step="any"
                  required
                  placeholder="Ej. 30"
                  value={waterLiters}
                  onChange={(e) => setWaterLiters(e.target.value)}
                  className="w-full h-10 pl-3 pr-9 rounded-xl border border-stone-300 bg-white text-sm font-bold text-[#000000] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                  L
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: Producto, Objetivo, Dosis recomendada base */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 5. Producto */}
            <div>
              <label
                htmlFor="parchoneo-product"
                className="block text-xs font-semibold text-stone-600 mb-1.5"
              >
                5. Producto (Catálogo)
              </label>
              <select
                id="parchoneo-product"
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-medium text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
              >
                <option value="">Seleccionar agroquímico...</option>
                {agrochemicals.map((item) => {
                  const eff = resolveEffectivePurchaseCost(item, supplyPurchases);
                  const min = getMinimumUnitCost(
                    eff.unitCost,
                    eff.unit,
                    inferPresentation(item)
                  );
                  return (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatMoneyMXN(min.costPerMinUnit)}/{min.minUnit})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 6. Objetivo */}
            <div>
              <label
                htmlFor="parchoneo-objective"
                className="block text-xs font-semibold text-stone-600 mb-1.5"
              >
                6. Objetivo
              </label>
              <input
                id="parchoneo-objective"
                type="text"
                list="parchoneo-objective-suggestions"
                placeholder="Ej. Cenicilla, Peronospora..."
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm text-[#000000] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
              />
            </div>

            {/* 7. Dosis recomendada base: [Cantidad base] por cada [Litros base] */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                7. Dosis recomendada base (referencia del fabricante)
              </label>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  aria-label="Cantidad base"
                  placeholder="Ej. 50"
                  value={baseDoseAmount}
                  onChange={(e) => setBaseDoseAmount(e.target.value)}
                  className="w-24 sm:w-28 h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-bold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <select
                  aria-label="Unidad de dosis base"
                  value={baseDoseUnit}
                  onChange={(e) => setBaseDoseUnit(e.target.value as FoliarDoseUnit)}
                  className="w-20 h-10 px-2 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125]"
                >
                  {FOLIAR_DOSE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">
                  por cada
                </span>
                <div className="relative flex-1 min-w-[96px]">
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    required
                    aria-label="Litros base"
                    placeholder="200"
                    value={baseWaterLiters}
                    onChange={(e) => setBaseWaterLiters(e.target.value)}
                    className="w-full h-10 pl-3 pr-8 rounded-xl border border-stone-300 bg-white text-sm font-bold text-[#000000] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5C1125]/25 focus:border-[#5C1125] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    L
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Automatic Results Strip (8. Dosis real calculada + 9. Costo calculado + 10. CTA) */}
          <div className="pt-2 border-t border-stone-100 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            {/* 8. Dosis real calculada */}
            <div className="rounded-xl bg-[#FAF8F5] border border-stone-200 p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-stone-500">
                8. Dosis real calculada (Regla de tres)
              </span>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-extrabold text-[#000000] tabular-nums">
                  {calc.calculatedDose.toLocaleString('es-MX', {
                    maximumFractionDigits: 4,
                  })}{' '}
                  <span className="text-base font-bold text-[#535B28]">{baseDoseUnit}</span>
                </span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 tabular-nums">
                ({Number(waterLiters || 0)} L × {Number(baseDoseAmount || 0)} {baseDoseUnit}) ÷{' '}
                {Number(baseWaterLiters || 0)} L
              </span>
            </div>

            {/* 9. Costo calculado */}
            <div className="rounded-xl bg-[#FAF8F5] border border-stone-200 p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-stone-500">
                9. Costo calculado automático
              </span>
              <div className="mt-2">
                <span className="text-2xl font-extrabold text-[#5C1125] tabular-nums">
                  {formatMoneyMXN(calc.calculatedCost)}
                </span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 tabular-nums">
                {calc.calculatedDose.toLocaleString('es-MX', { maximumFractionDigits: 4 })}{' '}
                {baseDoseUnit} × {formatMoneyMXN(calc.costPerDoseUnit)} / {baseDoseUnit}
              </span>
            </div>

            {/* 10. Botón Registrar */}
            <div className="flex flex-col justify-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full h-12 px-5 rounded-xl bg-[#5C1125] hover:bg-[#460c1b] active:scale-[0.99] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#C3A25D] stroke-[2.5px]" />
                <span>{saving ? 'Registrando...' : '+ Registrar parchoneo'}</span>
              </button>
              {feedback && (
                <div
                  className={`text-xs font-semibold inline-flex items-center gap-1.5 ${
                    feedback.tone === 'ok' ? 'text-[#535B28]' : 'text-amber-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{feedback.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Parchoneo History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#000000]">
              Historial de Parchoneos ({historySummary.count})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
              Agua acumulada: <strong className="text-stone-700">{historySummary.totalWater} L</strong>{' '}
              · Costo total acumulado:{' '}
              <strong className="text-[#5C1125]">{formatMoneyMXN(historySummary.totalCost)}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#5C1125]" />
              <input
                type="date"
                aria-label="Filtrar historial por fecha"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-9 px-2.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-[#000000] tabular-nums"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#535B28]" />
              <select
                aria-label="Filtrar historial por módulo"
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="h-9 px-2.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-[#000000]"
              >
                <option value="TODOS">Todos los módulos</option>
                {FOLIAR_PARCHONEO_MODULES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {(filterDate || filterModule !== 'TODOS') && (
              <button
                type="button"
                onClick={() => {
                  setFilterDate('');
                  setFilterModule('TODOS');
                }}
                className="h-9 px-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-[#5C1125] hover:bg-stone-100 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-stone-500">
            No hay registros de parchoneo todavía. Usa la calculadora superior y presiona{' '}
            <strong>+ Registrar parchoneo</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-stone-200 text-xs font-bold text-stone-600">
                  <th className="py-3 pl-5 pr-3">Fecha</th>
                  <th className="py-3 px-3">Módulo</th>
                  <th className="py-3 px-3">Variedad</th>
                  <th className="py-3 px-3">Producto / Objetivo</th>
                  <th className="py-3 px-3 text-right">Agua</th>
                  <th className="py-3 px-3 text-right">Ref. Base</th>
                  <th className="py-3 px-3 text-right">Dosis Real</th>
                  <th className="py-3 px-3 text-right">Costo</th>
                  <th className="py-3 pl-3 pr-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F5]/70 transition-colors">
                    <td className="py-3 pl-5 pr-3 font-semibold text-[#000000] tabular-nums whitespace-nowrap">
                      {item.applicationDate}
                    </td>
                    <td className="py-3 px-3 text-xs font-semibold text-stone-700 whitespace-nowrap">
                      {item.moduleName}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#000000]">
                      {item.variety || 'General'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#000000]">{item.productName}</div>
                      {item.objective && (
                        <div className="text-xs text-stone-500">{item.objective}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-stone-700 tabular-nums whitespace-nowrap">
                      {item.waterLiters} L
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-stone-500 tabular-nums whitespace-nowrap">
                      {item.baseDoseAmount} {item.baseDoseUnit} / {item.baseWaterLiters} L
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-[#535B28] tabular-nums whitespace-nowrap">
                      {item.calculatedDose.toLocaleString('es-MX', {
                        maximumFractionDigits: 4,
                      })}{' '}
                      {item.baseDoseUnit}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-[#5C1125] tabular-nums whitespace-nowrap">
                      {formatMoneyMXN(item.calculatedCost)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                      {confirmDeleteId === item.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              setConfirmDeleteId(null);
                              await deleteFoliarParchoneo(item.id);
                              showNotice('Parchoneo eliminado.');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                          >
                            Borrar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg border border-stone-200 text-stone-600 text-xs font-semibold cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="w-8 h-8 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 text-stone-400 hover:text-[#5C1125] inline-flex items-center justify-center transition cursor-pointer"
                          aria-label="Eliminar parchoneo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
