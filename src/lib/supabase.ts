import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ActiveLoan,
  AromaFlowerSheetEntry,
  AuditLogEntry,
  BankAccount,
  CulturalTask,
  Customer,
  EquipmentAsset,
  FinancialMovement,
  GreenhouseModule,
  HarvestRecord,
  InventoryItem,
  IrrigationLog,
  PestMonitoring,
  PhytosanitaryApplication,
  SalesOrder,
  UserRole,
  Worker,
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
    const { error } = await client.from('aroma_flower_sheets').select('id').limit(1);
    if (!error) {
      return {
        ok: true,
        tablesReady: true,
        status: 'connected',
        message: 'Conexión exitosa y tablas listas en Supabase.',
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
          'Proyecto Supabase conectado, pero faltan crear las tablas. Copia y ejecuta el Esquema SQL en Supabase → SQL Editor.',
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
  return { ok: false, error: error.message };
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
  const check = await client.from('aroma_flower_sheets').select('*');
  if (check.error) {
    if (
      check.error.code === 'PGRST205' ||
      check.error.code === '42P01' ||
      check.error.message?.toLowerCase().includes('could not find the table')
    ) {
      return { status: 'missing_tables' };
    }
    return { status: 'error' };
  }

  if (onlyAromaFlowers) {
    return {
      status: 'connected',
      aromaSheets: check.data?.length ? check.data.map(mapAromaSheetFromDb) : undefined,
    };
  }

  const [
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
  const batches: Array<{ table: string; rows: Record<string, any>[] }> = onlyAromaFlowers
    ? [{ table: 'aroma_flower_sheets', rows: state.aromaSheets.map(mapAromaSheetToDb) }]
    : [
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
