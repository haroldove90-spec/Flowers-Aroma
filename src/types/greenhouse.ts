export type UserRole =
  | 'admin'
  | 'produccion'
  | 'perfil'
  | 'director'
  | 'operaciones'
  | 'agronomo'
  | 'cosecha'
  | 'ventas'
  | 'sistema'
  | 'aroma_flowers';

export type AppUserRole = 'admin' | 'produccion';

export interface AppUser {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: AppUserRole;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RoleConfig {
  id: UserRole;
  title: string;
  shortTitle: string;
  badge: string;
  color: string;
  iconName: string;
  enabled?: boolean;
}

export const ROLES: RoleConfig[] = [
  {
    id: 'admin',
    title: 'Admin',
    shortTitle: 'Admin',
    badge: 'Acceso Total • Admin y Producción',
    color: 'wine',
    iconName: 'ShieldCheck',
    enabled: true,
  },
  {
    id: 'produccion',
    title: 'Producción',
    shortTitle: 'Producción',
    badge: 'Producción del Día, Inventario, Ventas y Perfil',
    color: 'olive',
    iconName: 'PackageCheck',
    enabled: true,
  },
  {
    id: 'perfil',
    title: 'Perfil',
    shortTitle: 'Perfil',
    badge: 'Módulo Integrado en Admin y Producción',
    color: 'gold',
    iconName: 'UserCog',
    enabled: false,
  },
  {
    id: 'aroma_flowers',
    title: 'Aroma Flowers',
    shortTitle: 'Aroma Flowers',
    badge: 'Producción, Empaque y Ventas Excel',
    color: 'wine',
    iconName: 'PackageCheck',
    enabled: false,
  },
  {
    id: 'director',
    title: 'Director General / Gerente Propietario',
    shortTitle: 'Dirección General',
    badge: 'Administración y Alta Dirección',
    color: 'emerald',
    iconName: 'Building2',
    enabled: false,
  },
  {
    id: 'operaciones',
    title: 'Administrador / Jefe de Operaciones',
    shortTitle: 'Operaciones',
    badge: 'Gestión de Recursos y Producción',
    color: 'blue',
    iconName: 'Settings',
    enabled: false,
  },
  {
    id: 'agronomo',
    title: 'Ingeniero Agrónomo / Encargado de Riego y Sanidad',
    shortTitle: 'Agronomía & Sanidad',
    badge: 'Cultivo, Riego y Fitoprotección',
    color: 'teal',
    iconName: 'Sprout',
    enabled: false,
  },
  {
    id: 'cosecha',
    title: 'Jefe de Cosecha, Poscosecha y Empaque',
    shortTitle: 'Cosecha & Empaque',
    badge: 'Corte, Selección y Calidad',
    color: 'rose',
    iconName: 'Flower2',
    enabled: false,
  },
  {
    id: 'ventas',
    title: 'Encargado de Ventas y Comercialización',
    shortTitle: 'Comercialización',
    badge: 'Ventas, Clientes y Cobranza',
    color: 'amber',
    iconName: 'TrendingUp',
    enabled: false,
  },
  {
    id: 'sistema',
    title: 'Sistema / Soporte Técnico y Operadores en Campo',
    shortTitle: 'Sistema & Campo',
    badge: 'Operación Ágil y Tecnología',
    color: 'purple',
    iconName: 'Tablet',
    enabled: false,
  },
];

// Aroma Flowers Standardized Catalog (22 Varieties/Products from Aaron, David & CEDA CDMX sheets)
export const AROMA_FLOWER_VARIETIES = [
  'FREEDOM',
  'MONDIAL',
  'PROUD',
  'HERMOSA',
  'TOPAZ',
  'CARICIA',
  'HOMER',
  'DEEP PURPLE',
  'COOL WATER',
  'NOVIA',
  'BOUEVARD',
  'SAMURAY',
  'SALMA',
  'BLANCARICIA',
  'SHIMER',
  'MANDALA',
  'BEE SWEET',
  'OCEAN SUN',
  'GOTCHA',
  'INGLESA',
  'COMBINADOS',
  'STD Y MOL',
] as const;

export type AromaFlowerVariety = typeof AROMA_FLOWER_VARIETIES[number];

export type ProductCaptureMode = 'lar_med_chi' | 'direct_total';

export interface AromaProduct {
  id: string;
  name: string;
  captureMode: ProductCaptureMode;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface DailyProductionRow {
  productId: string;
  productName: string;
  captureMode: ProductCaptureMode;
  lar: number;
  med: number;
  chi: number;
  total: number;
}

export interface DailyProductionEntry {
  id: string;
  productionDate: string; // YYYY-MM-DD
  employeeUserId: string;
  employeeUsername: string;
  employeeName: string;
  rows: DailyProductionRow[];
  totalLar: number;
  totalMed: number;
  totalChi: number;
  grandTotal: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DailySalesRow {
  productId: string;
  productName: string;
  captureMode: ProductCaptureMode;
  packagesSold: number;
  unitPrice: number;
  subtotal: number;
}

export interface DailySalesEntry {
  id: string;
  saleDate: string; // YYYY-MM-DD
  employeeUserId: string;
  employeeUsername: string;
  employeeName: string;
  channel: string;
  rows: DailySalesRow[];
  totalPackages: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ==================== EMPLEADOS & PAGOS / NÓMINA ====================

export interface PayrollEmployee {
  id: string;
  fullName: string;
  teamGroup: string; // ej. 'AARON', 'DAVID', 'INVERNADERO'
  jobTitle: string;
  phone: string;
  email: string;
  weeklySalary: number; // P/ SEMANAL (base 6 días)
  hasAttendanceBonus: boolean; // BONO/AyP automático si cumple 6 días
  defaultBonusAmount: number; // default $150.00
  loanBalance: number; // Saldo actual de préstamo pendiente
  hireDate: string; // YYYY-MM-DD
  terminationDate?: string; // Fecha de baja si active === false
  terminationReason?: string;
  active: boolean;
  linkedUserId?: string; // Vínculo opcional con app_users.id
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PayrollRates {
  fumigadaRate: number; // default 20
  cargadaRate: number; // configurable
  extraHourRate: number; // configurable
  destajoRate: number; // configurable
  defaultBonus: number; // default 150 (100 asistencia + 50 puntualidad)
  workDaysPerWeek: number; // default 6
  attendanceBonusPart?: number; // default 100
  punctualityBonusPart?: number; // default 50
  unjustifiedPenalty?: number; // default 150
  manyTardiesBonus?: number; // default 50 (configurable a 0 o 50 para >2 retardos)
}

export interface PayrollExtraWorkItem {
  id: string;
  concept: string;
  amount: number;
}

export interface PayrollWeekRow {
  employeeId: string;
  employeeName: string;
  teamGroup: string;
  daysWorked: number; // DIAS (base 6)
  tardiesCount?: number; // Retardos en la semana
  permissionsCount?: number; // Faltas con permiso previo (>=1 día de anticipación)
  manualBonusOverride?: boolean; // true si el admin ajustó manualmente el bono/penalización
  weeklySalary: number; // P/ SEMANAL
  weekPay: number; // SEMANA = (weeklySalary / 6) * daysWorked
  attendanceBonus: number; // BONO/AyP (+)
  attendanceDiscount?: number; // Penalización / Descuento por asistencia (-)
  fumigadasQty: number; // Tambos / aplicaciones realizadas
  fumigadasAmount: number;
  cargadasQty: number;
  cargadasAmount: number;
  extraHoursQty: number;
  extraHoursAmount: number;
  destajosQty: number;
  destajosAmount: number;
  extraWorkQty: number;
  extraWorkAmount: number; // TRABAJO EXTRA ($) = suma de extraWorkItems
  extraWorkDescription?: string; // Resumen textual de trabajos extras
  extraWorkItems?: PayrollExtraWorkItem[]; // Lista dinámica de trabajos extras (concepto + monto)
  commissionBonusAmount?: number; // Bonos de productividad, comisiones y pagos adicionales (+)
  commissionBonusNotes?: string; // Detalle de bonos/comisiones
  otherDeductions: number; // Otros descuentos (daños, vales, etc.)
  appliedAdjustmentIds?: string[]; // IDs de incidencias/ajustes sincronizados en esta nómina
  loanDate?: string; // Fecha del préstamo (YYYY-MM-DD)
  loanPreviousBalance: number; // Saldo anterior arrastrado
  loanAddedAmount?: number; // Préstamo nuevo otorgado esta semana
  loanPayment: number; // Abono / Pago de préstamo descontado en esta nómina
  loanRemainingBalance: number; // Saldo pendiente = max(0, loanPreviousBalance + loanAddedAmount - loanPayment)
  totalNetPay: number; // TOTAL neto a pagar
  paid: boolean;
  notes?: string;
}

export interface PayrollWeekEntry {
  id: string;
  weekLabel: string; // ej. '23 NOV - 29 NOV 2026'
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  teamGroup: string; // ej. 'AARON' o 'TODOS'
  rates: PayrollRates;
  rows: PayrollWeekRow[];
  totalWeekPay: number;
  totalBonus: number;
  totalAttendanceDiscounts?: number;
  totalFumigadas: number;
  totalCargadas: number;
  totalExtraHours: number;
  totalDestajos: number;
  totalExtraWork: number;
  totalCommissions?: number;
  totalOtherDeductions: number;
  totalNewLoans?: number;
  totalLoanPayments: number;
  totalLoanRemaining: number;
  grandTotalPay: number;
  status: 'borrador' | 'pagada';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type EmployeeLoanMovementType = 'prestamo' | 'abono' | 'descuento';

export interface EmployeeLoanMovement {
  id: string;
  employeeId: string;
  employeeName: string;
  movementDate: string; // YYYY-MM-DD
  movementType: EmployeeLoanMovementType;
  amount: number;
  balanceAfter: number;
  concept: string;
  payrollWeekId?: string; // Si fue descontado desde una nómina semanal
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type EmployeeAdjustmentType =
  | 'descuento_falta'
  | 'otro_descuento'
  | 'bono_productividad'
  | 'comision'
  | 'pago_adicional';

export type EmployeeAdjustmentDirection = 'suma' | 'resta';

export interface EmployeeAdjustment {
  id: string;
  employeeId: string;
  employeeName: string;
  adjustmentDate: string; // YYYY-MM-DD
  adjustmentType: EmployeeAdjustmentType;
  direction: EmployeeAdjustmentDirection;
  amount: number;
  concept: string;
  status: 'pendiente' | 'aplicado';
  appliedPayrollWeekId?: string;
  appliedWeekLabel?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type SupplierPaymentCategory =
  | 'agroquimicos'
  | 'fertilizantes'
  | 'empaques'
  | 'fletes_transporte'
  | 'servicios'
  | 'renta'
  | 'mantenimiento'
  | 'otros';

export type SupplierPaymentMethod = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta';
export type SupplierPaymentStatus = 'pagado' | 'pendiente' | 'parcial';

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  rfc?: string;
  category: SupplierPaymentCategory;
  bankInfo?: string;
  creditDays: number;
  creditLimit: number;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId?: string;
  paymentDate: string; // YYYY-MM-DD
  supplierName: string;
  category: SupplierPaymentCategory;
  concept: string;
  reference?: string; // Factura / folio
  amount: number;
  paidAmount: number;
  paymentMethod: SupplierPaymentMethod;
  status: SupplierPaymentStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ==================== VENTAS, PUNTOS DE VENTA, CARGAS, REMISIONES Y COBRANZA ====================

export interface SalesPoint {
  id: string;
  name: string; // ej. 'Central de Abastos CDMX', 'Mercado Puebla'
  city: string;
  address?: string;
  contactPhone?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SalesClient {
  id: string;
  name: string; // ej. 'Chema'
  phone: string;
  defaultSalesPointId?: string;
  defaultSalesPointName?: string;
  creditLimit: number;
  balance: number; // Saldo pendiente actual (Cuentas por Cobrar)
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TripExpenses {
  casetas: number;
  gasolina: number;
  pagoPiso: number;
  comida: number;
  extra: number;
  extraNotes?: string;
}

export interface TruckLoadOwnerShare {
  ownerName: string; // ej. 'Harold (Administrador)', 'David', 'Aaron'
  packages: number;
  expenseShare: number;
  grossSales: number;
  netPayout: number;
}

export interface TruckLoad {
  id: string;
  folio: string; // ej. 'CARGA-2026-001'
  loadDate: string; // YYYY-MM-DD
  salesPointId: string;
  salesPointName: string;
  driverUserId?: string;
  driverName: string; // ej. 'David'
  vehicleLabel?: string;
  rows: DailyProductionRow[]; // Misma tabla de variedades + LAR / MED / CHI
  ownerShares: TruckLoadOwnerShare[]; // Reparto de paquetes por dueño para prorrateo
  totalLar: number;
  totalMed: number;
  totalChi: number;
  totalPackages: number;
  expenses: TripExpenses;
  totalExpenses: number;
  costPerPackage: number; // totalExpenses / totalPackages
  status: 'en_ruta' | 'liquidada';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type RemissionPaymentMethod = 'contado' | 'credito' | 'deposito';
export type RemissionPaymentStatus = 'pagado' | 'pendiente' | 'parcial';

export interface RemissionNoteRow {
  productId: string;
  productName: string;
  captureMode?: ProductCaptureMode;
  lar: number;
  med: number;
  chi: number;
  totalPackages: number;
  colorNote?: string; // Color / calidad opcional
  unitPrice: number; // Precio libre/variable por producto
  subtotal: number;
}

export interface RemissionNote {
  id: string;
  folio: string; // ej. 'REM-2026-001'
  noteDate: string; // YYYY-MM-DD
  loadId?: string; // Si pertenece a una carga de camioneta (evita doble descuento de inventario)
  loadFolio?: string;
  salesPointId: string;
  salesPointName: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  sellerUserId?: string;
  sellerName: string; // Vendedor / Chofer que realizó la entrega
  ownerName?: string; // Dueño de la flor vendida (opcional para liquidación directa)
  rows: RemissionNoteRow[];
  totalPackages: number;
  totalAmount: number;
  paymentMethod: RemissionPaymentMethod;
  paymentStatus: RemissionPaymentStatus;
  paidAmount: number;
  balanceDue: number;
  deductsInventory: boolean; // true = venta directa sin carga previa; false = ya descontado en TruckLoad
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ClientPaymentType = 'abono' | 'pago_total';
export type ClientPaymentMethod = 'efectivo' | 'deposito' | 'transferencia';

export interface ClientPayment {
  id: string;
  clientId: string;
  clientName: string;
  remissionNoteId?: string;
  remissionFolio?: string;
  paymentDate: string; // YYYY-MM-DD
  paymentType: ClientPaymentType;
  paymentMethod: ClientPaymentMethod;
  amount: number;
  balanceAfter: number;
  reference?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ==================== COMPRAS, INSUMOS POR ÁREA Y APLICACIONES EN INVERNADEROS ====================

export type SupplyArea = 'invernadero' | 'empaque' | 'comida_trabajadores' | 'otros';

export interface SupplyItem {
  id: string;
  name: string; // ej. 'Consist Max'
  area: SupplyArea;
  areaCustom?: string;
  category: string; // ej. 'Fungicida', 'Fertilizante', 'Capuchones', 'Despensa'
  unit: string; // ej. 'L', 'kg', 'g', 'paq', 'pza'
  purpose: string; // Ficha: "¿Para qué sirve?"
  activeIngredient?: string;
  recommendedDose?: string; // ej. '100 ml / 200L'
  stock: number;
  minStock: number;
  unitCost: number;
  supplier?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SupplyPurchase {
  id: string;
  purchaseDate: string; // YYYY-MM-DD
  supplyItemId: string;
  supplyName: string;
  area: SupplyArea;
  supplierName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  paymentMethod?: string;
  invoiceRef?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type GreenhouseApplicationType = 'foliar' | 'fertilizacion' | 'drench' | 'otro';

export interface GreenhouseApplicationItem {
  lineNo: number; // 1..8+
  supplyItemId?: string;
  productName: string; // PRODUCTO
  dose: string; // DOSIS legible (ej. "300 ml", "2 kg")
  quantityUsed: number; // Cantidad numérica capturada en doseUnit
  doseUnit: string; // 'ml' | 'L' | 'g' | 'kg' | 'pza' | 'paq' | 'Lote'
  stockDeductedQty: number; // Cantidad equivalente en la unidad del inventario para descuento automático
  objective: string; // OBJETIVO (se auto-llena desde "¿Para qué sirve?", editable)
  unitCost: number; // Costo unitario de referencia del insumo
  cost: number; // COSTO de la línea ($ MXN)
}

export interface GreenhouseApplication {
  id: string;
  folio?: string; // ej. APL-2026-001
  applicationDate: string; // YYYY-MM-DD
  unitName?: string; // Santa Cruz | Saúl | Tlapizaco
  moduleName?: string; // Módulo 1 | Módulo 2 | Módulo 3
  greenhouseName: string; // ej. 'Santa Cruz — Módulo 1'
  applicationType: GreenhouseApplicationType;
  items?: GreenhouseApplicationItem[]; // Tabla 1..8 productos de la hoja
  supplyItemId: string; // Primer producto o resumen para compatibilidad
  supplyName: string;
  supplyPurpose: string; // Se jala automáticamente de SupplyItem.purpose
  quantityUsed: number;
  unit: string;
  unitCost?: number;
  totalCost: number;
  estimatedCost?: number;
  doseUsed?: string;
  drums200L?: number; // Tambos de 200L preparados
  applicatorName: string;
  notes?: string; // Observaciones
  createdAt: string;
  updatedAt?: string;
}

export type AromaFlowerModuleType =
  | 'fi_general'
  | 'produccion_aaron'
  | 'suma_paquetes'
  | 'resumen_variedades'
  | 'venta'
  | 'resumen_venta'
  | 'matriz_2026';

export interface VarietyQuantityRow {
  variedad: string;
  lar: number;
  med: number;
  chi: number;
  total: number;
}

export interface AromaFlowerSheetEntry {
  id: string;
  moduleType: AromaFlowerModuleType;
  date: string; // YYYY-MM-DD
  responsable: string;
  title: string;
  rows: VarietyQuantityRow[];
  totalLar: number;
  totalMed: number;
  totalChi: number;
  grandTotal: number;
  notes?: string;
  createdAt: string;
}

// Production Unit (Módulo / Invernadero)
export interface GreenhouseModule {
  id: string;
  code: string; // ej: M-01
  name: string;
  variety: string;
  areaM2: number;
  bedsCount: number;
  plantsCount: number;
  densityPerM2: number;
  plantingDate: string;
  expectedYieldStems: number;
  status: 'vegetativo' | 'floracion' | 'cosecha' | 'renovacion';
  irrigationSector: string;
  tenure: 'propiedad' | 'arrendamiento' | 'asociacion';
  location: string;
  coordinates?: string;
  supervisor: string;
}

// Cultural Tasks (Labores)
export interface CulturalTask {
  id: string;
  moduleId: string;
  moduleCode: string;
  taskType: 'tutoreo' | 'desahije' | 'desbotonado_pinch' | 'toque_hoja' | 'poda' | 'desmalezado' | 'manejo_cortinas' | 'limpieza';
  taskName: string;
  date: string;
  assignedTeam: string;
  scheduledBeds: number;
  executedBeds: number;
  status: 'pendiente' | 'en_progreso' | 'completado';
  notes?: string;
  hasPhotos?: boolean;
}

// Irrigation & Nutrition
export interface IrrigationLog {
  id: string;
  date: string;
  time: string;
  moduleId: string;
  moduleCode: string;
  sector: string;
  volumeM3: number;
  durationMinutes: number;
  phInput: number;
  phDrainage: number;
  ecInput: number; // Conductividad eléctrica dS/m
  ecDrainage: number;
  tensiometerCbar: number; // Tensión de humedad
  tankARecipe: string;
  tankBRecipe: string;
  operator: string;
  notes?: string;
}

// Phytosanitary / Sanidad
export interface PestMonitoring {
  id: string;
  date: string;
  moduleId: string;
  moduleCode: string;
  section: string;
  pestName: 'Araña Roja (Tetranychus)' | 'Trips (Frankliniella)' | 'Oídio / Cenicilla' | 'Botrytis' | 'Mosca Blanca' | 'Pulgón';
  severity: 'baja' | 'media' | 'alta' | 'critica';
  incidencePercent: number; // 0 - 100%
  status: 'vigilancia' | 'requiere_aplicacion' | 'tratada';
  notes: string;
}

export interface PhytosanitaryApplication {
  id: string;
  date: string;
  moduleId: string;
  moduleCode: string;
  targetPest: string;
  productName: string;
  activeIngredient: string;
  dosePer100L: string;
  waterVolumeLiters: number;
  treatedAreaM2: number;
  operator: string;
  safetyEquipment: string;
  reentryHours: number;
  costTotal: number;
  status: 'programada' | 'aplicada' | 'evaluada';
  efficacyPercent?: number;
}

// Harvest & Postharvest
export interface HarvestRecord {
  id: string;
  date: string;
  moduleId: string;
  moduleCode: string;
  variety: string;
  stemsCut: number;
  harvesterTeam: string;
  stemsGrade40cm: number;
  stemsGrade50cm: number;
  stemsGrade60cm: number;
  stemsGrade70cm: number;
  stemsGrade80cm: number;
  stemsWaste: number;
  wasteReason: string;
  packages25Stems: number; // paquetes comerciales de 25
  coldRoomCode: string;
  solutionTreatment: string;
  status: 'en_hidratacion' | 'en_camara_fria' | 'listo_empaque' | 'despachado';
}

// Inventory & Warehouse
export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: 'fertilizante' | 'fitosanitario' | 'empaque' | 'sustrato' | 'herramienta';
  unit: 'kg' | 'L' | 'piezas' | 'sacos' | 'rollos';
  stock: number;
  minStock: number;
  avgCost: number;
  lastLot: string;
  expirationDate: string;
  supplier: string;
  warehouseLocation: string;
}

// Asset / Infrastructure
export interface EquipmentAsset {
  id: string;
  code: string;
  name: string;
  type: 'maquinaria' | 'vehiculo' | 'sistema_riego' | 'camara_fria' | 'caldera' | 'herramienta_mayor';
  brandModel: string;
  acquisitionDate: string;
  value: number;
  lastMaintenance: string;
  nextMaintenance: string;
  status: 'operativo' | 'requiere_servicio' | 'en_taller';
}

// Personnel & HR
export interface Worker {
  id: string;
  code: string;
  name: string;
  role: string;
  team: string;
  dailyRate: number;
  phone: string;
  hireDate: string;
  active: boolean;
  attendanceToday: 'presente' | 'retardo' | 'falta' | 'permiso';
  stemsHarvestedWeek?: number;
  efficiencyRating: number; // 1-100
}

// Sales & Commercialization
export interface Customer {
  id: string;
  name: string;
  type: 'mayorista' | 'floreria' | 'distribuidor' | 'exportacion';
  channel: 'Central de Abasto' | 'Local' | 'Regional' | 'Exportación';
  contactPhone: string;
  email: string;
  city: string;
  creditDays: number;
  creditLimit: number;
  currentBalance: number;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  channel: string;
  variety: string;
  grade: string;
  packages25: number;
  totalStems: number;
  unitPricePerPackage: number;
  totalAmount: number;
  paymentType: 'contado' | 'credito';
  dueDate: string;
  status: 'pendiente' | 'empacado' | 'enviado' | 'entregado' | 'pagado';
  paidAmount: number;
}

// Financials & Directorship
export interface BankAccount {
  id: string;
  bankName: string;
  accountType: 'cheques' | 'debito' | 'efectivo_caja' | 'tarjeta_credito';
  accountNumber: string;
  balance: number;
  currency: string;
}

export interface FinancialMovement {
  id: string;
  date: string;
  type: 'ingreso' | 'egreso' | 'transferencia' | 'prestamo' | 'amortizacion';
  scope: 'empresarial' | 'personal'; // separación de gastos personales vs de negocio
  category: string;
  amount: number;
  description: string;
  bankAccountId: string;
  reconciled: boolean;
  moduleId?: string;
}

export interface ActiveLoan {
  id: string;
  institution: string;
  totalAmount: number;
  outstandingBalance: number;
  interestRateAnnual: number;
  monthlyPayment: number;
  termMonths: number;
  remainingMonths: number;
  collateral: string; // garantía
  nextDueDate: string;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userRole: UserRole;
  action: string;
  details: string;
}
