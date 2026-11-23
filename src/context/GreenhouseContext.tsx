import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
  GreenhouseModule,
  CulturalTask,
  IrrigationLog,
  PestMonitoring,
  PhytosanitaryApplication,
  HarvestRecord,
  InventoryItem,
  EquipmentAsset,
  Worker,
  Customer,
  SalesOrder,
  BankAccount,
  FinancialMovement,
  ActiveLoan,
  AuditLogEntry,
  AromaFlowerSheetEntry,
  AromaProduct,
  DailyProductionEntry,
  DailySalesEntry,
  AppUser,
  PayrollEmployee,
  PayrollWeekEntry,
  EmployeeLoanMovement,
  SupplierPayment,
  ROLES,
} from '../types/greenhouse';
import {
  INITIAL_MODULES,
  INITIAL_TASKS,
  INITIAL_IRRIGATION,
  INITIAL_PEST_MONITORING,
  INITIAL_APPLICATIONS,
  INITIAL_HARVEST,
  INITIAL_INVENTORY,
  INITIAL_EQUIPMENT,
  INITIAL_WORKERS,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_ACCOUNTS,
  INITIAL_MOVEMENTS,
  INITIAL_LOANS,
  INITIAL_AUDIT_LOGS,
  INITIAL_AROMA_FLOWER_SHEETS,
  INITIAL_AROMA_PRODUCTS,
  INITIAL_DAILY_PRODUCTIONS,
  INITIAL_DAILY_SALES,
  INITIAL_APP_USERS,
  INITIAL_PAYROLL_EMPLOYEES,
  INITIAL_PAYROLL_WEEKS,
  INITIAL_EMPLOYEE_LOANS,
  INITIAL_SUPPLIER_PAYMENTS,
} from '../data/mockData';
import {
  DEFAULT_SUPABASE_KEY,
  DEFAULT_SUPABASE_URL,
  SupabaseSyncStatus,
  SupabaseTestResult,
  deleteRowFromSupabase,
  fetchAllFromSupabase,
  getSupabaseClient,
  mapAccountToDb,
  mapAppUserFromDb,
  mapAppUserToDb,
  mapApplicationToDb,
  mapAromaProductFromDb,
  mapAromaProductToDb,
  mapAuditToDb,
  mapAromaSheetToDb,
  mapCustomerToDb,
  mapDailyProductionFromDb,
  mapDailyProductionToDb,
  mapDailySaleFromDb,
  mapDailySaleToDb,
  mapEmployeeLoanFromDb,
  mapEmployeeLoanToDb,
  mapEquipmentToDb,
  mapHarvestToDb,
  mapInventoryToDb,
  mapIrrigationToDb,
  mapLoanToDb,
  mapModuleToDb,
  mapMovementToDb,
  mapOrderToDb,
  mapPayrollEmployeeFromDb,
  mapPayrollEmployeeToDb,
  mapPayrollWeekFromDb,
  mapPayrollWeekToDb,
  mapPestToDb,
  mapSupplierPaymentFromDb,
  mapSupplierPaymentToDb,
  mapTaskToDb,
  mapWorkerToDb,
  normalizeSupabaseUrl,
  pushAllLocalToSupabase,
  testSupabaseConnection,
  upsertSingleRecordToSupabase,
} from '../lib/supabase';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

interface OfflineOperation {
  id: string;
  table: string;
  op: 'upsert' | 'delete';
  payload?: Record<string, any>;
  recordId?: string;
}

interface GreenhouseContextType {
  // Authentication & Users
  currentUser: AppUser | null;
  appUsers: AppUser[];
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  canAccessRole: (role: UserRole) => boolean;
  saveAppUser: (
    userInput: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<{
    ok: boolean;
    error?: string;
    cloudSynced?: boolean;
    cloudError?: string;
    user?: AppUser;
  }>;
  updateCurrentProfile: (
    updates: Partial<AppUser>
  ) => Promise<{ ok: boolean; error?: string; cloudSynced?: boolean; cloudError?: string }>;
  deleteAppUser: (id: string) => Promise<{ ok: boolean; error?: string; cloudSynced?: boolean }>;

  // Navigation & Role
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole | null) => void;
  activeView: string;
  setActiveView: (view: string) => void;

  // Data Collections
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
  offlineQueue: OfflineOperation[];

  // Aroma Flowers Sheets (Legacy 7 Modules)
  aromaSheets: AromaFlowerSheetEntry[];
  saveAromaSheet: (sheet: Omit<AromaFlowerSheetEntry, 'id' | 'createdAt'>, existingId?: string) => void;
  deleteAromaSheet: (id: string) => void;

  // Dynamic Catalog of Products & Daily Production by Employee
  aromaProducts: AromaProduct[];
  saveAromaProduct: (
    product: Omit<AromaProduct, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<{ ok: boolean; error?: string; cloudSynced?: boolean; cloudError?: string }>;
  deleteAromaProduct: (id: string) => Promise<{ ok: boolean; cloudSynced?: boolean }>;

  dailyProductions: DailyProductionEntry[];
  saveDailyProduction: (
    entry: Omit<DailyProductionEntry, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<{ entry: DailyProductionEntry; cloudSynced: boolean; cloudError?: string }>;
  deleteDailyProduction: (id: string) => Promise<{ ok: boolean; cloudSynced?: boolean }>;

  dailySales: DailySalesEntry[];
  saveDailySale: (
    entry: Omit<DailySalesEntry, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<{ entry: DailySalesEntry; cloudSynced: boolean; cloudError?: string }>;
  deleteDailySale: (id: string) => Promise<{ ok: boolean; cloudSynced?: boolean }>;

  // Empleados, Nómina Semanal, Préstamos y Pagos a Proveedores
  payrollEmployees: PayrollEmployee[];
  savePayrollEmployee: (
    empInput: Omit<PayrollEmployee, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<{
    ok: boolean;
    error?: string;
    employee?: PayrollEmployee;
    cloudSynced?: boolean;
    cloudError?: string;
  }>;
  setPayrollEmployeeActive: (
    id: string,
    active: boolean,
    terminationReason?: string
  ) => Promise<{ ok: boolean; cloudSynced?: boolean }>;
  deletePayrollEmployee: (id: string) => Promise<{ ok: boolean; cloudSynced?: boolean }>;

  payrollWeeks: PayrollWeekEntry[];
  savePayrollWeek: (
    weekInput: Omit<PayrollWeekEntry, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
    syncLoanBalances?: boolean
  ) => Promise<{ entry: PayrollWeekEntry; cloudSynced: boolean; cloudError?: string }>;
  deletePayrollWeek: (id: string) => Promise<{ ok: boolean; cloudSynced?: boolean }>;

  employeeLoans: EmployeeLoanMovement[];
  addEmployeeLoanMovement: (
    input: Omit<EmployeeLoanMovement, 'id' | 'balanceAfter' | 'createdAt' | 'updatedAt'>
  ) => Promise<{ ok: boolean; error?: string; movement?: EmployeeLoanMovement; cloudSynced?: boolean; cloudError?: string }>;
  deleteEmployeeLoanMovement: (id: string) => Promise<{ ok: boolean; cloudSynced?: boolean }>;

  supplierPayments: SupplierPayment[];
  saveSupplierPayment: (
    input: Omit<SupplierPayment, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<{ entry: SupplierPayment; cloudSynced: boolean; cloudError?: string }>;
  deleteSupplierPayment: (id: string) => Promise<{ ok: boolean; cloudSynced?: boolean }>;

  refreshFromSupabase: () => Promise<boolean>;

  // Mutators
  addModule: (mod: GreenhouseModule) => void;
  updateModule: (mod: GreenhouseModule) => void;
  deleteModule: (id: string) => void;

  addTask: (task: CulturalTask) => void;
  updateTask: (task: CulturalTask) => void;

  addIrrigation: (log: IrrigationLog) => void;
  addPestMonitoring: (item: PestMonitoring) => void;
  addApplication: (app: PhytosanitaryApplication) => void;

  addHarvest: (record: HarvestRecord) => void;
  updateHarvest: (record: HarvestRecord) => void;

  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryStock: (id: string, newStock: number) => void;

  addWorker: (worker: Worker) => void;
  updateWorkerAttendance: (id: string, status: Worker['attendanceToday']) => void;

  addCustomer: (cust: Customer) => void;
  addOrder: (order: SalesOrder) => void;
  updateOrderStatus: (orderId: string, status: SalesOrder['status']) => void;

  addFinancialMovement: (movement: FinancialMovement) => void;
  addLoan: (loan: ActiveLoan) => void;

  addAuditLog: (action: string, details: string) => void;

  // Demo Data Management & Supabase
  demoDataCleared: boolean;
  clearAllDemoData: () => void;
  restoreDemoData: () => void;
  neverShowDemoAgain: boolean;
  setNeverShowDemoAgain: (val: boolean) => void;

  // Supabase Integration State
  supabaseConfig: SupabaseConfig;
  supabaseStatus: SupabaseSyncStatus;
  supabaseMessage: string;
  isSyncingSupabase: boolean;
  saveSupabaseConfig: (url: string, key: string) => void;
  testSupabase: (overrideUrl?: string, overrideKey?: string) => Promise<SupabaseTestResult>;
  syncAllToSupabase: () => Promise<{ ok: boolean; syncedCount: number; message: string }>;
  generateSupabaseSql: () => string;
  generateSupabaseCleanupSql: () => string;

  // Backup
  exportDataJson: () => string;
  importDataJson: (jsonStr: string) => boolean;

  // Offline
  isOnline: boolean;
  syncOfflineQueue: () => Promise<void>;
}

const STORAGE_KEY_PREFIX = 'aroma_flowers_';

const GreenhouseContext = createContext<GreenhouseContextType | undefined>(undefined);

export const GreenhouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if demo data was previously wiped by user
  const storedDemoCleared = localStorage.getItem(`${STORAGE_KEY_PREFIX}demo_cleared`) === 'true';
  const storedNeverShow = localStorage.getItem(`${STORAGE_KEY_PREFIX}never_show_demo`) === 'true';

  const [demoDataCleared, setDemoDataCleared] = useState<boolean>(storedDemoCleared || storedNeverShow);
  const [neverShowDemoAgain, setNeverShowDemoAgainState] = useState<boolean>(storedNeverShow);

  // Users & Session State (always keeps seeded credentials available even if demo data cleared)
  const [appUsers, setAppUsers] = useState<AppUser[]>(() => {
    const local = localStorage.getItem(`${STORAGE_KEY_PREFIX}app_users`);
    let list: AppUser[] = INITIAL_APP_USERS;
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch {
        list = INITIAL_APP_USERS;
      }
    }
    // Ensure seeded credentials exist if missing
    const merged = [...list];
    INITIAL_APP_USERS.forEach((seedUser) => {
      if (!merged.some((u) => u.username.toLowerCase() === seedUser.username.toLowerCase())) {
        merged.push(seedUser);
      }
    });
    return merged;
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}session_user_id`);
  });

  const currentUser = appUsers.find((u) => u.id === currentUserId && u.active !== false) || null;

  // Active Role and View
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);
  const [activeView, setActiveView] = useState<string>('produccion_dia');

  // Network status
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}offline_queue`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Supabase Config (pre-configured with project syrchvrxkkwvwynvtzfq unless overridden in localStorage)
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}supabase_cfg`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.url || parsed.anonKey) {
          const cleanUrl = normalizeSupabaseUrl(parsed.url || '');
          const cleanKey = (parsed.anonKey || '').trim();
          return {
            url: cleanUrl,
            anonKey: cleanKey,
            isConnected: Boolean(cleanUrl && cleanKey),
          };
        }
      } catch {
        // fallback to default
      }
    }
    const cleanDefaultUrl = normalizeSupabaseUrl(DEFAULT_SUPABASE_URL);
    return {
      url: cleanDefaultUrl,
      anonKey: DEFAULT_SUPABASE_KEY,
      isConnected: Boolean(cleanDefaultUrl && DEFAULT_SUPABASE_KEY),
    };
  });

  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseSyncStatus>('idle');
  const [supabaseMessage, setSupabaseMessage] = useState<string>('');
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);

  // Data Collections helper to initialize from storage or seed
  const loadInitial = <T,>(key: string, seed: T[]): T[] => {
    if (storedDemoCleared || storedNeverShow) return [];
    const local = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        return seed;
      }
    }
    return seed;
  };

  const [modules, setModules] = useState<GreenhouseModule[]>(() => loadInitial('modules', INITIAL_MODULES));
  const [tasks, setTasks] = useState<CulturalTask[]>(() => loadInitial('tasks', INITIAL_TASKS));
  const [irrigation, setIrrigation] = useState<IrrigationLog[]>(() => loadInitial('irrigation', INITIAL_IRRIGATION));
  const [pestMonitoring, setPestMonitoring] = useState<PestMonitoring[]>(() => loadInitial('pest_monitoring', INITIAL_PEST_MONITORING));
  const [applications, setApplications] = useState<PhytosanitaryApplication[]>(() => loadInitial('applications', INITIAL_APPLICATIONS));
  const [harvest, setHarvest] = useState<HarvestRecord[]>(() => loadInitial('harvest', INITIAL_HARVEST));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadInitial('inventory', INITIAL_INVENTORY));
  const [equipment, setEquipment] = useState<EquipmentAsset[]>(() => loadInitial('equipment', INITIAL_EQUIPMENT));
  const [workers, setWorkers] = useState<Worker[]>(() => loadInitial('workers', INITIAL_WORKERS));
  const [customers, setCustomers] = useState<Customer[]>(() => loadInitial('customers', INITIAL_CUSTOMERS));
  const [orders, setOrders] = useState<SalesOrder[]>(() => loadInitial('orders', INITIAL_ORDERS));
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => loadInitial('bank_accounts', INITIAL_ACCOUNTS));
  const [movements, setMovements] = useState<FinancialMovement[]>(() => loadInitial('movements', INITIAL_MOVEMENTS));
  const [loans, setLoans] = useState<ActiveLoan[]>(() => loadInitial('loans', INITIAL_LOANS));
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => loadInitial('audit_logs', INITIAL_AUDIT_LOGS));
  const [aromaSheets, setAromaSheets] = useState<AromaFlowerSheetEntry[]>(() => loadInitial('aroma_sheets', INITIAL_AROMA_FLOWER_SHEETS));

  // Catalog of Products (always stays populated unless Admin modifies it)
  const [aromaProducts, setAromaProducts] = useState<AromaProduct[]>(() => {
    const local = localStorage.getItem(`${STORAGE_KEY_PREFIX}app_products`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        return INITIAL_AROMA_PRODUCTS;
      }
    }
    return INITIAL_AROMA_PRODUCTS;
  });

  // Daily Production Entries by employee and date
  const [dailyProductions, setDailyProductions] = useState<DailyProductionEntry[]>(() =>
    loadInitial('daily_productions', INITIAL_DAILY_PRODUCTIONS)
  );

  // Daily Sales Entries (Resumen de Ventas CEDA CDMX)
  const [dailySales, setDailySales] = useState<DailySalesEntry[]>(() =>
    loadInitial('daily_sales', INITIAL_DAILY_SALES)
  );

  // Empleados de Nómina & Directorio (keeps 13 seeded workers unless cleared/modified)
  const [payrollEmployees, setPayrollEmployees] = useState<PayrollEmployee[]>(() => {
    const local = localStorage.getItem(`${STORAGE_KEY_PREFIX}payroll_employees`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        return INITIAL_PAYROLL_EMPLOYEES;
      }
    }
    return INITIAL_PAYROLL_EMPLOYEES;
  });

  // Nóminas Semanales (Módulo Pagos)
  const [payrollWeeks, setPayrollWeeks] = useState<PayrollWeekEntry[]>(() =>
    loadInitial('payroll_weeks', INITIAL_PAYROLL_WEEKS)
  );

  // Préstamos y Descuentos de Empleados
  const [employeeLoans, setEmployeeLoans] = useState<EmployeeLoanMovement[]>(() =>
    loadInitial('employee_loans', INITIAL_EMPLOYEE_LOANS)
  );

  // Pagos a Proveedores y Otros Gastos
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(() =>
    loadInitial('supplier_payments', INITIAL_SUPPLIER_PAYMENTS)
  );

  // Sync online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save changes to localStorage
  const saveState = (key: string, value: any) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving ${key}:`, e);
    }
  };

