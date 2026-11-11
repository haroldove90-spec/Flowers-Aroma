import React, { useState } from 'react';
import {
  TrendingUp,
  Wallet,
  Building2,
  PieChart,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  CreditCard,
  PlusCircle,
  FileText,
  DollarSign,
  Calendar,
  Layers,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { FinancialMovement, ActiveLoan, BankAccount } from '../../types/greenhouse';

export const DirectorView: React.FC = () => {
  const {
    activeView,
    bankAccounts,
    movements,
    loans,
    orders,
    modules,
    harvest,
    auditLogs,
    addFinancialMovement,
  } = useGreenhouse();

  // Movement Form Modal state
  const [showAddMovModal, setShowAddMovModal] = useState(false);
  const [movType, setMovType] = useState<'ingreso' | 'egreso' | 'transferencia'>('egreso');
  const [movScope, setMovScope] = useState<'empresarial' | 'personal'>('empresarial');
  const [movCategory, setMovCategory] = useState('Insumos Agrícolas');
  const [movAmount, setMovAmount] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [movAccount, setMovAccount] = useState(bankAccounts[0]?.id || 'bco-1');

  // Filter for movements in finanzas
  const [filterScope, setFilterScope] = useState<'todos' | 'empresarial' | 'personal'>('todos');

  // Metrics
  const totalBankBalance = bankAccounts.reduce((acc, b) => acc + b.balance, 0);
  const totalBusinessIncome = movements
    .filter((m) => m.type === 'ingreso' && m.scope === 'empresarial')
    .reduce((acc, m) => acc + m.amount, 0);
  const totalBusinessExpense = movements
    .filter((m) => m.type === 'egreso' && m.scope === 'empresarial')
    .reduce((acc, m) => acc + m.amount, 0);
  const totalPersonalDraws = movements
    .filter((m) => m.scope === 'personal')
    .reduce((acc, m) => acc + m.amount, 0);
  const totalDebt = loans.reduce((acc, l) => acc + l.outstandingBalance, 0);

  const totalStemsSold = orders.reduce((acc, o) => acc + o.totalStems, 0);
  const totalHarvestedStems = harvest.reduce((acc, h) => acc + h.stemsCut, 0);

  // Cost estimates
  const costPerStem = 3.85; // $3.85 MXN per stem
  const costPerPackage = costPerStem * 25; // $96.25 MXN per 25 stem bunch
  const avgSalePricePerStem = totalStemsSold > 0 ? (orders.reduce((acc, o) => acc + o.totalAmount, 0) / totalStemsSold) : 8.5;
  const grossMarginPercent = (((avgSalePricePerStem - costPerStem) / avgSalePricePerStem) * 100).toFixed(1);

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movAmount || isNaN(Number(movAmount))) return;
    const newMovement: FinancialMovement = {
      id: `mov-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      type: movType,
      scope: movScope,
      category: movCategory,
      amount: parseFloat(movAmount),
      description: movDesc || 'Registro de tesorería',
      bankAccountId: movAccount,
      reconciled: true,
    };
    addFinancialMovement(newMovement);
    setShowAddMovModal(false);
    setMovAmount('');
    setMovDesc('');
  };

  const handleExportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Ámbito', 'Categoría', 'Monto MXN', 'Descripción', 'Conciliado'];
    const rows = movements.map((m) => [
      m.date,
      m.type,
      m.scope,
      `"${m.category}"`,
      m.amount,
      `"${m.description}"`,
      m.reconciled ? 'SI' : 'NO',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_financiero_aroma_flowers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMovements = movements.filter((m) => {
    if (filterScope === 'todos') return true;
    return m.scope === filterScope;
  });

  // Current view selected from sidebar
  const currentView =
    activeView === 'finanzas'
      ? 'finanzas'
      : activeView === 'costos'
      ? 'costos'
      : activeView === 'deudas'
      ? 'deudas'
      : activeView === 'reportes'
      ? 'reportes'
      : 'kpis';

  return (
    <div className="space-y-6">
      {/* Executive Header (Clean, without horizontal duplicate tab bar) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Alta Dirección & Gerencia Propietaria
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {currentView === 'finanzas'
              ? 'Tesorería, Cuentas Bancarias & Flujo de Caja'
              : currentView === 'costos'
              ? 'Costos Unitarios, Margen & Rentabilidad'
              : currentView === 'deudas'
              ? 'Préstamos, Tasas & Líneas Refaccionarias'
              : currentView === 'reportes'
              ? 'Reportes Ejecutivos & Bitácora de Auditoría'
              : 'Panel Estratégico de Indicadores (KPIs)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentView === 'finanzas'
              ? 'Registro de ingresos/egresos y separación estricta de gastos personales del socio vs negocio'
              : currentView === 'costos'
              ? 'Cálculo de costo por tallo ($3.85), bonche de 25 ($96.25) y punto de equilibrio'
              : currentView === 'deudas'
              ? 'Control de capital, intereses, garantías y calendario de vencimientos bancarios'
              : currentView === 'reportes'
              ? 'Exportación a Excel (CSV), impresión en PDF y trazabilidad de registros'
              : 'Visión 360° de la salud financiera, margen operativo y rentabilidad de flor'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentView === 'finanzas' && (
            <button
              onClick={() => setShowAddMovModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Movimiento</span>
            </button>
          )}

          {currentView === 'reportes' && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs sm:text-sm font-semibold transition border border-emerald-200"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Exportar Excel</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition border border-slate-200"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimir PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 1. View: KPIs Principales */}
      {currentView === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Saldo en Tesorería</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900">
                ${totalBankBalance.toLocaleString()} <span className="text-xs font-normal text-slate-500">MXN</span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {bankAccounts.length} cuentas conciliadas
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Margen Bruto de Flor</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-lg sm:text-2xl font-black text-emerald-800">
                {grossMarginPercent}%
              </div>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">
                Precio prom: ${avgSalePricePerStem.toFixed(2)} / tallo
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Costo Unitario Tallo</span>
                <PieChart className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900">
                ${costPerStem.toFixed(2)} <span className="text-xs font-semibold text-slate-500">/ tallo</span>
              </div>
              <p className="mt-1 text-[11px] text-blue-700 font-medium">
                ${costPerPackage.toFixed(2)} por paquete de 25
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Pasivo / Deuda Activa</span>
                <CreditCard className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-lg sm:text-2xl font-black text-amber-800">
                ${totalDebt.toLocaleString()} <span className="text-xs font-normal text-slate-500">MXN</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">
                {loans.length} líneas FIRA / Bancarias
              </p>
            </div>
          </div>

          {/* Directorship Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Resumen de Ingresos vs Egresos Operativos
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Ingresos por Venta de Flor:</span>
                  <strong className="text-emerald-700 font-bold">${totalBusinessIncome.toLocaleString()} MXN</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Egresos Empresariales Operativos:</span>
                  <strong className="text-slate-900 font-bold">${totalBusinessExpense.toLocaleString()} MXN</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Retiros Personales del Propietario:</span>
                  <strong className="text-purple-700 font-bold">${totalPersonalDraws.toLocaleString()} MXN</strong>
                </div>
                <div className="flex justify-between py-2 pt-2 text-sm">
                  <span className="font-bold text-slate-900">Utilidad Operativa Neta:</span>
                  <strong className="text-emerald-800 font-black">
                    ${(totalBusinessIncome - totalBusinessExpense).toLocaleString()} MXN
                  </strong>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Rentabilidad por Módulo y Variedad
              </h3>
              <div className="space-y-2 text-xs">
                {modules.slice(0, 4).map((m) => (
                  <div key={m.id} className="p-2.5 rounded-lg bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{m.code} - {m.variety}</span>
                      <span className="text-[10px] text-slate-500 block">{m.areaM2} m² • {m.plantsCount} plantas</span>
                    </div>
                    <span className="font-bold text-emerald-700 text-xs">
                      ${(m.expectedYieldStems * 8.5).toLocaleString()} est.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. View: Finanzas & Tesorería */}
      {currentView === 'finanzas' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Movimientos Bancarios & Separación de Gastos</h2>
                <p className="text-xs text-slate-500">
                  Control estricto de caja chica, cheques, transferencias y retiro de socios
                </p>
              </div>

              {/* Scope filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setFilterScope('todos')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    filterScope === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({movements.length})
                </button>
                <button
                  onClick={() => setFilterScope('empresarial')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    filterScope === 'empresarial' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Empresariales
                </button>
                <button
                  onClick={() => setFilterScope('personal')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    filterScope === 'personal' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gastos Personales
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-2 font-bold">Fecha</th>
                    <th className="pb-2 font-bold">Concepto / Categoría</th>
                    <th className="pb-2 font-bold">Ámbito</th>
                    <th className="pb-2 font-bold text-right">Monto</th>
                    <th className="pb-2 font-bold text-center">Conciliado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 text-slate-600 whitespace-nowrap">{m.date}</td>
                      <td className="py-3 pr-2">
                        <span className="font-bold text-slate-900 block">{m.description}</span>
                        <span className="text-[10px] text-slate-500">{m.category}</span>
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.scope === 'personal'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {m.scope === 'personal' ? 'Personal' : 'Empresarial'}
                        </span>
                      </td>
                      <td
                        className={`py-3 text-right font-bold whitespace-nowrap ${
                          m.type === 'ingreso' ? 'text-emerald-700' : 'text-slate-800'
                        }`}
                      >
                        {m.type === 'ingreso' ? '+' : '-'}${m.amount.toLocaleString()}
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center text-emerald-600 font-bold text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> OK
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cuentas Bancarias */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              Cuentas Bancarias, Efectivo y Tarjetas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {bankAccounts.map((acc) => (
                <div key={acc.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <h4 className="text-xs font-bold text-slate-800">{acc.bankName}</h4>
                  <span className="text-[10px] text-slate-500 block">{acc.accountNumber}</span>
                  <span className={`text-base font-black mt-2 block ${acc.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    ${acc.balance.toLocaleString()} {acc.currency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. View: Costos & Rentabilidad */}
      {currentView === 'costos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
              <span className="text-slate-500 text-xs font-semibold">Costo Directo por Tallo</span>
              <strong className="text-2xl font-black text-slate-900 block">$2.40 MXN</strong>
              <span className="text-[11px] text-slate-400">Fertilizante, plaguicidas y corte</span>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
              <span className="text-slate-500 text-xs font-semibold">Costos Indirectos y Fijos</span>
              <strong className="text-2xl font-black text-slate-900 block">$1.45 MXN</strong>
              <span className="text-[11px] text-slate-400">Energía caldera, empaque, amortización</span>
            </div>
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 shadow-xs space-y-1">
              <span className="text-emerald-800 text-xs font-semibold">Costo Total por Paquete (25 Tallos)</span>
              <strong className="text-2xl font-black text-emerald-900 block">${costPerPackage.toFixed(2)} MXN</strong>
              <span className="text-[11px] text-emerald-700 font-medium">Margen promedio de contribución: 54.7%</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Desglose de Costos por Metro Cuadrado (m²)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px]">
                    <th className="pb-2 font-bold">Módulo / Variedad</th>
                    <th className="pb-2 font-bold">Superficie</th>
                    <th className="pb-2 font-bold">Costo Directo</th>
                    <th className="pb-2 font-bold">Costo Indirecto</th>
                    <th className="pb-2 font-bold text-right">Costo / m²</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modules.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-800">{m.code} - {m.variety}</td>
                      <td className="py-2.5 text-slate-600">{m.areaM2.toLocaleString()} m²</td>
                      <td className="py-2.5 text-slate-600">$18.50 / m²</td>
                      <td className="py-2.5 text-slate-600">$11.20 / m²</td>
                      <td className="py-2.5 text-right font-black text-slate-900">$29.70 MXN</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. View: Deudas & Créditos */}
      {currentView === 'deudas' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Líneas de Crédito, Financiamiento & Calendario de Amortización
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loans.map((loan) => (
              <div key={loan.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{loan.institution}</h3>
                    <span className="text-[10px] text-slate-500">Plazo: {loan.termMonths} meses (Restan {loan.remainingMonths})</span>
                  </div>
                  <span className="text-base font-black text-amber-800">
                    ${loan.outstandingBalance.toLocaleString()} MXN
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 pt-2 border-t border-amber-200/60">
                  <div>Tasa Anual: <strong>{loan.interestRateAnnual}%</strong></div>
                  <div>Pago Mensual: <strong>${loan.monthlyPayment.toLocaleString()}</strong></div>
                  <div className="col-span-2">Garantía: <strong>{loan.collateral}</strong></div>
                  <div className="col-span-2 text-emerald-800">Próximo Vencimiento: <strong>{loan.nextDueDate}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. View: Reportes & Auditoría */}
      {currentView === 'reportes' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Bitácora de Auditoría y Trazabilidad</h2>
              <p className="text-xs text-slate-500">Registro inmutable de transacciones, capturas y cambios</p>
            </div>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      {log.userRole}
                    </span>
                    <strong className="text-slate-900">{log.action}</strong>
                  </div>
                  <span className="text-slate-500 text-[11px] block mt-1">{log.details}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                  {log.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Registrar Movimiento */}
      {showAddMovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-xs">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Registrar Movimiento de Tesorería
            </h3>
            <form onSubmit={handleCreateMovement} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Movimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['egreso', 'ingreso', 'transferencia'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMovType(t)}
                      className={`py-1.5 rounded-lg font-bold capitalize text-center border ${
                        movType === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Separación de Ámbito</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovScope('empresarial')}
                    className={`py-1.5 rounded-lg font-bold text-center border ${
                      movScope === 'empresarial' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Gasto Empresarial
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovScope('personal')}
                    className={`py-1.5 rounded-lg font-bold text-center border ${
                      movScope === 'personal' ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Retiro Personal Socio
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monto en Pesos ($ MXN)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="ej. 15000"
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concepto / Categoría</label>
                <input
                  type="text"
                  required
                  value={movCategory}
                  onChange={(e) => setMovCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={movDesc}
                  onChange={(e) => setMovDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cuenta Bancaria</label>
                <select
                  value={movAccount}
                  onChange={(e) => setMovAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountNumber} (${acc.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMovModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
