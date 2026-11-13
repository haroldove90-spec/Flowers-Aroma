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
  mapApplicationToDb,
  mapAuditToDb,
  mapAromaSheetToDb,
  mapCustomerToDb,
  mapEquipmentToDb,
  mapHarvestToDb,
  mapInventoryToDb,
  mapIrrigationToDb,
  mapLoanToDb,
  mapModuleToDb,
  mapMovementToDb,
  mapOrderToDb,
  mapPestToDb,
  mapTaskToDb,
  mapWorkerToDb,
  normalizeSupabaseUrl,
  pushAllLocalToSupabase,
  testSupabaseConnection,
  upsertRowsToSupabase,
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

  // Aroma Flowers Sheets (7 Modules from Excel)
  aromaSheets: AromaFlowerSheetEntry[];
  saveAromaSheet: (sheet: Omit<AromaFlowerSheetEntry, 'id' | 'createdAt'>, existingId?: string) => void;
  deleteAromaSheet: (id: string) => void;

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
  syncOfflineQueue: () => void;
}

const STORAGE_KEY_PREFIX = 'aroma_flowers_';

const GreenhouseContext = createContext<GreenhouseContextType | undefined>(undefined);

export const GreenhouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if demo data was previously wiped by user
  const storedDemoCleared = localStorage.getItem(`${STORAGE_KEY_PREFIX}demo_cleared`) === 'true';
  const storedNeverShow = localStorage.getItem(`${STORAGE_KEY_PREFIX}never_show_demo`) === 'true';

  const [demoDataCleared, setDemoDataCleared] = useState<boolean>(storedDemoCleared || storedNeverShow);
  const [neverShowDemoAgain, setNeverShowDemoAgainState] = useState<boolean>(storedNeverShow);

  // Active Role and View
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [activeView, setActiveView] = useState<string>('principal');

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

  const pushUpsertToSupabase = (table: string, payload: Record<string, any>) => {
    if (!supabaseConfig.isConnected) return;
    if (!isOnline) {
      enqueueOfflineOp({ table, op: 'upsert', payload });
      return;
    }
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) return;
    upsertRowsToSupabase(client, table, [payload]).then((res) => {
      if (res.ok) {
        setSupabaseStatus('connected');
      } else if (res.missingTable) {
        setSupabaseStatus('missing_tables');
        enqueueOfflineOp({ table, op: 'upsert', payload });
      } else {
        enqueueOfflineOp({ table, op: 'upsert', payload });
      }
    });
  };

  const pushDeleteToSupabase = (table: string, recordId: string) => {
    if (!supabaseConfig.isConnected) return;
    if (!isOnline) {
      enqueueOfflineOp({ table, op: 'delete', recordId });
      return;
    }
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) return;
    deleteRowFromSupabase(client, table, recordId).then((res) => {
      if (!res.ok) {
        if (res.missingTable) setSupabaseStatus('missing_tables');
        enqueueOfflineOp({ table, op: 'delete', recordId });
      }
    });
  };

  // Hydrate / check Supabase status on startup and when credentials change
  useEffect(() => {
    if (!supabaseConfig.isConnected || !isOnline) {
      if (!supabaseConfig.isConnected) setSupabaseStatus('disconnected');
      return;
    }
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) return;

    let cancelled = false;
    setSupabaseStatus('connecting');
    fetchAllFromSupabase(client).then((snap) => {
      if (cancelled) return;
      setSupabaseStatus(snap.status);
      if (snap.status === 'missing_tables') {
        setSupabaseMessage('Faltan crear las tablas en Supabase. Ejecuta el Esquema SQL.');
        return;
      }
      if (snap.status === 'error') {
        setSupabaseMessage('Error al consultar Supabase. Verifica tu conexión o políticas RLS.');
        return;
      }
      setSupabaseMessage('Conectado a Supabase');
      if (snap.aromaSheets) {
        setAromaSheets(snap.aromaSheets);
        saveState('aroma_sheets', snap.aromaSheets);
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
    });

    return () => {
      cancelled = true;
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
      const res = await pushAllLocalToSupabase(client, {
        aromaSheets,
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
      });
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

      setDemoDataCleared(false);
      addAuditLog('Restauración de Respaldo', 'Base de datos restaurada desde archivo JSON');
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  };

  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0 || !isOnline || !supabaseConfig.isConnected) return;
    const client = getSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    if (!client) return;

    const remaining: OfflineOperation[] = [];
    let synced = 0;

    for (const item of offlineQueue) {
      if (item.op === 'upsert' && item.payload) {
        const res = await upsertRowsToSupabase(client, item.table, [item.payload]);
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
      addAuditLog('Sincronización Offline', `${synced} registros sincronizados con Supabase`);
    }
  };

  return (
    <GreenhouseContext.Provider
      value={{
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