  const enqueueOfflineOp = (op: Omit<OfflineOperation, 'id'>) => {
    setOfflineQueue((prev) => {
      const updated: OfflineOperation[] = [
        ...prev,
        { ...op, id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
      ];
      saveState('offline_queue', updated);
      return updated;
    });
  };

  const onlyAromaFlowers = ROLES.every(
    (r) =>
      r.id === 'admin' ||
      r.id === 'produccion' ||
      r.enabled === false
  );

  const pushUpsertToSupabase = async (
    table: string,
    payload: Record<string, any>
  ): Promise<{ ok: boolean; error?: string; savedRow?: Record<string, any> }> => {
    if (!supabaseConfig.isConnected) {
      return { ok: false, error: 'Supabase no está configurado.' };
    }
    const ACTIVE_AROMA_TABLES = new Set([
      'app_users',
      'app_products',
      'daily_productions',
      'daily_sales',
      'payroll_employees',
      'payroll_weeks',
      'employee_loans',
      'supplier_payments',
    ]);
    if (onlyAromaFlowers && !ACTIVE_AROMA_TABLES.has(table)) {
      return { ok: true };
    }
    if (!isOnline) {
      enqueueOfflineOp({ table, op: 'upsert', payload });
      return { ok: false, error: 'Sin conexión a internet; guardado en cola offline.' };
    }
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) {
      return { ok: false, error: 'Cliente Supabase inválido.' };
    }
    const res = await upsertSingleRecordToSupabase(client, table, payload);
    if (res.ok) {
      setSupabaseStatus('connected');
      setSupabaseMessage('Conectado a Supabase');
      return { ok: true, savedRow: res.savedRow };
    }
    if (res.missingTable) {
      setSupabaseStatus('missing_tables');
      setSupabaseMessage(`Falta la tabla "${table}" en Supabase.`);
    } else {
      setSupabaseMessage(`Error al guardar en "${table}": ${res.error || 'Error desconocido'}`);
    }
    enqueueOfflineOp({ table, op: 'upsert', payload });
    return { ok: false, error: res.error || 'Error al sincronizar con Supabase.' };
  };

