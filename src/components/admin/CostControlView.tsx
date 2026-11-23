import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Flower2,
  Package,
  Truck,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  FileText,
  Wallet,
  Sprout,
  Receipt,
  Calendar,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
  CostAnalysisExportData,
  exportCostAnalysisExcel,
  exportCostAnalysisPdf,
} from '../../utils/exportReports';

const parseIntPos = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  const parsed = parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const fmtMoney = (n: number, decimals = 2) =>
  `$${Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const CostControlView: React.FC = () => {
  const {
    dailyProductions,
    payrollWeeks,
    supplyPurchases,
    greenhouseApplications,
    supplierPayments,
    truckLoads,
    remissionNotes,
    dailySales,
  } = useGreenhouse();

  const [useAllHistory, setUseAllHistory] = useState<boolean>(true);
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = `${today.slice(0, 7)}-01`;
  const [dateFrom, setDateFrom] = useState<string>(firstDayOfMonth);
  const [dateTo, setDateTo] = useState<string>(today);
  const [stemsPerPackageStr, setStemsPerPackageStr] = useState<string>('25');

  const stemsPerPackage = Math.max(1, parseIntPos(stemsPerPackageStr) || 25);

  const inRange = (isoDate?: string) => {
    if (useAllHistory) return true;
    if (!isoDate) return false;
    const d = isoDate.slice(0, 10);
    return d >= dateFrom && d <= dateTo;
  };

  const analysis = useMemo(() => {
    const filteredProd = dailyProductions.filter((p) => inRange(p.productionDate));
    const filteredPayroll = payrollWeeks.filter((w) => inRange(w.endDate || w.startDate));
    const filteredPurchases = supplyPurchases.filter((p) => inRange(p.purchaseDate));
    const filteredApps = greenhouseApplications.filter((a) => inRange(a.applicationDate));
    const filteredSuppliers = supplierPayments.filter((s) => inRange(s.paymentDate));
    const filteredLoads = truckLoads.filter((l) => inRange(l.loadDate));
    const filteredNotes = remissionNotes.filter((n) => inRange(n.noteDate));
    const filteredLegacySales = dailySales.filter((s) => inRange(s.saleDate));

    const totalPackagesProduced = filteredProd.reduce((acc, p) => acc + Number(p.grandTotal || 0), 0);
    const totalStemsProduced = totalPackagesProduced * stemsPerPackage;

    const packagesSoldRemissions = filteredNotes.reduce((acc, n) => acc + Number(n.totalPackages || 0), 0);
    const packagesDispatchedLoads = filteredLoads.reduce((acc, l) => acc + Number(l.totalPackages || 0), 0);
    const packagesLegacySales = filteredLegacySales.reduce((acc, s) => acc + Number(s.totalPackages || 0), 0);

    // Avoid double-counting: use Remission Notes when present, fallback to legacy daily sales or dispatched loads
    const totalPackagesSold =
      packagesSoldRemissions > 0
        ? packagesSoldRemissions + packagesLegacySales
        : packagesLegacySales > 0
        ? packagesLegacySales
        : packagesDispatchedLoads;

    const payrollCost = round2(
      filteredPayroll.reduce((acc, w) => acc + Number(w.grandTotalPay || 0), 0)
    );

    const purchasesCost = round2(
      filteredPurchases.reduce((acc, p) => acc + Number(p.totalCost || 0), 0)
    );
    const appsCost = round2(
      filteredApps.reduce((acc, a) => acc + Number(a.totalCost || 0), 0)
    );
    // Use actual supply purchases when recorded; if zero purchases in range, fall back to applied supplies cost
    const suppliesAndAppsCost = purchasesCost > 0 ? purchasesCost : appsCost;
    const suppliesCostSource =
      purchasesCost > 0 ? 'Compras de Insumos Registradas' : 'Aplicaciones en Invernadero';

    const supplierOpsCost = round2(
      filteredSuppliers.reduce((acc, s) => acc + Number(s.paidAmount || s.amount || 0), 0)
    );

    const productionTotalCost = round2(payrollCost + suppliesAndAppsCost + supplierOpsCost);

    const logisticsTripCost = round2(
      filteredLoads.reduce((acc, l) => acc + Number(l.totalExpenses || 0), 0)
    );

    const totalCombinedCost = round2(productionTotalCost + logisticsTripCost);

    const revenueRemissions = round2(
      filteredNotes.reduce((acc, n) => acc + Number(n.totalAmount || 0), 0)
    );
    const revenueLegacy = round2(
      filteredLegacySales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0)
    );
    const totalRevenue = round2(revenueRemissions + revenueLegacy);

    const costPerPackageGreenhouse =
      totalPackagesProduced > 0 ? productionTotalCost / totalPackagesProduced : 0;
    const costPerStem = totalStemsProduced > 0 ? productionTotalCost / totalStemsProduced : 0;

    const deliveryBasePackages =
      packagesDispatchedLoads > 0
        ? packagesDispatchedLoads
        : totalPackagesSold > 0
        ? totalPackagesSold
        : totalPackagesProduced;
    const deliveryCostPerPackage =
      deliveryBasePackages > 0 ? logisticsTripCost / deliveryBasePackages : 0;

    const totalCostPerPackageDelivered = costPerPackageGreenhouse + deliveryCostPerPackage;
    const avgSalePricePerPackage = totalPackagesSold > 0 ? totalRevenue / totalPackagesSold : 0;

    const netProfit = round2(totalRevenue - totalCombinedCost);
    const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const unitProfitPerPackage = avgSalePricePerPackage - totalCostPerPackageDelivered;

    const periodLabel = useAllHistory ? 'Todo el Historial Acumulado' : `${dateFrom} al ${dateTo}`;

    const exportData: CostAnalysisExportData = {
      periodLabel,
      stemsPerPackage,
      totalPackagesProduced,
      totalStemsProduced,
      totalPackagesSold,
      payrollCost,
      suppliesAndAppsCost,
      supplierOpsCost,
      productionTotalCost,
      logisticsTripCost,
      totalCombinedCost,
      totalRevenue,
      costPerStem,
      costPerPackageGreenhouse,
      deliveryCostPerPackage,
      totalCostPerPackageDelivered,
      avgSalePricePerPackage,
      netProfit,
      profitMarginPct,
    };

    return {
      ...exportData,
      suppliesCostSource,
      appsCost,
      purchasesCost,
      unitProfitPerPackage,
      counts: {
        productions: filteredProd.length,
        payrolls: filteredPayroll.length,
        purchases: filteredPurchases.length,
        apps: filteredApps.length,
        suppliers: filteredSuppliers.length,
        loads: filteredLoads.length,
        notes: filteredNotes.length,
      },
      exportData,
    };
  }, [
    dailyProductions,
    payrollWeeks,
    supplyPurchases,
    greenhouseApplications,
    supplierPayments,
    truckLoads,
    remissionNotes,
    dailySales,
    useAllHistory,
    dateFrom,
    dateTo,
    stemsPerPackage,
  ]);

  const costDistribution = [
    { label: 'Nómina y Mano de Obra', amount: analysis.payrollCost, color: 'bg-[#5C1125]' },
    { label: analysis.suppliesCostSource, amount: analysis.suppliesAndAppsCost, color: 'bg-[#535B28]' },
    { label: 'Proveedores y Gastos Operativos', amount: analysis.supplierOpsCost, color: 'bg-[#C3A25D]' },
    { label: 'Gastos de Viaje / Venta (Fletes, Casetas, Piso)', amount: analysis.logisticsTripCost, color: 'bg-[#000000]' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-[#C3A25D]/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AromaFlowersLogo size="lg" className="shrink-0" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C3A25D]">
                  Inteligencia Financiera &bull; Aroma Flower
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#535B28] text-white">
                  Cruce Automático en Tiempo Real
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                Control de Costos de Producción y Utilidad Real
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                Cruza nómina, insumos, proveedores y gastos de viaje contra producción y ventas para saber exactamente cuánto cuesta cada tallo y paquete.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportCostAnalysisExcel(analysis.exportData)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#C3A25D]" />
              <span>Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportCostAnalysisPdf(analysis.exportData)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs font-bold transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Period & Stems-per-Package Controls */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#5C1125]">
            <Calendar className="w-4 h-4" />
            <span>Periodo:</span>
          </div>
          <button
            type="button"
            onClick={() => setUseAllHistory(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              useAllHistory
                ? 'bg-[#5C1125] text-white border-[#5C1125]'
                : 'bg-[#FAF8F5] text-stone-700 border-stone-300'
            }`}
          >
            Todo el Historial
          </button>
          <button
            type="button"
            onClick={() => setUseAllHistory(false)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              !useAllHistory
                ? 'bg-[#5C1125] text-white border-[#5C1125]'
                : 'bg-[#FAF8F5] text-stone-700 border-stone-300'
            }`}
          >
            Rango de Fechas
          </button>

          {!useAllHistory && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold"
              />
              <span className="text-xs text-stone-500 font-bold">a</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 bg-[#FAF8F5] px-3.5 py-2 rounded-xl border border-[#C3A25D]/40">
          <Flower2 className="w-4 h-4 text-[#5C1125]" />
          <label className="text-xs font-bold text-stone-700 whitespace-nowrap">
            Tallos por Paquete:
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={stemsPerPackageStr}
            onChange={(e) => setStemsPerPackageStr(e.target.value.replace(/[^0-9]/g, ''))}
            className="no-spinner w-16 text-center px-2 py-1 border border-stone-300 rounded-lg text-xs font-black bg-white focus:ring-2 focus:ring-[#5C1125]"
          />
        </div>
      </div>

      {/* HERO UNIT ECONOMICS CARDS (The 4 core questions the client asked) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border-2 border-[#5C1125]/25 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5C1125]">
              Costo Real por 1 Tallo
            </span>
            <Flower2 className="w-5 h-5 text-[#5C1125]" />
          </div>
          <p className="text-3xl font-black text-[#000000]">
            {fmtMoney(analysis.costPerStem, 2)}
          </p>
          <p className="text-[11px] text-stone-500">
            Sobre {analysis.totalStemsProduced.toLocaleString()} tallos producidos ({stemsPerPackage}/paq.)
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border-2 border-[#535B28]/30 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#535B28]">
              Costo Paquete en Invernadero
            </span>
            <Package className="w-5 h-5 text-[#535B28]" />
          </div>
          <p className="text-3xl font-black text-[#535B28]">
            {fmtMoney(analysis.costPerPackageGreenhouse)}
          </p>
          <p className="text-[11px] text-stone-500">
            Sobre {analysis.totalPackagesProduced.toLocaleString()} paquetes cortados
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border-2 border-[#C3A25D]/50 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8a6d2b]">
              Costo Puesto en Punto de Venta
            </span>
            <Truck className="w-5 h-5 text-[#8a6d2b]" />
          </div>
          <p className="text-3xl font-black text-[#000000]">
            {fmtMoney(analysis.totalCostPerPackageDelivered)}
          </p>
          <p className="text-[11px] text-stone-500">
            Invernadero ({fmtMoney(analysis.costPerPackageGreenhouse)}) + Traslado ({fmtMoney(analysis.deliveryCostPerPackage)})
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl shadow-sm space-y-1 border ${
            analysis.netProfit >= 0
              ? 'bg-[#5C1125] text-white border-[#C3A25D]/50'
              : 'bg-rose-950 text-white border-rose-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#C3A25D]">
              Utilidad Neta Real
            </span>
            {analysis.netProfit >= 0 ? (
              <TrendingUp className="w-5 h-5 text-[#C3A25D]" />
            ) : (
              <TrendingDown className="w-5 h-5 text-rose-300" />
            )}
          </div>
          <p className="text-3xl font-black">{fmtMoney(analysis.netProfit)}</p>
          <p className="text-[11px] text-[#d6be83]">
            Margen Real: <strong className="text-white">{analysis.profitMarginPct.toFixed(1)}%</strong> &bull; Precio Prom.: {fmtMoney(analysis.avgSalePricePerPackage)}/paq.
          </p>
        </div>
      </div>

      {/* Detailed P&L + Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operating P&L */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#5C1125]" />
              <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
                Estado de Resultados Operativo
              </h2>
            </div>
            <span className="text-[11px] font-bold text-stone-500">{analysis.periodLabel}</span>
          </div>

          <div className="p-5 space-y-3 text-xs sm:text-sm">
            <div className="flex items-center justify-between py-2 border-b border-stone-100">
              <span className="font-extrabold text-[#535B28] flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Ingresos Totales por Ventas ({analysis.totalPackagesSold.toLocaleString()} paq.)
              </span>
              <span className="font-black text-[#535B28] text-base">
                {fmtMoney(analysis.totalRevenue)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-stone-700 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#5C1125]" />
                (-) Nómina de Trabajadores ({analysis.counts.payrolls} sem.)
              </span>
              <span className="font-bold text-rose-700">- {fmtMoney(analysis.payrollCost)}</span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-stone-700 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#535B28]" />
                (-) {analysis.suppliesCostSource}
              </span>
              <span className="font-bold text-rose-700">- {fmtMoney(analysis.suppliesAndAppsCost)}</span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-stone-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#8a6d2b]" />
                (-) Proveedores y Gastos Operativos ({analysis.counts.suppliers} mov.)
              </span>
              <span className="font-bold text-rose-700">- {fmtMoney(analysis.supplierOpsCost)}</span>
            </div>

            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-[#FAF8F5] border border-stone-200">
              <span className="font-extrabold text-stone-800">Subtotal Costo de Producción (Invernadero)</span>
              <span className="font-black text-[#000000]">{fmtMoney(analysis.productionTotalCost)}</span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-stone-700 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#000000]" />
                (-) Gastos de Viaje / Traslado a Puntos de Venta ({analysis.counts.loads} viajes)
              </span>
              <span className="font-bold text-rose-700">- {fmtMoney(analysis.logisticsTripCost)}</span>
            </div>

            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#000000] text-[#C3A25D]">
              <span className="font-extrabold uppercase text-xs">Costo Total Integrado</span>
              <span className="font-black text-base text-white">{fmtMoney(analysis.totalCombinedCost)}</span>
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#5C1125] text-white">
              <div>
                <span className="font-extrabold uppercase text-xs text-[#C3A25D] block">
                  Utilidad Neta Real del Periodo
                </span>
                <span className="text-[11px] text-[#d6be83]">
                  Utilidad promedio por paquete vendido: {fmtMoney(analysis.unitProfitPerPackage)}
                </span>
              </div>
              <span className="font-black text-xl">{fmtMoney(analysis.netProfit)}</span>
            </div>
          </div>
        </div>

        {/* Visual Distribution & Unit Benchmarks */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-5">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#000000]">
              Estructura de Costos (% de Participación)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Identifica qué rubro consume mayor presupuesto en tu operación florícola.
            </p>
          </div>

          <div className="space-y-3.5">
            {costDistribution.map((item) => {
              const pct =
                analysis.totalCombinedCost > 0
                  ? (item.amount / analysis.totalCombinedCost) * 100
                  : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-700">{item.label}</span>
                    <span className="font-black text-[#000000]">
                      {fmtMoney(item.amount)}{' '}
                      <span className="text-stone-500 font-semibold">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-stone-200 grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200">
              <span className="text-[10px] font-bold uppercase text-stone-500">
                Precio Promedio de Venta
              </span>
              <p className="text-lg font-black text-[#535B28] mt-0.5">
                {fmtMoney(analysis.avgSalePricePerPackage)} / paq.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200">
              <span className="text-[10px] font-bold uppercase text-stone-500">
                Ganancia Neta / Paquete
              </span>
              <p
                className={`text-lg font-black mt-0.5 ${
                  analysis.unitProfitPerPackage >= 0 ? 'text-[#5C1125]' : 'text-rose-700'
                }`}
              >
                {fmtMoney(analysis.unitProfitPerPackage)} / paq.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200">
              <span className="text-[10px] font-bold uppercase text-stone-500">
                Paquetes Producidos
              </span>
              <p className="text-lg font-black text-[#000000] mt-0.5">
                {analysis.totalPackagesProduced.toLocaleString()}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200">
              <span className="text-[10px] font-bold uppercase text-stone-500">
                Aplicaciones Registradas
              </span>
              <p className="text-lg font-black text-[#000000] mt-0.5">
                {fmtMoney(analysis.appsCost)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
