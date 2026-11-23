import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ActiveLoan,
  AppUser,
  AromaFlowerSheetEntry,
  AromaProduct,
  AuditLogEntry,
  BankAccount,
  CulturalTask,
  Customer,
  DailyProductionEntry,
  DailySalesEntry,
  EmployeeLoanMovement,
  EquipmentAsset,
  FinancialMovement,
  GreenhouseModule,
  HarvestRecord,
  InventoryItem,
  IrrigationLog,
  PayrollEmployee,
  PayrollWeekEntry,
  PestMonitoring,
  PhytosanitaryApplication,
  SalesOrder,
  SupplierPayment,
  UserRole,
  Worker,
  SalesPoint,
  SalesClient,
  TruckLoad,
  RemissionNote,
  ClientPayment,
  SupplyItem,
  SupplyPurchase,
  GreenhouseApplication,
} from '../types/greenhouse';

export const DEFAULT_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://syrchvrxkkwvwynvtzfq.supabase.co';

export const DEFAULT_SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_GMYRm7mp-8zk__CKFjmKEw_fMDuVbjw';

export type SupabaseSyncStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'missing_tables'
  | 'disconnected'
  | 'error';

export function normalizeSupabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

const clientCache = new Map<string, SupabaseClient>();

export function getSupabaseClient(url: string, key: string): SupabaseClient | null {
  const cleanUrl = normalizeSupabaseUrl(url);
  const cleanKey = key.trim();
  if (!cleanUrl || !cleanKey) return null;

  const cacheKey = `${cleanUrl}::${cleanKey}`;
  const existing = clientCache.get(cacheKey);
  if (existing) return existing;

  const client = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  clientCache.set(cacheKey, client);
  return client;
}

export interface SupabaseTestResult {
  ok: boolean;
  tablesReady: boolean;
  status: SupabaseSyncStatus;
  message: string;
}