  const pushDeleteToSupabase = async (
    table: string,
    recordId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!supabaseConfig.isConnected) {
      return { ok: false, error: 'Supabase no está configurado.' };
    }
    const ACTIVE_AROMA_TABLES = new Set([
      'app_users',
      'app_products',
      'daily_productions',
      'daily_sales',
      'payroll_employees',
      'payroll_weeks',
      'employee_loans',
      'supplier_payments',
    ]);
    if (onlyAromaFlowers && !ACTIVE_AROMA_TABLES.has(table)) {
      return { ok: true };
    }
    if (!isOnline) {
      enqueueOfflineOp({ table, op: 'delete', recordId });
      return { ok: false, error: 'Sin conexión; eliminación en cola offline.' };
    }
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) return { ok: false, error: 'Cliente Supabase inválido.' };
    const res = await deleteRowFromSupabase(client, table, recordId);
    if (!res.ok) {
      if (res.missingTable) setSupabaseStatus('missing_tables');
      enqueueOfflineOp({ table, op: 'delete', recordId });
      return { ok: false, error: res.error };
    }
    return { ok: true };
  };

  const getPendingTables = (): Set<string> => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}offline_queue`);
    const set = new Set<string>();
    if (!saved) return set;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((op: OfflineOperation) => set.add(op.table));
      }
    } catch {
      // ignore
    }
    return set;
  };

  const applyRemoteSnapshot = (snap: Awaited<ReturnType<typeof fetchAllFromSupabase>>) => {
    setSupabaseStatus(snap.status);
    if (snap.status === 'missing_tables') {
      setSupabaseMessage('Faltan crear/actualizar las tablas en Supabase. Ejecuta el SQL actualizado.');
    } else if (snap.status === 'error') {
      setSupabaseMessage('Error al consultar Supabase. Verifica tu conexión o políticas RLS.');
      return;
    } else {
      setSupabaseMessage('Conectado a Supabase');
    }
    const pendingTables = getPendingTables();

    if (snap.aromaSheets) {
      setAromaSheets(snap.aromaSheets);
      saveState('aroma_sheets', snap.aromaSheets);
    }
    if (snap.appUsers && !pendingTables.has('app_users')) {
      setAppUsers((prev) => {
        const byId = new Map<string, AppUser>();
        prev.forEach((u) => byId.set(u.id, u));
        snap.appUsers?.forEach((u) => byId.set(u.id, u));
        const merged = Array.from(byId.values());
        saveState('app_users', merged);
        return merged;
      });
    }
    if (snap.aromaProducts && snap.aromaProducts.length > 0 && !pendingTables.has('app_products')) {
      const sorted = [...snap.aromaProducts].sort((a, b) => a.sortOrder - b.sortOrder);
      setAromaProducts(sorted);
      saveState('app_products', sorted);
    }
    if (snap.dailyProductions !== undefined && !pendingTables.has('daily_productions')) {
      setDailyProductions(snap.dailyProductions);
      saveState('daily_productions', snap.dailyProductions);
    }
    if (snap.dailySales !== undefined && !pendingTables.has('daily_sales')) {
      setDailySales(snap.dailySales);
      saveState('daily_sales', snap.dailySales);
    }
    if (snap.payrollEmployees && snap.payrollEmployees.length > 0 && !pendingTables.has('payroll_employees')) {
      setPayrollEmployees(snap.payrollEmployees);
      saveState('payroll_employees', snap.payrollEmployees);
    }
    if (snap.payrollWeeks !== undefined && !pendingTables.has('payroll_weeks')) {
      setPayrollWeeks(snap.payrollWeeks);
      saveState('payroll_weeks', snap.payrollWeeks);
    }
    if (snap.employeeLoans !== undefined && !pendingTables.has('employee_loans')) {
      setEmployeeLoans(snap.employeeLoans);
      saveState('employee_loans', snap.employeeLoans);
    }
    if (snap.supplierPayments !== undefined && !pendingTables.has('supplier_payments')) {
      setSupplierPayments(snap.supplierPayments);
      saveState('supplier_payments', snap.supplierPayments);
    }
    if (snap.modules) {
      setModules(snap.modules);
      saveState('modules', snap.modules);
    }
    if (snap.tasks) {
      setTasks(snap.tasks);
      saveState('tasks', snap.tasks);
    }
    if (snap.irrigation) {
      setIrrigation(snap.irrigation);
      saveState('irrigation', snap.irrigation);
    }
    if (snap.pestMonitoring) {
      setPestMonitoring(snap.pestMonitoring);
      saveState('pest_monitoring', snap.pestMonitoring);
    }
    if (snap.applications) {
      setApplications(snap.applications);
      saveState('applications', snap.applications);
    }
    if (snap.harvest) {
      setHarvest(snap.harvest);
      saveState('harvest', snap.harvest);
    }
    if (snap.inventory) {
      setInventory(snap.inventory);
      saveState('inventory', snap.inventory);
    }
    if (snap.equipment) {
      setEquipment(snap.equipment);
      saveState('equipment', snap.equipment);
    }
    if (snap.workers) {
      setWorkers(snap.workers);
      saveState('workers', snap.workers);
    }
    if (snap.customers) {
      setCustomers(snap.customers);
      saveState('customers', snap.customers);
    }
    if (snap.orders) {
      setOrders(snap.orders);
      saveState('orders', snap.orders);
    }
    if (snap.bankAccounts) {
      setBankAccounts(snap.bankAccounts);
      saveState('bank_accounts', snap.bankAccounts);
    }
    if (snap.movements) {
      setMovements(snap.movements);
      saveState('movements', snap.movements);
    }
    if (snap.loans) {
      setLoans(snap.loans);
      saveState('loans', snap.loans);
    }
    if (snap.auditLogs) {
      setAuditLogs(snap.auditLogs);
      saveState('audit_logs', snap.auditLogs);
    }
  };

  const flushOfflineQueue = async (client: NonNullable<ReturnType<typeof getSupabaseClient>>) => {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}offline_queue`);
    if (!raw) return;
    let queue: OfflineOperation[] = [];
    try {
      queue = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(queue) || queue.length === 0) return;

    const remaining: OfflineOperation[] = [];
    let synced = 0;

    for (const item of queue) {
      if (item.op === 'upsert' && item.payload) {
        const res = await upsertSingleRecordToSupabase(client, item.table, item.payload);
        if (res.ok) synced++;
        else remaining.push(item);
      } else if (item.op === 'delete' && item.recordId) {
        const res = await deleteRowFromSupabase(client, item.table, item.recordId);
        if (res.ok) synced++;
        else remaining.push(item);
      }
    }

    setOfflineQueue(remaining);
    saveState('offline_queue', remaining);
    if (synced > 0) {
      setSupabaseStatus('connected');
      setSupabaseMessage('Conectado a Supabase');
    }
  };

  const refreshFromSupabase = async (): Promise<boolean> => {
    if (!supabaseConfig.isConnected || !isOnline) return false;
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) return false;
    await flushOfflineQueue(client);
    const snap = await fetchAllFromSupabase(client, onlyAromaFlowers);
    applyRemoteSnapshot(snap);
    return snap.status === 'connected';
  };

  // Hydrate / check Supabase status on startup and poll every 15s for real-time employee sync
  useEffect(() => {
    if (!supabaseConfig.isConnected || !isOnline) {
      if (!supabaseConfig.isConnected) setSupabaseStatus('disconnected');
      return;
    }
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) return;

    let cancelled = false;
    setSupabaseStatus('connecting');
    flushOfflineQueue(client)
      .then(() => fetchAllFromSupabase(client, onlyAromaFlowers))
      .then((snap) => {
        if (cancelled) return;
        applyRemoteSnapshot(snap);
      });

    const intervalId = window.setInterval(async () => {
      await flushOfflineQueue(client);
      const snap = await fetchAllFromSupabase(client, onlyAromaFlowers);
      if (!cancelled && snap.status === 'connected') {
        applyRemoteSnapshot(snap);
      }
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [supabaseConfig.url, supabaseConfig.anonKey, supabaseConfig.isConnected, isOnline]);

  const addAuditLog = (action: string, details: string) => {
    const newLog: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      userRole: activeRole || 'sistema',
      action,
      details,
    };
    setAuditLogs((prev) => {
      const updated = [newLog, ...prev.slice(0, 49)];
      saveState('audit_logs', updated);
      return updated;
    });
    pushUpsertToSupabase('audit_logs', mapAuditToDb(newLog));
  };

  // Mutators
  const addModule = (mod: GreenhouseModule) => {
    setModules((prev) => {
      const updated = [mod, ...prev];
      saveState('modules', updated);
      return updated;
    });
    pushUpsertToSupabase('modules', mapModuleToDb(mod));
    addAuditLog('Alta de Módulo', `Módulo ${mod.code} - ${mod.name} (${mod.variety})`);
  };

  const updateModule = (mod: GreenhouseModule) => {
    setModules((prev) => {
      const updated = prev.map((m) => (m.id === mod.id ? mod : m));
      saveState('modules', updated);
      return updated;
    });
    pushUpsertToSupabase('modules', mapModuleToDb(mod));
    addAuditLog('Actualización de Módulo', `Módulo ${mod.code} actualizado`);
  };

  const deleteModule = (id: string) => {
    setModules((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveState('modules', updated);
      return updated;
    });
    pushDeleteToSupabase('modules', id);
    addAuditLog('Eliminación de Módulo', `Módulo ID ${id} eliminado`);
  };

  const addTask = (task: CulturalTask) => {
    setTasks((prev) => {
      const updated = [task, ...prev];
      saveState('tasks', updated);
      return updated;
    });
    pushUpsertToSupabase('cultural_tasks', mapTaskToDb(task));
    addAuditLog('Programación de Labor', `${task.taskName} en ${task.moduleCode}`);
  };

  const updateTask = (task: CulturalTask) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === task.id ? task : t));
      saveState('tasks', updated);
      return updated;
    });
    pushUpsertToSupabase('cultural_tasks', mapTaskToDb(task));
    addAuditLog('Avance de Labor', `${task.taskName} marcado ${task.status}`);
  };

  const addIrrigation = (log: IrrigationLog) => {
    setIrrigation((prev) => {
      const updated = [log, ...prev];
      saveState('irrigation', updated);
      return updated;
    });
    pushUpsertToSupabase('irrigation_logs', mapIrrigationToDb(log));
    addAuditLog('Riego y Nutrición', `${log.volumeM3}m³ en ${log.moduleCode} pH:${log.phInput} CE:${log.ecInput}`);
  };

  const addPestMonitoring = (item: PestMonitoring) => {
    setPestMonitoring((prev) => {
      const updated = [item, ...prev];
      saveState('pest_monitoring', updated);
      return updated;
    });
    pushUpsertToSupabase('pest_monitoring', mapPestToDb(item));
    addAuditLog('Monitoreo Fitosanitario', `${item.pestName} en ${item.moduleCode} severidad ${item.severity}`);
  };

  const addApplication = (app: PhytosanitaryApplication) => {
    setApplications((prev) => {
      const updated = [app, ...prev];
      saveState('applications', updated);
      return updated;
    });
    pushUpsertToSupabase('phytosanitary_applications', mapApplicationToDb(app));
    addAuditLog('Aplicación Fitosanitaria', `${app.productName} en ${app.moduleCode} ($${app.costTotal})`);
  };

  const addHarvest = (record: HarvestRecord) => {
    setHarvest((prev) => {
      const updated = [record, ...prev];
      saveState('harvest', updated);
      return updated;
    });
    pushUpsertToSupabase('harvest_records', mapHarvestToDb(record));
    addAuditLog('Corte y Clasificación', `${record.stemsCut} tallos cortados (${record.packages25Stems} bonches de 25)`);
  };

  const updateHarvest = (record: HarvestRecord) => {
    setHarvest((prev) => {
      const updated = prev.map((h) => (h.id === record.id ? record : h));
      saveState('harvest', updated);
      return updated;
    });
    pushUpsertToSupabase('harvest_records', mapHarvestToDb(record));
  };

  const addInventoryItem = (item: InventoryItem) => {
    setInventory((prev) => {
      const updated = [item, ...prev];
      saveState('inventory', updated);
      return updated;
    });
    pushUpsertToSupabase('inventory_items', mapInventoryToDb(item));
    addAuditLog('Alta en Almacén', `${item.name} (${item.stock} ${item.unit})`);
  };

  const updateInventoryStock = (id: string, newStock: number) => {
    let target: InventoryItem | undefined;
    setInventory((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          target = { ...item, stock: newStock };
          return target;
        }
        return item;
      });
      saveState('inventory', updated);
      return updated;
    });
    if (target) pushUpsertToSupabase('inventory_items', mapInventoryToDb(target));
  };

  const addWorker = (worker: Worker) => {
    setWorkers((prev) => {
      const updated = [worker, ...prev];
      saveState('workers', updated);
      return updated;
    });
    pushUpsertToSupabase('workers', mapWorkerToDb(worker));
    addAuditLog('Alta de Personal', `${worker.name} (${worker.role})`);
  };

  const updateWorkerAttendance = (id: string, status: Worker['attendanceToday']) => {
    let target: Worker | undefined;
    setWorkers((prev) => {
      const updated = prev.map((w) => {
        if (w.id === id) {
          target = { ...w, attendanceToday: status };
          return target;
        }
        return w;
      });
      saveState('workers', updated);
      return updated;
    });
    if (target) pushUpsertToSupabase('workers', mapWorkerToDb(target));
  };

  const addCustomer = (cust: Customer) => {
    setCustomers((prev) => {
      const updated = [cust, ...prev];
      saveState('customers', updated);
      return updated;
    });
    pushUpsertToSupabase('customers', mapCustomerToDb(cust));
    addAuditLog('Alta de Cliente', `${cust.name} (${cust.channel})`);
  };

  const addOrder = (order: SalesOrder) => {
    setOrders((prev) => {
      const updated = [order, ...prev];
      saveState('orders', updated);
      return updated;
    });
    pushUpsertToSupabase('sales_orders', mapOrderToDb(order));
    // Add movement if paid
    if (order.paymentType === 'contado') {
      const newMov: FinancialMovement = {
        id: `mov-${Date.now()}`,
        date: order.date,
        type: 'ingreso',
        scope: 'empresarial',
        category: 'Venta de Flor',
        amount: order.totalAmount,
        description: `Cobro contado Pedido ${order.orderNumber} - ${order.customerName}`,
        bankAccountId: bankAccounts[0]?.id || 'bco-1',
        reconciled: true,
      };
      setMovements((prev) => {
        const updated = [newMov, ...prev];
        saveState('movements', updated);
        return updated;
      });
      pushUpsertToSupabase('financial_movements', mapMovementToDb(newMov));
    }
    addAuditLog('Nuevo Pedido de Venta', `Pedido ${order.orderNumber} por $${order.totalAmount} a ${order.customerName}`);
  };

  const updateOrderStatus = (orderId: string, status: SalesOrder['status']) => {
    let target: SalesOrder | undefined;
    setOrders((prev) => {
      const updated = prev.map((o) => {
        if (o.id === orderId) {
          target = { ...o, status };
          return target;
        }
        return o;
      });
      saveState('orders', updated);
      return updated;
    });
    if (target) pushUpsertToSupabase('sales_orders', mapOrderToDb(target));
  };

  const addFinancialMovement = (movement: FinancialMovement) => {
    setMovements((prev) => {
      const updated = [movement, ...prev];
      saveState('movements', updated);
      return updated;
    });
    pushUpsertToSupabase('financial_movements', mapMovementToDb(movement));
    // update bank balance
    let updatedAcc: BankAccount | undefined;
    setBankAccounts((prev) => {
      const updated = prev.map((acc) => {
        if (acc.id === movement.bankAccountId) {
          const delta = movement.type === 'ingreso' ? movement.amount : -movement.amount;
          updatedAcc = { ...acc, balance: acc.balance + delta };
          return updatedAcc;
        }
        return acc;
      });
      saveState('bank_accounts', updated);
      return updated;
    });
    if (updatedAcc) pushUpsertToSupabase('bank_accounts', mapAccountToDb(updatedAcc));
    addAuditLog('Movimiento Financiero', `${movement.type.toUpperCase()}: $${movement.amount} [${movement.scope}]`);
  };

  const addLoan = (loan: ActiveLoan) => {
    setLoans((prev) => {
      const updated = [loan, ...prev];
      saveState('loans', updated);
      return updated;
    });
    pushUpsertToSupabase('active_loans', mapLoanToDb(loan));
    addAuditLog('Registro de Préstamo', `${loan.institution} por $${loan.totalAmount}`);
  };

  // Aroma Flowers Sheets Mutators
  const saveAromaSheet = (
    sheet: Omit<AromaFlowerSheetEntry, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const savedEntry: AromaFlowerSheetEntry = existingId
      ? {
          ...sheet,
          id: existingId,
          createdAt: aromaSheets.find((item) => item.id === existingId)?.createdAt || now,
        }
      : {
          ...sheet,
          id: `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: now,
        };

    setAromaSheets((prev) => {
      const updated = existingId
        ? prev.map((item) => (item.id === existingId ? savedEntry : item))
        : [savedEntry, ...prev];
      saveState('aroma_sheets', updated);
      return updated;
    });
    pushUpsertToSupabase('aroma_flower_sheets', mapAromaSheetToDb(savedEntry));
    addAuditLog('Aroma Flowers', `Planilla ${sheet.title} guardada (${sheet.grandTotal} tallos/paquetes)`);
  };

  const deleteAromaSheet = (id: string) => {
    setAromaSheets((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveState('aroma_sheets', updated);
      return updated;
    });
    pushDeleteToSupabase('aroma_flower_sheets', id);
    addAuditLog('Aroma Flowers', `Planilla eliminada (ID: ${id})`);
  };

  // ---------- Aroma Products Catalog Mutators (Admin) ----------
  const saveAromaProduct = async (
    productInput: Omit<AromaProduct, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ): Promise<{ ok: boolean; error?: string; cloudSynced?: boolean; cloudError?: string }> => {
    const cleanName = productInput.name.trim().toUpperCase();
    if (!cleanName) {
      return { ok: false, error: 'El nombre del producto/variedad es obligatorio.' };
    }
    const dup = aromaProducts.find(
      (p) => p.name.trim().toUpperCase() === cleanName && p.id !== existingId
    );
    if (dup) {
      return { ok: false, error: `El producto "${cleanName}" ya existe en el catálogo.` };
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const existing = existingId ? aromaProducts.find((p) => p.id === existingId) : undefined;
    const saved: AromaProduct = {
      ...productInput,
      name: cleanName,
      id: existingId || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    setAromaProducts((prev) => {
      const updated = existingId
        ? prev.map((p) => (p.id === existingId ? saved : p))
        : [...prev, saved];
      const sorted = [...updated].sort((a, b) => a.sortOrder - b.sortOrder);
      saveState('app_products', sorted);
      return sorted;
    });

    const cloudRes = await pushUpsertToSupabase('app_products', mapAromaProductToDb(saved));
    if (cloudRes.ok && cloudRes.savedRow) {
      const synced = mapAromaProductFromDb(cloudRes.savedRow);
      setAromaProducts((prev) => {
        const updated = prev.map((p) => (p.id === saved.id ? synced : p));
        const sorted = [...updated].sort((a, b) => a.sortOrder - b.sortOrder);
        saveState('app_products', sorted);
        return sorted;
      });
    }
    addAuditLog('Catálogo de Productos', `Producto "${saved.name}" guardado`);
    return { ok: true, cloudSynced: cloudRes.ok, cloudError: cloudRes.error };
  };

  const deleteAromaProduct = async (id: string): Promise<{ ok: boolean; cloudSynced?: boolean }> => {
    setAromaProducts((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      saveState('app_products', updated);
      return updated;
    });
    const res = await pushDeleteToSupabase('app_products', id);
    addAuditLog('Catálogo de Productos', `Producto eliminado (ID: ${id})`);
    return { ok: true, cloudSynced: res.ok };
  };

  // ---------- Daily Production Mutators (Empleados + Admin) ----------
  const saveDailyProduction = async (
    entryInput: Omit<DailyProductionEntry, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ): Promise<{ entry: DailyProductionEntry; cloudSynced: boolean; cloudError?: string }> => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const matchedSameDay =
      existingId
        ? dailyProductions.find((d) => d.id === existingId)
        : dailyProductions.find(
            (d) =>
              d.productionDate === entryInput.productionDate &&
              d.employeeUserId === entryInput.employeeUserId
          );

    const targetId =
      existingId ||
      matchedSameDay?.id ||
      `dp-${entryInput.productionDate}-${entryInput.employeeUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`;

    const saved: DailyProductionEntry = {
      ...entryInput,
      id: targetId,
      createdAt: matchedSameDay?.createdAt || now,
      updatedAt: now,
    };

    setDailyProductions((prev) => {
      const exists = prev.some((d) => d.id === saved.id);
      const updated = exists
        ? prev.map((d) => (d.id === saved.id ? saved : d))
        : [saved, ...prev];
      saveState('daily_productions', updated);
      return updated;
    });

    const cloudRes = await pushUpsertToSupabase('daily_productions', mapDailyProductionToDb(saved));
    if (cloudRes.ok && cloudRes.savedRow) {
      const synced = mapDailyProductionFromDb(cloudRes.savedRow);
      setDailyProductions((prev) => {
        const updated = prev.map((d) => (d.id === saved.id ? synced : d));
        saveState('daily_productions', updated);
        return updated;
      });
    }
    addAuditLog(
      'Producción del Día',
      `${saved.employeeName} registró ${saved.grandTotal} unidades el ${saved.productionDate}`
    );
    return { entry: saved, cloudSynced: cloudRes.ok, cloudError: cloudRes.error };
  };

  const deleteDailyProduction = async (id: string): Promise<{ ok: boolean; cloudSynced?: boolean }> => {
    setDailyProductions((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      saveState('daily_productions', updated);
      return updated;
    });
    const res = await pushDeleteToSupabase('daily_productions', id);
    addAuditLog('Producción del Día (CEDA CDMX)', `Registro eliminado (ID: ${id})`);
    return { ok: true, cloudSynced: res.ok };
  };

  // ---------- Daily Sales Mutators (Resumen de Ventas CEDA CDMX) ----------
  const saveDailySale = async (
    entryInput: Omit<DailySalesEntry, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ): Promise<{ entry: DailySalesEntry; cloudSynced: boolean; cloudError?: string }> => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const matchedSameDay =
      existingId
        ? dailySales.find((d) => d.id === existingId)
        : dailySales.find(
            (d) =>
              d.saleDate === entryInput.saleDate &&
              d.employeeUserId === entryInput.employeeUserId
          );

    const targetId =
      existingId ||
      matchedSameDay?.id ||
      `ds-${entryInput.saleDate}-${entryInput.employeeUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`;

    const saved: DailySalesEntry = {
      ...entryInput,
      channel: entryInput.channel || 'CEDA CDMX',
      id: targetId,
      createdAt: matchedSameDay?.createdAt || now,
      updatedAt: now,
    };

    setDailySales((prev) => {
      const exists = prev.some((d) => d.id === saved.id);
      const updated = exists
        ? prev.map((d) => (d.id === saved.id ? saved : d))
        : [saved, ...prev];
      saveState('daily_sales', updated);
      return updated;
    });

    const cloudRes = await pushUpsertToSupabase('daily_sales', mapDailySaleToDb(saved));
    if (cloudRes.ok && cloudRes.savedRow) {
      const synced = mapDailySaleFromDb(cloudRes.savedRow);
      setDailySales((prev) => {
        const updated = prev.map((d) => (d.id === saved.id ? synced : d));
        saveState('daily_sales', updated);
        return updated;
      });
    }
    addAuditLog(
      'Resumen de Ventas',
      `${saved.employeeName} registró venta de ${saved.totalPackages} paq. ($${saved.totalAmount}) el ${saved.saleDate}`
    );
    return { entry: saved, cloudSynced: cloudRes.ok, cloudError: cloudRes.error };
  };

  const deleteDailySale = async (id: string): Promise<{ ok: boolean; cloudSynced?: boolean }> => {
    setDailySales((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      saveState('daily_sales', updated);
      return updated;
    });
    const res = await pushDeleteToSupabase('daily_sales', id);
    addAuditLog('Resumen de Ventas', `Venta eliminada (ID: ${id})`);
    return { ok: true, cloudSynced: res.ok };
  };

  // ---------- Empleados, Nómina Semanal, Préstamos y Proveedores (Admin) ----------
  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

  const savePayrollEmployee = async (
    empInput: Omit<PayrollEmployee, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ): Promise<{
    ok: boolean;
    error?: string;
    employee?: PayrollEmployee;
    cloudSynced?: boolean;
    cloudError?: string;
  }> => {
    const cleanName = empInput.fullName.trim().toUpperCase();
    if (!cleanName) {
      return { ok: false, error: 'El nombre del empleado es obligatorio.' };
    }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const existing = existingId ? payrollEmployees.find((e) => e.id === existingId) : undefined;
    const saved: PayrollEmployee = {
      ...empInput,
      fullName: cleanName,
      teamGroup: (empInput.teamGroup || 'AARON').trim().toUpperCase(),
      jobTitle: (empInput.jobTitle || '').trim(),
      phone: (empInput.phone || '').trim(),
      email: (empInput.email || '').trim(),
      weeklySalary: round2(empInput.weeklySalary),
      defaultBonusAmount: round2(empInput.defaultBonusAmount ?? 150),
      loanBalance: Math.max(0, round2(empInput.loanBalance)),
      id:
        existingId ||
        `emp-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}-${Date.now().toString(36)}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    setPayrollEmployees((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      const updated = exists
        ? prev.map((e) => (e.id === saved.id ? saved : e))
        : [...prev, saved];
      saveState('payroll_employees', updated);
      return updated;
    });

    const cloudRes = await pushUpsertToSupabase('payroll_employees', mapPayrollEmployeeToDb(saved));
    if (cloudRes.ok && cloudRes.savedRow) {
      const synced = mapPayrollEmployeeFromDb(cloudRes.savedRow);
      setPayrollEmployees((prev) => {
        const updated = prev.map((e) => (e.id === saved.id ? synced : e));
        saveState('payroll_employees', updated);
        return updated;
      });
    }
    addAuditLog('Empleados', `Empleado ${saved.fullName} (${saved.teamGroup}) guardado`);
    return {
      ok: true,
      employee: saved,
      cloudSynced: cloudRes.ok,
      cloudError: cloudRes.error,
    };
  };

  const setPayrollEmployeeActive = async (
    id: string,
    active: boolean,
    terminationReason?: string
  ): Promise<{ ok: boolean; cloudSynced?: boolean }> => {
    const existing = payrollEmployees.find((e) => e.id === id);
    if (!existing) return { ok: false };
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const today = new Date().toISOString().slice(0, 10);
    const updatedEmp: PayrollEmployee = {
      ...existing,
      active,
      terminationDate: active ? undefined : today,
      terminationReason: active ? undefined : terminationReason?.trim() || 'Baja registrada por Admin',
      updatedAt: now,
    };

    setPayrollEmployees((prev) => {
      const updated = prev.map((e) => (e.id === id ? updatedEmp : e));
      saveState('payroll_employees', updated);
      return updated;
    });

    const cloudRes = await pushUpsertToSupabase(
      'payroll_employees',
      mapPayrollEmployeeToDb(updatedEmp)
    );

    // Also synchronize linked system credential active status if linked (prevent terminated employee login)
    if (existing.linkedUserId) {
      const linkedUser = appUsers.find((u) => u.id === existing.linkedUserId);
      if (linkedUser && linkedUser.id !== currentUser?.id) {
        const updatedUser: AppUser = {
          ...linkedUser,
          active,
          updatedAt: new Date().toISOString(),
        };
        setAppUsers((prev) => {
          const next = prev.map((u) => (u.id === updatedUser.id ? updatedUser : u));
          saveState('app_users', next);
          return next;
        });
        await pushUpsertToSupabase('app_users', mapAppUserToDb(updatedUser));
      }
    }

    addAuditLog(
      'Empleados',
      active ? `Empleado ${existing.fullName} reactivado` : `Baja de empleado ${existing.fullName}`
    );
    return { ok: true, cloudSynced: cloudRes.ok };
  };

  const deletePayrollEmployee = async (
    id: string
  ): Promise<{ ok: boolean; cloudSynced?: boolean }> => {
    setPayrollEmployees((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      saveState('payroll_employees', updated);
      return updated;
    });
    const res = await pushDeleteToSupabase('payroll_employees', id);
    addAuditLog('Empleados', `Empleado eliminado (ID: ${id})`);
    return { ok: true, cloudSynced: res.ok };
  };

  const savePayrollWeek = async (
    weekInput: Omit<PayrollWeekEntry, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
    syncLoanBalances = true
  ): Promise<{ entry: PayrollWeekEntry; cloudSynced: boolean; cloudError?: string }> => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const existing = existingId ? payrollWeeks.find((w) => w.id === existingId) : undefined;
    const saved: PayrollWeekEntry = {
      ...weekInput,
      id:
        existingId ||
        `pw-${weekInput.startDate}-${(weekInput.teamGroup || 'general').toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    setPayrollWeeks((prev) => {
      const exists = prev.some((w) => w.id === saved.id);
      const updated = exists
        ? prev.map((w) => (w.id === saved.id ? saved : w))
        : [saved, ...prev];
      saveState('payroll_weeks', updated);
      return updated;
    });

    const cloudRes = await pushUpsertToSupabase('payroll_weeks', mapPayrollWeekToDb(saved));
    if (cloudRes.ok && cloudRes.savedRow) {
      const synced = mapPayrollWeekFromDb(cloudRes.savedRow);
      setPayrollWeeks((prev) => {
        const updated = prev.map((w) => (w.id === saved.id ? synced : w));
        saveState('payroll_weeks', updated);
        return updated;
      });
    }

    // Automatically sync employee loan balances and record deterministic loan payment movements
    if (syncLoanBalances) {
      const employeesToSync: PayrollEmployee[] = [];
      const loansToSync: EmployeeLoanMovement[] = [];

      for (const row of saved.rows) {
        const emp = payrollEmployees.find((e) => e.id === row.employeeId);
        if (!emp) continue;
        const targetBalance = Math.max(0, round2(row.loanRemainingBalance));
        if (row.loanPayment > 0 || (row.loanPreviousBalance > 0 && targetBalance !== emp.loanBalance)) {
          employeesToSync.push({
            ...emp,
            loanBalance: targetBalance,
            updatedAt: now,
          });
        }
        if (row.loanPayment > 0) {
          const movementId = `eln-pw-${saved.id}-${row.employeeId}`;
          loansToSync.push({
            id: movementId,
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            movementDate: saved.endDate || saved.startDate,
            movementType: 'abono',
            amount: round2(row.loanPayment),
            balanceAfter: targetBalance,
            concept: `Pago de préstamo en nómina ${saved.weekLabel}`,
            payrollWeekId: saved.id,
            notes: `Saldo anterior: $${round2(row.loanPreviousBalance).toFixed(2)} → Resta: $${targetBalance.toFixed(2)}`,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (employeesToSync.length > 0) {
        const mapById = new Map(employeesToSync.map((e) => [e.id, e]));
        setPayrollEmployees((prev) => {
          const updated = prev.map((e) => mapById.get(e.id) || e);
          saveState('payroll_employees', updated);
          return updated;
        });
        for (const emp of employeesToSync) {
          await pushUpsertToSupabase('payroll_employees', mapPayrollEmployeeToDb(emp));
        }
      }

      if (loansToSync.length > 0) {
        setEmployeeLoans((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          loansToSync.forEach((m) => byId.set(m.id, m));
          const updated = Array.from(byId.values()).sort((a, b) =>
            b.movementDate.localeCompare(a.movementDate)
          );
          saveState('employee_loans', updated);
          return updated;
        });
        for (const loanMov of loansToSync) {
          await pushUpsertToSupabase('employee_loans', mapEmployeeLoanToDb(loanMov));
        }
      }
    }

    addAuditLog(
      'Pagos y Nómina',
      `Nómina ${saved.weekLabel} (${saved.teamGroup}) guardada por $${saved.grandTotalPay.toFixed(2)}`
    );
    return { entry: saved, cloudSynced: cloudRes.ok, cloudError: cloudRes.error };
  };

  const deletePayrollWeek = async (
    id: string
  ): Promise<{ ok: boolean; cloudSynced?: boolean }> => {
    setPayrollWeeks((prev) => {
      const updated = prev.filter((w) => w.id !== id);
      saveState('payroll_weeks', updated);
      return updated;
    });
    const res = await pushDeleteToSupabase('payroll_weeks', id);
    addAuditLog('Pagos y Nómina', `Nómina semanal eliminada (ID: ${id})`);
    return { ok: true, cloudSynced: res.ok };
  };

  const addEmployeeLoanMovement = async (
    input: Omit<EmployeeLoanMovement, 'id' | 'balanceAfter' | 'createdAt' | 'updatedAt'>
  ): Promise<{
    ok: boolean;
    error?: string;
    movement?: EmployeeLoanMovement;
    cloudSynced?: boolean;
    cloudError?: string;
  }> => {
    const emp = payrollEmployees.find((e) => e.id === input.employeeId);
    if (!emp) {
      return { ok: false, error: 'Selecciona un empleado válido.' };
    }
    const cleanAmount = round2(input.amount);
    if (cleanAmount <= 0) {
      return { ok: false, error: 'Ingresa un monto mayor a cero.' };
    }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newBalance =
      input.movementType === 'prestamo'
        ? round2((emp.loanBalance || 0) + cleanAmount)
        : Math.max(0, round2((emp.loanBalance || 0) - cleanAmount));

    const movement: EmployeeLoanMovement = {
      ...input,
      employeeName: emp.fullName,
      amount: cleanAmount,
      balanceAfter: newBalance,
      id: `eln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };

    const updatedEmp: PayrollEmployee = {
      ...emp,
      loanBalance: newBalance,
      updatedAt: now,
    };

    setEmployeeLoans((prev) => {
      const updated = [movement, ...prev];
      saveState('employee_loans', updated);
      return updated;
    });

    setPayrollEmployees((prev) => {
      const updated = prev.map((e) => (e.id === emp.id ? updatedEmp : e));
      saveState('payroll_employees', updated);
      return updated;
    });

    const [loanRes, empRes] = await Promise.all([
      pushUpsertToSupabase('employee_loans', mapEmployeeLoanToDb(movement)),
      pushUpsertToSupabase('payroll_employees', mapPayrollEmployeeToDb(updatedEmp)),
    ]);

    if (loanRes.ok && loanRes.savedRow) {
      const synced = mapEmployeeLoanFromDb(loanRes.savedRow);
      setEmployeeLoans((prev) => {
        const updated = prev.map((m) => (m.id === movement.id ? synced : m));
        saveState('employee_loans', updated);
        return updated;
      });
    }

    addAuditLog(
      'Préstamos Empleados',
      `${input.movementType.toUpperCase()} $${cleanAmount.toFixed(2)} a ${emp.fullName} (Saldo: $${newBalance.toFixed(2)})`
    );
    return {
      ok: true,
      movement,
      cloudSynced: loanRes.ok && empRes.ok,
      cloudError: loanRes.error || empRes.error,
    };
  };

  const deleteEmployeeLoanMovement = async (
    id: string
  ): Promise<{ ok: boolean; cloudSynced?: boolean }> => {
    const target = employeeLoans.find((m) => m.id === id);
    setEmployeeLoans((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveState('employee_loans', updated);
      return updated;
    });
    const res = await pushDeleteToSupabase('employee_loans', id);

    // Revert balance on employee cleanly
    if (target) {
      const emp = payrollEmployees.find((e) => e.id === target.employeeId);
      if (emp) {
        const revertedBalance =
          target.movementType === 'prestamo'
            ? Math.max(0, round2(emp.loanBalance - target.amount))
            : round2(emp.loanBalance + target.amount);
        const updatedEmp: PayrollEmployee = {
          ...emp,
          loanBalance: revertedBalance,
          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        };
        setPayrollEmployees((prev) => {
          const updated = prev.map((e) => (e.id === emp.id ? updatedEmp : e));
          saveState('payroll_employees', updated);
          return updated;
        });
        await pushUpsertToSupabase('payroll_employees', mapPayrollEmployeeToDb(updatedEmp));
      }
    }

    addAuditLog('Préstamos Empleados', `Movimiento eliminado (ID: ${id})`);
    return { ok: true, cloudSynced: res.ok };
  };

  const saveSupplierPayment = async (
    input: Omit<SupplierPayment, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ): Promise<{ entry: SupplierPayment; cloudSynced: boolean; cloudError?: string }> => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const existing = existingId ? supplierPayments.find((s) => s.id === existingId) : undefined;
    const saved: SupplierPayment = {
      ...input,
      supplierName: input.supplierName.trim(),
      concept: input.concept.trim(),
      amount: round2(input.amount),
      paidAmount:
        input.status === 'pagado'
          ? round2(input.amount)
          : input.status === 'pendiente'
          ? 0
          : round2(input.paidAmount),
      id: existingId || `sp-${input.paymentDate}-${Date.now().toString(36)}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    setSupplierPayments((prev) => {
      const exists = prev.some((s) => s.id === saved.id);
      const updated = exists
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [saved, ...prev];
      saveState('supplier_payments', updated);
      return updated;
    });

    const cloudRes = await pushUpsertToSupabase('supplier_payments', mapSupplierPaymentToDb(saved));
    if (cloudRes.ok && cloudRes.savedRow) {
      const synced = mapSupplierPaymentFromDb(cloudRes.savedRow);
      setSupplierPayments((prev) => {
        const updated = prev.map((s) => (s.id === saved.id ? synced : s));
        saveState('supplier_payments', updated);
        return updated;
      });
    }
    addAuditLog(
      'Pagos Proveedores',
      `${saved.supplierName} - $${saved.amount.toFixed(2)} (${saved.status})`
    );
    return { entry: saved, cloudSynced: cloudRes.ok, cloudError: cloudRes.error };
  };

  const deleteSupplierPayment = async (
    id: string
  ): Promise<{ ok: boolean; cloudSynced?: boolean }> => {
    setSupplierPayments((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveState('supplier_payments', updated);
      return updated;
    });
    const res = await pushDeleteToSupabase('supplier_payments', id);
    addAuditLog('Pagos Proveedores', `Pago eliminado (ID: ${id})`);
    return { ok: true, cloudSynced: res.ok };
  };

  // ---------- Authentication, Permissions & User Profile Management ----------
  const canAccessRole = (role: UserRole): boolean => {
    if (!currentUser) return false;
    const cfg = ROLES.find((r) => r.id === role);
    if (!cfg || cfg.enabled === false) return false;
    if (currentUser.role === 'admin') {
      return role === 'admin' || role === 'produccion';
    }
    return role === 'produccion';
  };

  const setActiveRole = (role: UserRole | null) => {
    if (role === null) {
      setActiveRoleState(null);
      return;
    }
    if (!currentUser) return;
    if (role === 'admin' && currentUser.role !== 'admin') return;
    setActiveRoleState(role);
  };

  const login = async (
    rawUsername: string,
    rawPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanUser = rawUsername.trim();
    const cleanPass = rawPassword;

    if (!cleanUser || !cleanPass) {
      return { ok: false, error: 'Ingresa tu usuario y contraseña.' };
    }

    // Try matching live Supabase user first if online & connected
    let matchedUser: AppUser | undefined;
    if (supabaseConfig.isConnected && isOnline) {
      const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
      if (client) {
        const { data, error } = await client
          .from('app_users')
          .select('*')
          .ilike('username', cleanUser)
          .limit(1);
        if (!error && data && data.length > 0) {
          const remoteUser = mapAppUserFromDb(data[0]);
          if (remoteUser.password === cleanPass) {
            matchedUser = remoteUser;
            setAppUsers((prev) => {
              const exists = prev.some((u) => u.id === remoteUser.id);
              const updated = exists
                ? prev.map((u) => (u.id === remoteUser.id ? remoteUser : u))
                : [remoteUser, ...prev];
              saveState('app_users', updated);
              return updated;
            });
          } else {
            return { ok: false, error: 'Usuario o contraseña incorrectos.' };
          }
        }
      }
    }

    if (!matchedUser) {
      matchedUser = appUsers.find(
        (u) =>
          u.username.trim().toLowerCase() === cleanUser.toLowerCase() &&
          u.password === cleanPass
      );
    }

    if (!matchedUser) {
      return { ok: false, error: 'Usuario o contraseña incorrectos.' };
    }

    if (matchedUser.active === false) {
      return { ok: false, error: 'Esta cuenta se encuentra desactivada. Contacta al Administrador.' };
    }

    setCurrentUserId(matchedUser.id);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}session_user_id`, matchedUser.id);
    setActiveRoleState(null);
    setActiveView(matchedUser.role === 'admin' ? 'admin_panel' : 'produccion_dia');
    addAuditLog('Inicio de Sesión', `Usuario ${matchedUser.username} (${matchedUser.role}) ingresó al sistema`);
    return { ok: true };
  };

  const logout = () => {
    if (currentUser) {
      addAuditLog('Cierre de Sesión', `Usuario ${currentUser.username} cerró sesión`);
    }
    setCurrentUserId(null);
    setActiveRoleState(null);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}session_user_id`);
  };

  const saveAppUser = async (
    userInput: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ): Promise<{
    ok: boolean;
    error?: string;
    cloudSynced?: boolean;
    cloudError?: string;
    user?: AppUser;
  }> => {
    const cleanUsername = userInput.username.trim();
    if (!cleanUsername || !userInput.fullName.trim() || !userInput.password) {
      return { ok: false, error: 'Nombre, usuario y contraseña son obligatorio.' };
    }
    const duplicate = appUsers.find(
      (u) =>
        u.username.toLowerCase() === cleanUsername.toLowerCase() && u.id !== existingId
    );
    if (duplicate) {
      return { ok: false, error: `El usuario "${cleanUsername}" ya existe.` };
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const existing = existingId ? appUsers.find((u) => u.id === existingId) : undefined;
    const saved: AppUser = {
      ...userInput,
      username: cleanUsername,
      fullName: userInput.fullName.trim(),
      id: existingId || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    setAppUsers((prev) => {
      const updated = existingId
        ? prev.map((u) => (u.id === existingId ? saved : u))
        : [...prev, saved];
      saveState('app_users', updated);
      return updated;
    });

    const cloudRes = await pushUpsertToSupabase('app_users', mapAppUserToDb(saved));
    let finalUser = saved;
    if (cloudRes.ok && cloudRes.savedRow) {
      finalUser = mapAppUserFromDb(cloudRes.savedRow);
      setAppUsers((prev) => {
        const updated = prev.map((u) => (u.id === saved.id ? finalUser : u));
        saveState('app_users', updated);
        return updated;
      });
    }
    addAuditLog('Gestión de Usuarios', `Usuario ${finalUser.username} (${finalUser.role}) guardado`);
    return {
      ok: true,
      user: finalUser,
      cloudSynced: cloudRes.ok,
      cloudError: cloudRes.error,
    };
  };

  const updateCurrentProfile = async (
    updates: Partial<AppUser>
  ): Promise<{ ok: boolean; error?: string; cloudSynced?: boolean; cloudError?: string }> => {
    if (!currentUser) return { ok: false, error: 'No hay sesión activa.' };
    const nextUsername = (updates.username ?? currentUser.username).trim();
    const duplicate = appUsers.find(
      (u) =>
        u.username.toLowerCase() === nextUsername.toLowerCase() &&
        u.id !== currentUser.id
    );
    if (duplicate) {
      return { ok: false, error: `El nombre de usuario "${nextUsername}" ya está en uso.` };
    }

    const now = new Date().toISOString();
    const updatedUser: AppUser = {
      ...currentUser,
      ...updates,
      username: nextUsername,
      fullName: (updates.fullName ?? currentUser.fullName).trim(),
      email: (updates.email ?? currentUser.email ?? '').trim(),
      phone: (updates.phone ?? currentUser.phone ?? '').trim(),
      jobTitle: (updates.jobTitle ?? currentUser.jobTitle ?? '').trim(),
      department: (updates.department ?? currentUser.department ?? '').trim(),
      notes: (updates.notes ?? currentUser.notes ?? '').trim(),
      role: currentUser.role, // users keep their assigned role on self-profile edit
      updatedAt: now,
    };

    setAppUsers((prev) => {
      const updated = prev.map((u) => (u.id === currentUser.id ? updatedUser : u));
      saveState('app_users', updated);
      return updated;
    });

    const cloudRes = await pushUpsertToSupabase('app_users', mapAppUserToDb(updatedUser));
    if (cloudRes.ok && cloudRes.savedRow) {
      const synced = mapAppUserFromDb(cloudRes.savedRow);
      if (synced.id !== currentUser.id) {
        setCurrentUserId(synced.id);
        localStorage.setItem(`${STORAGE_KEY_PREFIX}session_user_id`, synced.id);
      }
      setAppUsers((prev) => {
        const updated = prev.map((u) =>
          u.id === currentUser.id || u.id === synced.id ? synced : u
        );
        saveState('app_users', updated);
        return updated;
      });
    }
    addAuditLog('Actualización de Perfil', `${updatedUser.username} actualizó sus datos personales`);
    return { ok: true, cloudSynced: cloudRes.ok, cloudError: cloudRes.error };
  };

  const deleteAppUser = async (
    id: string
  ): Promise<{ ok: boolean; error?: string; cloudSynced?: boolean }> => {
    if (currentUser?.id === id) {
      return { ok: false, error: 'No puedes eliminar tu propia cuenta activa.' };
    }
    setAppUsers((prev) => {
      const updated = prev.filter((u) => u.id !== id);
      saveState('app_users', updated);
      return updated;
    });
    const res = await pushDeleteToSupabase('app_users', id);
    addAuditLog('Gestión de Usuarios', `Usuario eliminado (ID: ${id})`);
    return { ok: true, cloudSynced: res.ok };
  };

  // Demo data wipe function (as requested in the prompt)
  const clearAllDemoData = () => {
    setModules([]);
    setTasks([]);
    setIrrigation([]);
    setPestMonitoring([]);
    setApplications([]);
    setHarvest([]);
    setInventory([]);
    setEquipment([]);
    setWorkers([]);
    setCustomers([]);
    setOrders([]);
    setBankAccounts([]);
    setMovements([]);
    setLoans([]);
    setAuditLogs([]);
    setAromaSheets([]);
    setDailyProductions([]);
    setDailySales([]);
    setPayrollWeeks([]);
    setEmployeeLoans([]);
    setSupplierPayments([]);

    localStorage.setItem(`${STORAGE_KEY_PREFIX}demo_cleared`, 'true');
    localStorage.setItem(`${STORAGE_KEY_PREFIX}never_show_demo`, 'true');
    setDemoDataCleared(true);
    setNeverShowDemoAgainState(true);

    // Clean stored keys
    const keys = [
      'modules',
      'tasks',
      'irrigation',
      'pest_monitoring',
      'applications',
      'harvest',
      'inventory',
      'equipment',
      'workers',
      'customers',
      'orders',
      'bank_accounts',
      'movements',
      'loans',
      'audit_logs',
      'aroma_sheets',
      'daily_productions',
      'daily_sales',
      'payroll_weeks',
      'employee_loans',
      'supplier_payments',
    ];
    keys.forEach((k) => localStorage.removeItem(`${STORAGE_KEY_PREFIX}${k}`));

    addAuditLog('Sistema', 'Datos de muestra eliminados completamente del sistema');
  };

  const restoreDemoData = () => {
    setModules(INITIAL_MODULES);
    setTasks(INITIAL_TASKS);
    setIrrigation(INITIAL_IRRIGATION);
    setPestMonitoring(INITIAL_PEST_MONITORING);
    setApplications(INITIAL_APPLICATIONS);
    setHarvest(INITIAL_HARVEST);
    setInventory(INITIAL_INVENTORY);
    setEquipment(INITIAL_EQUIPMENT);
    setWorkers(INITIAL_WORKERS);
    setCustomers(INITIAL_CUSTOMERS);
    setOrders(INITIAL_ORDERS);
    setBankAccounts(INITIAL_ACCOUNTS);
    setMovements(INITIAL_MOVEMENTS);
    setLoans(INITIAL_LOANS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setAromaSheets(INITIAL_AROMA_FLOWER_SHEETS);
    setDailyProductions(INITIAL_DAILY_PRODUCTIONS);
    setDailySales(INITIAL_DAILY_SALES);
    setPayrollEmployees(INITIAL_PAYROLL_EMPLOYEES);
    setPayrollWeeks(INITIAL_PAYROLL_WEEKS);
    setEmployeeLoans(INITIAL_EMPLOYEE_LOANS);
    setSupplierPayments(INITIAL_SUPPLIER_PAYMENTS);

    localStorage.removeItem(`${STORAGE_KEY_PREFIX}demo_cleared`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}never_show_demo`);
    setDemoDataCleared(false);
    setNeverShowDemoAgainState(false);

    addAuditLog('Sistema', 'Datos de muestra restaurados para demostración');
  };

  const setNeverShowDemoAgain = (val: boolean) => {
    setNeverShowDemoAgainState(val);
    if (val) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}never_show_demo`, 'true');
    } else {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}never_show_demo`);
    }
  };

  const saveSupabaseConfig = (url: string, key: string) => {
    const cleanUrl = normalizeSupabaseUrl(url);
    const cleanKey = key.trim();
    const cfg = {
      url: cleanUrl,
      anonKey: cleanKey,
      isConnected: Boolean(cleanUrl && cleanKey),
    };
    setSupabaseConfig(cfg);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}supabase_cfg`, JSON.stringify(cfg));
    addAuditLog('Configuración Supabase', cfg.isConnected ? 'Credenciales Supabase guardadas' : 'Supabase desconectado');
  };

  const testSupabase = async (overrideUrl?: string, overrideKey?: string): Promise<SupabaseTestResult> => {
    const targetUrl = overrideUrl !== undefined ? normalizeSupabaseUrl(overrideUrl) : supabaseConfig.url;
    const targetKey = overrideKey !== undefined ? overrideKey.trim() : supabaseConfig.anonKey;
    setSupabaseStatus('connecting');
    const result = await testSupabaseConnection(targetUrl, targetKey);
    setSupabaseStatus(result.status);
    setSupabaseMessage(result.message);
    return result;
  };

  const syncAllToSupabase = async (): Promise<{ ok: boolean; syncedCount: number; message: string }> => {
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) {
      return { ok: false, syncedCount: 0, message: 'No hay credenciales válidas de Supabase configuradas.' };
    }
    setIsSyncingSupabase(true);
    try {
      const res = await pushAllLocalToSupabase(
        client,
        {
          aromaSheets,
          appUsers,
          aromaProducts,
          dailyProductions,
          dailySales,
          payrollEmployees,
          payrollWeeks,
          employeeLoans,
          supplierPayments,
          modules,
          tasks,
          irrigation,
          pestMonitoring,
          applications,
          harvest,
          inventory,
          equipment,
          workers,
          customers,
          orders,
          bankAccounts,
          movements,
          loans,
          auditLogs,
        },
        onlyAromaFlowers
      );
      setSupabaseStatus(res.status);
      setSupabaseMessage(res.message);
      if (res.ok) {
        addAuditLog('Sincronización Supabase', `${res.syncedCount} registros subidos a la nube`);
      }
      return { ok: res.ok, syncedCount: res.syncedCount, message: res.message };
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const generateSupabaseSql = (): string => {
    if (onlyAromaFlowers) {
      return `-- ================================================================
