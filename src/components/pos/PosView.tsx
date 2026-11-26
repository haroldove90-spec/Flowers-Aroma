import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Printer,
  Copy,
  CheckCircle2,
  Banknote,
  CreditCard,
  Clock,
  MapPin,
  LogOut,
  Camera,
  SlidersHorizontal,
  GripVertical,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Store,
  RotateCcw,
  AlertCircle,
  ShoppingBag,
  BarChart3,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import {
  AromaProduct,
  RemissionNote,
  RemissionNoteRow,
  RemissionPaymentMethod,
} from '../../types/greenhouse';
import {
  getPosProductMeta,
  compressProductImage,
} from '../../data/posProductImages';
import { AromaFlowersLogo } from '../common/AromaFlowersLogo';

type PosCaliber = 'lar' | 'med' | 'chi' | 'direct';
type PosColorFilter = 'all' | 'rojas' | 'blancas' | 'rosas' | 'especiales' | 'combinados';

interface PosCartItem {
  key: string; // `${productId}__${caliber}`
  productId: string;
  productName: string;
  caliber: PosCaliber;
  quantity: number;
  unitPrice: number;
  imageSrc: string;
  captureMode: AromaProduct['captureMode'];
}

interface LastSaleReceipt {
  note: RemissionNote;
  cashReceived: number;
  changeDue: number;
  createdTimeLabel: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CALIBER_LABELS: Record<PosCaliber, { short: string; full: string }> = {
  lar: { short: 'LAR', full: 'Largo' },
  med: { short: 'MED', full: 'Mediano' },
  chi: { short: 'CHI', full: 'Chico' },
  direct: { short: 'ÚNICO', full: 'Directo' },
};

const QUICK_BILLS = [50, 100, 200, 500, 1000];

export const PosView: React.FC = () => {
  const {
    currentUser,
    aromaProducts,
    saveAromaProduct,
    generalInventory,
    salesPoints,
    salesClients,
    remissionNotes,
    saveRemissionNote,
    setActiveView,
    hasFullAccess,
    canAccessModule,
    logout,
  } = useGreenhouse();

  const isFullAdmin = hasFullAccess(currentUser);

  // Determine whether user can return to a dashboard or is POS-only
  const returnViewId = useMemo(() => {
    if (isFullAdmin) return 'admin_panel';
    if (canAccessModule('ventas_operacion')) return 'ventas_operacion';
    if (canAccessModule('resumen_ventas')) return 'resumen_ventas';
    if (canAccessModule('produccion_dia')) return 'produccion_dia';
    if (canAccessModule('mi_perfil')) return 'mi_perfil';
    return null;
  }, [isFullAdmin, canAccessModule]);

  // Active filters & catalog state
  const [activeCaliber, setActiveCaliber] = useState<'lar' | 'med' | 'chi'>('lar');
  const [colorFilter, setColorFilter] = useState<PosColorFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSalesPointId, setSelectedSalesPointId] = useState<string>(
    () => salesPoints[0]?.id || ''
  );
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);

  // Ticket / Cart state
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [customClientName, setCustomClientName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<RemissionPaymentMethod>('contado');
  const [cashInput, setCashInput] = useState<string>('');
  const [autoPrint80mm, setAutoPrint80mm] = useState<boolean>(true);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'catalog' | 'ticket'>('catalog');

  // Options & Admin Editor Modal state
  const [optionsProduct, setOptionsProduct] = useState<AromaProduct | null>(null);
  const [optCaliber, setOptCaliber] = useState<PosCaliber>('lar');
  const [optQty, setOptQty] = useState<number>(1);
  const [optUnitPrice, setOptUnitPrice] = useState<string>('180');
  const [optTab, setOptTab] = useState<'sell' | 'edit'>('sell');
  const [editPriceLar, setEditPriceLar] = useState<string>('');
  const [editPriceMed, setEditPriceMed] = useState<string>('');
  const [editPriceChi, setEditPriceChi] = useState<string>('');
  const [editImageData, setEditImageData] = useState<string>('');
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Post-sale & Corte de Caja modals
  const [lastSale, setLastSale] = useState<LastSaleReceipt | null>(null);
  const [copiedWa, setCopiedWa] = useState(false);
  const [showCorteModal, setShowCorteModal] = useState(false);
  const [corteDate, setCorteDate] = useState<string>(todayIso());

  // Print mode state (rendered in hidden-on-screen 80mm thermal receipt DOM)
  const [printMode, setPrintMode] = useState<'none' | 'ticket' | 'corte'>('none');
  const [printReceiptData, setPrintReceiptData] = useState<LastSaleReceipt | null>(null);

  const showToast = (msg: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync default sales point if loaded asynchronously
  useEffect(() => {
    if (!selectedSalesPointId && salesPoints.length > 0) {
      setSelectedSalesPointId(salesPoints[0].id);
    }
  }, [salesPoints, selectedSalesPointId]);

  const activeProducts = useMemo(
    () =>
      [...aromaProducts]
        .filter((p) => p.active !== false)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [aromaProducts]
  );

  // Live stock lookup from generalInventory
  const stockByProductId = useMemo(() => {
    const map = new Map<string, { lar: number; med: number; chi: number; total: number }>();
    generalInventory.forEach((inv) => {
      map.set(inv.productId, {
        lar: Number(inv.availableLar || 0),
        med: Number(inv.availableMed || 0),
        chi: Number(inv.availableChi || 0),
        total: Number(inv.availableTotal || 0),
      });
    });
    return map;
  }, [generalInventory]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeProducts.filter((prod) => {
      const meta = getPosProductMeta(prod);
      if (colorFilter !== 'all' && meta.categoryTag !== colorFilter) {
        return false;
      }
      if (q) {
        const hay = `${prod.name} ${meta.colorLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeProducts, colorFilter, searchQuery]);

  // Cart quantities per product for subtle indicator
  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
    });
    return map;
  }, [cart]);

  // Ticket totals
  const ticketTotal = useMemo(
    () =>
      Number(
        cart
          .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
          .toFixed(2)
      ),
    [cart]
  );
  const ticketTotalPackages = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cashReceivedNum = useMemo(() => {
    const parsed = parseFloat(cashInput);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [cashInput]);

  const changeDue = useMemo(
    () => Number((cashReceivedNum - ticketTotal).toFixed(2)),
    [cashReceivedNum, ticketTotal]
  );

  // Today's sales notes for Corte de Caja badge & modal
  const corteNotes = useMemo(() => {
    return remissionNotes
      .filter((n) => n.noteDate === corteDate)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [remissionNotes, corteDate]);

  const todayNotesCount = useMemo(() => {
    const today = todayIso();
    return remissionNotes.filter((n) => n.noteDate === today).length;
  }, [remissionNotes]);

  const corteSummary = useMemo(() => {
    let totalAmount = 0;
    let cashAmount = 0;
    let cardAmount = 0;
    let creditAmount = 0;
    let totalPackages = 0;
    corteNotes.forEach((n) => {
      const amt = Number(n.totalAmount || 0);
      totalAmount += amt;
      totalPackages += Number(n.totalPackages || 0);
      if (n.paymentMethod === 'contado') cashAmount += amt;
      else if (n.paymentMethod === 'deposito') cardAmount += amt;
      else creditAmount += amt;
    });
    return {
      totalAmount,
      cashAmount,
      cardAmount,
      creditAmount,
      totalPackages,
      ticketCount: corteNotes.length,
    };
  }, [corteNotes]);

  // Price helper for a product + caliber
  const getPriceForProduct = (prod: AromaProduct, cal: PosCaliber): number => {
    const meta = getPosProductMeta(prod);
    if (prod.captureMode === 'direct_total' || cal === 'direct') return meta.priceLar;
    if (cal === 'lar') return meta.priceLar;
    if (cal === 'med') return meta.priceMed;
    return meta.priceChi;
  };

  // Add item to cart
  const addToCart = (
    prod: AromaProduct,
    cal: PosCaliber,
    qty = 1,
    overridePrice?: number
  ) => {
    const effectiveCal: PosCaliber =
      prod.captureMode === 'direct_total' ? 'direct' : cal;
    const meta = getPosProductMeta(prod);
    const unitPrice =
      overridePrice !== undefined && Number.isFinite(overridePrice) && overridePrice >= 0
        ? overridePrice
        : getPriceForProduct(prod, effectiveCal);
    const key = `${prod.id}__${effectiveCal}`;

    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key
            ? {
                ...i,
                quantity: i.quantity + qty,
                unitPrice: overridePrice !== undefined ? unitPrice : i.unitPrice,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          key,
          productId: prod.id,
          productName: prod.name,
          caliber: effectiveCal,
          quantity: qty,
          unitPrice,
          imageSrc: meta.imageSrc,
          captureMode: prod.captureMode,
        },
      ];
    });
  };

  const updateCartItemQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const updateCartItemPrice = (key: string, rawVal: string) => {
    const cleaned = rawVal.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    setCart((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, unitPrice: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }
          : item
      )
    );
  };

  const removeCartItem = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const clearCart = () => {
    setCart([]);
    setCashInput('');
    setSelectedClientId('');
    setCustomClientName('');
    setPaymentMethod('contado');
  };

  // Touch numeric keypad handler
  const handleKeypadPress = (key: string) => {
    if (paymentMethod !== 'contado') {
      setPaymentMethod('contado');
    }
    if (key === 'C') {
      setCashInput('');
      return;
    }
    if (key === '.') {
      setCashInput((prev) => {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : `${prev}.`;
      });
      return;
    }
    setCashInput((prev) => {
      if (prev.length >= 9) return prev;
      if (prev.includes('.')) {
        const [, dec] = prev.split('.');
        if (dec && dec.length >= 2) return prev;
      }
      if (prev === '0') return key;
      return `${prev}${key}`;
    });
  };

  // Drag-and-drop reordering & touch reorder
  const persistProductOrder = async (reordered: AromaProduct[]) => {
    const updates = reordered.map((prod, idx) => ({
      prod,
      newOrder: idx + 1,
    }));
    const changed = updates.filter((u) => u.prod.sortOrder !== u.newOrder);
    for (const item of changed) {
      await saveAromaProduct(
        {
          name: item.prod.name,
          captureMode: item.prod.captureMode,
          sortOrder: item.newOrder,
          active: item.prod.active,
          imageUrl: item.prod.imageUrl,
          priceLar: item.prod.priceLar,
          priceMed: item.prod.priceMed,
          priceChi: item.prod.priceChi,
        },
        item.prod.id
      );
    }
  };

  const handleDropProduct = async (targetId: string) => {
    if (!draggedProductId || draggedProductId === targetId) {
      setDraggedProductId(null);
      return;
    }
    const list = [...activeProducts];
    const fromIdx = list.findIndex((p) => p.id === draggedProductId);
    const toIdx = list.findIndex((p) => p.id === targetId);
    if (fromIdx < 0 || toIdx < 0) {
      setDraggedProductId(null);
      return;
    }
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setDraggedProductId(null);
    await persistProductOrder(list);
    showToast(`Orden actualizado: ${moved.name} movido a la posición #${toIdx + 1}.`);
  };

  const handleMoveProductStep = async (productId: string, dir: -1 | 1) => {
    const list = [...activeProducts];
    const idx = list.findIndex((p) => p.id === productId);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= list.length) return;
    const [moved] = list.splice(idx, 1);
    list.splice(targetIdx, 0, moved);
    await persistProductOrder(list);
  };

  // Open +Opciones / Admin Edit modal
  const openOptionsModal = (prod: AromaProduct, initialTab: 'sell' | 'edit' = 'sell') => {
    const meta = getPosProductMeta(prod);
    const initialCal: PosCaliber =
      prod.captureMode === 'direct_total' ? 'direct' : activeCaliber;
    setOptionsProduct(prod);
    setOptCaliber(initialCal);
    setOptQty(1);
    setOptUnitPrice(String(getPriceForProduct(prod, initialCal)));
    setOptTab(initialTab);
    setEditPriceLar(String(meta.priceLar));
    setEditPriceMed(String(meta.priceMed));
    setEditPriceChi(String(meta.priceChi));
    setEditImageData(prod.imageUrl || '');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressProductImage(file);
      setEditImageData(compressed);
      showToast('Foto lista. Presiona "Guardar cambios" para aplicarla.');
    } catch {
      showToast('No se pudo procesar la imagen seleccionada.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveCatalogEdits = async () => {
    if (!optionsProduct) return;
    setIsSavingCatalog(true);
    const pLar = parseFloat(editPriceLar);
    const pMed = parseFloat(editPriceMed);
    const pChi = parseFloat(editPriceChi);
    const res = await saveAromaProduct(
      {
        name: optionsProduct.name,
        captureMode: optionsProduct.captureMode,
        sortOrder: optionsProduct.sortOrder,
        active: optionsProduct.active,
        imageUrl: editImageData || '',
        priceLar: Number.isFinite(pLar) && pLar > 0 ? pLar : undefined,
        priceMed: Number.isFinite(pMed) && pMed > 0 ? pMed : undefined,
        priceChi: Number.isFinite(pChi) && pChi > 0 ? pChi : undefined,
      },
      optionsProduct.id
    );
    setIsSavingCatalog(false);
    if (!res.ok) {
      showToast(res.error || 'No se pudo actualizar el producto.', 'error');
      return;
    }
    showToast(`Foto y precios de ${optionsProduct.name} actualizados.`);
    setOptionsProduct(null);
  };

  // Trigger thermal 80mm print via @media print (never window.open)
  const triggerThermalPrint = (mode: 'ticket' | 'corte', receipt?: LastSaleReceipt) => {
    if (mode === 'ticket' && receipt) {
      setPrintReceiptData(receipt);
    }
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  // Generate next POS folio
  const generateNextPosFolio = (): string => {
    const year = new Date().getFullYear();
    const prefix = `POS-${year}-`;
    let maxNum = 0;
    remissionNotes.forEach((n) => {
      if (n.folio?.startsWith(prefix)) {
        const tail = parseInt(n.folio.slice(prefix.length), 10);
        if (Number.isFinite(tail) && tail > maxNum) maxNum = tail;
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Checkout / Save real RemissionNote synced to Supabase & Inventory
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Agrega al menos un producto al ticket.', 'error');
      return;
    }

    const selectedClient = salesClients.find((c) => c.id === selectedClientId);
    const resolvedClientName =
      selectedClient?.name || customClientName.trim() || 'Público General';

    if (paymentMethod === 'credito' && !selectedClient && !customClientName.trim()) {
      showToast('Para venta a Crédito, selecciona o escribe el nombre del cliente.', 'error');
      return;
    }

    if (paymentMethod === 'contado' && cashReceivedNum > 0 && cashReceivedNum < ticketTotal) {
      showToast(
        `El efectivo recibido (${fmtMoney(cashReceivedNum)}) es menor al total (${fmtMoney(ticketTotal)}).`,
        'error'
      );
      return;
    }

    // Group cart items by productId into RemissionNoteRow[]
    const rowsByProduct = new Map<string, RemissionNoteRow>();
    cart.forEach((item) => {
      const existing = rowsByProduct.get(item.productId);
      const lineSub = Number((item.quantity * item.unitPrice).toFixed(2));
      if (!existing) {
        rowsByProduct.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          lar: item.caliber === 'lar' ? item.quantity : 0,
          med: item.caliber === 'med' ? item.quantity : 0,
          chi: item.caliber === 'chi' ? item.quantity : 0,
          totalPackages: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: lineSub,
        });
      } else {
        const lar = existing.lar + (item.caliber === 'lar' ? item.quantity : 0);
        const med = existing.med + (item.caliber === 'med' ? item.quantity : 0);
        const chi = existing.chi + (item.caliber === 'chi' ? item.quantity : 0);
        const totalPackages = existing.totalPackages + item.quantity;
        const subtotal = Number((existing.subtotal + lineSub).toFixed(2));
        rowsByProduct.set(item.productId, {
          ...existing,
          lar,
          med,
          chi,
          totalPackages,
          unitPrice:
            totalPackages > 0
              ? Number((subtotal / totalPackages).toFixed(2))
              : existing.unitPrice,
          subtotal,
        });
      }
    });

    const rows = Array.from(rowsByProduct.values());
    const salesPoint = salesPoints.find((sp) => sp.id === selectedSalesPointId);
    const folio = generateNextPosFolio();
    const effectiveCashReceived =
      paymentMethod === 'contado'
        ? cashReceivedNum > 0
          ? cashReceivedNum
          : ticketTotal
        : paymentMethod === 'deposito'
        ? ticketTotal
        : 0;
    const effectiveChange =
      paymentMethod === 'contado'
        ? Math.max(0, Number((effectiveCashReceived - ticketTotal).toFixed(2)))
        : 0;

    const paidAmount = paymentMethod === 'credito' ? 0 : ticketTotal;
    const balanceDue = paymentMethod === 'credito' ? ticketTotal : 0;

    setIsCheckingOut(true);
    const res = await saveRemissionNote({
      folio,
      noteDate: todayIso(),
      salesPointId: salesPoint?.id || '',
      salesPointName: salesPoint?.name || 'Punto de Venta POS',
      clientId: selectedClient?.id || '',
      clientName: resolvedClientName,
      clientPhone: selectedClient?.phone || '',
      sellerUserId: currentUser?.id,
      sellerName: currentUser?.fullName || 'Caja POS',
      ownerName: 'Aroma Flower',
      rows,
      totalPackages: ticketTotalPackages,
      totalAmount: ticketTotal,
      paymentMethod,
      paymentStatus: paymentMethod === 'credito' ? 'pendiente' : 'pagado',
      paidAmount,
      balanceDue,
      deductsInventory: true,
      notes:
        paymentMethod === 'contado'
          ? `Venta POS Efectivo · Recibido ${fmtMoney(effectiveCashReceived)} · Cambio ${fmtMoney(effectiveChange)}`
          : paymentMethod === 'deposito'
          ? 'Venta POS Tarjeta / SPEI'
          : 'Venta POS a Crédito',
    });
    setIsCheckingOut(false);

    if (!res?.entry) {
      showToast('No se pudo registrar el cobro.', 'error');
      return;
    }

    const receipt: LastSaleReceipt = {
      note: res.entry,
      cashReceived: effectiveCashReceived,
      changeDue: effectiveChange,
      createdTimeLabel: new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setLastSale(receipt);
    setCopiedWa(false);
    clearCart();
    setMobilePanel('catalog');

    if (autoPrint80mm) {
      triggerThermalPrint('ticket', receipt);
    }
  };

  // Build WhatsApp summary text
  const buildWhatsappText = (receipt: LastSaleReceipt): string => {
    const n = receipt.note;
    const methodLabel =
      n.paymentMethod === 'contado'
        ? 'Efectivo'
        : n.paymentMethod === 'deposito'
        ? 'Tarjeta / SPEI'
        : 'Crédito';
    const lines = n.rows.map((r) => {
      const parts: string[] = [];
      if (r.lar > 0) parts.push(`${r.lar} LAR`);
      if (r.med > 0) parts.push(`${r.med} MED`);
      if (r.chi > 0) parts.push(`${r.chi} CHI`);
      const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      return `• ${r.productName}${detail} x${r.totalPackages} paq — ${fmtMoney(r.subtotal)}`;
    });

    return [
      `🌹 *AROMA FLOWER — TICKET DE VENTA*`,
      `Folio: *${n.folio}*`,
      `Fecha: ${n.noteDate} ${receipt.createdTimeLabel}`,
      `Punto: ${n.salesPointName}`,
      `Cliente: ${n.clientName}`,
      `------------------------------`,
      ...lines,
      `------------------------------`,
      `Paquetes: *${n.totalPackages}*`,
      `*TOTAL: ${fmtMoney(n.totalAmount)} MXN*`,
      `Pago: ${methodLabel}`,
      n.paymentMethod === 'contado'
        ? `Recibido: ${fmtMoney(receipt.cashReceived)} · Cambio: ${fmtMoney(receipt.changeDue)}`
        : '',
      `¡Gracias por su preferencia!`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleCopyWhatsapp = async (receipt: LastSaleReceipt) => {
    try {
      await navigator.clipboard.writeText(buildWhatsappText(receipt));
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 2500);
    } catch {
      showToast('No se pudo copiar al portapapeles.', 'error');
    }
  };

  const activeCaliberLabel = CALIBER_LABELS[activeCaliber].full.toUpperCase();

  return (
    <>
      {/* MAIN INTERACTIVE FULL-SCREEN POS WORKSPACE */}
      <div className="pos-hide-on-print h-dvh w-full max-w-full overflow-hidden flex flex-col bg-[#FAF8F5] text-[#000000] select-none">
        {/* Toast feedback */}
        {toast && (
          <div
            className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl border text-xs sm:text-sm font-bold flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-[#5C1125] text-white border-[#C3A25D]/60'
                : 'bg-[#535B28] text-white border-[#C3A25D]/60'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-[#C3A25D] shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#C3A25D] shrink-0" />
            )}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* TOP BAR */}
        <header className="shrink-0 bg-white border-b border-[#C3A25D]/40 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {returnViewId && (
              <button
                type="button"
                onClick={() => setActiveView(returnViewId)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5C1125] hover:bg-[#3f0918] text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-[#C3A25D]" />
                <span className="hidden sm:inline">Volver al Panel</span>
                <span className="sm:hidden">Panel</span>
              </button>
            )}

            <div className="hidden md:flex items-center gap-2 pr-2 border-r border-stone-200 shrink-0">
              <AromaFlowersLogo size="sm" />
              <div className="leading-tight">
                <span className="block text-xs font-black tracking-tight text-[#5C1125]">
                  AROMA FLOWER POS
                </span>
                <span className="block text-[10px] font-semibold text-stone-500">
                  {currentUser?.fullName || 'Caja'}
                </span>
              </div>
            </div>

            {/* Punto de Venta Selector */}
            <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#C3A25D]/50 rounded-xl px-2.5 py-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-[#5C1125] shrink-0" />
              <select
                value={selectedSalesPointId}
                onChange={(e) => setSelectedSalesPointId(e.target.value)}
                aria-label="Punto de Venta"
                className="bg-transparent text-xs font-bold text-[#000000] focus:outline-none truncate max-w-[140px] sm:max-w-[210px] cursor-pointer"
              >
                {salesPoints.length === 0 ? (
                  <option value="">Punto de Venta General</option>
                ) : (
                  salesPoints.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Catalog/Ticket Switcher */}
            <button
              type="button"
              onClick={() =>
                setMobilePanel((p) => (p === 'catalog' ? 'ticket' : 'catalog'))
              }
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C3A25D] text-[#000000] text-xs font-black shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {mobilePanel === 'catalog'
                  ? `Ticket (${ticketTotalPackages})`
                  : 'Productos'}
              </span>
            </button>

            {isFullAdmin && (
              <button
                type="button"
                onClick={() => setAdminEditMode((v) => !v)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                  adminEditMode
                    ? 'bg-[#C3A25D] text-[#000000] border-[#9f8241]'
                    : 'bg-[#FAF8F5] hover:bg-[#f8f2e2] text-[#000000] border-[#C3A25D]/60'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{adminEditMode ? 'Editando Fotos/Precios' : 'Editar Fotos / Precios'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCorteDate(todayIso());
                setShowCorteModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5C1125] hover:bg-[#3f0918] text-white text-xs sm:text-sm font-bold border border-[#C3A25D]/40 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <BarChart3 className="w-4 h-4 text-[#C3A25D]" />
              <span className="hidden sm:inline">Corte de Caja</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#C3A25D] text-[#000000] text-[10px] font-black tabular-nums">
                {todayNotesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              className="p-2 rounded-xl bg-white hover:bg-[#fbf2f4] text-stone-600 hover:text-[#5C1125] border border-stone-200 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* SPLIT POS WORKSPACE: LEFT CATALOG + RIGHT TICKET & CALCULATOR */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT PANE: VISUAL PRODUCT PHOTO GRID (~68%) */}
          <section
            className={`${
              mobilePanel === 'ticket' ? 'hidden lg:flex' : 'flex'
            } flex-1 min-w-0 flex-col overflow-hidden px-3 sm:px-5 pt-3 pb-2 gap-2.5`}
          >
            {/* Caliber / Category Selector Row */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600 mr-1">
                  Calibre (1 toque):
                </span>
                {(
                  [
                    { id: 'lar', label: 'Largo (LAR)' },
                    { id: 'med', label: 'Mediano (MED)' },
                    { id: 'chi', label: 'Chico (CHI)' },
                  ] as const
                ).map((cal) => (
                  <button
                    key={cal.id}
                    type="button"
                    onClick={() => setActiveCaliber(cal.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap shrink-0 border ${
                      activeCaliber === cal.id
                        ? 'bg-[#5C1125] text-white border-[#C3A25D] shadow-xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:border-[#C3A25D]'
                    }`}
                  >
                    {cal.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'Todas' },
                    { id: 'rojas', label: 'Rojas' },
                    { id: 'blancas', label: 'Blancas' },
                    { id: 'rosas', label: 'Rosas' },
                    { id: 'especiales', label: 'Especiales' },
                    { id: 'combinados', label: 'Combinados' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setColorFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                      colorFilter === cat.id
                        ? 'bg-[#535B28] text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Header & Search Bar (matching reference structure) */}
            <div className="shrink-0 bg-white rounded-2xl border border-[#C3A25D]/40 px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C3A25D] shrink-0" />
                <span className="text-xs sm:text-sm font-black tracking-tight text-[#5C1125]">
                  ROSA DE CORTE · {activeCaliberLabel}
                </span>
                <span className="text-xs font-semibold text-stone-500">
                  ({filteredProducts.length} disponibles)
                </span>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar variedad..."
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-[#FAF8F5] border border-stone-200 text-xs sm:text-sm font-semibold text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#5C1125] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Reorder Tip Strip (matching reference) */}
            <div className="shrink-0 bg-[#fcfaf4] border border-[#C3A25D]/45 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-[#6d5726]">
              <div className="flex items-center gap-1.5 min-w-0">
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#C3A25D] shrink-0" />
                <span className="truncate">
                  <strong className="text-[#5C1125]">Organizar Productos:</strong> Arrastra cualquier tarjeta para ordenar las variedades a tu gusto.
                </span>
              </div>
              <span className="hidden md:inline text-[11px] font-semibold text-[#535B28] whitespace-nowrap shrink-0">
                Toca una foto para sumar al ticket
              </span>
            </div>

            {/* 4-COLUMN PHOTO CARD GRID */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
              {filteredProducts.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-[#C3A25D]/60 text-stone-500 text-sm font-semibold">
                  <Store className="w-8 h-8 text-[#C3A25D] mb-2" />
                  <span>No se encontraron variedades con ese filtro.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((prod) => {
                    const meta = getPosProductMeta(prod);
                    const effCal: PosCaliber =
                      prod.captureMode === 'direct_total' ? 'direct' : activeCaliber;
                    const price = getPriceForProduct(prod, effCal);
                    const stockObj = stockByProductId.get(prod.id);
                    const stockForCal =
                      effCal === 'direct'
                        ? stockObj?.total || 0
                        : stockObj?.[effCal] || 0;
                    const inCartQty = cartQtyByProduct.get(prod.id) || 0;

                    return (
                      <div
                        key={prod.id}
                        draggable
                        onDragStart={() => setDraggedProductId(prod.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropProduct(prod.id)}
                        onDragEnd={() => setDraggedProductId(null)}
                        onClick={() => addToCart(prod, effCal, 1)}
                        className={`group bg-white rounded-2xl border transition-all duration-150 overflow-hidden flex flex-col cursor-pointer ${
                          draggedProductId === prod.id
                            ? 'opacity-50 border-[#5C1125] scale-[0.98]'
                            : inCartQty > 0
                            ? 'border-[#5C1125] ring-2 ring-[#5C1125]/15 shadow-sm'
                            : 'border-[#C3A25D]/45 hover:border-[#5C1125] hover:shadow-md'
                        }`}
                      >
                        {/* 4:3 Studio Rose Photograph */}
                        <div className="relative aspect-[4/3] w-full bg-[#f8f2e2] overflow-hidden">
                          <img
                            src={meta.imageSrc}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* + Opciones button (top-left, matching reference) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOptionsModal(prod, 'sell');
                            }}
                            className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-[#FAF8F5]/95 hover:bg-[#C3A25D] text-[#000000] text-[11px] font-extrabold shadow-sm border border-[#C3A25D]/70 transition cursor-pointer"
                          >
                            + Opciones
                          </button>

                          {/* Drag Handle / Admin Quick Photo Button (top-right) */}
                          {adminEditMode && isFullAdmin ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOptionsModal(prod, 'edit');
                              }}
                              title="Cambiar foto o precios"
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#5C1125] hover:bg-[#3f0918] text-[#C3A25D] shadow-sm cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              title="Arrastrar para reordenar"
                              className="absolute top-2 right-2 p-1 rounded-lg bg-black/35 text-white/90"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                          )}

                          {/* In-cart quantity badge (bottom-left when > 0) */}
                          {inCartQty > 0 && (
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-[#5C1125] text-[#C3A25D] text-[11px] font-black tabular-nums shadow-sm">
                              {inCartQty} en ticket
                            </span>
                          )}

                          {/* Price Tag Overlay (bottom-right, matching reference) */}
                          <span className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-lg bg-[#000000]/85 text-white text-xs sm:text-sm font-black tabular-nums border border-[#C3A25D]/60 shadow-sm">
                            {fmtMoney(price)}
                          </span>
                        </div>

                        {/* Card Details */}
                        <div className="p-2.5 flex-1 flex flex-col justify-between gap-1.5">
                          <div>
                            <h3 className="text-xs sm:text-sm font-black text-[#000000] uppercase leading-tight truncate">
                              {prod.name}
                            </h3>
                            <p className="text-[11px] text-stone-500 truncate mt-0.5">
                              {meta.colorLabel} &bull; Stock:{' '}
                              <span
                                className={`font-bold tabular-nums ${
                                  stockForCal > 0 ? 'text-[#535B28]' : 'text-stone-400'
                                }`}
                              >
                                {stockForCal}
                              </span>
                            </p>
                          </div>

                          <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#9f8241]">
                              {effCal === 'direct'
                                ? 'PAQUETE ÚNICO'
                                : `CAL. ${CALIBER_LABELS[effCal].full}`}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-[#5C1125] tabular-nums">
                              {fmtMoney(price)}
                            </span>
                          </div>

                          {/* Touch Reorder & Edit Bar when Admin Edit Mode is ON */}
                          {adminEditMode && isFullAdmin && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="pt-1.5 border-t border-[#C3A25D]/30 flex items-center justify-between gap-1"
                            >
                              <button
                                type="button"
                                onClick={() => handleMoveProductStep(prod.id, -1)}
                                className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                                title="Mover a la izquierda"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openOptionsModal(prod, 'edit')}
                                className="flex-1 py-1 px-2 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] text-[10px] font-bold cursor-pointer text-center"
                              >
                                Foto / Precios
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveProductStep(prod.id, 1)}
                                className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                                title="Mover a la derecha"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT PANE: PERMANENT TICKET + TOUCH CALCULATOR (~33%) */}
          <aside
            className={`${
              mobilePanel === 'catalog' ? 'hidden lg:flex' : 'flex'
            } w-full lg:w-[375px] xl:w-[405px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-[#C3A25D]/45 flex-col h-full min-h-0 overflow-y-auto shadow-lg`}
          >
            {/* Ticket Header */}
            <div className="shrink-0 px-3.5 py-2 border-b border-stone-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#5C1125]" />
                <h2 className="text-xs sm:text-sm font-black tracking-tight text-[#000000]">
                  TICKET DE VENTA
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#f8f2e2] text-[#8a6d2b] text-[11px] font-extrabold tabular-nums border border-[#C3A25D]/40">
                  {ticketTotalPackages} paq
                </span>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[11px] font-bold text-[#5C1125] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar</span>
                </button>
              )}
            </div>

            {/* Client Selector (single compact row) */}
            <div className="shrink-0 px-3.5 py-1.5 border-b border-stone-100">
              <div className={`grid gap-1.5 ${selectedClientId ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    if (e.target.value) setCustomClientName('');
                  }}
                  aria-label="Cliente registrado"
                  className="w-full px-2 py-1.5 rounded-lg bg-[#FAF8F5] border border-stone-200 text-xs font-bold text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125] cursor-pointer truncate"
                >
                  <option value="">Público General</option>
                  {salesClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.balance > 0 ? ` (${fmtMoney(c.balance)})` : ''}
                    </option>
                  ))}
                </select>
                {!selectedClientId && (
                  <input
                    type="text"
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    placeholder="Cliente (Opcional)..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-semibold text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#5C1125]"
                  />
                )}
              </div>
            </div>

            {/* Scrollable Cart Items */}
            <div className="flex-1 min-h-[60px] overflow-y-auto px-3.5 py-1.5 space-y-1.5 bg-[#FAF8F5]/50">
              {cart.length === 0 ? (
                <div className="h-full min-h-[52px] flex items-center justify-center rounded-xl border border-dashed border-[#C3A25D]/60 bg-[#fcfaf4] text-xs font-semibold text-[#8a6d2b] px-3 text-center">
                  Ticket vacío &bull; Toca productos a la izquierda
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.key}
                    className="bg-white rounded-xl border border-stone-200 p-2 flex items-center gap-2 shadow-2xs"
                  >
                    <img
                      src={item.imageSrc}
                      alt={item.productName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#C3A25D]/40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-[#000000] uppercase truncate">
                          {item.productName}
                        </span>
                        <span className="text-[10px] font-extrabold text-[#5C1125] bg-[#fbf2f4] px-1.5 py-0.5 rounded shrink-0">
                          {CALIBER_LABELS[item.caliber].short}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-1.5">
                        {/* Editable Unit Price */}
                        <div className="flex items-center text-[11px] font-bold text-stone-600">
                          <span className="mr-0.5">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateCartItemPrice(item.key, e.target.value)
                            }
                            aria-label={`Precio unitario ${item.productName}`}
                            className="w-14 px-1 py-0.5 rounded border border-stone-200 bg-[#FAF8F5] text-xs font-bold tabular-nums text-[#000000] focus:outline-none focus:border-[#5C1125]"
                          />
                        </div>

                        {/* Qty Stepper */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(item.key, -1)}
                            className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-[#000000] flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-black tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(item.key, 1)}
                            className="w-6 h-6 rounded-lg bg-[#5C1125] hover:bg-[#3f0918] text-white flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Line Subtotal */}
                        <span className="text-xs font-black text-[#000000] tabular-nums min-w-[60px] text-right">
                          {fmtMoney(item.quantity * item.unitPrice)}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeCartItem(item.key)}
                          className="text-stone-400 hover:text-[#5C1125] p-0.5 cursor-pointer"
                          title="Quitar línea"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* PERMANENT CHECKOUT & TOUCH CALCULATOR DOCK */}
            <div className="shrink-0 px-3.5 pt-2 pb-2.5 border-t border-[#C3A25D]/40 bg-white space-y-1.5">
              {/* Total Highlight Box */}
              <div className="rounded-xl bg-[#f8f2e2] border-2 border-[#C3A25D] px-3 py-1.5 flex items-center justify-between gap-2">
                <div className="leading-tight">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-[#5C1125]">
                    TOTAL A COBRAR:
                  </span>
                  <span className="text-[10px] font-bold text-stone-700 tabular-nums">
                    {ticketTotalPackages} paquete(s) en ticket
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-[#5C1125] tabular-nums">
                    {fmtMoney(ticketTotal)}
                  </span>
                  <span className="text-[10px] font-extrabold text-[#8a6d2b] ml-1">
                    MXN
                  </span>
                </div>
              </div>

              {/* Payment Method Buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('contado')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-extrabold border transition cursor-pointer whitespace-nowrap ${
                    paymentMethod === 'contado'
                      ? 'bg-[#5C1125] text-white border-[#5C1125] shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-[#C3A25D]'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span>Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('deposito')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-extrabold border transition cursor-pointer whitespace-nowrap ${
                    paymentMethod === 'deposito'
                      ? 'bg-[#5C1125] text-white border-[#5C1125] shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-[#C3A25D]'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>Tarjeta / SPEI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credito')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-extrabold border transition cursor-pointer whitespace-nowrap ${
                    paymentMethod === 'credito'
                      ? 'bg-[#535B28] text-white border-[#535B28] shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-[#C3A25D]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Crédito</span>
                </button>
              </div>

              {/* Quick Bills Row */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-stone-500">
                  <span>BILLETES RÁPIDOS (1 TOQUE):</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('contado');
                      setCashInput(ticketTotal > 0 ? String(ticketTotal) : '');
                    }}
                    className="text-[#5C1125] hover:underline cursor-pointer tabular-nums"
                  >
                    Exacto ({fmtMoney(ticketTotal)})
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {QUICK_BILLS.map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => {
                        setPaymentMethod('contado');
                        setCashInput(String(bill));
                      }}
                      className="py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#f8f2e2] border border-[#C3A25D]/50 text-[#000000] text-[11px] font-extrabold tabular-nums transition cursor-pointer"
                    >
                      ${bill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Received & Change Display */}
              <div className="rounded-xl border-2 border-[#C3A25D]/60 bg-[#FAF8F5] px-3 py-1.5 flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[9px] font-extrabold uppercase text-stone-500">
                    {paymentMethod === 'contado'
                      ? 'EFECTIVO RECIBIDO'
                      : paymentMethod === 'deposito'
                      ? 'PAGO TARJETA / SPEI'
                      : 'CARGO A CRÉDITO'}
                  </span>
                  <span className="text-base font-black text-[#000000] tabular-nums">
                    {paymentMethod === 'contado'
                      ? fmtMoney(cashReceivedNum)
                      : fmtMoney(ticketTotal)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="block text-[9px] font-extrabold uppercase text-stone-500">
                    {paymentMethod === 'contado'
                      ? changeDue >= 0
                        ? 'CAMBIO A ENTREGAR'
                        : 'FALTANTE'
                      : paymentMethod === 'credito'
                      ? 'SALDO CLIENTE'
                      : 'ESTADO'}
                  </span>
                  <span
                    className={`text-base font-black tabular-nums ${
                      paymentMethod === 'contado'
                        ? changeDue >= 0
                          ? 'text-[#535B28]'
                          : 'text-[#5C1125]'
                        : paymentMethod === 'credito'
                        ? 'text-amber-700'
                        : 'text-[#535B28]'
                    }`}
                  >
                    {paymentMethod === 'contado'
                      ? fmtMoney(Math.abs(changeDue))
                      : paymentMethod === 'credito'
                      ? fmtMoney(ticketTotal)
                      : 'EXACTO'}
                  </span>
                </div>
              </div>

              {/* Permanent 4x3 Touch Numeric Keypad */}
              <div className="grid grid-cols-3 gap-1">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'].map(
                  (key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeypadPress(key)}
                      className={`py-1.5 rounded-lg text-sm font-black tabular-nums transition active:scale-95 cursor-pointer border ${
                        key === 'C'
                          ? 'bg-[#000000] hover:bg-stone-800 text-white border-[#000000]'
                          : 'bg-white hover:bg-[#FAF8F5] text-[#000000] border-stone-200 shadow-2xs'
                      }`}
                    >
                      {key}
                    </button>
                  )
                )}
              </div>

              {/* Auto-print 80mm Checkbox */}
              <label className="flex items-center gap-2 text-[11px] font-semibold text-stone-700 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={autoPrint80mm}
                  onChange={(e) => setAutoPrint80mm(e.target.checked)}
                  className="rounded border-stone-300 text-[#5C1125] focus:ring-[#5C1125]"
                />
                <span>Imprimir ticket térmico de 80mm automáticamente</span>
              </label>

              {/* Primary Checkout CTA */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isCheckingOut}
                className="w-full py-2.5 px-4 rounded-xl bg-[#5C1125] hover:bg-[#3f0918] disabled:bg-stone-300 disabled:text-stone-500 text-white font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:cursor-not-allowed tabular-nums"
              >
                <Printer className="w-4 h-4 text-[#C3A25D]" />
                <span>
                  {isCheckingOut
                    ? 'GUARDANDO TICKET...'
                    : `COBRAR / GENERAR TICKET (${fmtMoney(ticketTotal)})`}
                </span>
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* MODAL 1: + OPCIONES & ADMIN PHOTO/PRICE EDITOR */}
      {optionsProduct && (
        <div className="pos-hide-on-print fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#C3A25D]/50 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-[#5C1125] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#C3A25D]" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  {optionsProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOptionsProduct(null)}
                className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isFullAdmin && (
              <div className="grid grid-cols-2 border-b border-stone-200 bg-[#FAF8F5]">
                <button
                  type="button"
                  onClick={() => setOptTab('sell')}
                  className={`py-2.5 text-xs font-extrabold cursor-pointer transition ${
                    optTab === 'sell'
                      ? 'bg-white text-[#5C1125] border-b-2 border-[#5C1125]'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Agregar al Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setOptTab('edit')}
                  className={`py-2.5 text-xs font-extrabold cursor-pointer transition ${
                    optTab === 'edit'
                      ? 'bg-white text-[#5C1125] border-b-2 border-[#5C1125]'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Editar Foto y Precios
                </button>
              </div>
            )}

            {optTab === 'sell' ? (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={getPosProductMeta(optionsProduct).imageSrc}
                    alt={optionsProduct.name}
                    referrerPolicy="no-referrer"
                    className="w-24 h-20 rounded-xl object-cover border border-[#C3A25D]/50 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-stone-500">
                      {getPosProductMeta(optionsProduct).colorLabel}
                    </p>
                    <p className="text-xs text-stone-600 mt-1">
                      Stock disponible:{' '}
                      <strong className="text-[#535B28] tabular-nums">
                        {stockByProductId.get(optionsProduct.id)?.total || 0} paq
                      </strong>
                    </p>
                  </div>
                </div>

                {optionsProduct.captureMode !== 'direct_total' && (
                  <div>
                    <label className="block text-xs font-extrabold text-stone-700 mb-1.5">
                      Selecciona Calibre
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['lar', 'med', 'chi'] as const).map((cal) => {
                        const p = getPriceForProduct(optionsProduct, cal);
                        return (
                          <button
                            key={cal}
                            type="button"
                            onClick={() => {
                              setOptCaliber(cal);
                              setOptUnitPrice(String(p));
                            }}
                            className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                              optCaliber === cal
                                ? 'bg-[#5C1125] text-white border-[#5C1125]'
                                : 'bg-[#FAF8F5] text-[#000000] border-stone-200 hover:border-[#C3A25D]'
                            }`}
                          >
                            <span className="block text-[11px] font-extrabold">
                              {CALIBER_LABELS[cal].full}
                            </span>
                            <span className="block text-xs font-black tabular-nums mt-0.5">
                              {fmtMoney(p)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-stone-700 mb-1">
                      Cantidad (paquetes)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOptQty((q) => Math.max(1, q - 1))}
                        className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center font-black cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={optQty}
                        onChange={(e) =>
                          setOptQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="w-full h-9 text-center rounded-xl border border-stone-300 font-black tabular-nums text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setOptQty((q) => q + 1)}
                        className="w-9 h-9 rounded-xl bg-[#5C1125] text-white flex items-center justify-center font-black cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-stone-700 mb-1">
                      Precio Unitario (MXN)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={optUnitPrice}
                      onChange={(e) =>
                        setOptUnitPrice(e.target.value.replace(/[^0-9.]/g, ''))
                      }
                      className="w-full h-9 px-3 rounded-xl border border-stone-300 font-black tabular-nums text-sm text-[#000000]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const price = parseFloat(optUnitPrice);
                    addToCart(
                      optionsProduct,
                      optCaliber,
                      optQty,
                      Number.isFinite(price) && price >= 0 ? price : undefined
                    );
                    setOptionsProduct(null);
                  }}
                  className="w-full py-3 rounded-xl bg-[#5C1125] hover:bg-[#3f0918] text-white font-black text-sm transition cursor-pointer tabular-nums"
                >
                  Agregar {optQty} paq al Ticket (
                  {fmtMoney((parseFloat(optUnitPrice) || 0) * optQty)})
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Admin Photo Upload & Preview */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-stone-700">
                    Fotografía del Producto
                  </label>
                  <div className="relative aspect-[4/3] w-full max-h-48 rounded-xl overflow-hidden border border-[#C3A25D]/50 bg-[#f8f2e2]">
                    <img
                      src={editImageData || getPosProductMeta(optionsProduct).imageSrc}
                      alt={optionsProduct.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-bold transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#C3A25D]" />
                      <span>Subir Foto Propia</span>
                    </button>
                    {editImageData && (
                      <button
                        type="button"
                        onClick={() => setEditImageData('')}
                        className="flex items-center gap-1 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Default Prices per Caliber */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                      Precio Largo
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editPriceLar}
                      onChange={(e) =>
                        setEditPriceLar(e.target.value.replace(/[^0-9.]/g, ''))
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs font-black tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                      Precio Mediano
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editPriceMed}
                      onChange={(e) =>
                        setEditPriceMed(e.target.value.replace(/[^0-9.]/g, ''))
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs font-black tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                      Precio Chico
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editPriceChi}
                      onChange={(e) =>
                        setEditPriceChi(e.target.value.replace(/[^0-9.]/g, ''))
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs font-black tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveCatalogEdits}
                  disabled={isSavingCatalog}
                  className="w-full py-2.5 rounded-xl bg-[#5C1125] hover:bg-[#3f0918] text-white text-xs sm:text-sm font-black transition cursor-pointer disabled:opacity-60"
                >
                  {isSavingCatalog ? 'Guardando...' : 'Guardar Cambios en Catálogo'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: POST-SALE RECEIPT CONFIRMATION */}
      {lastSale && (
        <div className="pos-hide-on-print fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#C3A25D]/60 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-[#535B28] text-white text-center space-y-1">
              <CheckCircle2 className="w-10 h-10 text-[#C3A25D] mx-auto" />
              <h3 className="text-lg font-black">Venta Registrada</h3>
              <p className="text-xs text-[#edf1df] font-semibold">
                Folio {lastSale.note.folio} &bull; Inventario actualizado automáticamente
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-[#FAF8F5] border border-stone-200 p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500 font-semibold">Cliente:</span>
                  <span className="font-extrabold text-[#000000]">
                    {lastSale.note.clientName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 font-semibold">Paquetes:</span>
                  <span className="font-extrabold tabular-nums">
                    {lastSale.note.totalPackages}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-stone-200">
                  <span className="font-black text-[#5C1125]">TOTAL COBRADO:</span>
                  <span className="font-black text-[#5C1125] tabular-nums">
                    {fmtMoney(lastSale.note.totalAmount)} MXN
                  </span>
                </div>
                {lastSale.note.paymentMethod === 'contado' && (
                  <div className="flex justify-between text-xs pt-1 text-[#535B28] font-bold">
                    <span>Recibido: {fmtMoney(lastSale.cashReceived)}</span>
                    <span>Cambio: {fmtMoney(lastSale.changeDue)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => triggerThermalPrint('ticket', lastSale)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#5C1125] hover:bg-[#3f0918] text-white text-xs font-extrabold transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#C3A25D]" />
                  <span>Imprimir 80mm</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyWhatsapp(lastSale)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#535B28] hover:bg-[#3b411c] text-white text-xs font-extrabold transition cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-[#C3A25D]" />
                  <span>{copiedWa ? '¡Copiado!' : 'Resumen WhatsApp'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLastSale(null)}
                className="w-full py-2.5 rounded-xl bg-[#f8f2e2] hover:bg-[#efe1c2] text-[#000000] border border-[#C3A25D] text-xs font-black transition cursor-pointer"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CORTE DE CAJA */}
      {showCorteModal && (
        <div className="pos-hide-on-print fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#C3A25D]/60 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-[#5C1125] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#C3A25D]" />
                <div>
                  <h3 className="text-sm sm:text-base font-black">Corte de Caja POS</h3>
                  <p className="text-[11px] text-[#d6be83]">
                    Resumen diario de tickets, formas de pago y reimpresión 80mm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCorteModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-extrabold text-stone-700">Fecha:</label>
                  <input
                    type="date"
                    value={corteDate}
                    onChange={(e) => setCorteDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-bold text-[#000000]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => triggerThermalPrint('corte')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#5C1125] hover:bg-[#3f0918] text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C3A25D]" />
                  <span>Imprimir Corte (80mm)</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#f8f2e2] border border-[#C3A25D]/60">
                  <span className="text-[10px] font-extrabold uppercase text-[#5C1125]">
                    Total Vendido
                  </span>
                  <p className="text-lg font-black text-[#5C1125] tabular-nums mt-0.5">
                    {fmtMoney(corteSummary.totalAmount)}
                  </p>
                  <span className="text-[10px] text-stone-600">
                    {corteSummary.ticketCount} tickets &bull; {corteSummary.totalPackages} paq
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#f7f8f2] border border-[#dce4bf]">
                  <span className="text-[10px] font-extrabold uppercase text-[#535B28]">
                    Efectivo
                  </span>
                  <p className="text-lg font-black text-[#535B28] tabular-nums mt-0.5">
                    {fmtMoney(corteSummary.cashAmount)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-extrabold uppercase text-stone-600">
                    Tarjeta / SPEI
                  </span>
                  <p className="text-lg font-black text-[#000000] tabular-nums mt-0.5">
                    {fmtMoney(corteSummary.cardAmount)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-extrabold uppercase text-amber-800">
                    Crédito
                  </span>
                  <p className="text-lg font-black text-amber-800 tabular-nums mt-0.5">
                    {fmtMoney(corteSummary.creditAmount)}
                  </p>
                </div>
              </div>

              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2 bg-[#FAF8F5] border-b border-stone-200 text-xs font-extrabold text-stone-700">
                  Tickets del Día ({corteNotes.length})
                </div>
                {corteNotes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-500 font-semibold">
                    No hay ventas registradas para esta fecha.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto">
                    {corteNotes.map((note) => (
                      <div
                        key={note.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-[#FAF8F5]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-[#5C1125]">
                              {note.folio}
                            </span>
                            <span className="font-bold text-[#000000] truncate">
                              {note.clientName}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500">
                            {note.totalPackages} paq &bull;{' '}
                            {note.paymentMethod === 'contado'
                              ? 'Efectivo'
                              : note.paymentMethod === 'deposito'
                              ? 'Tarjeta / SPEI'
                              : 'Crédito'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-black text-[#000000] tabular-nums">
                            {fmtMoney(note.totalAmount)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              triggerThermalPrint('ticket', {
                                note,
                                cashReceived: note.paidAmount,
                                changeDue: 0,
                                createdTimeLabel: (note.createdAt || '').slice(11, 16),
                              })
                            }
                            title="Reimprimir ticket 80mm"
                            className="p-1.5 rounded-lg bg-[#fbf2f4] hover:bg-[#ebccd4] text-[#5C1125] cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL 80MM PRINT-ONLY CONTAINER (VISIBLE ONLY IN @media print) */}
      <div className="pos-thermal-print-only">
        {printMode === 'ticket' && printReceiptData && (
          <div className="font-mono text-[11px] leading-snug text-black p-1">
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
              <div className="font-bold text-sm tracking-wide">AROMA FLOWER</div>
              <div>PRODUCTORA DE ROSA DE CORTE</div>
              <div>{printReceiptData.note.salesPointName}</div>
            </div>

            <div className="space-y-0.5 border-b border-dashed border-black pb-2 mb-2">
              <div>FOLIO: {printReceiptData.note.folio}</div>
              <div>
                FECHA: {printReceiptData.note.noteDate}{' '}
                {printReceiptData.createdTimeLabel}
              </div>
              <div>CLIENTE: {printReceiptData.note.clientName}</div>
              <div>ATENDIÓ: {printReceiptData.note.sellerName}</div>
            </div>

            <div className="border-b border-dashed border-black pb-2 mb-2 space-y-1">
              {printReceiptData.note.rows.map((r) => {
                const cals: string[] = [];
                if (r.lar > 0) cals.push(`${r.lar}L`);
                if (r.med > 0) cals.push(`${r.med}M`);
                if (r.chi > 0) cals.push(`${r.chi}C`);
                return (
                  <div key={r.productId}>
                    <div className="font-bold">{r.productName}</div>
                    <div className="flex justify-between">
                      <span>
                        {r.totalPackages} paq {cals.length ? `(${cals.join('/')})` : ''} x{' '}
                        {fmtMoney(r.unitPrice)}
                      </span>
                      <span className="font-bold">{fmtMoney(r.subtotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>PAQUETES:</span>
                <span className="font-bold">{printReceiptData.note.totalPackages}</span>
              </div>
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL:</span>
                <span>{fmtMoney(printReceiptData.note.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>FORMA DE PAGO:</span>
                <span>
                  {printReceiptData.note.paymentMethod === 'contado'
                    ? 'EFECTIVO'
                    : printReceiptData.note.paymentMethod === 'deposito'
                    ? 'TARJETA / SPEI'
                    : 'CRÉDITO'}
                </span>
              </div>
              {printReceiptData.note.paymentMethod === 'contado' && (
                <>
                  <div className="flex justify-between">
                    <span>RECIBIDO:</span>
                    <span>{fmtMoney(printReceiptData.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CAMBIO:</span>
                    <span>{fmtMoney(printReceiptData.changeDue)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center border-t border-dashed border-black pt-2 mt-3">
              <div>¡GRACIAS POR SU COMPRA!</div>
              <div>AROMA FLOWER</div>
            </div>
          </div>
        )}

        {printMode === 'corte' && (
          <div className="font-mono text-[11px] leading-snug text-black p-1">
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
              <div className="font-bold text-sm">AROMA FLOWER</div>
              <div className="font-bold">CORTE DE CAJA POS</div>
              <div>FECHA: {corteDate}</div>
            </div>
            <div className="space-y-1 border-b border-dashed border-black pb-2 mb-2">
              <div className="flex justify-between">
                <span>TICKETS:</span>
                <span>{corteSummary.ticketCount}</span>
              </div>
              <div className="flex justify-between">
                <span>PAQUETES VENDIDOS:</span>
                <span>{corteSummary.totalPackages}</span>
              </div>
              <div className="flex justify-between">
                <span>EFECTIVO:</span>
                <span>{fmtMoney(corteSummary.cashAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>TARJETA / SPEI:</span>
                <span>{fmtMoney(corteSummary.cardAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>CRÉDITO:</span>
                <span>{fmtMoney(corteSummary.creditAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                <span>TOTAL DEL DÍA:</span>
                <span>{fmtMoney(corteSummary.totalAmount)}</span>
              </div>
            </div>
            <div className="text-center mt-2">
              GENERADO POR: {currentUser?.fullName || 'CAJA'}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
