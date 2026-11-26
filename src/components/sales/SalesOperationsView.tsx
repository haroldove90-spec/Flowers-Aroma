import React, { useState, useMemo } from 'react';
import {
  Truck,
  Receipt,
  Calculator,
  Wallet,
  MapPin,
  Users,
  PlusCircle,
  Save,
  Trash2,
  Edit3,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  MessageCircle,
  Copy,
  RefreshCw,
  DollarSign,
  Package,
  AlertCircle,
  Store,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  DailyProductionRow,
  RemissionNote,
  RemissionNoteRow,
  RemissionPaymentMethod,
  SalesClient,
  SalesPoint,
  TruckLoad,
  TruckLoadOwnerShare,
} from '../../types/greenhouse';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';
import {
  DriverLiquidationSummary,
  exportClientStatementExcel,
  exportClientStatementPdf,
  exportDriverLiquidationExcel,
  exportDriverLiquidationPdf,
  exportRemissionNotePdf,
  exportTruckLoadReportPdf,
} from '../../utils/exportReports';

const todayIso = () => new Date().toISOString().slice(0, 10);

const parseIntPos = (raw: string): number => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const parseDecPos = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parts = cleaned.split('.');
  const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const sanitizePhoneForWa = (phone: string): string => {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `52${digits}` : digits;
};