-- AROMA FLOWER - ESQUEMA ACTUALIZADO PARA SUPABASE
-- Roles Activos: Admin y Producción (con Mi Perfil en ambos)
-- Módulos: Producción del Día ( CEDA CDMX ), Resumen de Ventas, Catálogo,
--          Empleados (Credenciales + WhatsApp) y Pagos (Nómina, Préstamos, Proveedores)
-- Proyecto: aromaflowers@appdesignsoftware.com's Project (syrchvrxkkwvwynvtzfq)
-- IMPORTANTE: Pega este código en SQL Editor y haz clic en el botón verde "Run"
-- ================================================================

-- 1. Eliminar tablas heredadas desactivadas para que Supabase detecte
--    únicamente las 8 tablas activas actuales:
--    app_users, app_products, daily_productions, daily_sales,
--    payroll_employees, payroll_weeks, employee_loans, supplier_payments
DROP TABLE IF EXISTS
  aroma_flower_sheets,
  active_loans,
  audit_logs,
  bank_accounts,
  cultural_tasks,
  customers,
  equipment_assets,
  financial_movements,
  harvest_records,
  inventory_items,
  irrigation_logs,
  modules,
  pest_monitoring,
  phytosanitary_applications,
  sales_orders,
  workers
CASCADE;

-- 2. Tabla de Usuarios, Credenciales, Roles y Módulo Perfil
CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'produccion' CHECK (role IN ('admin', 'produccion')),
    avatar_url TEXT,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    job_title TEXT DEFAULT '',
    department TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_app_users_username
  ON app_users (LOWER(username));

