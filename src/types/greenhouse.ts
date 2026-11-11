export type UserRole =
  | 'director'
  | 'operaciones'
  | 'agronomo'
  | 'cosecha'
  | 'ventas'
  | 'sistema'
  | 'aroma_flowers';

export interface RoleConfig {
  id: UserRole;
  title: string;
  shortTitle: string;
  badge: string;
  color: string;
  iconName: string;
}

export const ROLES: RoleConfig[] = [
  {
    id: 'aroma_flowers',
    title: 'Aroma Flowers',
    shortTitle: 'Aroma Flowers',
    badge: 'Producción, Empaque y Ventas Excel',
    color: 'wine',
    iconName: 'PackageCheck',
  },
  {
    id: 'director',
    title: 'Director General / Gerente Propietario',
    shortTitle: 'Dirección General',
    badge: 'Administración y Alta Dirección',
    color: 'emerald',
    iconName: 'Building2',
  },
  {
    id: 'operaciones',
    title: 'Administrador / Jefe de Operaciones',
    shortTitle: 'Operaciones',
    badge: 'Gestión de Recursos y Producción',
    color: 'blue',
    iconName: 'Settings',
  },
  {
    id: 'agronomo',
    title: 'Ingeniero Agrónomo / Encargado de Riego y Sanidad',
    shortTitle: 'Agronomía & Sanidad',
    badge: 'Cultivo, Riego y Fitoprotección',
    color: 'teal',
    iconName: 'Sprout',
  },
  {
    id: 'cosecha',
    title: 'Jefe de Cosecha, Poscosecha y Empaque',
    shortTitle: 'Cosecha & Empaque',
    badge: 'Corte, Selección y Calidad',
    color: 'rose',
    iconName: 'Flower2',
  },
  {
    id: 'ventas',
    title: 'Encargado de Ventas y Comercialización',
    shortTitle: 'Comercialización',
    badge: 'Ventas, Clientes y Cobranza',
    color: 'amber',
    iconName: 'TrendingUp',
  },
  {
    id: 'sistema',
    title: 'Sistema / Soporte Técnico y Operadores en Campo',
    shortTitle: 'Sistema & Campo',
    badge: 'Operación Ágil y Tecnología',
    color: 'purple',
    iconName: 'Tablet',
  },
];

// Aroma Flowers Excel/CSV Module Types
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
  'SHIMER',
  'MANDALA',
  'BEE SWEET',
  'BOUEVARD',
  'COMBINADOS',
  'STD Y MOL',
] as const;

export type AromaFlowerVariety = typeof AROMA_FLOWER_VARIETIES[number];

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
