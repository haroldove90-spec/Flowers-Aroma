import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  Wallet,
  ShoppingBag,
  PlusCircle,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { SalesOrder, Customer } from '../../types/greenhouse';

export const SalesView: React.FC = () => {
  const {
    activeView,
    orders,
    customers,
    harvest,
    addOrder,
    updateOrderStatus,
    addCustomer,
  } = useGreenhouse();

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // New Order Form state
  const [selectedCust, setSelectedCust] = useState(customers[0]?.id || 'cli-1');
  const [orderVariety, setOrderVariety] = useState('Rosa Freedom (Roja)');
  const [orderGrade, setOrderGrade] = useState('60 cm Select (25 tallos)');
  const [orderPackages, setOrderPackages] = useState('50');
  const [orderPricePerPkg, setOrderPricePerPkg] = useState('195');
  const [orderPayment, setOrderPayment] = useState<'contado' | 'credito'>('contado');

  // Customer Form state
  const [cName, setCName] = useState('');
  const [cType, setCType] = useState<Customer['type']>('mayorista');
  const [cChannel, setCChannel] = useState<Customer['channel']>('Central de Abasto');
  const [cPhone, setCPhone] = useState('');
  const [cCity, setCCity] = useState('');
  const [cCreditDays, setCCreditDays] = useState('15');
  const [cLimit, setCLimit] = useState('100000');

  // Metrics
  const totalSales = orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalPackagesSold = orders.reduce((acc, o) => acc + o.packages25, 0);
  const totalReceivables = customers.reduce((acc, c) => acc + c.currentBalance, 0);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCust) || customers[0];
    const pkgs = parseInt(orderPackages) || 10;
    const price = parseFloat(orderPricePerPkg) || 190;
    const total = pkgs * price;

    const newOrder: SalesOrder = {
      id: `ord-${Date.now()}`,
      orderNumber: `PED-2026-${1040 + orders.length + 1}`,
      date: new Date().toISOString().slice(0, 10),
      customerId: cust.id,
      customerName: cust.name,
      channel: cust.channel,
      variety: orderVariety,
      grade: orderGrade,
      packages25: pkgs,
      totalStems: pkgs * 25,
      unitPricePerPackage: price,
      totalAmount: total,
      paymentType: orderPayment,
      dueDate: orderPayment === 'credito' ? '2026-11-15' : new Date().toISOString().slice(0, 10),
      status: orderPayment === 'contado' ? 'pagado' : 'empacado',
      paidAmount: orderPayment === 'contado' ? total : 0,
    };
    addOrder(newOrder);
    setShowOrderModal(false);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const newCust: Customer = {
      id: `cli-${Date.now()}`,
      name: cName.trim() || 'Nuevo Cliente',
      type: cType,
      channel: cChannel,
      contactPhone: cPhone,
      email: '',
      city: cCity,
      creditDays: parseInt(cCreditDays) || 0,
      creditLimit: parseFloat(cLimit) || 0,
      currentBalance: 0,
    };
    addCustomer(newCust);
    setShowCustomerModal(false);
  };

  // Determine current active view from sidebar without duplicate horizontal tabs
  const currentView =
    activeView === 'clientes'
      ? 'clientes'
      : activeView === 'cobranza'
      ? 'cobranza'
      : activeView === 'temporadas'
      ? 'temporadas'
      : 'pedidos';

  return (
    <div className="space-y-6">
      {/* Sales Header (Clean, without horizontal duplicate tab bar) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Ventas, Clientes y Comercialización
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {currentView === 'clientes'
              ? 'Directorio de Clientes & Canales de Distribución'
              : currentView === 'cobranza'
              ? 'Gestión de Cobranza & Cartera por Cobrar'
              : currentView === 'temporadas'
              ? 'Análisis de Demanda & Fechas Especiales'
              : 'Pedidos de Venta & Facturación de Flor'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentView === 'clientes'
              ? 'Central de Abasto CDMX, florerías regionales, exportación y límites de crédito'
              : currentView === 'cobranza'
              ? 'Control de plazos a 15 y 30 días, facturas vencidas y registro de liquidaciones'
              : currentView === 'temporadas'
              ? 'Estrategia de corte y fijación de precios para San Valentín y 10 de Mayo'
              : 'Generación de notas de venta y descuento de producto terminado en cámara'}
          </p>
        </div>

        <div>
          {currentView === 'pedidos' && (
            <button
              onClick={() => setShowOrderModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Pedido</span>
            </button>
          )}

          {currentView === 'clientes' && (
            <button
              onClick={() => setShowCustomerModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Cliente</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Facturación Acumulada</span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
            ${totalSales.toLocaleString()} <span className="text-xs font-normal text-slate-400">MXN</span>
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">{orders.length} órdenes generadas</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Bonches Despachados</span>
          <span className="text-xl sm:text-2xl font-black text-amber-800 mt-1 block">
            {totalPackagesSold.toLocaleString()} bonches
          </span>
          <span className="text-[11px] text-slate-500">{(totalPackagesSold * 25).toLocaleString()} tallos vendidos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Cartera / Cuentas x Cobrar</span>
          <span className="text-xl sm:text-2xl font-black text-rose-700 mt-1 block">
            ${totalReceivables.toLocaleString()} <span className="text-xs font-normal text-slate-400">MXN</span>
          </span>
          <span className="text-[11px] text-amber-700 font-medium">Créditos a 15 y 30 días</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Canal Principal</span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
            Central de Abasto
          </span>
          <span className="text-[11px] text-slate-500">62% de volumen total</span>
        </div>
      </div>

      {/* 1. View: Pedidos */}
      {currentView === 'pedidos' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-2 font-bold">Folio / Fecha</th>
                  <th className="pb-2 font-bold">Cliente / Canal</th>
                  <th className="pb-2 font-bold">Producto & Bonches</th>
                  <th className="pb-2 font-bold text-right">Total ($ MXN)</th>
                  <th className="pb-2 font-bold text-center">Estado</th>
                  <th className="pb-2 font-bold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 font-bold text-slate-900 whitespace-nowrap">
                      {o.orderNumber}
                      <span className="text-[10px] block font-normal text-slate-400">{o.date}</span>
                    </td>
                    <td className="py-3">
                      <span className="font-bold text-slate-900 block">{o.customerName}</span>
                      <span className="text-[10px] text-slate-500">{o.channel} • Pago: {o.paymentType}</span>
                    </td>
                    <td className="py-3">
                      <span className="font-bold text-slate-800 block">{o.variety} ({o.grade})</span>
                      <span className="text-[10px] text-slate-500">{o.packages25} bonches ({o.totalStems} tallos)</span>
                    </td>
                    <td className="py-3 text-right font-black text-slate-900 whitespace-nowrap">
                      ${o.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          o.status === 'pagado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'enviado'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {o.status !== 'pagado' && (
                        <button
                          onClick={() => updateOrderStatus(o.id, 'pagado')}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100"
                        >
                          Liquidar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. View: Clientes */}
      {currentView === 'clientes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customers.map((c) => (
            <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    {c.channel}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{c.name}</h3>
                </div>
                <span className="text-xs font-black text-rose-700">
                  Saldo: ${c.currentBalance.toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pt-1">
                <p>📍 {c.city}</p>
                <p>📞 {c.contactPhone} • ✉️ {c.email || 'Sin correo'}</p>
                <p className="text-[11px] text-slate-500">
                  Plazo Crédito: <strong>{c.creditDays} días</strong> • Límite: ${c.creditLimit.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. View: Cobranza */}
      {currentView === 'cobranza' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="space-y-3">
            {customers.filter((c) => c.currentBalance > 0).map((c) => (
              <div key={c.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{c.name}</h3>
                  <p className="text-xs text-slate-600">
                    Canal: {c.channel} • Crédito {c.creditDays} días • Tel: {c.contactPhone}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-rose-700 block">
                    ${c.currentBalance.toLocaleString()} MXN
                  </span>
                  <span className="text-[10px] text-slate-500">Saldo por cobrar</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. View: Temporadas Especiales */}
      {currentView === 'temporadas' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-rose-200 bg-white shadow-xs space-y-2">
            <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded">14 Febrero</span>
            <h3 className="font-bold text-slate-900 text-sm mt-1">San Valentín</h3>
            <p className="text-xs text-slate-600">
              Demanda pico de Rosa Freedom y Rosa Explorer. Precios proyectados suben a $280/bonche de 25.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-amber-200 bg-white shadow-xs space-y-2">
            <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded">10 Mayo</span>
            <h3 className="font-bold text-slate-900 text-sm mt-1">Día de las Madres</h3>
            <p className="text-xs text-slate-600">
              Variedades Mondial, Freedom y Gypsophila al 100% de capacidad. Máximo volumen nacional.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-purple-200 bg-white shadow-xs space-y-2">
            <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded">1 y 2 Noviembre</span>
            <h3 className="font-bold text-slate-900 text-sm mt-1">Día de Muertos</h3>
            <p className="text-xs text-slate-600">
              Mercados locales y Central de Abasto con alta rotación de follajes y flores blancas/amarillas.
            </p>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Pedido */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs text-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Generar Orden de Pedido / Nota de Venta
            </h3>
            <form onSubmit={handleCreateOrder} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cliente</label>
                <select
                  value={selectedCust}
                  onChange={(e) => setSelectedCust(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.channel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Variedad de Flor</label>
                <select
                  value={orderVariety}
                  onChange={(e) => setOrderVariety(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="Rosa Freedom (Roja)">Rosa Freedom (Roja)</option>
                  <option value="Rosa Mondial (Blanca)">Rosa Mondial (Blanca)</option>
                  <option value="Rosa Explorer (Terciopelo)">Rosa Explorer (Terciopelo)</option>
                  <option value="Gypsophila Million Stars">Gypsophila Million Stars</option>
                  <option value="Clavel Standard Diana">Clavel Standard Diana</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Grado y Longitud</label>
                <select
                  value={orderGrade}
                  onChange={(e) => setOrderGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="60 cm Select (25 tallos)">60 cm Select (25 tallos)</option>
                  <option value="70 cm Fancy (25 tallos)">70 cm Fancy (25 tallos)</option>
                  <option value="80 cm Export (25 tallos)">80 cm Export (25 tallos)</option>
                  <option value="50 cm Nacional (25 tallos)">50 cm Nacional (25 tallos)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Paquetes de 25</label>
                  <input
                    type="number"
                    value={orderPackages}
                    onChange={(e) => setOrderPackages(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Precio por Paquete ($)</label>
                  <input
                    type="number"
                    value={orderPricePerPkg}
                    onChange={(e) => setOrderPricePerPkg(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Condición de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderPayment('contado')}
                    className={`py-1.5 rounded-lg font-bold border text-center ${
                      orderPayment === 'contado' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Contado (Cobro Inmediato)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderPayment('credito')}
                    className={`py-1.5 rounded-lg font-bold border text-center ${
                      orderPayment === 'credito' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Crédito (Añadir a Cartera)
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Total del Pedido</span>
                <span className="text-lg font-black text-slate-900">
                  ${((parseInt(orderPackages) || 0) * (parseFloat(orderPricePerPkg) || 0)).toLocaleString()} MXN
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ({(parseInt(orderPackages) || 0) * 25} tallos totales)
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700"
                >
                  Guardar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Cliente */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs text-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Alta de Nuevo Cliente
            </h3>
            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre Comercial / Razón Social</label>
                <input
                  type="text"
                  required
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Canal de Venta</label>
                  <select
                    value={cChannel}
                    onChange={(e) => setCChannel(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Central de Abasto">Central de Abasto</option>
                    <option value="Local">Local</option>
                    <option value="Regional">Regional</option>
                    <option value="Exportación">Exportación</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ciudad / Ubicación</label>
                <input
                  type="text"
                  value={cCity}
                  onChange={(e) => setCCity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