-- Credenciales iniciales (conserva correos/fotos/contraseñas ya editados si existen)
INSERT INTO app_users (id, full_name, username, password, role, job_title, department, notes, active, created_at)
VALUES
  ('usr-haroldo90', 'Harold Anguiano Morales', 'haroldo90', 'Chevropar#1970', 'admin', 'Administrador General', 'Dirección & Administración', 'Acceso completo a Admin y Producción.', TRUE, '2026-11-18 05:00'),
  ('usr-admin-1', 'Admin_1', 'Admin_1', 'Chevropar#1970', 'admin', 'Administrador del Sistema', 'Administración', 'Cuenta administrativa principal.', TRUE, '2026-11-18 05:00'),
  ('usr-aaron-mena', 'Aaron Mena', 'aaron_mena', 'Chevropar#1970', 'admin', 'Administrador de Producción', 'Producción & Ventas', 'Acceso completo a Admin y Producción.', TRUE, '2026-11-18 05:00'),
  ('usr-aaron-prod', 'Aaron', 'aaron', 'Chevropar#1970', 'produccion', 'Encargado de Producción', 'Producción Invernadero', 'Cuenta operativa de producción del día.', TRUE, '2026-11-18 05:00'),
  ('usr-david-prod', 'David', 'david', 'Chevropar#1970', 'produccion', 'Encargado de Producción', 'Producción Invernadero', 'Cuenta operativa de producción del día.', TRUE, '2026-11-18 05:00')