export async function testSupabaseConnection(
  url: string,
  key: string
): Promise<SupabaseTestResult> {
  const client = getSupabaseClient(url, key);
  if (!client) {
    return {
      ok: false,
      tablesReady: false,
      status: 'disconnected',
      message: 'Falta ingresar la URL y la API Key de Supabase.',
    };
  }

  try {
    const checks = await Promise.all([
      client.from('app_users').select('id').limit(1),
      client.from('app_products').select('id').limit(1),
      client.from('daily_productions').select('id').limit(1),
      client.from('daily_sales').select('id').limit(1),
      client.from('payroll_employees').select('id').limit(1),
      client.from('payroll_weeks').select('id').limit(1),
      client.from('employee_loans').select('id').limit(1),
      client.from('supplier_payments').select('id').limit(1),
      client.from('sales_points').select('id').limit(1),
      client.from('sales_clients').select('id').limit(1),
      client.from('truck_loads').select('id').limit(1),
      client.from('remission_notes').select('id').limit(1),
      client.from('client_payments').select('id').limit(1),
      client.from('supply_items').select('id').limit(1),
      client.from('supply_purchases').select('id').limit(1),
      client.from('greenhouse_applications').select('id').limit(1),
    ]);
    const error = checks.find((c) => c.error)?.error;
    if (!error) {
      return {
        ok: true,
        tablesReady: true,
        status: 'connected',
        message:
          'Conexión exitosa y las 16 tablas activas de Aroma Flower están listas en Supabase.',
      };
    }

    if (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      error.message?.toLowerCase().includes('could not find the table')
    ) {
      return {
        ok: true,
        tablesReady: false,
        status: 'missing_tables',
        message:
          'Proyecto Supabase conectado, pero falta ejecutar el SQL actualizado (16 tablas activas) en Supabase → SQL Editor (botón Run).',
      };
    }

    return {
      ok: false,
      tablesReady: false,
      status: 'error',
      message: `Error de Supabase (${error.code || 'API'}): ${error.message}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      tablesReady: false,
      status: 'error',
      message: err?.message || 'No se pudo conectar con el servidor de Supabase.',
    };
  }
}

// ---------- Mappers (camelCase <-> snake_case) ----------

export const mapAromaSheetToDb = (s: AromaFlowerSheetEntry) => ({
  id: s.id,
  module_type: s.moduleType,
  sheet_date: s.date,
  responsable: s.responsable || '',
  title: s.title,
  rows: s.rows || [],
  total_lar: Number(s.totalLar || 0),
  total_med: Number(s.totalMed || 0),
  total_chi: Number(s.totalChi || 0),
  grand_total: Number(s.grandTotal || 0),
  notes: s.notes || null,
  created_at: s.createdAt || '',
});

export const mapAromaSheetFromDb = (r: any): AromaFlowerSheetEntry => ({
  id: String(r.id),
  moduleType: r.module_type,
  date: r.sheet_date || '',
  responsable: r.responsable || '',
  title: r.title || '',
  rows: Array.isArray(r.rows) ? r.rows : [],
  totalLar: Number(r.total_lar || 0),
  totalMed: Number(r.total_med || 0),
  totalChi: Number(r.total_chi || 0),
  grandTotal: Number(r.grand_total || 0),
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
});

export const mapModuleToDb = (m: GreenhouseModule) => ({
  id: m.id,
  code: m.code,
  name: m.name,
  variety: m.variety,
  area_m2: Number(m.areaM2 || 0),
  beds_count: Number(m.bedsCount || 0),
  plants_count: Number(m.plantsCount || 0),
  density_per_m2: Number(m.densityPerM2 || 0),
  planting_date: m.plantingDate || '',
  expected_yield_stems: Number(m.expectedYieldStems || 0),
  status: m.status,
  irrigation_sector: m.irrigationSector || '',
  tenure: m.tenure,
  location: m.location || '',
  coordinates: m.coordinates || null,
  supervisor: m.supervisor || '',
});

export const mapModuleFromDb = (r: any): GreenhouseModule => ({
  id: String(r.id),
  code: r.code || '',
  name: r.name || '',
  variety: r.variety || '',
  areaM2: Number(r.area_m2 || 0),
  bedsCount: Number(r.beds_count || 0),
  plantsCount: Number(r.plants_count || 0),
  densityPerM2: Number(r.density_per_m2 || 0),
  plantingDate: r.planting_date || '',
  expectedYieldStems: Number(r.expected_yield_stems || 0),
  status: r.status || 'vegetativo',
  irrigationSector: r.irrigation_sector || '',
  tenure: r.tenure || 'propiedad',
  location: r.location || '',
  coordinates: r.coordinates || undefined,
  supervisor: r.supervisor || '',
});

export const mapTaskToDb = (t: CulturalTask) => ({
  id: t.id,
  module_id: t.moduleId || '',
  module_code: t.moduleCode,
  task_type: t.taskType,
  task_name: t.taskName,
  task_date: t.date,
  assigned_team: t.assignedTeam || '',
  scheduled_beds: Number(t.scheduledBeds || 0),
  executed_beds: Number(t.executedBeds || 0),
  status: t.status,
  notes: t.notes || null,
  has_photos: Boolean(t.hasPhotos),
});

export const mapTaskFromDb = (r: any): CulturalTask => ({
  id: String(r.id),
  moduleId: r.module_id || '',
  moduleCode: r.module_code || '',
  taskType: r.task_type || 'tutoreo',
  taskName: r.task_name || '',
  date: r.task_date || '',
  assignedTeam: r.assigned_team || '',
  scheduledBeds: Number(r.scheduled_beds || 0),
  executedBeds: Number(r.executed_beds || 0),
  status: r.status || 'pendiente',
  notes: r.notes || undefined,
  hasPhotos: Boolean(r.has_photos),
});

export const mapIrrigationToDb = (i: IrrigationLog) => ({
  id: i.id,
  log_date: i.date,
  log_time: i.time,
  module_id: i.moduleId || '',
  module_code: i.moduleCode,
  sector: i.sector || '',
  volume_m3: Number(i.volumeM3 || 0),
  duration_minutes: Number(i.durationMinutes || 0),
  ph_input: Number(i.phInput || 0),
  ph_drainage: Number(i.phDrainage || 0),
  ec_input: Number(i.ecInput || 0),
  ec_drainage: Number(i.ecDrainage || 0),
  tensiometer_cbar: Number(i.tensiometerCbar || 0),
  tank_a_recipe: i.tankARecipe || '',
  tank_b_recipe: i.tankBRecipe || '',
  operator: i.operator || '',
  notes: i.notes || null,
});

export const mapIrrigationFromDb = (r: any): IrrigationLog => ({
  id: String(r.id),
  date: r.log_date || '',
  time: r.log_time || '',
  moduleId: r.module_id || '',
  moduleCode: r.module_code || '',
  sector: r.sector || '',
  volumeM3: Number(r.volume_m3 || 0),
  durationMinutes: Number(r.duration_minutes || 0),
  phInput: Number(r.ph_input || 0),
  phDrainage: Number(r.ph_drainage || 0),
  ecInput: Number(r.ec_input || 0),
  ecDrainage: Number(r.ec_drainage || 0),
  tensiometerCbar: Number(r.tensiometer_cbar || 0),
  tankARecipe: r.tank_a_recipe || '',
  tankBRecipe: r.tank_b_recipe || '',
  operator: r.operator || '',
  notes: r.notes || undefined,
});

export const mapPestToDb = (p: PestMonitoring) => ({
  id: p.id,
  monitoring_date: p.date,
  module_id: p.moduleId || '',
  module_code: p.moduleCode,
  section: p.section || '',
  pest_name: p.pestName,
  severity: p.severity,
  incidence_percent: Number(p.incidencePercent || 0),
  status: p.status,
  notes: p.notes || '',
});

export const mapPestFromDb = (r: any): PestMonitoring => ({
  id: String(r.id),
  date: r.monitoring_date || '',
  moduleId: r.module_id || '',
  moduleCode: r.module_code || '',
  section: r.section || '',
  pestName: r.pest_name,
  severity: r.severity || 'baja',
  incidencePercent: Number(r.incidence_percent || 0),
  status: r.status || 'vigilancia',
  notes: r.notes || '',
});

export const mapApplicationToDb = (a: PhytosanitaryApplication) => ({
  id: a.id,
  application_date: a.date,
  module_id: a.moduleId || '',
  module_code: a.moduleCode,
  target_pest: a.targetPest,
  product_name: a.productName,
  active_ingredient: a.activeIngredient || '',
  dose_per_100l: a.dosePer100L || '',
  water_volume_liters: Number(a.waterVolumeLiters || 0),
  treated_area_m2: Number(a.treatedAreaM2 || 0),
  operator: a.operator || '',
  safety_equipment: a.safetyEquipment || '',
  reentry_hours: Number(a.reentryHours || 24),
  cost_total: Number(a.costTotal || 0),
  status: a.status,
  efficacy_percent: a.efficacyPercent ?? null,
});

export const mapApplicationFromDb = (r: any): PhytosanitaryApplication => ({
  id: String(r.id),
  date: r.application_date || '',
  moduleId: r.module_id || '',
  moduleCode: r.module_code || '',
  targetPest: r.target_pest || '',
  productName: r.product_name || '',
  activeIngredient: r.active_ingredient || '',
  dosePer100L: r.dose_per_100l || '',
  waterVolumeLiters: Number(r.water_volume_liters || 0),
  treatedAreaM2: Number(r.treated_area_m2 || 0),
  operator: r.operator || '',
  safetyEquipment: r.safety_equipment || '',
  reentryHours: Number(r.reentry_hours || 24),
  costTotal: Number(r.cost_total || 0),
  status: r.status || 'programada',
  efficacyPercent: r.efficacy_percent !== null && r.efficacy_percent !== undefined ? Number(r.efficacy_percent) : undefined,
});

export const mapHarvestToDb = (h: HarvestRecord) => ({
  id: h.id,
  harvest_date: h.date,
  module_id: h.moduleId || '',
  module_code: h.moduleCode,
  variety: h.variety,
  stems_cut: Number(h.stemsCut || 0),
  harvester_team: h.harvesterTeam || '',
  stems_grade_40cm: Number(h.stemsGrade40cm || 0),
  stems_grade_50cm: Number(h.stemsGrade50cm || 0),
  stems_grade_60cm: Number(h.stemsGrade60cm || 0),
  stems_grade_70cm: Number(h.stemsGrade70cm || 0),
  stems_grade_80cm: Number(h.stemsGrade80cm || 0),
  stems_waste: Number(h.stemsWaste || 0),
  waste_reason: h.wasteReason || '',
  packages_25_stems: Number(h.packages25Stems || 0),
  cold_room_code: h.coldRoomCode || '',
  solution_treatment: h.solutionTreatment || '',
  status: h.status,
});

export const mapHarvestFromDb = (r: any): HarvestRecord => ({
  id: String(r.id),
  date: r.harvest_date || '',
  moduleId: r.module_id || '',
  moduleCode: r.module_code || '',
  variety: r.variety || '',
  stemsCut: Number(r.stems_cut || 0),
  harvesterTeam: r.harvester_team || '',
  stemsGrade40cm: Number(r.stems_grade_40cm || 0),
  stemsGrade50cm: Number(r.stems_grade_50cm || 0),
  stemsGrade60cm: Number(r.stems_grade_60cm || 0),
  stemsGrade70cm: Number(r.stems_grade_70cm || 0),
  stemsGrade80cm: Number(r.stems_grade_80cm || 0),
  stemsWaste: Number(r.stems_waste || 0),
  wasteReason: r.waste_reason || '',
  packages25Stems: Number(r.packages_25_stems || 0),
  coldRoomCode: r.cold_room_code || '',
  solutionTreatment: r.solution_treatment || '',
  status: r.status || 'en_camara_fria',
});

export const mapInventoryToDb = (i: InventoryItem) => ({
  id: i.id,
  code: i.code,
  name: i.name,
  category: i.category,
  unit: i.unit,
  stock: Number(i.stock || 0),
  min_stock: Number(i.minStock || 0),
  avg_cost: Number(i.avgCost || 0),
  last_lot: i.lastLot || '',
  expiration_date: i.expirationDate || '',
  supplier: i.supplier || '',
  warehouse_location: i.warehouseLocation || '',
});

export const mapInventoryFromDb = (r: any): InventoryItem => ({
  id: String(r.id),
  code: r.code || '',
  name: r.name || '',
  category: r.category || 'fertilizante',
  unit: r.unit || 'kg',
  stock: Number(r.stock || 0),
  minStock: Number(r.min_stock || 0),
  avgCost: Number(r.avg_cost || 0),
  lastLot: r.last_lot || '',
  expirationDate: r.expiration_date || '',
  supplier: r.supplier || '',
  warehouseLocation: r.warehouse_location || '',
});

export const mapEquipmentToDb = (e: EquipmentAsset) => ({
  id: e.id,
  code: e.code,
  name: e.name,
  type: e.type,
  brand_model: e.brandModel || '',
  acquisition_date: e.acquisitionDate || '',
  value: Number(e.value || 0),
  last_maintenance: e.lastMaintenance || '',
  next_maintenance: e.nextMaintenance || '',
  status: e.status,
});

export const mapEquipmentFromDb = (r: any): EquipmentAsset => ({
  id: String(r.id),
  code: r.code || '',
  name: r.name || '',
  type: r.type || 'maquinaria',
  brandModel: r.brand_model || '',
  acquisitionDate: r.acquisition_date || '',
  value: Number(r.value || 0),
  lastMaintenance: r.last_maintenance || '',
  nextMaintenance: r.next_maintenance || '',
  status: r.status || 'operativo',
});

export const mapWorkerToDb = (w: Worker) => ({
  id: w.id,
  code: w.code,
  name: w.name,
  role: w.role,
  team: w.team || '',
  daily_rate: Number(w.dailyRate || 0),
  phone: w.phone || '',
  hire_date: w.hireDate || '',
  active: Boolean(w.active),
  attendance_today: w.attendanceToday,
  stems_harvested_week: Number(w.stemsHarvestedWeek || 0),
  efficiency_rating: Number(w.efficiencyRating || 100),
});

export const mapWorkerFromDb = (r: any): Worker => ({
  id: String(r.id),
  code: r.code || '',
  name: r.name || '',
  role: r.role || '',
  team: r.team || '',
  dailyRate: Number(r.daily_rate || 0),
  phone: r.phone || '',
  hireDate: r.hire_date || '',
  active: r.active !== false,
  attendanceToday: r.attendance_today || 'presente',
  stemsHarvestedWeek: Number(r.stems_harvested_week || 0),
  efficiencyRating: Number(r.efficiency_rating || 100),
});

export const mapCustomerToDb = (c: Customer) => ({
  id: c.id,
  name: c.name,
  type: c.type,
  channel: c.channel,
  contact_phone: c.contactPhone || '',
  email: c.email || '',
  city: c.city || '',
  credit_days: Number(c.creditDays || 0),
  credit_limit: Number(c.creditLimit || 0),
  current_balance: Number(c.currentBalance || 0),
});

export const mapCustomerFromDb = (r: any): Customer => ({
  id: String(r.id),
  name: r.name || '',
  type: r.type || 'mayorista',
  channel: r.channel || 'Local',
  contactPhone: r.contact_phone || '',
  email: r.email || '',
  city: r.city || '',
  creditDays: Number(r.credit_days || 0),
  creditLimit: Number(r.credit_limit || 0),
  currentBalance: Number(r.current_balance || 0),
});

export const mapOrderToDb = (o: SalesOrder) => ({
  id: o.id,
  order_number: o.orderNumber,
  order_date: o.date,
  customer_id: o.customerId || '',
  customer_name: o.customerName,
  channel: o.channel || '',
  variety: o.variety || '',
  grade: o.grade || '',
  packages_25: Number(o.packages25 || 0),
  total_stems: Number(o.totalStems || 0),
  unit_price: Number(o.unitPricePerPackage || 0),
  total_amount: Number(o.totalAmount || 0),
  payment_type: o.paymentType,
  due_date: o.dueDate || '',
  status: o.status,
  paid_amount: Number(o.paidAmount || 0),
});

export const mapOrderFromDb = (r: any): SalesOrder => ({
  id: String(r.id),
  orderNumber: r.order_number || '',
  date: r.order_date || '',
  customerId: r.customer_id || '',
  customerName: r.customer_name || '',
  channel: r.channel || '',
  variety: r.variety || '',
  grade: r.grade || '',
  packages25: Number(r.packages_25 || 0),
  totalStems: Number(r.total_stems || 0),
  unitPricePerPackage: Number(r.unit_price || 0),
  totalAmount: Number(r.total_amount || 0),
  paymentType: r.payment_type || 'contado',
  dueDate: r.due_date || '',
  status: r.status || 'pendiente',
  paidAmount: Number(r.paid_amount || 0),
});

export const mapAccountToDb = (b: BankAccount) => ({
  id: b.id,
  bank_name: b.bankName,
  account_type: b.accountType,
  account_number: b.accountNumber || '',
  balance: Number(b.balance || 0),
  currency: b.currency || 'MXN',
});

export const mapAccountFromDb = (r: any): BankAccount => ({
  id: String(r.id),
  bankName: r.bank_name || '',
  accountType: r.account_type || 'cheques',
  accountNumber: r.account_number || '',
  balance: Number(r.balance || 0),
  currency: r.currency || 'MXN',
});

export const mapMovementToDb = (m: FinancialMovement) => ({
  id: m.id,
  movement_date: m.date,
  movement_type: m.type,
  scope: m.scope,
  category: m.category,
  amount: Number(m.amount || 0),
  description: m.description || '',
  bank_account_id: m.bankAccountId || '',
  reconciled: Boolean(m.reconciled),
  module_id: m.moduleId || null,
});

export const mapMovementFromDb = (r: any): FinancialMovement => ({
  id: String(r.id),
  date: r.movement_date || '',
  type: r.movement_type || 'egreso',
  scope: r.scope || 'empresarial',
  category: r.category || '',
  amount: Number(r.amount || 0),
  description: r.description || '',
  bankAccountId: r.bank_account_id || '',
  reconciled: Boolean(r.reconciled),
  moduleId: r.module_id || undefined,
});

export const mapLoanToDb = (l: ActiveLoan) => ({
  id: l.id,
  institution: l.institution,
  total_amount: Number(l.totalAmount || 0),
  outstanding_balance: Number(l.outstandingBalance || 0),
  interest_rate_annual: Number(l.interestRateAnnual || 0),
  monthly_payment: Number(l.monthlyPayment || 0),
  term_months: Number(l.termMonths || 0),
  remaining_months: Number(l.remainingMonths || 0),
  collateral: l.collateral || '',
  next_due_date: l.nextDueDate || '',
});

export const mapLoanFromDb = (r: any): ActiveLoan => ({
  id: String(r.id),
  institution: r.institution || '',
  totalAmount: Number(r.total_amount || 0),
  outstandingBalance: Number(r.outstanding_balance || 0),
  interestRateAnnual: Number(r.interest_rate_annual || 0),
  monthlyPayment: Number(r.monthly_payment || 0),
  termMonths: Number(r.term_months || 0),
  remainingMonths: Number(r.remaining_months || 0),
  collateral: r.collateral || '',
  nextDueDate: r.next_due_date || '',
});

export const mapAuditToDb = (a: AuditLogEntry) => ({
  id: a.id,
  log_timestamp: a.timestamp,
  user_role: a.userRole,
  action: a.action,
  details: a.details || '',
});

export const mapAuditFromDb = (r: any): AuditLogEntry => ({
  id: String(r.id),
  timestamp: r.log_timestamp || '',
  userRole: (r.user_role || 'sistema') as UserRole,
  action: r.action || '',
  details: r.details || '',
});

export const mapAppUserToDb = (u: AppUser) => ({
  id: u.id,
  full_name: u.fullName,
  username: u.username,
  password: u.password,
  role: u.role,
  avatar_url: u.avatarUrl || null,
  email: u.email || '',
  phone: u.phone || '',
  job_title: u.jobTitle || '',
  department: u.department || '',
  notes: u.notes || '',
  active: u.active !== false,
  created_at: u.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapAppUserFromDb = (r: any): AppUser => ({
  id: String(r.id),
  fullName: r.full_name || '',
  username: r.username || '',
  password: r.password || '',
  role: r.role === 'admin' ? 'admin' : 'produccion',
  avatarUrl: r.avatar_url || undefined,
  email: r.email || '',
  phone: r.phone || '',
  jobTitle: r.job_title || '',
  department: r.department || '',
  notes: r.notes || '',
  active: r.active !== false,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapAromaProductToDb = (p: AromaProduct) => ({
  id: p.id,
  name: p.name,
  capture_mode: p.captureMode,
  sort_order: Number(p.sortOrder || 0),
  active: p.active !== false,
  created_at: p.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapAromaProductFromDb = (r: any): AromaProduct => ({
  id: String(r.id),
  name: r.name || '',
  captureMode: r.capture_mode === 'direct_total' ? 'direct_total' : 'lar_med_chi',
  sortOrder: Number(r.sort_order || 0),
  active: r.active !== false,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapDailyProductionToDb = (d: DailyProductionEntry) => ({
  id: d.id,
  production_date: d.productionDate,
  employee_user_id: d.employeeUserId,
  employee_username: d.employeeUsername,
  employee_name: d.employeeName,
  rows: d.rows || [],
  total_lar: Number(d.totalLar || 0),
  total_med: Number(d.totalMed || 0),
  total_chi: Number(d.totalChi || 0),
  grand_total: Number(d.grandTotal || 0),
  notes: d.notes || null,
  created_at: d.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapDailyProductionFromDb = (r: any): DailyProductionEntry => ({
  id: String(r.id),
  productionDate: r.production_date || '',
  employeeUserId: r.employee_user_id || '',
  employeeUsername: r.employee_username || '',
  employeeName: r.employee_name || '',
  rows: Array.isArray(r.rows) ? r.rows : [],
  totalLar: Number(r.total_lar || 0),
  totalMed: Number(r.total_med || 0),
  totalChi: Number(r.total_chi || 0),
  grandTotal: Number(r.grand_total || 0),
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapDailySaleToDb = (s: DailySalesEntry) => ({
  id: s.id,
  sale_date: s.saleDate,
  employee_user_id: s.employeeUserId,
  employee_username: s.employeeUsername,
  employee_name: s.employeeName,
  channel: s.channel || 'CEDA CDMX',
  rows: s.rows || [],
  total_packages: Number(s.totalPackages || 0),
  total_amount: Number(s.totalAmount || 0),
  notes: s.notes || null,
  created_at: s.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapDailySaleFromDb = (r: any): DailySalesEntry => ({
  id: String(r.id),
  saleDate: r.sale_date || '',
  employeeUserId: r.employee_user_id || '',
  employeeUsername: r.employee_username || '',
  employeeName: r.employee_name || '',
  channel: r.channel || 'CEDA CDMX',
  rows: Array.isArray(r.rows) ? r.rows : [],
  totalPackages: Number(r.total_packages || 0),
  totalAmount: Number(r.total_amount || 0),
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapPayrollEmployeeToDb = (e: PayrollEmployee) => ({
  id: e.id,
  full_name: e.fullName,
  team_group: e.teamGroup || 'AARON',
  job_title: e.jobTitle || '',
  phone: e.phone || '',
  email: e.email || '',
  weekly_salary: Number(e.weeklySalary || 0),
  has_attendance_bonus: Boolean(e.hasAttendanceBonus),
  default_bonus_amount: Number(e.defaultBonusAmount || 150),
  loan_balance: Number(e.loanBalance || 0),
  hire_date: e.hireDate || '',
  termination_date: e.terminationDate || null,
  termination_reason: e.terminationReason || null,
  active: e.active !== false,
  linked_user_id: e.linkedUserId || null,
  notes: e.notes || '',
  created_at: e.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapPayrollEmployeeFromDb = (r: any): PayrollEmployee => ({
  id: String(r.id),
  fullName: r.full_name || '',
  teamGroup: r.team_group || 'AARON',
  jobTitle: r.job_title || '',
  phone: r.phone || '',
  email: r.email || '',
  weeklySalary: Number(r.weekly_salary || 0),
  hasAttendanceBonus: Boolean(r.has_attendance_bonus),
  defaultBonusAmount: Number(r.default_bonus_amount ?? 150),
  loanBalance: Number(r.loan_balance || 0),
  hireDate: r.hire_date || '',
  terminationDate: r.termination_date || undefined,
  terminationReason: r.termination_reason || undefined,
  active: r.active !== false,
  linkedUserId: r.linked_user_id || undefined,
  notes: r.notes || '',
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapPayrollWeekToDb = (w: PayrollWeekEntry) => ({
  id: w.id,
  week_label: w.weekLabel,
  start_date: w.startDate,
  end_date: w.endDate,
  team_group: w.teamGroup || 'AARON',
  rates: w.rates || {
    fumigadaRate: 20,
    cargadaRate: 0,
    extraHourRate: 0,
    destajoRate: 0,
    defaultBonus: 150,
    workDaysPerWeek: 6,
  },
  rows: w.rows || [],
  total_week_pay: Number(w.totalWeekPay || 0),
  total_bonus: Number(w.totalBonus || 0),
  total_fumigadas: Number(w.totalFumigadas || 0),
  total_cargadas: Number(w.totalCargadas || 0),
  total_extra_hours: Number(w.totalExtraHours || 0),
  total_destajos: Number(w.totalDestajos || 0),
  total_extra_work: Number(w.totalExtraWork || 0),
  total_other_deductions: Number(w.totalOtherDeductions || 0),
  total_loan_payments: Number(w.totalLoanPayments || 0),
  total_loan_remaining: Number(w.totalLoanRemaining || 0),
  grand_total_pay: Number(w.grandTotalPay || 0),
  status: w.status || 'borrador',
  notes: w.notes || null,
  created_at: w.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapPayrollWeekFromDb = (r: any): PayrollWeekEntry => ({
  id: String(r.id),
  weekLabel: r.week_label || '',
  startDate: r.start_date || '',
  endDate: r.end_date || '',
  teamGroup: r.team_group || 'AARON',
  rates: r.rates || {
    fumigadaRate: 20,
    cargadaRate: 0,
    extraHourRate: 0,
    destajoRate: 0,
    defaultBonus: 150,
    workDaysPerWeek: 6,
  },
  rows: Array.isArray(r.rows) ? r.rows : [],
  totalWeekPay: Number(r.total_week_pay || 0),
  totalBonus: Number(r.total_bonus || 0),
  totalFumigadas: Number(r.total_fumigadas || 0),
  totalCargadas: Number(r.total_cargadas || 0),
  totalExtraHours: Number(r.total_extra_hours || 0),
  totalDestajos: Number(r.total_destajos || 0),
  totalExtraWork: Number(r.total_extra_work || 0),
  totalOtherDeductions: Number(r.total_other_deductions || 0),
  totalLoanPayments: Number(r.total_loan_payments || 0),
  totalLoanRemaining: Number(r.total_loan_remaining || 0),
  grandTotalPay: Number(r.grand_total_pay || 0),
  status: r.status === 'pagada' ? 'pagada' : 'borrador',
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapEmployeeLoanToDb = (l: EmployeeLoanMovement) => ({
  id: l.id,
  employee_id: l.employeeId,
  employee_name: l.employeeName,
  movement_date: l.movementDate,
  movement_type: l.movementType,
  amount: Number(l.amount || 0),
  balance_after: Number(l.balanceAfter || 0),
  concept: l.concept || '',
  payroll_week_id: l.payrollWeekId || null,
  notes: l.notes || null,
  created_at: l.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapEmployeeLoanFromDb = (r: any): EmployeeLoanMovement => ({
  id: String(r.id),
  employeeId: r.employee_id || '',
  employeeName: r.employee_name || '',
  movementDate: r.movement_date || '',
  movementType:
    r.movement_type === 'abono' || r.movement_type === 'descuento'
      ? r.movement_type
      : 'prestamo',
  amount: Number(r.amount || 0),
  balanceAfter: Number(r.balance_after || 0),
  concept: r.concept || '',
  payrollWeekId: r.payroll_week_id || undefined,
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapSupplierPaymentToDb = (s: SupplierPayment) => ({
  id: s.id,
  payment_date: s.paymentDate,
  supplier_name: s.supplierName,
  category: s.category || 'otros',
  concept: s.concept || '',
  reference: s.reference || '',
  amount: Number(s.amount || 0),
  paid_amount: Number(s.paidAmount || 0),
  payment_method: s.paymentMethod || 'efectivo',
  status: s.status || 'pagado',
  notes: s.notes || null,
  created_at: s.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapSupplierPaymentFromDb = (r: any): SupplierPayment => ({
  id: String(r.id),
  paymentDate: r.payment_date || '',
  supplierName: r.supplier_name || '',
  category: r.category || 'otros',
  concept: r.concept || '',
  reference: r.reference || '',
  amount: Number(r.amount || 0),
  paidAmount: Number(r.paid_amount || 0),
  paymentMethod: r.payment_method || 'efectivo',
  status: r.status === 'pendiente' || r.status === 'parcial' ? r.status : 'pagado',
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapSalesPointToDb = (p: SalesPoint) => ({
  id: p.id,
  name: p.name,
  city: p.city || '',
  address: p.address || '',
  contact_phone: p.contactPhone || '',
  notes: p.notes || '',
  active: p.active !== false,
  created_at: p.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapSalesPointFromDb = (r: any): SalesPoint => ({
  id: String(r.id),
  name: r.name || '',
  city: r.city || '',
  address: r.address || '',
  contactPhone: r.contact_phone || r.contact || '',
  notes: r.notes || '',
  active: r.active !== false,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapSalesClientToDb = (c: SalesClient) => ({
  id: c.id,
  name: c.name,
  phone: c.phone || '',
  default_sales_point_id: c.defaultSalesPointId || '',
  default_sales_point_name: c.defaultSalesPointName || '',
  credit_limit: Number(c.creditLimit || 0),
  balance: Number(c.balance || 0),
  notes: c.notes || '',
  active: c.active !== false,
  created_at: c.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapSalesClientFromDb = (r: any): SalesClient => ({
  id: String(r.id),
  name: r.name || '',
  phone: r.phone || '',
  defaultSalesPointId: r.default_sales_point_id || r.sales_point_id || '',
  defaultSalesPointName: r.default_sales_point_name || r.sales_point_name || '',
  creditLimit: Number(r.credit_limit || 0),
  balance: Number(r.balance || 0),
  notes: r.notes || '',
  active: r.active !== false,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapTruckLoadToDb = (l: TruckLoad) => ({
  id: l.id,
  folio: l.folio,
  load_date: l.loadDate,
  sales_point_id: l.salesPointId,
  sales_point_name: l.salesPointName,
  driver_user_id: l.driverUserId || '',
  driver_name: l.driverName,
  vehicle_label: l.vehicleLabel || '',
  rows: l.rows || [],
  owner_shares: l.ownerShares || [],
  total_lar: Number(l.totalLar || 0),
  total_med: Number(l.totalMed || 0),
  total_chi: Number(l.totalChi || 0),
  total_packages: Number(l.totalPackages || 0),
  expenses: l.expenses || {
    casetas: 0,
    gasolina: 0,
    pagoPiso: 0,
    comida: 0,
    extra: 0,
    extraNotes: '',
  },
  total_expenses: Number(l.totalExpenses || 0),
  cost_per_package: Number(l.costPerPackage || 0),
  status: l.status === 'liquidada' ? 'liquidada' : 'en_ruta',
  notes: l.notes || '',
  created_at: l.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapTruckLoadFromDb = (r: any): TruckLoad => {
  const exp = r.expenses || {};
  const normalizedExp = {
    casetas: Number(exp.casetas || 0),
    gasolina: Number(exp.gasolina || 0),
    pagoPiso: Number(exp.pagoPiso || 0),
    comida: Number(exp.comida || 0),
    extra: Number(exp.extra ?? exp.gastosExtra ?? 0),
    extraNotes: exp.extraNotes || exp.gastosExtraNotes || '',
  };
  const totalExp = Number(
    r.total_expenses ??
      (normalizedExp.casetas +
        normalizedExp.gasolina +
        normalizedExp.pagoPiso +
        normalizedExp.comida +
        normalizedExp.extra)
  );
  return {
    id: String(r.id),
    folio: r.folio || '',
    loadDate: r.load_date || '',
    salesPointId: r.sales_point_id || '',
    salesPointName: r.sales_point_name || '',
    driverUserId: r.driver_user_id || '',
    driverName: r.driver_name || '',
    vehicleLabel: r.vehicle_label || r.vehicle || '',
    rows: Array.isArray(r.rows) ? r.rows : [],
    ownerShares: Array.isArray(r.owner_shares) ? r.owner_shares : [],
    totalLar: Number(r.total_lar || 0),
    totalMed: Number(r.total_med || 0),
    totalChi: Number(r.total_chi || 0),
    totalPackages: Number(r.total_packages || 0),
    expenses: normalizedExp,
    totalExpenses: totalExp,
    costPerPackage: Number(r.cost_per_package || 0),
    status: r.status === 'liquidada' ? 'liquidada' : 'en_ruta',
    notes: r.notes || undefined,
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || undefined,
  };
};

export const mapRemissionNoteToDb = (n: RemissionNote) => ({
  id: n.id,
  folio: n.folio,
  note_date: n.noteDate,
  load_id: n.loadId || '',
  load_folio: n.loadFolio || '',
  sales_point_id: n.salesPointId,
  sales_point_name: n.salesPointName,
  client_id: n.clientId,
  client_name: n.clientName,
  client_phone: n.clientPhone || '',
  seller_user_id: n.sellerUserId || '',
  seller_name: n.sellerName,
  owner_name: n.ownerName || 'Harold',
  rows: n.rows || [],
  total_packages: Number(n.totalPackages || 0),
  total_amount: Number(n.totalAmount || 0),
  payment_method: n.paymentMethod || 'contado',
  payment_status: n.paymentStatus || 'pagado',
  paid_amount: Number(n.paidAmount || 0),
  balance_due: Number(n.balanceDue || 0),
  deducts_inventory: Boolean(n.deductsInventory),
  notes: n.notes || '',
  created_at: n.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapRemissionNoteFromDb = (r: any): RemissionNote => ({
  id: String(r.id),
  folio: r.folio || '',
  noteDate: r.note_date || r.sale_date || '',
  loadId: r.load_id || undefined,
  loadFolio: r.load_folio || undefined,
  salesPointId: r.sales_point_id || '',
  salesPointName: r.sales_point_name || '',
  clientId: r.client_id || '',
  clientName: r.client_name || '',
  clientPhone: r.client_phone || '',
  sellerUserId: r.seller_user_id || undefined,
  sellerName: r.seller_name || r.driver_name || '',
  ownerName: r.owner_name || undefined,
  rows: Array.isArray(r.rows) ? r.rows : [],
  totalPackages: Number(r.total_packages || 0),
  totalAmount: Number(r.total_amount || 0),
  paymentMethod:
    r.payment_method === 'credito' || r.payment_method === 'deposito'
      ? r.payment_method
      : 'contado',
  paymentStatus:
    r.payment_status === 'pendiente' || r.payment_status === 'parcial'
      ? r.payment_status
      : 'pagado',
  paidAmount: Number(r.paid_amount || 0),
  balanceDue: Number(r.balance_due || 0),
  deductsInventory: Boolean(r.deducts_inventory),
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapClientPaymentToDb = (p: ClientPayment) => ({
  id: p.id,
  client_id: p.clientId,
  client_name: p.clientName,
  remission_note_id: p.remissionNoteId || '',
  remission_folio: p.remissionFolio || '',
  payment_date: p.paymentDate,
  payment_type: p.paymentType || 'abono',
  payment_method: p.paymentMethod || 'efectivo',
  amount: Number(p.amount || 0),
  balance_after: Number(p.balanceAfter || 0),
  reference: p.reference || '',
  notes: p.notes || '',
  created_at: p.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapClientPaymentFromDb = (r: any): ClientPayment => ({
  id: String(r.id),
  clientId: r.client_id || '',
  clientName: r.client_name || '',
  remissionNoteId: r.remission_note_id || r.remission_id || undefined,
  remissionFolio: r.remission_folio || undefined,
  paymentDate: r.payment_date || '',
  paymentType: r.payment_type === 'pago_total' ? 'pago_total' : 'abono',
  paymentMethod:
    r.payment_method === 'deposito' || r.payment_method === 'transferencia'
      ? r.payment_method
      : 'efectivo',
  amount: Number(r.amount || 0),
  balanceAfter: Number(r.balance_after || 0),
  reference: r.reference || '',
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

const normalizeArea = (raw: any): SupplyItem['area'] => {
  if (raw === 'empaque') return 'empaque';
  if (raw === 'comida_trabajadores' || raw === 'comida') return 'comida_trabajadores';
  if (raw === 'otros') return 'otros';
  return 'invernadero';
};

export const mapSupplyItemToDb = (s: SupplyItem) => ({
  id: s.id,
  name: s.name,
  area: s.area || 'invernadero',
  category: s.category || 'General',
  purpose: s.purpose || '',
  active_ingredient: s.activeIngredient || '',
  recommended_dose: s.recommendedDose || '',
  unit: s.unit || 'pza',
  stock: Number(s.stock || 0),
  min_stock: Number(s.minStock || 0),
  unit_cost: Number(s.unitCost || 0),
  supplier: s.supplier || '',
  active: s.active !== false,
  created_at: s.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapSupplyItemFromDb = (r: any): SupplyItem => ({
  id: String(r.id),
  name: r.name || '',
  area: normalizeArea(r.area),
  category: r.category || 'General',
  unit: r.unit || 'pza',
  purpose: r.purpose || '',
  activeIngredient: r.active_ingredient || '',
  recommendedDose: r.recommended_dose || '',
  stock: Number(r.stock || 0),
  minStock: Number(r.min_stock || 0),
  unitCost: Number(r.unit_cost || 0),
  supplier: r.supplier || '',
  active: r.active !== false,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapSupplyPurchaseToDb = (p: SupplyPurchase) => ({
  id: p.id,
  purchase_date: p.purchaseDate,
  supply_item_id: p.supplyItemId || '',
  supply_name: p.supplyName,
  area: p.area || 'invernadero',
  supplier_name: p.supplierName || '',
  quantity: Number(p.quantity || 0),
  unit: p.unit || 'pza',
  unit_cost: Number(p.unitCost || 0),
  total_cost: Number(p.totalCost || 0),
  payment_method: p.paymentMethod || 'efectivo',
  reference: p.invoiceRef || '',
  notes: p.notes || '',
  created_at: p.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapSupplyPurchaseFromDb = (r: any): SupplyPurchase => ({
  id: String(r.id),
  purchaseDate: r.purchase_date || '',
  supplyItemId: r.supply_item_id || r.supply_id || '',
  supplyName: r.supply_name || '',
  area: normalizeArea(r.area),
  supplierName: r.supplier_name || '',
  quantity: Number(r.quantity || 0),
  unit: r.unit || 'pza',
  unitCost: Number(r.unit_cost || 0),
  totalCost: Number(r.total_cost || 0),
  paymentMethod: r.payment_method || 'efectivo',
  invoiceRef: r.reference || r.invoice_ref || '',
  notes: r.notes || undefined,
  createdAt: r.created_at || '',
  updatedAt: r.updated_at || undefined,
});

export const mapGreenhouseAppToDb = (a: GreenhouseApplication) => ({
  id: a.id,
  application_date: a.applicationDate,
  greenhouse_name: a.greenhouseName,
  application_type: a.applicationType || 'foliar',
  supply_item_id: a.supplyItemId || '',
  supply_name: a.supplyName,
  supply_purpose: a.supplyPurpose || '',
  quantity_used: Number(a.quantityUsed || 0),
  unit: a.unit || 'L',
  tambos_200l: Number(a.drums200L || 0),
  applicator_name: a.applicatorName || '',
  estimated_cost: Number(a.totalCost || a.estimatedCost || 0),
  notes: a.notes || '',
  created_at: a.createdAt || '',
  updated_at: new Date().toISOString(),
});

export const mapGreenhouseAppFromDb = (r: any): GreenhouseApplication => {
  const cost = Number(r.estimated_cost ?? r.total_cost ?? 0);
  return {
    id: String(r.id),
    applicationDate: r.application_date || '',
    greenhouseName: r.greenhouse_name || '',
    applicationType:
      r.application_type === 'fertilizacion' ||
      r.application_type === 'drench' ||
      r.application_type === 'otro'
        ? r.application_type
        : 'foliar',
    supplyItemId: r.supply_item_id || r.supply_id || '',
    supplyName: r.supply_name || '',
    supplyPurpose: r.supply_purpose || '',
    quantityUsed: Number(r.quantity_used || 0),
    unit: r.unit || 'L',
    unitCost: Number(r.unit_cost || 0),
    totalCost: cost,
    estimatedCost: cost,
    doseUsed: r.dose_used || '',
    drums200L: Number(r.tambos_200l ?? r.drums_200l ?? 0),
    applicatorName: r.applicator_name || '',
    notes: r.notes || undefined,
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || undefined,
  };
};

export const mapGreenhouseApplicationToDb = mapGreenhouseAppToDb;
export const mapGreenhouseApplicationFromDb = mapGreenhouseAppFromDb;

// ---------- Sync Helpers ----------

export async function upsertRowsToSupabase(
  client: SupabaseClient,
  table: string,
  rows: Record<string, any>[]
): Promise<{ ok: boolean; missingTable?: boolean; error?: string }> {
  if (rows.length === 0) return { ok: true };
  const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
  if (!error) return { ok: true };

  if (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.message?.toLowerCase().includes('could not find the table')
  ) {
    return { ok: false, missingTable: true, error: error.message };
  }

  // Fallback for batch sync if unique secondary key differs by id
  if (error.code === '23505' && (table === 'app_users' || table === 'app_products')) {
    for (const row of rows) {
      const singleRes = await upsertSingleRecordToSupabase(client, table, row);
      if (!singleRes.ok) return singleRes;
    }
    return { ok: true };
  }

  return { ok: false, error: error.message };
}

export async function upsertSingleRecordToSupabase(
  client: SupabaseClient,
  table: string,
  payload: Record<string, any>
): Promise<{
  ok: boolean;
  missingTable?: boolean;
  error?: string;
  savedRow?: Record<string, any>;
}> {
  const { data, error } = await client
    .from(table)
    .upsert(payload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (!error) {
    return { ok: true, savedRow: data || payload };
  }

  if (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.message?.toLowerCase().includes('could not find the table')
  ) {
    return { ok: false, missingTable: true, error: error.message };
  }

  // Handle unique constraint collision on username/name if DB row had a different id
  if (error.code === '23505') {
    if (table === 'app_users' && payload.username) {
      const { data: existing } = await client
        .from('app_users')
        .select('id')
        .ilike('username', payload.username)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        const { id: _ignoreId, ...rest } = payload;
        const { data: updatedRow, error: updErr } = await client
          .from('app_users')
          .update(rest)
          .eq('id', existing.id)
          .select()
          .maybeSingle();
        if (!updErr) return { ok: true, savedRow: updatedRow || { ...payload, id: existing.id } };
        return { ok: false, error: updErr.message };
      }
    }
    if (table === 'app_products' && payload.name) {
      const { data: existing } = await client
        .from('app_products')
        .select('id')
        .ilike('name', payload.name)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        const { id: _ignoreId, ...rest } = payload;
        const { data: updatedRow, error: updErr } = await client
          .from('app_products')
          .update(rest)
          .eq('id', existing.id)
          .select()
          .maybeSingle();
        if (!updErr) return { ok: true, savedRow: updatedRow || { ...payload, id: existing.id } };
        return { ok: false, error: updErr.message };
      }
    }
  }

  return { ok: false, error: `${error.code ? `[${error.code}] ` : ''}${error.message}` };
}

export async function deleteRowFromSupabase(
  client: SupabaseClient,
  table: string,
  id: string
): Promise<{ ok: boolean; missingTable?: boolean; error?: string }> {
  const { error } = await client.from(table).delete().eq('id', id);
  if (!error) return { ok: true };
  if (error.code === 'PGRST205' || error.code === '42P01') {
    return { ok: false, missingTable: true, error: error.message };
  }
  return { ok: false, error: error.message };
}

export interface RemoteSnapshot {
  status: SupabaseSyncStatus;
  aromaSheets?: AromaFlowerSheetEntry[];
  appUsers?: AppUser[];
  aromaProducts?: AromaProduct[];
  dailyProductions?: DailyProductionEntry[];
  dailySales?: DailySalesEntry[];
  payrollEmployees?: PayrollEmployee[];
  payrollWeeks?: PayrollWeekEntry[];
  employeeLoans?: EmployeeLoanMovement[];
  supplierPayments?: SupplierPayment[];
  salesPoints?: SalesPoint[];
  salesClients?: SalesClient[];
  truckLoads?: TruckLoad[];
  remissionNotes?: RemissionNote[];
  clientPayments?: ClientPayment[];
  supplyItems?: SupplyItem[];
  supplyPurchases?: SupplyPurchase[];
  greenhouseApplications?: GreenhouseApplication[];
  modules?: GreenhouseModule[];
  tasks?: CulturalTask[];
  irrigation?: IrrigationLog[];
  pestMonitoring?: PestMonitoring[];
  applications?: PhytosanitaryApplication[];
  harvest?: HarvestRecord[];
  inventory?: InventoryItem[];
  equipment?: EquipmentAsset[];
  workers?: Worker[];
  customers?: Customer[];
  orders?: SalesOrder[];
  bankAccounts?: BankAccount[];
  movements?: FinancialMovement[];
  loans?: ActiveLoan[];
  auditLogs?: AuditLogEntry[];
}

export async function fetchAllFromSupabase(
  client: SupabaseClient,
  onlyAromaFlowers = false
): Promise<RemoteSnapshot> {
  const [
    usersRes,
    productsRes,
    prodRes,
    salesRes,
    empRes,
    weekRes,
    loanRes,
    supRes,
    spRes,
    cliRes,
    loadRes,
    remRes,
    cpayRes,
    sitemRes,
    spurRes,
    gappRes,
  ] = await Promise.all([
    client.from('app_users').select('*'),
    client.from('app_products').select('*').order('sort_order', { ascending: true }),
    client.from('daily_productions').select('*').order('production_date', { ascending: false }),
    client.from('daily_sales').select('*').order('sale_date', { ascending: false }),
    client.from('payroll_employees').select('*').order('full_name', { ascending: true }),
    client.from('payroll_weeks').select('*').order('start_date', { ascending: false }),
    client.from('employee_loans').select('*').order('movement_date', { ascending: false }),
    client.from('supplier_payments').select('*').order('payment_date', { ascending: false }),
    client.from('sales_points').select('*').order('name', { ascending: true }),
    client.from('sales_clients').select('*').order('name', { ascending: true }),
    client.from('truck_loads').select('*').order('load_date', { ascending: false }),
    client.from('remission_notes').select('*').order('sale_date', { ascending: false }),
    client.from('client_payments').select('*').order('payment_date', { ascending: false }),
    client.from('supply_items').select('*').order('name', { ascending: true }),
    client.from('supply_purchases').select('*').order('purchase_date', { ascending: false }),
    client.from('greenhouse_applications').select('*').order('application_date', { ascending: false }),
  ]);

  const isMissingTable = (err: any) =>
    err &&
    (err.code === 'PGRST205' ||
      err.code === '42P01' ||
      err.message?.toLowerCase().includes('could not find the table'));

  const allRes = [
    usersRes,
    productsRes,
    prodRes,
    salesRes,
    empRes,
    weekRes,
    loanRes,
    supRes,
    spRes,
    cliRes,
    loadRes,
    remRes,
    cpayRes,
    sitemRes,
    spurRes,
    gappRes,
  ];

  const mappedBase = {
    appUsers: !usersRes.error && usersRes.data?.length ? usersRes.data.map(mapAppUserFromDb) : undefined,
    aromaProducts: !productsRes.error && productsRes.data?.length ? productsRes.data.map(mapAromaProductFromDb) : undefined,
    dailyProductions: !prodRes.error && prodRes.data ? prodRes.data.map(mapDailyProductionFromDb) : undefined,
    dailySales: !salesRes.error && salesRes.data ? salesRes.data.map(mapDailySaleFromDb) : undefined,
    payrollEmployees: !empRes.error && empRes.data?.length ? empRes.data.map(mapPayrollEmployeeFromDb) : undefined,
    payrollWeeks: !weekRes.error && weekRes.data ? weekRes.data.map(mapPayrollWeekFromDb) : undefined,
    employeeLoans: !loanRes.error && loanRes.data ? loanRes.data.map(mapEmployeeLoanFromDb) : undefined,
    supplierPayments: !supRes.error && supRes.data ? supRes.data.map(mapSupplierPaymentFromDb) : undefined,
    salesPoints: !spRes.error && spRes.data?.length ? spRes.data.map(mapSalesPointFromDb) : undefined,
    salesClients: !cliRes.error && cliRes.data?.length ? cliRes.data.map(mapSalesClientFromDb) : undefined,
    truckLoads: !loadRes.error && loadRes.data ? loadRes.data.map(mapTruckLoadFromDb) : undefined,
    remissionNotes: !remRes.error && remRes.data ? remRes.data.map(mapRemissionNoteFromDb) : undefined,
    clientPayments: !cpayRes.error && cpayRes.data ? cpayRes.data.map(mapClientPaymentFromDb) : undefined,
    supplyItems: !sitemRes.error && sitemRes.data?.length ? sitemRes.data.map(mapSupplyItemFromDb) : undefined,
    supplyPurchases: !spurRes.error && spurRes.data ? spurRes.data.map(mapSupplyPurchaseFromDb) : undefined,
    greenhouseApplications: !gappRes.error && gappRes.data ? gappRes.data.map(mapGreenhouseAppFromDb) : undefined,
  };

  if (allRes.some((r) => isMissingTable(r.error))) {
    return {
      status: 'missing_tables',
      ...mappedBase,
    };
  }

  if (allRes.some((r) => r.error)) {
    return { status: 'error' };
  }

  if (onlyAromaFlowers) {
    return {
      status: 'connected',
      ...mappedBase,
    };
  }

  const [
    check,
    modulesRes,
    tasksRes,
    irrigationRes,
    pestRes,
    appsRes,
    harvestRes,
    inventoryRes,
    equipmentRes,
    workersRes,
    customersRes,
    ordersRes,
    accountsRes,
    movementsRes,
    loansRes,
    auditRes,
  ] = await Promise.all([
    client.from('aroma_flower_sheets').select('*'),
    client.from('modules').select('*'),
    client.from('cultural_tasks').select('*'),
    client.from('irrigation_logs').select('*'),
    client.from('pest_monitoring').select('*'),
    client.from('phytosanitary_applications').select('*'),
    client.from('harvest_records').select('*'),
    client.from('inventory_items').select('*'),
    client.from('equipment_assets').select('*'),
    client.from('workers').select('*'),
    client.from('customers').select('*'),
    client.from('sales_orders').select('*'),
    client.from('bank_accounts').select('*'),
    client.from('financial_movements').select('*'),
    client.from('active_loans').select('*'),
    client.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  return {
    status: 'connected',
    aromaSheets: check.data?.length ? check.data.map(mapAromaSheetFromDb) : undefined,
    ...mappedBase,
    modules: modulesRes.data?.length ? modulesRes.data.map(mapModuleFromDb) : undefined,
    tasks: tasksRes.data?.length ? tasksRes.data.map(mapTaskFromDb) : undefined,
    irrigation: irrigationRes.data?.length ? irrigationRes.data.map(mapIrrigationFromDb) : undefined,
    pestMonitoring: pestRes.data?.length ? pestRes.data.map(mapPestFromDb) : undefined,
    applications: appsRes.data?.length ? appsRes.data.map(mapApplicationFromDb) : undefined,
    harvest: harvestRes.data?.length ? harvestRes.data.map(mapHarvestFromDb) : undefined,
    inventory: inventoryRes.data?.length ? inventoryRes.data.map(mapInventoryFromDb) : undefined,
    equipment: equipmentRes.data?.length ? equipmentRes.data.map(mapEquipmentFromDb) : undefined,
    workers: workersRes.data?.length ? workersRes.data.map(mapWorkerFromDb) : undefined,
    customers: customersRes.data?.length ? customersRes.data.map(mapCustomerFromDb) : undefined,
    orders: ordersRes.data?.length ? ordersRes.data.map(mapOrderFromDb) : undefined,
    bankAccounts: accountsRes.data?.length ? accountsRes.data.map(mapAccountFromDb) : undefined,
    movements: movementsRes.data?.length ? movementsRes.data.map(mapMovementFromDb) : undefined,
    loans: loansRes.data?.length ? loansRes.data.map(mapLoanFromDb) : undefined,
    auditLogs: auditRes.data?.length ? auditRes.data.map(mapAuditFromDb) : undefined,
  };
}

export interface LocalStateSnapshot {
  aromaSheets: AromaFlowerSheetEntry[];
  appUsers: AppUser[];
  aromaProducts: AromaProduct[];
  dailyProductions: DailyProductionEntry[];
  dailySales: DailySalesEntry[];
  payrollEmployees: PayrollEmployee[];
  payrollWeeks: PayrollWeekEntry[];
  employeeLoans: EmployeeLoanMovement[];
  supplierPayments: SupplierPayment[];
  salesPoints: SalesPoint[];
  salesClients: SalesClient[];
  truckLoads: TruckLoad[];
  remissionNotes: RemissionNote[];
  clientPayments: ClientPayment[];
  supplyItems: SupplyItem[];
  supplyPurchases: SupplyPurchase[];
  greenhouseApplications: GreenhouseApplication[];
  modules: GreenhouseModule[];
  tasks: CulturalTask[];
  irrigation: IrrigationLog[];
  pestMonitoring: PestMonitoring[];
  applications: PhytosanitaryApplication[];
  harvest: HarvestRecord[];
  inventory: InventoryItem[];
  equipment: EquipmentAsset[];
  workers: Worker[];
  customers: Customer[];
  orders: SalesOrder[];
  bankAccounts: BankAccount[];
  movements: FinancialMovement[];
  loans: ActiveLoan[];
  auditLogs: AuditLogEntry[];
}

export async function pushAllLocalToSupabase(
  client: SupabaseClient,
  state: LocalStateSnapshot,
  onlyAromaFlowers = false
): Promise<{ ok: boolean; syncedCount: number; status: SupabaseSyncStatus; message: string }> {
  const coreBatches: Array<{ table: string; rows: Record<string, any>[] }> = [
    { table: 'app_users', rows: state.appUsers.map(mapAppUserToDb) },
    { table: 'app_products', rows: state.aromaProducts.map(mapAromaProductToDb) },
    { table: 'daily_productions', rows: state.dailyProductions.map(mapDailyProductionToDb) },
    { table: 'daily_sales', rows: state.dailySales.map(mapDailySaleToDb) },
    { table: 'payroll_employees', rows: state.payrollEmployees.map(mapPayrollEmployeeToDb) },
    { table: 'payroll_weeks', rows: state.payrollWeeks.map(mapPayrollWeekToDb) },
    { table: 'employee_loans', rows: state.employeeLoans.map(mapEmployeeLoanToDb) },
    { table: 'supplier_payments', rows: state.supplierPayments.map(mapSupplierPaymentToDb) },
    { table: 'sales_points', rows: state.salesPoints.map(mapSalesPointToDb) },
    { table: 'sales_clients', rows: state.salesClients.map(mapSalesClientToDb) },
    { table: 'truck_loads', rows: state.truckLoads.map(mapTruckLoadToDb) },
    { table: 'remission_notes', rows: state.remissionNotes.map(mapRemissionNoteToDb) },
    { table: 'client_payments', rows: state.clientPayments.map(mapClientPaymentToDb) },
    { table: 'supply_items', rows: state.supplyItems.map(mapSupplyItemToDb) },
    { table: 'supply_purchases', rows: state.supplyPurchases.map(mapSupplyPurchaseToDb) },
    { table: 'greenhouse_applications', rows: state.greenhouseApplications.map(mapGreenhouseAppToDb) },
  ];

  const batches = onlyAromaFlowers
    ? coreBatches
    : [
        ...coreBatches,
        { table: 'aroma_flower_sheets', rows: state.aromaSheets.map(mapAromaSheetToDb) },
        { table: 'modules', rows: state.modules.map(mapModuleToDb) },
        { table: 'cultural_tasks', rows: state.tasks.map(mapTaskToDb) },
        { table: 'irrigation_logs', rows: state.irrigation.map(mapIrrigationToDb) },
        { table: 'pest_monitoring', rows: state.pestMonitoring.map(mapPestToDb) },
        { table: 'phytosanitary_applications', rows: state.applications.map(mapApplicationToDb) },
        { table: 'harvest_records', rows: state.harvest.map(mapHarvestToDb) },
        { table: 'inventory_items', rows: state.inventory.map(mapInventoryToDb) },
        { table: 'equipment_assets', rows: state.equipment.map(mapEquipmentToDb) },
        { table: 'workers', rows: state.workers.map(mapWorkerToDb) },
        { table: 'customers', rows: state.customers.map(mapCustomerToDb) },
        { table: 'sales_orders', rows: state.orders.map(mapOrderToDb) },
        { table: 'bank_accounts', rows: state.bankAccounts.map(mapAccountToDb) },
        { table: 'financial_movements', rows: state.movements.map(mapMovementToDb) },
        { table: 'active_loans', rows: state.loans.map(mapLoanToDb) },
        { table: 'audit_logs', rows: state.auditLogs.map(mapAuditToDb) },
      ];

  let syncedCount = 0;
  for (const batch of batches) {
    if (batch.rows.length === 0) continue;
    const res = await upsertRowsToSupabase(client, batch.table, batch.rows);
    if (!res.ok) {
      if (res.missingTable) {
        return {
          ok: false,
          syncedCount,
          status: 'missing_tables',
          message: `Falta la tabla "${batch.table}" en Supabase. Ejecuta primero el Esquema SQL en Supabase → SQL Editor.`,
        };
      }
      return {
        ok: false,
        syncedCount,
        status: 'error',
        message: `Error al sincronizar "${batch.table}": ${res.error}`,
      };
    }
    syncedCount += batch.rows.length;
  }

  return {
    ok: true,
    syncedCount,
    status: 'connected',
    message: `Se sincronizaron ${syncedCount} registros en Supabase correctamente.`,
  };
}