export const SalesOperationsView: React.FC = () => {
  const {
    currentUser,
    appUsers,
    aromaProducts,
    generalInventory,
    salesPoints,
    saveSalesPoint,
    deleteSalesPoint,
    salesClients,
    saveSalesClient,
    deleteSalesClient,
    truckLoads,
    saveTruckLoad,
    deleteTruckLoad,
    remissionNotes,
    saveRemissionNote,
    deleteRemissionNote,
    clientPayments,
    addClientPayment,
    deleteClientPayment,
    refreshFromSupabase,
    supabaseConfig,
    isOnline,
    setActiveView,
    canAccessModule,
  } = useGreenhouse();

  const [activeTab, setActiveTab] = useState<
    'cargas' | 'remisiones' | 'liquidacion' | 'cobranza' | 'catalogos'
  >('cargas');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const ok = await refreshFromSupabase();
    setIsRefreshing(false);
    showToast(ok ? 'Ventas, cargas y cobranza sincronizadas con Supabase.' : 'Mostrando datos locales.');
  };

  // Map available inventory by product name for live reference
  const stockByProductName = useMemo(() => {
    const m = new Map<string, { lar: number; med: number; chi: number; total: number }>();
    generalInventory.forEach((r) => {
      m.set(r.productName.trim().toUpperCase(), {
        lar: r.availableLar,
        med: r.availableMed,
        chi: r.availableChi,
        total: r.availableTotal,
      });
    });
    return m;
  }, [generalInventory]);

  // =========================================================================
  // TAB 1: CARGAS DE CAMIONETA, GASTOS DE VIAJE Y PRORRATEO
  // =========================================================================
  const buildBlankLoadRows = (existing?: TruckLoad): DailyProductionRow[] => {
    const activeCatalog = [...aromaProducts]
      .filter((p) => p.active !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const prevMap = new Map<string, DailyProductionRow>();
    existing?.rows.forEach((r) => prevMap.set(r.productName.trim().toUpperCase(), r));
    return activeCatalog.map((p) => {
      const prev = prevMap.get(p.name.trim().toUpperCase());
      if (prev) return { ...prev, productId: p.id, productName: p.name, captureMode: p.captureMode };
      return {
        productId: p.id,
        productName: p.name,
        captureMode: p.captureMode,
        lar: 0,
        med: 0,
        chi: 0,
        total: 0,
      };
    });
  };

  const [editingLoadId, setEditingLoadId] = useState<string | undefined>(undefined);
  const [loadFolio, setLoadFolio] = useState('');
  const [loadDate, setLoadDate] = useState(todayIso);
  const [loadPosId, setLoadPosId] = useState(() => salesPoints[0]?.id || '');
  const [loadDriverName, setLoadDriverName] = useState('David');
  const [loadVehicle, setLoadVehicle] = useState('Camioneta Nissan 3.5T');
  const [loadStatus, setLoadStatus] = useState<'en_ruta' | 'liquidada'>('en_ruta');
  const [loadNotes, setLoadNotes] = useState('');
  const [loadRows, setLoadRows] = useState<DailyProductionRow[]>(() => buildBlankLoadRows());
  const [expCasetas, setExpCasetas] = useState('');
  const [expGasolina, setExpGasolina] = useState('');
  const [expPagoPiso, setExpPagoPiso] = useState('');
  const [expComida, setExpComida] = useState('');
  const [expExtra, setExpExtra] = useState('');
  const [expExtraNotes, setExpExtraNotes] = useState('');
  const [ownerSharesDraft, setOwnerSharesDraft] = useState<
    Array<{ ownerName: string; packages: string; grossSales: string }>
  >([
    { ownerName: 'Harold', packages: '', grossSales: '' },
    { ownerName: 'David', packages: '', grossSales: '' },
  ]);
  const [confirmDeleteLoadId, setConfirmDeleteLoadId] = useState<string | null>(null);
  const [isSavingLoad, setIsSavingLoad] = useState(false);

  const loadTotals = useMemo(() => {
    return loadRows.reduce(
      (acc, r) => {
        if (r.captureMode === 'direct_total') {
          acc.totalPackages += Number(r.total || 0);
        } else {
          acc.totalLar += Number(r.lar || 0);
          acc.totalMed += Number(r.med || 0);
          acc.totalChi += Number(r.chi || 0);
          acc.totalPackages += Number(r.lar || 0) + Number(r.med || 0) + Number(r.chi || 0);
        }
        return acc;
      },
      { totalLar: 0, totalMed: 0, totalChi: 0, totalPackages: 0 }
    );
  }, [loadRows]);

  const loadExpenseTotals = useMemo(() => {
    const casetas = parseDecPos(expCasetas);
    const gasolina = parseDecPos(expGasolina);
    const pagoPiso = parseDecPos(expPagoPiso);
    const comida = parseDecPos(expComida);
    const extra = parseDecPos(expExtra);
    const totalExpenses = casetas + gasolina + pagoPiso + comida + extra;
    const ownerPkgSum = ownerSharesDraft.reduce((a, o) => a + parseIntPos(o.packages), 0);
    const basePkg = loadTotals.totalPackages > 0 ? loadTotals.totalPackages : ownerPkgSum;
    const costPerPackage = basePkg > 0 ? totalExpenses / basePkg : 0;
    const computedOwners: TruckLoadOwnerShare[] = ownerSharesDraft
      .filter((o) => o.ownerName.trim())
      .map((o) => {
        const packages = parseIntPos(o.packages);
        const grossSales = parseDecPos(o.grossSales);
        const expenseShare = Number((packages * costPerPackage).toFixed(2));
        return {
          ownerName: o.ownerName.trim(),
          packages,
          expenseShare,
          grossSales,
          netPayout: Number((grossSales - expenseShare).toFixed(2)),
        };
      });
    return {
      casetas,
      gasolina,
      pagoPiso,
      comida,
      extra,
      totalExpenses,
      costPerPackage,
      computedOwners,
    };
  }, [expCasetas, expGasolina, expPagoPiso, expComida, expExtra, ownerSharesDraft, loadTotals.totalPackages]);

  const handleLoadCellChange = (
    productId: string,
    field: 'lar' | 'med' | 'chi' | 'direct',
    raw: string
  ) => {
    const num = parseIntPos(raw);
    setLoadRows((prev) =>
      prev.map((row) => {
        if (row.productId !== productId) return row;
        if (field === 'direct' || row.captureMode === 'direct_total') {
          return { ...row, lar: 0, med: 0, chi: 0, total: num };
        }
        const lar = field === 'lar' ? num : row.lar;
        const med = field === 'med' ? num : row.med;
        const chi = field === 'chi' ? num : row.chi;
        return { ...row, lar, med, chi, total: lar + med + chi };
      })
    );
  };

  const resetLoadForm = () => {
    setEditingLoadId(undefined);
    setLoadFolio('');
    setLoadDate(todayIso());
    setLoadPosId(salesPoints[0]?.id || '');
    setLoadDriverName('David');
    setLoadVehicle('Camioneta Nissan 3.5T');
    setLoadStatus('en_ruta');
    setLoadNotes('');
    setLoadRows(buildBlankLoadRows());
    setExpCasetas('');
    setExpGasolina('');
    setExpPagoPiso('');
    setExpComida('');
    setExpExtra('');
    setExpExtraNotes('');
    setOwnerSharesDraft([
      { ownerName: 'Harold', packages: '', grossSales: '' },
      { ownerName: 'David', packages: '', grossSales: '' },
    ]);
  };

  const loadExistingTruckLoad = (load: TruckLoad) => {
    setEditingLoadId(load.id);
    setLoadFolio(load.folio);
    setLoadDate(load.loadDate);
    setLoadPosId(load.salesPointId);
    setLoadDriverName(load.driverName);
    setLoadVehicle(load.vehicleLabel || '');
    setLoadStatus(load.status);
    setLoadNotes(load.notes || '');
    setLoadRows(buildBlankLoadRows(load));
    setExpCasetas(load.expenses?.casetas ? String(load.expenses.casetas) : '');
    setExpGasolina(load.expenses?.gasolina ? String(load.expenses.gasolina) : '');
    setExpPagoPiso(load.expenses?.pagoPiso ? String(load.expenses.pagoPiso) : '');
    setExpComida(load.expenses?.comida ? String(load.expenses.comida) : '');
    setExpExtra(load.expenses?.extra ? String(load.expenses.extra) : '');
    setExpExtraNotes(load.expenses?.extraNotes || '');
    setOwnerSharesDraft(
      load.ownerShares && load.ownerShares.length > 0
        ? load.ownerShares.map((o) => ({
            ownerName: o.ownerName,
            packages: String(o.packages || ''),
            grossSales: String(o.grossSales || ''),
          }))
        : [
            { ownerName: 'Harold', packages: '', grossSales: '' },
            { ownerName: 'David', packages: '', grossSales: '' },
          ]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveTruckLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    const pos = salesPoints.find((p) => p.id === loadPosId) || salesPoints[0];
    if (!pos) {
      showToast('Primero agrega un Punto de Venta en la pestaña Catálogos.');
      return;
    }
    const nonZeroRows = loadRows.filter((r) => r.total > 0);
    if (nonZeroRows.length === 0) {
      showToast('Captura al menos 1 paquete en la tabla de variedades para guardar la carga.');
      return;
    }
    setIsSavingLoad(true);
    const driverUser = appUsers.find(
      (u) => u.fullName.toLowerCase() === loadDriverName.trim().toLowerCase()
    );
    const res = await saveTruckLoad(
      {
        folio: loadFolio.trim() || `CARGA-${new Date().getFullYear()}-${String(truckLoads.length + 1).padStart(3, '0')}`,
        loadDate,
        salesPointId: pos.id,
        salesPointName: pos.name,
        driverUserId: driverUser?.id || '',
        driverName: loadDriverName.trim() || 'Chofer',
        vehicleLabel: loadVehicle.trim(),
        rows: nonZeroRows,
        totalLar: loadTotals.totalLar,
        totalMed: loadTotals.totalMed,
        totalChi: loadTotals.totalChi,
        totalPackages: loadTotals.totalPackages,
        expenses: {
          casetas: loadExpenseTotals.casetas,
          gasolina: loadExpenseTotals.gasolina,
          pagoPiso: loadExpenseTotals.pagoPiso,
          comida: loadExpenseTotals.comida,
          extra: loadExpenseTotals.extra,
          extraNotes: expExtraNotes.trim(),
        },
        totalExpenses: loadExpenseTotals.totalExpenses,
        costPerPackage: loadExpenseTotals.costPerPackage,
        ownerShares: loadExpenseTotals.computedOwners,
        status: loadStatus,
        notes: loadNotes.trim(),
      },
      editingLoadId
    );
    setIsSavingLoad(false);
    showToast(
      res.cloudSynced
        ? `Carga ${res.entry.folio} (${res.entry.totalPackages} paq.) guardada en Supabase y descontada del Inventario General.`
        : `Carga ${res.entry.folio} guardada localmente y descontada del Inventario General.`
    );
    resetLoadForm();
  };

  const buildLoadWaUrl = (load: TruckLoad) => {
    const lines = [
      `*AROMA FLOWER — REPORTE DE CARGA ${load.folio}*`,
      `Fecha: ${load.loadDate}`,
      `Destino: ${load.salesPointName}`,
      `Chofer / Vendedor: ${load.driverName}`,
      `Total Paquetes: *${load.totalPackages}* (LAR: ${load.totalLar} | MED: ${load.totalMed} | CHI: ${load.totalChi})`,
      '',
      '*Detalle:*',
      ...load.rows
        .filter((r) => r.total > 0)
        .map((r) => `• ${r.productName}: ${r.total} paq (L:${r.lar} M:${r.med} C:${r.chi})`),
      '',
      `Gastos viaje: ${fmtMoney(load.totalExpenses)} (${fmtMoney(load.costPerPackage)}/paq)`,
    ];
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  // =========================================================================
  // TAB 2: NOTAS DE REMISIÓN (MODO TABLET + PRECIOS VARIABLES + WHATSAPP)
  // =========================================================================
  const [editingNoteId, setEditingNoteId] = useState<string | undefined>(undefined);
  const [noteDate, setNoteDate] = useState(todayIso);
  const [noteLoadId, setNoteLoadId] = useState('');
  const [notePosId, setNotePosId] = useState(() => salesPoints[0]?.id || '');
  const [noteClientId, setNoteClientId] = useState(() => salesClients[0]?.id || '');
  const [noteSellerName, setNoteSellerName] = useState(() => currentUser?.fullName || 'David');
  const [noteOwnerName, setNoteOwnerName] = useState('Harold');
  const [notePayMethod, setNotePayMethod] = useState<RemissionPaymentMethod>('contado');
  const [notePaidAmount, setNotePaidAmount] = useState('');
  const [noteNotes, setNoteNotes] = useState('');
  const [noteRows, setNoteRows] = useState<RemissionNoteRow[]>([
    {
      productId: aromaProducts[0]?.id || 'prod-freedom',
      productName: aromaProducts[0]?.name || 'FREEDOM',
      colorNote: '',
      lar: 0,
      med: 0,
      chi: 0,
      totalPackages: 0,
      unitPrice: 0,
      subtotal: 0,
    },
  ]);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const noteTotals = useMemo(() => {
    const totalPackages = noteRows.reduce((a, r) => a + Number(r.totalPackages || 0), 0);
    const totalAmount = noteRows.reduce((a, r) => a + Number(r.subtotal || 0), 0);
    const paid =
      notePayMethod === 'contado' || notePayMethod === 'deposito'
        ? notePaidAmount === ''
          ? totalAmount
          : parseDecPos(notePaidAmount)
        : parseDecPos(notePaidAmount);
    const balanceDue = Math.max(0, totalAmount - paid);
    return { totalPackages, totalAmount, paid, balanceDue };
  }, [noteRows, notePayMethod, notePaidAmount]);

  const handleAddNoteRow = () => {
    const firstProd = aromaProducts[0];
    setNoteRows((prev) => [
      ...prev,
      {
        productId: firstProd?.id || `p-${Date.now()}`,
        productName: firstProd?.name || 'FREEDOM',
        colorNote: '',
        lar: 0,
        med: 0,
        chi: 0,
        totalPackages: 0,
        unitPrice: 0,
        subtotal: 0,
      },
    ]);
  };

  const handleUpdateNoteRow = (
    idx: number,
    patch: Partial<RemissionNoteRow>
  ) => {
    setNoteRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        const totalPackages = Number(next.lar || 0) + Number(next.med || 0) + Number(next.chi || 0);
        const subtotal = Number((totalPackages * Number(next.unitPrice || 0)).toFixed(2));
        return { ...next, totalPackages, subtotal };
      })
    );
  };

  const resetNoteForm = () => {
    setEditingNoteId(undefined);
    setNoteDate(todayIso());
    setNoteLoadId('');
    setNotePosId(salesPoints[0]?.id || '');
    setNoteClientId(salesClients[0]?.id || '');
    setNoteSellerName(currentUser?.fullName || 'David');
    setNoteOwnerName('Harold');
    setNotePayMethod('contado');
    setNotePaidAmount('');
    setNoteNotes('');
    setNoteRows([
      {
        productId: aromaProducts[0]?.id || 'prod-freedom',
        productName: aromaProducts[0]?.name || 'FREEDOM',
        colorNote: '',
        lar: 0,
        med: 0,
        chi: 0,
        totalPackages: 0,
        unitPrice: 0,
        subtotal: 0,
      },
    ]);
  };

  const handleSelectLoadForNote = (selectedLoadId: string) => {
    setNoteLoadId(selectedLoadId);
    const found = truckLoads.find((l) => l.id === selectedLoadId);
    if (found) {
      setNotePosId(found.salesPointId);
      setNoteSellerName(found.driverName);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const pos = salesPoints.find((p) => p.id === notePosId) || salesPoints[0];
    const client = salesClients.find((c) => c.id === noteClientId) || salesClients[0];
    if (!pos || !client) {
      showToast('Selecciona un Punto de Venta y un Cliente.');
      return;
    }
    const validRows = noteRows.filter((r) => r.totalPackages > 0);
    if (validRows.length === 0) {
      showToast('Agrega al menos una variedad con cantidad mayor a 0.');
      return;
    }
    const linkedLoad = truckLoads.find((l) => l.id === noteLoadId);
    setIsSavingNote(true);
    const res = await saveRemissionNote(
      {
        folio:
          editingNoteId
            ? remissionNotes.find((n) => n.id === editingNoteId)?.folio || ''
            : `REM-${new Date().getFullYear()}-${String(remissionNotes.length + 1).padStart(3, '0')}`,
        noteDate,
        loadId: linkedLoad?.id || '',
        loadFolio: linkedLoad?.folio || '',
        salesPointId: pos.id,
        salesPointName: pos.name,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone || '',
        sellerUserId: currentUser?.id || '',
        sellerName: noteSellerName.trim() || currentUser?.fullName || 'Vendedor',
        ownerName: noteOwnerName.trim() || 'Harold',
        rows: validRows,
        totalPackages: noteTotals.totalPackages,
        totalAmount: noteTotals.totalAmount,
        paymentMethod: notePayMethod,
        paymentStatus:
          noteTotals.balanceDue <= 0.01 ? 'pagado' : noteTotals.paid > 0 ? 'parcial' : 'pendiente',
        paidAmount: noteTotals.paid,
        balanceDue: noteTotals.balanceDue,
        deductsInventory: !linkedLoad,
        notes: noteNotes.trim(),
      },
      editingNoteId
    );
    setIsSavingNote(false);
    showToast(
      res.cloudSynced
        ? `Nota de Remisión ${res.entry.folio} guardada en Supabase.`
        : `Nota ${res.entry.folio} guardada localmente.`
    );
    resetNoteForm();
  };

  const buildRemissionWaUrl = (note: RemissionNote) => {
    const phone = sanitizePhoneForWa(note.clientPhone || '');
    const lines = [
      `*AROMA FLOWER — NOTA DE REMISIÓN ${note.folio}*`,
      `Fecha: ${note.noteDate}`,
      `Cliente: *${note.clientName}*`,
      `Punto de Venta: ${note.salesPointName}`,
      `Vendedor: ${note.sellerName}`,
      '',
      '*Detalle de Flor:*',
      ...note.rows.map(
        (r) =>
          `• ${r.productName}${r.colorNote ? ` (${r.colorNote})` : ''}: ${r.totalPackages} paq x ${fmtMoney(r.unitPrice)} = *${fmtMoney(r.subtotal)}*`
      ),
      '',
      `Total Paquetes: ${note.totalPackages}`,
      `Total Nota: *${fmtMoney(note.totalAmount)}*`,
      `Forma de Pago: ${note.paymentMethod.toUpperCase()} (${note.paymentStatus.toUpperCase()})`,
      `Pagado: ${fmtMoney(note.paidAmount)} | Saldo Pendiente: *${fmtMoney(note.balanceDue)}*`,
      '',
      'Gracias por su preferencia — Aroma Flower',
    ];
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  // =========================================================================
  // TAB 3: LIQUIDACIÓN POR CHOFER / VENDEDOR
  // =========================================================================
  const driverNames = useMemo(() => {
    const s = new Set<string>(['David', 'Aaron', 'Harold']);
    truckLoads.forEach((l) => l.driverName && s.add(l.driverName));
    remissionNotes.forEach((n) => n.sellerName && s.add(n.sellerName));
    return Array.from(s);
  }, [truckLoads, remissionNotes]);

  const [liqDriver, setLiqDriver] = useState<string>('David');
  const [liqDateFrom, setLiqDateFrom] = useState<string>('');
  const [liqDateTo, setLiqDateTo] = useState<string>('');

  const liquidationSummary = useMemo<DriverLiquidationSummary>(() => {
    const matchDriver = (name: string) =>
      liqDriver === 'TODOS' || name.trim().toLowerCase() === liqDriver.trim().toLowerCase();
    const matchDate = (dt: string) => {
      if (liqDateFrom && dt < liqDateFrom) return false;
      if (liqDateTo && dt > liqDateTo) return false;
      return true;
    };

    const filteredNotes = remissionNotes.filter(
      (n) => matchDriver(n.sellerName) && matchDate(n.noteDate)
    );
    const filteredLoads = truckLoads.filter(
      (l) => matchDriver(l.driverName) && matchDate(l.loadDate)
    );

    const totalPackagesSold = filteredNotes.reduce((a, n) => a + Number(n.totalPackages || 0), 0);
    const totalSales = filteredNotes.reduce((a, n) => a + Number(n.totalAmount || 0), 0);
    const cashSales = filteredNotes
      .filter((n) => n.paymentMethod === 'contado')
      .reduce((a, n) => a + Number(n.paidAmount || 0), 0);
    const depositSales = filteredNotes
      .filter((n) => n.paymentMethod === 'deposito')
      .reduce((a, n) => a + Number(n.paidAmount || 0), 0);
    const creditCollectedAtDelivery = filteredNotes
      .filter((n) => n.paymentMethod === 'credito')
      .reduce((a, n) => a + Number(n.paidAmount || 0), 0);
    const creditSales = filteredNotes.reduce((a, n) => a + Number(n.balanceDue || 0), 0);
    const tripExpenses = filteredLoads.reduce((a, l) => a + Number(l.totalExpenses || 0), 0);
    const netCashToDeliver = Number((cashSales + creditCollectedAtDelivery - tripExpenses).toFixed(2));

    const dateLabel =
      liqDateFrom && liqDateTo
        ? `${liqDateFrom} al ${liqDateTo}`
        : liqDateFrom
        ? `Desde ${liqDateFrom}`
        : liqDateTo
        ? `Hasta ${liqDateTo}`
        : 'Todo el periodo';

    return {
      driverName: liqDriver,
      dateLabel,
      totalPackagesSold,
      totalSales,
      cashSales,
      depositSales,
      creditSales,
      creditCollectedAtDelivery,
      tripExpenses,
      netCashToDeliver,
      notes: filteredNotes,
      loads: filteredLoads,
    };
  }, [remissionNotes, truckLoads, liqDriver, liqDateFrom, liqDateTo]);

  // =========================================================================
  // TAB 4: CUENTAS POR COBRAR (ESTADO DE CUENTA POR CLIENTE)
  // =========================================================================
  const [selectedClientId, setSelectedClientId] = useState<string>(() => salesClients[0]?.id || '');
  const selectedClient = useMemo(
    () => salesClients.find((c) => c.id === selectedClientId) || salesClients[0],
    [salesClients, selectedClientId]
  );
  const selectedClientNotes = useMemo(
    () =>
      selectedClient
        ? remissionNotes
            .filter((n) => n.clientId === selectedClient.id)
            .sort((a, b) => b.noteDate.localeCompare(a.noteDate))
        : [],
    [remissionNotes, selectedClient]
  );
  const selectedClientPayments = useMemo(
    () =>
      selectedClient
        ? clientPayments
            .filter((p) => p.clientId === selectedClient.id)
            .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        : [],
    [clientPayments, selectedClient]
  );

  const [payDate, setPayDate] = useState(todayIso);
  const [payNoteId, setPayNoteId] = useState('');
  const [payType, setPayType] = useState<'abono' | 'pago_total'>('abono');
  const [payMethod, setPayMethod] = useState<'efectivo' | 'deposito' | 'transferencia'>('efectivo');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const handleRegisterClientPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    const amt = parseDecPos(payAmount);
    if (amt <= 0) {
      showToast('Ingresa un monto mayor a $0 para registrar el pago.');
      return;
    }
    const targetNote = selectedClientNotes.find((n) => n.id === payNoteId);
    const res = await addClientPayment({
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      remissionNoteId: targetNote?.id || '',
      remissionFolio: targetNote?.folio || '',
      paymentDate: payDate,
      paymentType: payType,
      paymentMethod: payMethod,
      amount: amt,
      reference: payRef.trim(),
      notes: payNotes.trim(),
    });
    if (!res.ok) {
      showToast(res.error || 'Error al registrar abono.');
      return;
    }
    setPayAmount('');
    setPayRef('');
    setPayNotes('');
    setPayNoteId('');
    showToast(`Pago de ${fmtMoney(amt)} registrado a cuenta de ${selectedClient.name}.`);
  };

  const buildStatementWaUrl = (client: SalesClient) => {
    const phone = sanitizePhoneForWa(client.phone || '');
    const pendingNotes = remissionNotes.filter((n) => n.clientId === client.id && n.balanceDue > 0);
    const lines = [
      `*AROMA FLOWER — ESTADO DE CUENTA*`,
      `Cliente: *${client.name}*`,
      `Saldo Pendiente Actual: *${fmtMoney(client.balance)}*`,
      '',
      pendingNotes.length > 0 ? '*Notas con saldo pendiente:*' : 'Sin notas pendientes.',
      ...pendingNotes.map(
        (n) => `• ${n.folio} (${n.noteDate}): Total ${fmtMoney(n.totalAmount)} | Pendiente *${fmtMoney(n.balanceDue)}*`
      ),
      '',
      'Agradecemos su pago o abono. ¡Gracias!',
    ];
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  // =========================================================================
  // TAB 5: PUNTOS DE VENTA Y CLIENTES (CRUD)
  // =========================================================================
  const [posForm, setPosForm] = useState({ name: '', city: '', address: '', contactPhone: '', notes: '' });
  const [editingPosId, setEditingPosId] = useState<string | undefined>(undefined);
  const [cliForm, setCliForm] = useState({
    name: '',
    phone: '',
    defaultSalesPointId: salesPoints[0]?.id || '',
    creditLimit: '',
    notes: '',
  });
  const [editingCliId, setEditingCliId] = useState<string | undefined>(undefined);

  const handleSavePosForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveSalesPoint(
      {
        name: posForm.name,
        city: posForm.city,
        address: posForm.address,
        contactPhone: posForm.contactPhone,
        active: true,
        notes: posForm.notes,
      },
      editingPosId
    );
    if (!res.ok) {
      showToast(res.error || 'Error al guardar punto de venta.');
      return;
    }
    setPosForm({ name: '', city: '', address: '', contactPhone: '', notes: '' });
    setEditingPosId(undefined);
    showToast(`Punto de venta "${res.entry?.name}" guardado en Supabase.`);
  };

  const handleSaveCliForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const pos = salesPoints.find((p) => p.id === cliForm.defaultSalesPointId);
    const prevCli = editingCliId ? salesClients.find((c) => c.id === editingCliId) : undefined;
    const res = await saveSalesClient(
      {
        name: cliForm.name,
        phone: cliForm.phone,
        defaultSalesPointId: pos?.id || '',
        defaultSalesPointName: pos?.name || '',
        creditLimit: parseDecPos(cliForm.creditLimit),
        balance: prevCli?.balance ?? 0,
        active: true,
        notes: cliForm.notes,
      },
      editingCliId
    );
    if (!res.ok) {
      showToast(res.error || 'Error al guardar cliente.');
      return;
    }
    setCliForm({ name: '', phone: '', defaultSalesPointId: salesPoints[0]?.id || '', creditLimit: '', notes: '' });
    setEditingCliId(undefined);
    showToast(`Cliente "${res.entry?.name}" guardado en Supabase.`);
  };

  const totalReceivable = useMemo(
    () => salesClients.reduce((a, c) => a + Number(c.balance || 0), 0),
    [salesClients]
  );
  const totalSalesAmountAll = useMemo(
    () => remissionNotes.reduce((a, n) => a + Number(n.totalAmount || 0), 0),
    [remissionNotes]
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 bg-[#5C1125] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#C3A25D]/50 flex items-center gap-2 text-xs sm:text-sm font-semibold max-w-md">
          <CheckCircle2 className="w-4 h-4 text-[#C3A25D] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-linear-to-r from-[#5C1125] via-[#430c1b] to-[#000000] text-white p-5 sm:p-7 rounded-2xl shadow-sm border border-[#C3A25D]/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AromaFlowersLogo size="lg" className="shrink-0" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C3A25D]">
                Operación Comercial • Tablet Chofer / Vendedor &amp; Administración
              </span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5">
                Ventas, Cargas, Remisiones y Cobranza
              </h1>
              <p className="text-xs sm:text-sm text-[#d6be83] mt-0.5">
                Cargas con descuento automático de Inventario General, gastos prorrateados, notas por WhatsApp y cuentas por cobrar.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canAccessModule('pos_caja') && (
              <button
                type="button"
                onClick={() => setActiveView('pos_caja')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C3A25D] hover:bg-[#d6be83] text-[#000000] text-xs sm:text-sm font-black shadow-md transition cursor-pointer whitespace-nowrap"
              >
                <Store className="w-4 h-4" />
                <span>Abrir POS Pantalla Completa</span>
              </button>
            )}
            {supabaseConfig.isConnected && isOnline && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#C3A25D] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Sincronizar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-[#5C1125]">Cargas Registradas</span>
          <p className="mt-1 text-2xl font-black text-[#000000]">{truckLoads.length}</p>
          <span className="text-[10px] text-stone-500">
            {truckLoads.reduce((a, l) => a + l.totalPackages, 0)} paquetes despachados
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-[#535B28]">Ventas (Remisiones)</span>
          <p className="mt-1 text-2xl font-black text-[#535B28]">{fmtMoney(totalSalesAmountAll)}</p>
          <span className="text-[10px] text-stone-500">{remissionNotes.length} notas emitidas</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-amber-700">Cuentas por Cobrar</span>
          <p className="mt-1 text-2xl font-black text-amber-700">{fmtMoney(totalReceivable)}</p>
          <span className="text-[10px] text-stone-500">
            {salesClients.filter((c) => c.balance > 0).length} clientes con saldo
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-stone-600">Puntos / Clientes</span>
          <p className="mt-1 text-2xl font-black text-[#000000]">
            {salesPoints.length} / {salesClients.length}
          </p>
          <span className="text-[10px] text-stone-500">Catálogos activos</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'cargas', label: '1. Cargas y Gastos (Prorrateo)', icon: Truck },
          { id: 'remisiones', label: '2. Notas de Remisión (Tablet)', icon: Receipt },
          { id: 'liquidacion', label: '3. Liquidación Chofer', icon: Calculator },
          { id: 'cobranza', label: '4. Cuentas por Cobrar', icon: Wallet },
          { id: 'catalogos', label: '5. Puntos de Venta y Clientes', icon: MapPin },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                active
                  ? 'bg-[#5C1125] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#C3A25D]' : 'text-[#5C1125]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: CARGAS DE CAMIONETA Y PRORRATEO ================= */}
      {activeTab === 'cargas' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveTruckLoad} className="space-y-5">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-[#000000]">
                    {editingLoadId ? `Editando Carga ${loadFolio}` : 'Nueva Carga de Camioneta (Descuenta de Inventario General)'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Selecciona el punto de venta y chofer; las cantidades capturadas se descuentan automáticamente del Inventario General Único.
                  </p>
                </div>
                {editingLoadId && (
                  <button
                    type="button"
                    onClick={resetLoadForm}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                  >
                    Cancelar Edición
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Fecha</label>
                  <input
                    type="date"
                    value={loadDate}
                    onChange={(e) => setLoadDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Punto de Venta</label>
                  <select
                    value={loadPosId}
                    onChange={(e) => setLoadPosId(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white"
                  >
                    {salesPoints.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Chofer / Vendedor</label>
                  <input
                    type="text"
                    value={loadDriverName}
                    onChange={(e) => setLoadDriverName(e.target.value)}
                    placeholder="Ej. David"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Vehículo</label>
                  <input
                    type="text"
                    value={loadVehicle}
                    onChange={(e) => setLoadVehicle(e.target.value)}
                    placeholder="Camioneta..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Estatus</label>
                  <select
                    value={loadStatus}
                    onChange={(e) => setLoadStatus(e.target.value as 'en_ruta' | 'liquidada')}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold bg-white"
                  >
                    <option value="en_ruta">En Ruta</option>
                    <option value="liquidada">Liquidada</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Varieties & Sizes Load Table */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
                <span className="text-sm font-extrabold text-[#000000]">
                  Carga por Variedad y Tamaño (LAR / MED / CHI)
                </span>
                <span className="text-xs font-bold text-[#5C1125]">
                  Total Carga: <strong className="text-base">{loadTotals.totalPackages}</strong> paq.
                </span>
              </div>
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#5C1125] text-white text-[11px] uppercase">
                      <th className="py-2.5 px-4 font-bold">Variedad</th>
                      <th className="py-2.5 px-2 font-bold text-center bg-[#430c1b]">Stock Disp.</th>
                      <th className="py-2.5 px-2 font-bold text-center w-24">LAR</th>
                      <th className="py-2.5 px-2 font-bold text-center w-24">MED</th>
                      <th className="py-2.5 px-2 font-bold text-center w-24">CHI</th>
                      <th className="py-2.5 px-4 font-bold text-right bg-[#000000] text-[#C3A25D] w-24">CARGA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {loadRows.map((row) => {
                      const st = stockByProductName.get(row.productName.trim().toUpperCase());
                      const avail = st?.total ?? 0;
                      const exceeds = row.total > avail && avail >= 0;
                      return (
                        <tr key={row.productId} className="hover:bg-[#FAF8F5]">
                          <td className="py-2 px-4 font-extrabold text-[#000000]">{row.productName}</td>
                          <td className="py-2 px-2 text-center text-xs font-bold">
                            <span className={exceeds ? 'text-rose-600' : 'text-[#535B28]'}>
                              {avail} {st && row.captureMode !== 'direct_total' ? `(${st.lar}/${st.med}/${st.chi})` : ''}
                            </span>
                          </td>
                          {row.captureMode === 'direct_total' ? (
                            <td colSpan={3} className="py-1.5 px-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={row.total === 0 ? '' : String(row.total)}
                                onChange={(e) => handleLoadCellChange(row.productId, 'direct', e.target.value)}
                                placeholder="0"
                                className="no-spinner w-full max-w-[160px] mx-auto block text-center py-1.5 px-2 border border-stone-300 rounded-lg font-bold"
                              />
                            </td>
                          ) : (
                            <>
                              {(['lar', 'med', 'chi'] as const).map((field) => (
                                <td key={field} className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={row[field] === 0 ? '' : String(row[field])}
                                    onChange={(e) => handleLoadCellChange(row.productId, field, e.target.value)}
                                    placeholder="0"
                                    className="no-spinner w-full text-center py-1.5 px-1 border border-stone-300 rounded-lg font-bold"
                                  />
                                </td>
                              ))}
                            </>
                          )}
                          <td className="py-2 px-4 text-right font-black text-[#5C1125] bg-[#FAF8F5]">
                            {row.total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#000000] text-white font-extrabold text-xs sm:text-sm">
                      <td colSpan={2} className="py-3 px-4 uppercase">TOTAL CARGA CAMIONETA</td>
                      <td className="py-3 px-2 text-center text-[#C3A25D]">{loadTotals.totalLar}</td>
                      <td className="py-3 px-2 text-center text-[#C3A25D]">{loadTotals.totalMed}</td>
                      <td className="py-3 px-2 text-center text-[#C3A25D]">{loadTotals.totalChi}</td>
                      <td className="py-3 px-4 text-right text-base text-[#C3A25D] bg-[#5C1125]">
                        {loadTotals.totalPackages}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Trip Expenses & Automatic Owner Prorating */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#5C1125] uppercase">
                    Gastos de Viaje / Venta
                  </h3>
                  <span className="px-2.5 py-1 rounded-lg bg-[#fbf7eb] text-[#7c5b16] text-xs font-extrabold border border-[#e7d4a5]">
                    Costo / Paquete: {fmtMoney(loadExpenseTotals.costPerPackage)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Casetas ($)', val: expCasetas, set: setExpCasetas },
                    { label: 'Gasolina ($)', val: expGasolina, set: setExpGasolina },
                    { label: 'Pago de Piso ($)', val: expPagoPiso, set: setExpPagoPiso },
                    { label: 'Comida ($)', val: expComida, set: setExpComida },
                    { label: 'Gastos Extra ($)', val: expExtra, set: setExpExtra },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">{f.label}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={f.val}
                        onChange={(e) => f.set(e.target.value)}
                        placeholder="0.00"
                        className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Total Gastos</label>
                    <div className="px-3 py-2 rounded-xl bg-[#000000] text-[#C3A25D] font-black text-sm">
                      {fmtMoney(loadExpenseTotals.totalExpenses)}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Detalle de Gastos Extra / Observaciones
                  </label>
                  <input
                    type="text"
                    value={expExtraNotes}
                    onChange={(e) => setExpExtraNotes(e.target.value)}
                    placeholder="Ej. Hielo, reparación llanta, propinas..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#535B28] uppercase">
                      Prorrateo Automático por Dueño de Mercancía
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Descuenta gastos proporcionalmente según los paquetes de cada dueño (ej. Harold y David).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setOwnerSharesDraft((prev) => [
                        ...prev,
                        { ownerName: '', packages: '', grossSales: '' },
                      ])
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#f7f8f2] text-[#535B28] border border-[#dce4bf] text-[11px] font-bold cursor-pointer"
                  >
                    + Dueño
                  </button>
                </div>

                <div className="space-y-2">
                  {ownerSharesDraft.map((o, idx) => {
                    const calc = loadExpenseTotals.computedOwners[idx];
                    return (
                      <div key={idx} className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-stone-500">Dueño</label>
                            <input
                              type="text"
                              value={o.ownerName}
                              onChange={(e) =>
                                setOwnerSharesDraft((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, ownerName: e.target.value } : item))
                                )
                              }
                              placeholder="Harold / David"
                              className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-stone-500">Paquetes</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={o.packages}
                              onChange={(e) =>
                                setOwnerSharesDraft((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, packages: e.target.value } : item))
                                )
                              }
                              placeholder="0"
                              className="no-spinner w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-stone-500">Venta Bruta ($)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={o.grossSales}
                              onChange={(e) =>
                                setOwnerSharesDraft((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, grossSales: e.target.value } : item))
                                )
                              }
                              placeholder="0.00"
                              className="no-spinner w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold bg-white"
                            />
                          </div>
                        </div>
                        {calc && (
                          <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 border-t border-stone-200">
                            <span className="text-amber-700 font-bold">
                              Gasto descontado: -{fmtMoney(calc.expenseShare)}
                            </span>
                            <span className="text-[#535B28] font-extrabold">
                              Pago Neto {calc.ownerName}: {fmtMoney(calc.netPayout)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingLoad}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-[#C3A25D]" />
                    <span>{isSavingLoad ? 'Guardando...' : editingLoadId ? 'Actualizar Carga' : 'Guardar Carga y Descontar Inventario'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Saved Truck Loads List */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-stone-200">
              <h3 className="text-sm font-extrabold text-[#000000]">
                Historial de Cargas de Camioneta y Reportes para Chofer ({truckLoads.length})
              </h3>
            </div>
            {truckLoads.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500">Sin cargas registradas aún.</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {truckLoads.map((load) => (
                  <div key={load.id} className="p-4 space-y-3 hover:bg-[#FAF8F5]/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-sm text-[#5C1125]">{load.folio}</span>
                          <span className="px-2 py-0.5 rounded bg-[#535B28]/15 text-[#535B28] text-[11px] font-bold">
                            {load.salesPointName}
                          </span>
                          <span className="text-xs font-bold text-stone-700">Chofer: {load.driverName}</span>
                          <span className="text-xs text-stone-500">{load.loadDate}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              load.status === 'liquidada'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {load.status}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 mt-1">
                          Total Carga: <strong>{load.totalPackages} paq.</strong> (LAR: {load.totalLar}, MED: {load.totalMed}, CHI: {load.totalChi}) &bull; Gastos: <strong>{fmtMoney(load.totalExpenses)}</strong> ({fmtMoney(load.costPerPackage)}/paq.)
                        </p>
                        {load.ownerShares && load.ownerShares.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {load.ownerShares.map((o) => (
                              <span
                                key={o.ownerName}
                                className="px-2.5 py-1 rounded-lg bg-[#fbf7eb] border border-[#e7d4a5] text-[11px] font-bold text-[#7c5b16]"
                              >
                                {o.ownerName}: {o.packages} paq • Gasto -{fmtMoney(o.expenseShare)} • Neto {fmtMoney(o.netPayout)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => exportTruckLoadReportPdf(load)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold hover:bg-[#430c1b] cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                          <span>Reporte Carga PDF</span>
                        </button>
                        <a
                          href={buildLoadWaUrl(load)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:bg-[#1fb658]"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => loadExistingTruckLoad(load)}
                          className="p-1.5 rounded-lg bg-[#FAF8F5] border border-stone-200 text-[#5C1125] hover:bg-stone-100 cursor-pointer"
                          title="Editar carga"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {confirmDeleteLoadId === load.id ? (
                          <div className="flex items-center gap-1 text-[11px] bg-rose-50 px-2 py-1 rounded border border-rose-200">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteTruckLoad(load.id);
                                setConfirmDeleteLoadId(null);
                                showToast('Carga eliminada e inventario restaurado.');
                              }}
                              className="font-bold text-rose-700 cursor-pointer"
                            >
                              Borrar
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteLoadId(null)}
                              className="text-stone-500 cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteLoadId(load.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                            title="Eliminar carga"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: NOTAS DE REMISIÓN (MODO TABLET) ================= */}
      {activeTab === 'remisiones' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveNote} className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-[#000000]">
                  Generar Nota de Remisión (Precios Variables por Cliente / Punto de Venta)
                </h2>
                <p className="text-xs text-stone-500">
                  Ideal para tablet en punto de venta. Descarga el ticket en PDF y envíalo al cliente por WhatsApp en un clic.
                </p>
              </div>
              {editingNoteId && (
                <button
                  type="button"
                  onClick={resetNoteForm}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-bold cursor-pointer"
                >
                  Nueva Nota
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Fecha</label>
                <input
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">
                  Carga de Camioneta (Opcional)
                </label>
                <select
                  value={noteLoadId}
                  onChange={(e) => handleSelectLoadForNote(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold bg-white"
                >
                  <option value="">Venta Directa (Descuenta Inventario)</option>
                  {truckLoads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.folio} — {l.driverName} ({l.salesPointName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Punto de Venta</label>
                <select
                  value={notePosId}
                  onChange={(e) => setNotePosId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold bg-white"
                >
                  {salesPoints.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Cliente</label>
                <select
                  value={noteClientId}
                  onChange={(e) => setNoteClientId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold bg-white"
                >
                  {salesClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.balance > 0 ? `(Saldo: ${fmtMoney(c.balance)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Vendedor / Chofer</label>
                <input
                  type="text"
                  value={noteSellerName}
                  onChange={(e) => setNoteSellerName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Dueño de Mercancía</label>
                <input
                  type="text"
                  value={noteOwnerName}
                  onChange={(e) => setNoteOwnerName(e.target.value)}
                  placeholder="Harold / David"
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Forma de Pago</label>
                <select
                  value={notePayMethod}
                  onChange={(e) => {
                    const val = e.target.value as RemissionPaymentMethod;
                    setNotePayMethod(val);
                    if (val === 'credito') setNotePaidAmount('0');
                    else setNotePaidAmount('');
                  }}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold bg-white"
                >
                  <option value="contado">Contado (Efectivo)</option>
                  <option value="credito">Crédito (Cuenta por Cobrar)</option>
                  <option value="deposito">Depósito / Transferencia</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">
                  Monto Recibido / Abono ($)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={notePaidAmount}
                  onChange={(e) => setNotePaidAmount(e.target.value)}
                  placeholder={notePayMethod === 'credito' ? '0.00 (todo a crédito)' : String(noteTotals.totalAmount)}
                  className="no-spinner w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold"
                />
              </div>
            </div>

            {/* Dynamic Rows with Free Variable Price */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-[#5C1125]">
                  Variedades, Tamaños y Precio Unitario Libre
                </span>
                <button
                  type="button"
                  onClick={handleAddNoteRow}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#535B28] text-white text-xs font-bold cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#C3A25D]" />
                  <span>Agregar Variedad</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#5C1125] text-white text-[11px] uppercase">
                      <th className="py-2.5 px-3">Variedad</th>
                      <th className="py-2.5 px-2">Color / Nota</th>
                      <th className="py-2.5 px-2 text-center w-16">LAR</th>
                      <th className="py-2.5 px-2 text-center w-16">MED</th>
                      <th className="py-2.5 px-2 text-center w-16">CHI</th>
                      <th className="py-2.5 px-2 text-center w-16">Paq.</th>
                      <th className="py-2.5 px-2 text-center w-28">Precio Libre ($)</th>
                      <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {noteRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={row.productName}
                            onChange={(e) => {
                              const found = aromaProducts.find((p) => p.name === e.target.value);
                              handleUpdateNoteRow(idx, {
                                productId: found?.id || row.productId,
                                productName: e.target.value,
                              });
                            }}
                            className="w-full px-2 py-2 border border-stone-300 rounded-lg font-bold bg-white text-xs"
                          >
                            {aromaProducts.map((p) => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.colorNote || ''}
                            onChange={(e) => handleUpdateNoteRow(idx, { colorNote: e.target.value })}
                            placeholder="Roja / Bca..."
                            className="w-full px-2 py-2 border border-stone-300 rounded-lg text-xs"
                          />
                        </td>
                        {(['lar', 'med', 'chi'] as const).map((field) => (
                          <td key={field} className="p-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row[field] === 0 ? '' : String(row[field])}
                              onChange={(e) =>
                                handleUpdateNoteRow(idx, { [field]: parseIntPos(e.target.value) })
                              }
                              placeholder="0"
                              className="no-spinner w-full text-center py-2 border border-stone-300 rounded-lg font-bold text-xs"
                            />
                          </td>
                        ))}
                        <td className="p-2 text-center font-black text-[#5C1125]">{row.totalPackages}</td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.unitPrice === 0 ? '' : String(row.unitPrice)}
                            onChange={(e) =>
                              handleUpdateNoteRow(idx, { unitPrice: parseDecPos(e.target.value) })
                            }
                            placeholder="0.00"
                            className="no-spinner w-full text-right px-2 py-2 border border-[#C3A25D] bg-[#fcfaf4] rounded-lg font-extrabold text-xs"
                          />
                        </td>
                        <td className="p-2 text-right font-black text-[#000000]">
                          {fmtMoney(row.subtotal)}
                        </td>
                        <td className="p-1.5 text-center">
                          {noteRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setNoteRows((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-stone-200">
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                <span>Paquetes: <strong className="text-[#5C1125]">{noteTotals.totalPackages}</strong></span>
                <span>Total Nota: <strong className="text-lg text-[#000000]">{fmtMoney(noteTotals.totalAmount)}</strong></span>
                <span>Pagado: <strong className="text-[#535B28]">{fmtMoney(noteTotals.paid)}</strong></span>
                <span>Saldo Crédito: <strong className="text-amber-700">{fmtMoney(noteTotals.balanceDue)}</strong></span>
              </div>
              <button
                type="submit"
                disabled={isSavingNote}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#5C1125] hover:bg-[#430c1b] text-white text-sm font-bold shadow-md cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#C3A25D]" />
                <span>{isSavingNote ? 'Guardando...' : 'Guardar y Sincronizar Nota'}</span>
              </button>
            </div>
          </form>

          {/* Saved Remission Notes List */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-stone-200">
              <h3 className="text-sm font-extrabold text-[#000000]">
                Notas de Remisión Emitidas ({remissionNotes.length})
              </h3>
            </div>
            <div className="divide-y divide-stone-100">
              {remissionNotes.map((note) => (
                <div key={note.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#FAF8F5]/60">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm text-[#5C1125]">{note.folio}</span>
                      <span className="font-extrabold text-sm text-[#000000]">{note.clientName}</span>
                      <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-[11px] font-bold">
                        {note.salesPointName}
                      </span>
                      <span className="text-xs text-stone-500">{note.noteDate}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          note.paymentStatus === 'pagado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : note.paymentStatus === 'parcial'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {note.paymentMethod} • {note.paymentStatus}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-1">
                      Vendedor: <strong>{note.sellerName}</strong> • {note.totalPackages} paq. • Total:{' '}
                      <strong className="text-[#000000]">{fmtMoney(note.totalAmount)}</strong> • Pagado:{' '}
                      <strong className="text-[#535B28]">{fmtMoney(note.paidAmount)}</strong>
                      {note.balanceDue > 0 && (
                        <>
                          {' '}• Pendiente: <strong className="text-rose-700">{fmtMoney(note.balanceDue)}</strong>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => exportRemissionNotePdf(note)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold hover:bg-[#430c1b] cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                      <span>Ticket / Nota PDF</span>
                    </button>
                    <a
                      href={buildRemissionWaUrl(note)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:bg-[#1fb658]"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Cliente</span>
                    </a>
                    {confirmDeleteNoteId === note.id ? (
                      <div className="flex items-center gap-1 text-[11px] bg-rose-50 px-2 py-1 rounded border border-rose-200">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteRemissionNote(note.id);
                            setConfirmDeleteNoteId(null);
                            showToast('Nota eliminada y saldo actualizado.');
                          }}
                          className="font-bold text-rose-700 cursor-pointer"
                        >
                          Borrar
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteNoteId(null)}
                          className="text-stone-500 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteNoteId(note.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: LIQUIDACIÓN POR CHOFER / VENDEDOR ================= */}
      {activeTab === 'liquidacion' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[#000000]">
                  Reporte de Liquidación de Venta por Chofer / Vendedor
                </h2>
                <p className="text-xs text-stone-500">
                  Muestra exactamente cuánto vendió, cuánto fue crédito o depósito, sus gastos de viaje y cuánto efectivo neto debe entregar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportDriverLiquidationExcel(liquidationSummary)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#535B28] text-white text-xs font-bold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                  <span>Excel Liquidación</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportDriverLiquidationPdf(liquidationSummary)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                  <span>PDF Liquidación</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Chofer / Vendedor</label>
                <select
                  value={liqDriver}
                  onChange={(e) => setLiqDriver(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-bold bg-white"
                >
                  <option value="TODOS">Todos los vendedores</option>
                  {driverNames.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Desde</label>
                <input
                  type="date"
                  value={liqDateFrom}
                  onChange={(e) => setLiqDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#535B28] mb-1">Hasta</label>
                <input
                  type="date"
                  value={liqDateTo}
                  onChange={(e) => setLiqDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-bold"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setLiqDateFrom('');
                    setLiqDateTo('');
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold text-stone-700 cursor-pointer"
                >
                  Limpiar Fechas
                </button>
              </div>
            </div>
          </div>

          {/* Liquidation KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <span className="text-[10px] font-bold uppercase text-stone-500">Venta Total Bruta</span>
              <p className="text-xl font-black text-[#000000] mt-1">{fmtMoney(liquidationSummary.totalSales)}</p>
              <span className="text-[10px] text-stone-500">{liquidationSummary.totalPackagesSold} paq. vendidos</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <span className="text-[10px] font-bold uppercase text-[#535B28]">Efectivo Cobrado</span>
              <p className="text-xl font-black text-[#535B28] mt-1">
                {fmtMoney(liquidationSummary.cashSales + liquidationSummary.creditCollectedAtDelivery)}
              </p>
              <span className="text-[10px] text-stone-500">Contado + abonos entrega</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <span className="text-[10px] font-bold uppercase text-blue-700">Depósito / Crédito</span>
              <p className="text-xl font-black text-blue-700 mt-1">
                {fmtMoney(liquidationSummary.depositSales + liquidationSummary.creditSales)}
              </p>
              <span className="text-[10px] text-stone-500">
                Dep: {fmtMoney(liquidationSummary.depositSales)} | Créd: {fmtMoney(liquidationSummary.creditSales)}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <span className="text-[10px] font-bold uppercase text-amber-700">(-) Gastos de Viaje</span>
              <p className="text-xl font-black text-amber-700 mt-1">
                -{fmtMoney(liquidationSummary.tripExpenses)}
              </p>
              <span className="text-[10px] text-stone-500">{liquidationSummary.loads.length} cargas</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#5C1125] text-white border border-[#C3A25D]/40 col-span-2 lg:col-span-1">
              <span className="text-[10px] font-bold uppercase text-[#C3A25D]">Efectivo a Entregar</span>
              <p className="text-2xl font-black text-white mt-1">
                {fmtMoney(liquidationSummary.netCashToDeliver)}
              </p>
              <span className="text-[10px] text-[#e7d4a5]">Neto en mano</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-stone-200">
              <h3 className="text-sm font-extrabold text-[#000000]">
                Notas Incluidas en esta Liquidación ({liquidationSummary.notes.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#5C1125] text-white text-[11px] uppercase">
                    <th className="py-2.5 px-4">Folio</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Punto Venta</th>
                    <th className="py-2.5 px-3 text-center">Paq.</th>
                    <th className="py-2.5 px-3">Pago</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Cobrado</th>
                    <th className="py-2.5 px-4 text-right">Saldo Créd.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {liquidationSummary.notes.map((n) => (
                    <tr key={n.id} className="hover:bg-[#FAF8F5]">
                      <td className="py-2.5 px-4 font-bold text-[#5C1125]">{n.folio}</td>
                      <td className="py-2.5 px-3">{n.noteDate}</td>
                      <td className="py-2.5 px-3 font-bold">{n.clientName}</td>
                      <td className="py-2.5 px-3">{n.salesPointName}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{n.totalPackages}</td>
                      <td className="py-2.5 px-3 uppercase text-xs font-bold">{n.paymentMethod}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{fmtMoney(n.totalAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#535B28]">{fmtMoney(n.paidAmount)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-700">{fmtMoney(n.balanceDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: CUENTAS POR COBRAR (ESTADO DE CUENTA) ================= */}
      {activeTab === 'cobranza' && (
        <div className="space-y-5">
          {/* Client Cards Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {salesClients.map((cli) => {
              const selected = selectedClient?.id === cli.id;
              return (
                <button
                  key={cli.id}
                  type="button"
                  onClick={() => setSelectedClientId(cli.id)}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    selected
                      ? 'bg-[#5C1125] text-white border-[#5C1125] shadow-md'
                      : 'bg-white text-stone-800 border-stone-200 hover:border-[#C3A25D]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm truncate">{cli.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cli.balance > 0
                          ? selected
                            ? 'bg-[#C3A25D] text-[#000000]'
                            : 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {cli.balance > 0 ? 'Con Saldo' : 'Al Corriente'}
                    </span>
                  </div>
                  <p className={`text-xl font-black mt-2 ${selected ? 'text-[#C3A25D]' : 'text-[#5C1125]'}`}>
                    {fmtMoney(cli.balance)}
                  </p>
                  <p className={`text-[11px] mt-0.5 truncate ${selected ? 'text-white/75' : 'text-stone-500'}`}>
                    {cli.defaultSalesPointName || 'Sin punto fijo'} {cli.phone ? `• ${cli.phone}` : ''}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedClient && (
            <div className="space-y-5">
              {/* Statement Header & Register Payment Form */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-[#000000]">
                        Estado de Cuenta — {selectedClient.name}
                      </h2>
                      <p className="text-xs text-stone-500">
                        Límite crédito: {fmtMoney(selectedClient.creditLimit)} • Saldo actual:{' '}
                        <strong className="text-rose-700">{fmtMoney(selectedClient.balance)}</strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          exportClientStatementExcel(
                            selectedClient,
                            selectedClientNotes,
                            selectedClientPayments
                          )
                        }
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#535B28] text-white text-xs font-bold cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#C3A25D]" />
                        <span>Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          exportClientStatementPdf(
                            selectedClient,
                            selectedClientNotes,
                            selectedClientPayments
                          )
                        }
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#C3A25D]" />
                        <span>PDF</span>
                      </button>
                      <a
                        href={buildStatementWaUrl(selectedClient)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>

                  {/* Client Notes Table */}
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#5C1125] text-white uppercase">
                          <th className="py-2 px-3">Folio</th>
                          <th className="py-2 px-2">Fecha</th>
                          <th className="py-2 px-2">Método</th>
                          <th className="py-2 px-2 text-right">Total</th>
                          <th className="py-2 px-2 text-right">Pagado</th>
                          <th className="py-2 px-3 text-right">Pendiente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {selectedClientNotes.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-5 text-center text-stone-500">
                              Sin notas de remisión registradas para este cliente.
                            </td>
                          </tr>
                        ) : (
                          selectedClientNotes.map((n) => (
                            <tr key={n.id}>
                              <td className="py-2 px-3 font-bold text-[#5C1125]">{n.folio}</td>
                              <td className="py-2 px-2">{n.noteDate}</td>
                              <td className="py-2 px-2 uppercase">{n.paymentMethod}</td>
                              <td className="py-2 px-2 text-right font-bold">{fmtMoney(n.totalAmount)}</td>
                              <td className="py-2 px-2 text-right text-[#535B28] font-bold">{fmtMoney(n.paidAmount)}</td>
                              <td className="py-2 px-3 text-right text-rose-700 font-black">{fmtMoney(n.balanceDue)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Register Payment / Abono Form */}
                <form
                  onSubmit={handleRegisterClientPayment}
                  className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3"
                >
                  <h3 className="text-sm font-extrabold text-[#535B28] uppercase">
                    Registrar Abono o Pago Total
                  </h3>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Fecha de Pago</label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Aplicar a Nota (Opcional)</label>
                    <select
                      value={payNoteId}
                      onChange={(e) => setPayNoteId(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white"
                    >
                      <option value="">Abono a saldo general</option>
                      {selectedClientNotes
                        .filter((n) => n.balanceDue > 0)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.folio} — Pendiente: {fmtMoney(n.balanceDue)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">Tipo</label>
                      <select
                        value={payType}
                        onChange={(e) => {
                          const t = e.target.value as 'abono' | 'pago_total';
                          setPayType(t);
                          if (t === 'pago_total') {
                            const note = selectedClientNotes.find((n) => n.id === payNoteId);
                            setPayAmount(String(note ? note.balanceDue : selectedClient.balance));
                          }
                        }}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white"
                      >
                        <option value="abono">Abono a Cuenta</option>
                        <option value="pago_total">Pago Total</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">Método</label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as any)}
                        className="w-full px-2.5 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white"
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="deposito">Depósito</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Monto ($ MXN)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="no-spinner w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-black text-[#5C1125]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Referencia / Folio</label>
                    <input
                      type="text"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="Ej. SPEI 88412 / Efectivo David"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold cursor-pointer"
                  >
                    Registrar Pago y Actualizar Saldo
                  </button>
                </form>
              </div>

              {/* Payment History */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-stone-200">
                  <h3 className="text-sm font-extrabold text-[#000000]">
                    Historial de Abonos y Pagos — {selectedClient.name} ({selectedClientPayments.length})
                  </h3>
                </div>
                <div className="divide-y divide-stone-100">
                  {selectedClientPayments.length === 0 ? (
                    <div className="p-6 text-center text-xs text-stone-500">Sin abonos registrados aún.</div>
                  ) : (
                    selectedClientPayments.map((p) => (
                      <div key={p.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-extrabold text-[#535B28]">{fmtMoney(p.amount)}</span>{' '}
                          <span className="uppercase font-bold text-stone-600">
                            ({p.paymentType === 'pago_total' ? 'Pago Total' : 'Abono'} • {p.paymentMethod})
                          </span>{' '}
                          <span className="text-stone-500">
                            • {p.paymentDate} {p.remissionFolio ? `• Nota ${p.remissionFolio}` : ''} {p.reference ? `• Ref: ${p.reference}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-stone-700">Saldo después: {fmtMoney(p.balanceAfter)}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteClientPayment(p.id);
                              showToast('Abono eliminado y saldo recalculado.');
                            }}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            title="Eliminar abono"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: PUNTOS DE VENTA Y CLIENTES ================= */}
      {activeTab === 'catalogos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Puntos de Venta */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
            <h2 className="text-base font-extrabold text-[#5C1125]">Puntos de Venta</h2>
            <form onSubmit={handleSavePosForm} className="space-y-3 bg-[#FAF8F5] p-4 rounded-xl border border-stone-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={posForm.name}
                  onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                  placeholder="Nombre (ej. Central de Abastos CDMX)"
                  className="px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white"
                />
                <input
                  type="text"
                  value={posForm.city}
                  onChange={(e) => setPosForm({ ...posForm, city: e.target.value })}
                  placeholder="Ciudad / Estado (ej. Puebla)"
                  className="px-3 py-2 border border-stone-300 rounded-xl text-xs bg-white"
                />
                <input
                  type="text"
                  value={posForm.address}
                  onChange={(e) => setPosForm({ ...posForm, address: e.target.value })}
                  placeholder="Dirección / Nave / Pasillo"
                  className="px-3 py-2 border border-stone-300 rounded-xl text-xs bg-white sm:col-span-2"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#5C1125] text-white text-xs font-bold cursor-pointer"
              >
                {editingPosId ? 'Actualizar Punto de Venta' : '+ Agregar Punto de Venta'}
              </button>
            </form>

            <div className="divide-y divide-stone-100">
              {salesPoints.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-[#000000]">{p.name}</p>
                    <p className="text-xs text-stone-500">
                      {p.city} {p.address ? `• ${p.address}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPosId(p.id);
                        setPosForm({
                          name: p.name,
                          city: p.city || '',
                          address: p.address || '',
                          contactPhone: p.contactPhone || '',
                          notes: p.notes || '',
                        });
                      }}
                      className="p-1.5 text-[#5C1125] hover:bg-stone-100 rounded cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteSalesPoint(p.id);
                        showToast('Punto de venta eliminado.');
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clientes */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
            <h2 className="text-base font-extrabold text-[#535B28]">Clientes Comerciales</h2>
            <form onSubmit={handleSaveCliForm} className="space-y-3 bg-[#FAF8F5] p-4 rounded-xl border border-stone-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={cliForm.name}
                  onChange={(e) => setCliForm({ ...cliForm, name: e.target.value })}
                  placeholder="Nombre del Cliente (ej. Chema)"
                  className="px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white"
                />
                <input
                  type="text"
                  value={cliForm.phone}
                  onChange={(e) => setCliForm({ ...cliForm, phone: e.target.value })}
                  placeholder="WhatsApp (10 dígitos)"
                  className="px-3 py-2 border border-stone-300 rounded-xl text-xs bg-white"
                />
                <select
                  value={cliForm.defaultSalesPointId}
                  onChange={(e) => setCliForm({ ...cliForm, defaultSalesPointId: e.target.value })}
                  className="px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white"
                >
                  <option value="">Punto de Venta habitual...</option>
                  {salesPoints.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cliForm.creditLimit}
                  onChange={(e) => setCliForm({ ...cliForm, creditLimit: e.target.value })}
                  placeholder="Límite Crédito ($)"
                  className="no-spinner px-3 py-2 border border-stone-300 rounded-xl text-xs bg-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#535B28] text-white text-xs font-bold cursor-pointer"
              >
                {editingCliId ? 'Actualizar Cliente' : '+ Agregar Cliente'}
              </button>
            </form>

            <div className="divide-y divide-stone-100">
              {salesClients.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-[#000000]">
                      {c.name}{' '}
                      {c.balance > 0 && (
                        <span className="text-xs text-amber-700 font-bold">
                          (Saldo: {fmtMoney(c.balance)})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-stone-500">
                      {c.defaultSalesPointName || 'General'} {c.phone ? `• WA: ${c.phone}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCliId(c.id);
                        setCliForm({
                          name: c.name,
                          phone: c.phone || '',
                          defaultSalesPointId: c.defaultSalesPointId || '',
                          creditLimit: String(c.creditLimit || ''),
                          notes: c.notes || '',
                        });
                      }}
                      className="p-1.5 text-[#5C1125] hover:bg-stone-100 rounded cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteSalesClient(c.id);
                        showToast('Cliente eliminado.');
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