ON CONFLICT (username) DO NOTHING;

-- 3. Tabla de Catálogo Dinámico de Productos / Variedades (Administrado por Admin)
CREATE TABLE IF NOT EXISTS app_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    capture_mode TEXT NOT NULL DEFAULT 'lar_med_chi' CHECK (capture_mode IN ('lar_med_chi', 'direct_total')),
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_products_sort
  ON app_products (sort_order ASC, name ASC);

INSERT INTO app_products (id, name, capture_mode, sort_order, active, created_at)
VALUES
  ('prod-freedom', 'FREEDOM', 'lar_med_chi', 1, TRUE, '2026-11-09 08:00'),
  ('prod-mondial', 'MONDIAL', 'lar_med_chi', 2, TRUE, '2026-11-09 08:00'),
  ('prod-proud', 'PROUD', 'lar_med_chi', 3, TRUE, '2026-11-09 08:00'),
  ('prod-hermosa', 'HERMOSA', 'lar_med_chi', 4, TRUE, '2026-11-09 08:00'),
  ('prod-topaz', 'TOPAZ', 'lar_med_chi', 5, TRUE, '2026-11-09 08:00'),
  ('prod-caricia', 'CARICIA', 'lar_med_chi', 6, TRUE, '2026-11-09 08:00'),
  ('prod-homer', 'HOMER', 'lar_med_chi', 7, TRUE, '2026-11-09 08:00'),
  ('prod-deep-purple', 'DEEP PURPLE', 'lar_med_chi', 8, TRUE, '2026-11-09 08:00'),
  ('prod-cool-water', 'COOL WATER', 'lar_med_chi', 9, TRUE, '2026-11-09 08:00'),
  ('prod-novia', 'NOVIA', 'lar_med_chi', 10, TRUE, '2026-11-09 08:00'),
  ('prod-bouevard', 'BOUEVARD', 'lar_med_chi', 11, TRUE, '2026-11-09 08:00'),
  ('prod-samuray', 'SAMURAY', 'lar_med_chi', 12, TRUE, '2026-11-09 08:00'),
  ('prod-salma', 'SALMA', 'lar_med_chi', 13, TRUE, '2026-11-09 08:00'),
  ('prod-blancaricia', 'BLANCARICIA', 'lar_med_chi', 14, TRUE, '2026-11-09 08:00'),
  ('prod-shimer', 'SHIMER', 'lar_med_chi', 15, TRUE, '2026-11-09 08:00'),
  ('prod-mandala', 'MANDALA', 'lar_med_chi', 16, TRUE, '2026-11-09 08:00'),
  ('prod-bee-sweet', 'BEE SWEET', 'lar_med_chi', 17, TRUE, '2026-11-09 08:00'),
  ('prod-ocean-sun', 'OCEAN SUN', 'lar_med_chi', 18, TRUE, '2026-11-09 08:00'),
  ('prod-gotcha', 'GOTCHA', 'lar_med_chi', 19, TRUE, '2026-11-09 08:00'),
  ('prod-inglesa', 'INGLESA', 'lar_med_chi', 20, TRUE, '2026-11-09 08:00'),
  ('prod-combinados', 'COMBINADOS', 'lar_med_chi', 21, TRUE, '2026-11-09 08:00'),
  ('prod-std-y-mol', 'STD Y MOL', 'direct_total', 22, TRUE, '2026-11-09 08:00')
ON CONFLICT (name) DO NOTHING;

-- 4. Tabla de Producción del Día ( CEDA CDMX ) por Empleado
CREATE TABLE IF NOT EXISTS daily_productions (
    id TEXT PRIMARY KEY,
    production_date TEXT NOT NULL,
    employee_user_id TEXT NOT NULL,
    employee_username TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_lar INT NOT NULL DEFAULT 0,
    total_med INT NOT NULL DEFAULT 0,
    total_chi INT NOT NULL DEFAULT 0,
    grand_total INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_productions_date_emp
  ON daily_productions (production_date DESC, employee_user_id);

-- 5. Nueva Tabla de Resumen de Ventas Diarias ( CEDA CDMX ) por Empleado y Variedad
CREATE TABLE IF NOT EXISTS daily_sales (
    id TEXT PRIMARY KEY,
    sale_date TEXT NOT NULL,
    employee_user_id TEXT NOT NULL,
    employee_username TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'CEDA CDMX',
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_packages INT NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_date_emp
  ON daily_sales (sale_date DESC, employee_user_id);

-- 6. Tabla de Empleados (Módulo Empleados + Sueldo Semanal + Saldo Préstamo + Vínculo Credencial)
CREATE TABLE IF NOT EXISTS payroll_employees (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    team_group TEXT NOT NULL DEFAULT 'AARON',
    job_title TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    weekly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    has_attendance_bonus BOOLEAN NOT NULL DEFAULT TRUE,
    default_bonus_amount NUMERIC(10, 2) NOT NULL DEFAULT 150,
    loan_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    hire_date TEXT NOT NULL DEFAULT '',
    termination_date TEXT,
    termination_reason TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    linked_user_id TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_employees_group_active
  ON payroll_employees (team_group, active, full_name);

-- Empleados iniciales (Equipo AARON del archivo base - conserva ediciones si ya existen)
INSERT INTO payroll_employees (id, full_name, team_group, job_title, weekly_salary, has_attendance_bonus, default_bonus_amount, loan_balance, hire_date, active, created_at)
VALUES
  ('emp-fidel', 'FIDEL', 'AARON', 'Encargado de Campo', 3500.00, FALSE, 150.00, 0.00, '2026-01-05', TRUE, '2026-11-09 08:00'),
  ('emp-ing-ana', 'ING ANA', 'AARON', 'Ingeniera Agrónoma', 3000.00, FALSE, 150.00, 0.00, '2026-01-05', TRUE, '2026-11-09 08:00'),
  ('emp-guillermo', 'GUILLERMO', 'AARON', 'Operario Invernadero', 2500.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-samuel', 'SAMUEL', 'AARON', 'Operario / Fumigación', 2400.00, TRUE, 150.00, 400.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-alex', 'ALEX', 'AARON', 'Operario / Fumigación', 2400.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-bruno', 'BRUNO', 'AARON', 'Operario / Fumigación', 2400.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-casimiro', 'CASIMIRO', 'AARON', 'Operario / Fumigación', 2400.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-alejandra', 'ALEJANDRA', 'AARON', 'Operaria de Corte y Empaque', 2400.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-mary', 'MARY', 'AARON', 'Operaria de Corte y Empaque', 2400.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-marilu', 'MARILU', 'AARON', 'Operaria de Corte y Empaque', 2400.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-armando', 'ARMANDO', 'AARON', 'Operario / Fumigación', 2400.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-sergio', 'SERGIO', 'AARON', 'Operario / Fumigación', 2400.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00'),
  ('emp-regina', 'REGINA', 'AARON', 'Operaria Invernadero', 2300.00, TRUE, 150.00, 0.00, '2026-01-10', TRUE, '2026-11-09 08:00')
ON CONFLICT (id) DO NOTHING;

-- 7. Tabla de Nóminas Semanales (Módulo Pagos - Empleados)
CREATE TABLE IF NOT EXISTS payroll_weeks (
    id TEXT PRIMARY KEY,
    week_label TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    team_group TEXT NOT NULL DEFAULT 'AARON',
    rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_week_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_fumigadas NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cargadas NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_extra_hours NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_destajos NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_extra_work NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_loan_payments NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_loan_remaining NUMERIC(12, 2) NOT NULL DEFAULT 0,
    grand_total_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'pagada')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_weeks_dates
  ON payroll_weeks (start_date DESC, team_group);

-- 8. Tabla de Préstamos y Abonos / Descuentos de Empleados
CREATE TABLE IF NOT EXISTS employee_loans (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    movement_date TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('prestamo', 'abono', 'descuento')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    balance_after NUMERIC(12, 2) NOT NULL DEFAULT 0,
    concept TEXT NOT NULL DEFAULT '',
    payroll_week_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_loans_emp_date
  ON employee_loans (employee_id, movement_date DESC);

-- 9. Tabla de Pagos a Proveedores y Otros Gastos Operativos
CREATE TABLE IF NOT EXISTS supplier_payments (
    id TEXT PRIMARY KEY,
    payment_date TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'otros',
    concept TEXT NOT NULL DEFAULT '',
    reference TEXT DEFAULT '',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'efectivo',
    status TEXT NOT NULL DEFAULT 'pagado' CHECK (status IN ('pagado', 'pendiente', 'parcial')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_date
  ON supplier_payments (payment_date DESC, status);

-- 10. Habilitar RLS y políticas de acceso para las 8 tablas activas de Aroma Flower
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'app_users',
    'app_products',
    'daily_productions',
    'daily_sales',
    'payroll_employees',
    'payroll_weeks',
    'employee_loans',
    'supplier_payments'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "aroma_flower_full_access" ON %I;', t);
    EXECUTE format(
      'CREATE POLICY "aroma_flower_full_access" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END $$;
`;
    }

    return `-- ================================================================
-- AROMA FLOWER - ESQUEMA COMPLETO PARA SUPABASE (POSTGRESQL)
-- Proyecto: aromaflowers@appdesignsoftware.com's Project (syrchvrxkkwvwynvtzfq)
-- ================================================================

-- 1. Planillas Aroma Flowers (7 Módulos Excel: FI General, Producción Aaron,
--    Suma Paquetes, Resumen Variedades, Venta, Resumen Venta, Matriz 2026)
CREATE TABLE IF NOT EXISTS aroma_flower_sheets (
    id TEXT PRIMARY KEY,
    module_type TEXT NOT NULL,
    sheet_date TEXT NOT NULL,
    responsable TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_lar INT NOT NULL DEFAULT 0,
    total_med INT NOT NULL DEFAULT 0,
    total_chi INT NOT NULL DEFAULT 0,
    grand_total INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aroma_sheets_module_date
  ON aroma_flower_sheets (module_type, sheet_date DESC);

-- 2. Módulos e Invernaderos
CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    variety TEXT NOT NULL,
    area_m2 NUMERIC(10, 2) NOT NULL DEFAULT 0,
    beds_count INT NOT NULL DEFAULT 0,
    plants_count INT NOT NULL DEFAULT 0,
    density_per_m2 NUMERIC(6, 2) NOT NULL DEFAULT 0,
    planting_date TEXT,
    expected_yield_stems INT DEFAULT 0,
    status TEXT DEFAULT 'vegetativo',
    irrigation_sector TEXT,
    tenure TEXT DEFAULT 'propiedad',
    location TEXT,
    coordinates TEXT,
    supervisor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Labores Culturales
CREATE TABLE IF NOT EXISTS cultural_tasks (
    id TEXT PRIMARY KEY,
    module_id TEXT,
    module_code TEXT NOT NULL,
    task_type TEXT NOT NULL,
    task_name TEXT NOT NULL,
    task_date TEXT NOT NULL,
    assigned_team TEXT,
    scheduled_beds INT DEFAULT 0,
    executed_beds INT DEFAULT 0,
    status TEXT DEFAULT 'pendiente',
    notes TEXT,
    has_photos BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Riego y Fertirrigación
CREATE TABLE IF NOT EXISTS irrigation_logs (
    id TEXT PRIMARY KEY,
    log_date TEXT NOT NULL,
    log_time TEXT NOT NULL,
    module_id TEXT,
    module_code TEXT NOT NULL,
    sector TEXT,
    volume_m3 NUMERIC(8, 2) NOT NULL DEFAULT 0,
    duration_minutes INT DEFAULT 0,
    ph_input NUMERIC(4, 2) DEFAULT 0,
    ph_drainage NUMERIC(4, 2) DEFAULT 0,
    ec_input NUMERIC(5, 2) DEFAULT 0,
    ec_drainage NUMERIC(5, 2) DEFAULT 0,
    tensiometer_cbar INT DEFAULT 0,
    tank_a_recipe TEXT,
    tank_b_recipe TEXT,
    operator TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Sanidad Vegetal & Fitosanitarios
CREATE TABLE IF NOT EXISTS pest_monitoring (
    id TEXT PRIMARY KEY,
    monitoring_date TEXT NOT NULL,
    module_id TEXT,
    module_code TEXT NOT NULL,
    section TEXT,
    pest_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    incidence_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'vigilancia',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phytosanitary_applications (
    id TEXT PRIMARY KEY,
    application_date TEXT NOT NULL,
    module_id TEXT,
    module_code TEXT NOT NULL,
    target_pest TEXT NOT NULL,
    product_name TEXT NOT NULL,
    active_ingredient TEXT,
    dose_per_100l TEXT,
    water_volume_liters INT DEFAULT 0,
    treated_area_m2 NUMERIC(10, 2) DEFAULT 0,
    operator TEXT,
    safety_equipment TEXT,
    reentry_hours INT DEFAULT 24,
    cost_total NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'programada',
    efficacy_percent NUMERIC(5, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Cosecha, Poscosecha y Empaque
CREATE TABLE IF NOT EXISTS harvest_records (
    id TEXT PRIMARY KEY,
    harvest_date TEXT NOT NULL,
    module_id TEXT,
    module_code TEXT NOT NULL,
    variety TEXT NOT NULL,
    stems_cut INT NOT NULL DEFAULT 0,
    harvester_team TEXT,
    stems_grade_40cm INT DEFAULT 0,
    stems_grade_50cm INT DEFAULT 0,
    stems_grade_60cm INT DEFAULT 0,
    stems_grade_70cm INT DEFAULT 0,
    stems_grade_80cm INT DEFAULT 0,
    stems_waste INT DEFAULT 0,
    waste_reason TEXT,
    packages_25_stems INT NOT NULL DEFAULT 0,
    cold_room_code TEXT,
    solution_treatment TEXT,
    status TEXT DEFAULT 'en_camara_fria',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Inventario, Almacén y Maquinaria
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    avg_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    last_lot TEXT,
    expiration_date TEXT,
    supplier TEXT,
    warehouse_location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_assets (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    brand_model TEXT,
    acquisition_date TEXT,
    value NUMERIC(12, 2) DEFAULT 0,
    last_maintenance TEXT,
    next_maintenance TEXT,
    status TEXT DEFAULT 'operativo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Personal y Cuadrillas
CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    team TEXT,
    daily_rate NUMERIC(10, 2) DEFAULT 0,
    phone TEXT,
    hire_date TEXT,
    active BOOLEAN DEFAULT TRUE,
    attendance_today TEXT DEFAULT 'presente',
    stems_harvested_week INT DEFAULT 0,
    efficiency_rating INT DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Ventas, Pedidos y Clientes
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    channel TEXT,
    contact_phone TEXT,
    email TEXT,
    city TEXT,
    credit_days INT DEFAULT 0,
    credit_limit NUMERIC(12, 2) DEFAULT 0,
    current_balance NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    order_date TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    channel TEXT,
    variety TEXT,
    grade TEXT,
    packages_25 INT NOT NULL DEFAULT 0,
    total_stems INT NOT NULL DEFAULT 0,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_type TEXT DEFAULT 'contado',
    due_date TEXT,
    status TEXT DEFAULT 'pendiente',
    paid_amount NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Finanzas, Tesorería, Préstamos y Bitácora
CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    account_number TEXT,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'MXN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_movements (
    id TEXT PRIMARY KEY,
    movement_date TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    scope TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    description TEXT,
    bank_account_id TEXT,
    reconciled BOOLEAN DEFAULT FALSE,
    module_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS active_loans (
    id TEXT PRIMARY KEY,
    institution TEXT NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    outstanding_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    interest_rate_annual NUMERIC(6, 2) DEFAULT 0,
    monthly_payment NUMERIC(12, 2) DEFAULT 0,
    term_months INT DEFAULT 0,
    remaining_months INT DEFAULT 0,
    collateral TEXT,
    next_due_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    log_timestamp TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- HABILITAR RLS Y POLÍTICAS DE ACCESO PARA LA APP AROMA FLOWER
-- ================================================================
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'aroma_flower_sheets',
    'modules',
    'cultural_tasks',
    'irrigation_logs',
    'pest_monitoring',
    'phytosanitary_applications',
    'harvest_records',
    'inventory_items',
    'equipment_assets',
    'workers',
    'customers',
    'sales_orders',
    'bank_accounts',
    'financial_movements',
    'active_loans',
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "aroma_flower_full_access" ON %I;', t);
    EXECUTE format(
      'CREATE POLICY "aroma_flower_full_access" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END $$;
`;
  };

  const generateSupabaseCleanupSql = (): string => {
    if (onlyAromaFlowers) {
      return `-- ================================================================
-- SCRIPT DE LIMPIEZA DE REGISTROS OPERATIVOS SUPABASE
-- Invernadero Aroma Flower (Mantiene usuarios, catálogo y empleados)
-- ================================================================
BEGIN;
TRUNCATE TABLE daily_productions, daily_sales, payroll_weeks, employee_loans, supplier_payments CASCADE;
UPDATE payroll_employees SET loan_balance = 0;
COMMIT;
-- Las 8 tablas activas permanecen listas para operación real.
`;
    }

    return `-- ================================================================
-- SCRIPT DE LIMPIEZA DE DATOS SUPABASE (BORRADO TOTAL DE PRUEBA)
-- Invernadero Aroma Flower
-- ================================================================
BEGIN;
TRUNCATE TABLE
  aroma_flower_sheets,
  audit_logs,
  active_loans,
  financial_movements,
  bank_accounts,
  sales_orders,
  customers,
  workers,
  equipment_assets,
  inventory_items,
  harvest_records,
  phytosanitary_applications,
  pest_monitoring,
  irrigation_logs,
  cultural_tasks,
  modules
CASCADE;
COMMIT;
-- Los esquemas y políticas RLS se mantienen intactos listos para producción real.
`;
  };

  const exportDataJson = (): string => {
    const backup = {
      appName: 'Aroma Flower',
      exportedAt: new Date().toISOString(),
      modules,
      tasks,
      irrigation,
      pestMonitoring,
      applications,
      harvest,
      inventory,
      equipment,
      workers,
      customers,
      orders,
      bankAccounts,
      movements,
      loans,
      aromaSheets,
      aromaProducts,
      dailyProductions,
      dailySales,
      payrollEmployees,
      payrollWeeks,
      employeeLoans,
      supplierPayments,
    };
    return JSON.stringify(backup, null, 2);
  };

  const importDataJson = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.modules) setModules(data.modules);
      if (data.tasks) setTasks(data.tasks);
      if (data.irrigation) setIrrigation(data.irrigation);
      if (data.pestMonitoring) setPestMonitoring(data.pestMonitoring);
      if (data.applications) setApplications(data.applications);
      if (data.harvest) setHarvest(data.harvest);
      if (data.inventory) setInventory(data.inventory);
      if (data.equipment) setEquipment(data.equipment);
      if (data.workers) setWorkers(data.workers);
      if (data.customers) setCustomers(data.customers);
      if (data.orders) setOrders(data.orders);
      if (data.bankAccounts) setBankAccounts(data.bankAccounts);
      if (data.movements) setMovements(data.movements);
      if (data.loans) setLoans(data.loans);
      if (data.aromaSheets) setAromaSheets(data.aromaSheets);
      if (data.aromaProducts) setAromaProducts(data.aromaProducts);
      if (data.dailyProductions) setDailyProductions(data.dailyProductions);
      if (data.dailySales) setDailySales(data.dailySales);
      if (data.payrollEmployees) setPayrollEmployees(data.payrollEmployees);
      if (data.payrollWeeks) setPayrollWeeks(data.payrollWeeks);
      if (data.employeeLoans) setEmployeeLoans(data.employeeLoans);
      if (data.supplierPayments) setSupplierPayments(data.supplierPayments);

      setDemoDataCleared(false);
      addAuditLog('Restauración de Respaldo', 'Base de datos restaurada desde archivo JSON');
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  };

  const syncOfflineQueue = async () => {
    if (!isOnline || !supabaseConfig.isConnected) return;
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) return;
    await flushOfflineQueue(client);
  };

  return (
    <GreenhouseContext.Provider
      value={{
        currentUser,
        appUsers,
        login,
        logout,
        canAccessRole,
        saveAppUser,
        updateCurrentProfile,
        deleteAppUser,
        activeRole,
        setActiveRole,
        activeView,
        setActiveView,
        modules,
        tasks,
        irrigation,
        pestMonitoring,
        applications,
        harvest,
        inventory,
        equipment,
        workers,
        customers,
        orders,
        bankAccounts,
        movements,
        loans,
        auditLogs,
        offlineQueue,
        aromaSheets,
        saveAromaSheet,
        deleteAromaSheet,
        aromaProducts,
        saveAromaProduct,
        deleteAromaProduct,
        dailyProductions,
        saveDailyProduction,
        deleteDailyProduction,
        dailySales,
        saveDailySale,
        deleteDailySale,
        payrollEmployees,
        savePayrollEmployee,
        setPayrollEmployeeActive,
        deletePayrollEmployee,
        payrollWeeks,
        savePayrollWeek,
        deletePayrollWeek,
        employeeLoans,
        addEmployeeLoanMovement,
        deleteEmployeeLoanMovement,
        supplierPayments,
        saveSupplierPayment,
        deleteSupplierPayment,
        refreshFromSupabase,
        addModule,
        updateModule,
        deleteModule,
        addTask,
        updateTask,
        addIrrigation,
        addPestMonitoring,
        addApplication,
        addHarvest,
        updateHarvest,
        addInventoryItem,
        updateInventoryStock,
        addWorker,
        updateWorkerAttendance,
        addCustomer,
        addOrder,
        updateOrderStatus,
        addFinancialMovement,
        addLoan,
        addAuditLog,
        demoDataCleared,
        clearAllDemoData,
        restoreDemoData,
        neverShowDemoAgain,
        setNeverShowDemoAgain,
        supabaseConfig,
        supabaseStatus,
        supabaseMessage,
        isSyncingSupabase,
        saveSupabaseConfig,
        testSupabase,
        syncAllToSupabase,
        generateSupabaseSql,
        generateSupabaseCleanupSql,
        exportDataJson,
        importDataJson,
        isOnline,
        syncOfflineQueue,
      }}
    >
      {children}
    </GreenhouseContext.Provider>
  );
};

export const useGreenhouse = () => {
  const context = useContext(GreenhouseContext);
  if (!context) {
    throw new Error('useGreenhouse must be used within a GreenhouseProvider');
  }
  return context;
};
