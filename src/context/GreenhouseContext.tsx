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

interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
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
  offlineQueue: any[];

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
  saveSupabaseConfig: (url: string, key: string) => void;
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
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  // Supabase Config
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}supabase_cfg`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return { url: '', anonKey: '', isConnected: false };
  });

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

  const addAuditLog = (action: string, details: string) => {
    const newLog: AuditLogEntry = {
      id: `aud-${Date.now()}`,
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
  };

  // Mutators
  const addModule = (mod: GreenhouseModule) => {
    setModules((prev) => {
      const updated = [mod, ...prev];
      saveState('modules', updated);
      return updated;
    });
    addAuditLog('Alta de Módulo', `Módulo ${mod.code} - ${mod.name} (${mod.variety})`);
  };

  const updateModule = (mod: GreenhouseModule) => {
    setModules((prev) => {
      const updated = prev.map((m) => (m.id === mod.id ? mod : m));
      saveState('modules', updated);
      return updated;
    });
    addAuditLog('Actualización de Módulo', `Módulo ${mod.code} actualizado`);
  };

  const deleteModule = (id: string) => {
    setModules((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveState('modules', updated);
      return updated;
    });
    addAuditLog('Eliminación de Módulo', `Módulo ID ${id} eliminado`);
  };

  const addTask = (task: CulturalTask) => {
    setTasks((prev) => {
      const updated = [task, ...prev];
      saveState('tasks', updated);
      return updated;
    });
    addAuditLog('Programación de Labor', `${task.taskName} en ${task.moduleCode}`);
  };

  const updateTask = (task: CulturalTask) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === task.id ? task : t));
      saveState('tasks', updated);
      return updated;
    });
    addAuditLog('Avance de Labor', `${task.taskName} marcado ${task.status}`);
  };

  const addIrrigation = (log: IrrigationLog) => {
    setIrrigation((prev) => {
      const updated = [log, ...prev];
      saveState('irrigation', updated);
      return updated;
    });
    addAuditLog('Riego y Nutrición', `${log.volumeM3}m³ en ${log.moduleCode} pH:${log.phInput} CE:${log.ecInput}`);
  };

  const addPestMonitoring = (item: PestMonitoring) => {
    setPestMonitoring((prev) => {
      const updated = [item, ...prev];
      saveState('pest_monitoring', updated);
      return updated;
    });
    addAuditLog('Monitoreo Fitosanitario', `${item.pestName} en ${item.moduleCode} severidad ${item.severity}`);
  };

  const addApplication = (app: PhytosanitaryApplication) => {
    setApplications((prev) => {
      const updated = [app, ...prev];
      saveState('applications', updated);
      return updated;
    });
    addAuditLog('Aplicación Fitosanitaria', `${app.productName} en ${app.moduleCode} ($${app.costTotal})`);
  };

  const addHarvest = (record: HarvestRecord) => {
    setHarvest((prev) => {
      const updated = [record, ...prev];
      saveState('harvest', updated);
      return updated;
    });
    addAuditLog('Corte y Clasificación', `${record.stemsCut} tallos cortados (${record.packages25Stems} bonches de 25)`);
  };

  const updateHarvest = (record: HarvestRecord) => {
    setHarvest((prev) => {
      const updated = prev.map((h) => (h.id === record.id ? record : h));
      saveState('harvest', updated);
      return updated;
    });
  };

  const addInventoryItem = (item: InventoryItem) => {
    setInventory((prev) => {
      const updated = [item, ...prev];
      saveState('inventory', updated);
      return updated;
    });
    addAuditLog('Alta en Almacén', `${item.name} (${item.stock} ${item.unit})`);
  };

  const updateInventoryStock = (id: string, newStock: number) => {
    setInventory((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, stock: newStock } : item));
      saveState('inventory', updated);
      return updated;
    });
  };

  const addWorker = (worker: Worker) => {
    setWorkers((prev) => {
      const updated = [worker, ...prev];
      saveState('workers', updated);
      return updated;
    });
    addAuditLog('Alta de Personal', `${worker.name} (${worker.role})`);
  };

  const updateWorkerAttendance = (id: string, status: Worker['attendanceToday']) => {
    setWorkers((prev) => {
      const updated = prev.map((w) => (w.id === id ? { ...w, attendanceToday: status } : w));
      saveState('workers', updated);
      return updated;
    });
  };

  const addCustomer = (cust: Customer) => {
    setCustomers((prev) => {
      const updated = [cust, ...prev];
      saveState('customers', updated);
      return updated;
    });
    addAuditLog('Alta de Cliente', `${cust.name} (${cust.channel})`);
  };

  const addOrder = (order: SalesOrder) => {
    setOrders((prev) => {
      const updated = [order, ...prev];
      saveState('orders', updated);
      return updated;
    });
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
      setMovements((prev) => [newMov, ...prev]);
    }
    addAuditLog('Nuevo Pedido de Venta', `Pedido ${order.orderNumber} por $${order.totalAmount} a ${order.customerName}`);
  };

  const updateOrderStatus = (orderId: string, status: SalesOrder['status']) => {
    setOrders((prev) => {
      const updated = prev.map((o) => (o.id === orderId ? { ...o, status } : o));
      saveState('orders', updated);
      return updated;
    });
  };

  const addFinancialMovement = (movement: FinancialMovement) => {
    setMovements((prev) => {
      const updated = [movement, ...prev];
      saveState('movements', updated);
      return updated;
    });
    // update bank balance
    setBankAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === movement.bankAccountId) {
          const delta = movement.type === 'ingreso' ? movement.amount : -movement.amount;
          return { ...acc, balance: acc.balance + delta };
        }
        return acc;
      })
    );
    addAuditLog('Movimiento Financiero', `${movement.type.toUpperCase()}: $${movement.amount} [${movement.scope}]`);
  };

  const addLoan = (loan: ActiveLoan) => {
    setLoans((prev) => {
      const updated = [loan, ...prev];
      saveState('loans', updated);
      return updated;
    });
    addAuditLog('Registro de Préstamo', `${loan.institution} por $${loan.totalAmount}`);
  };

  // Aroma Flowers Sheets Mutators
  const saveAromaSheet = (
    sheet: Omit<AromaFlowerSheetEntry, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    setAromaSheets((prev) => {
      let updated: AromaFlowerSheetEntry[];
      const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
      if (existingId) {
        updated = prev.map((item) =>
          item.id === existingId
            ? { ...sheet, id: existingId, createdAt: item.createdAt }
            : item
        );
      } else {
        const newEntry: AromaFlowerSheetEntry = {
          ...sheet,
          id: `sheet-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          createdAt: now,
        };
        updated = [newEntry, ...prev];
      }
      saveState('aroma_sheets', updated);
      return updated;
    });
    addAuditLog('Aroma Flowers', `Planilla ${sheet.title} guardada (${sheet.grandTotal} tallos/paquetes)`);
  };

  const deleteAromaSheet = (id: string) => {
    setAromaSheets((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveState('aroma_sheets', updated);
      return updated;
    });
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
    const cfg = {
      url,
      anonKey: key,
      isConnected: Boolean(url && key),
    };
    setSupabaseConfig(cfg);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}supabase_cfg`, JSON.stringify(cfg));
    addAuditLog('Configuración Supabase', cfg.isConnected ? 'Credenciales Supabase guardadas' : 'Supabase desconectado');
  };

  const generateSupabaseSql = (): string => {
    return `-- ================================================================
-- AROMA FLOWERS - ESQUEMA DE BASE DE DATOS PARA SUPABASE (POSTGRESQL)
-- Invernadero Florícola de Alta Especialidad
-- ================================================================

-- 1. Módulos e Invernaderos
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    variety VARCHAR(100) NOT NULL,
    area_m2 NUMERIC(10, 2) NOT NULL,
    beds_count INT NOT NULL,
    plants_count INT NOT NULL,
    density_per_m2 NUMERIC(6, 2) NOT NULL,
    planting_date DATE,
    expected_yield_stems INT,
    status VARCHAR(30) DEFAULT 'vegetativo',
    irrigation_sector VARCHAR(50),
    tenure VARCHAR(30) DEFAULT 'propiedad',
    location VARCHAR(150),
    coordinates VARCHAR(100),
    supervisor VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Labores Culturales
CREATE TABLE IF NOT EXISTS cultural_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code VARCHAR(20) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    task_name VARCHAR(150) NOT NULL,
    task_date DATE NOT NULL,
    assigned_team VARCHAR(100),
    scheduled_beds INT DEFAULT 0,
    executed_beds INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pendiente',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Riego y Fertirrigación
CREATE TABLE IF NOT EXISTS irrigation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL,
    log_time TIME NOT NULL,
    module_code VARCHAR(20) NOT NULL,
    sector VARCHAR(50),
    volume_m3 NUMERIC(8, 2) NOT NULL,
    duration_minutes INT,
    ph_input NUMERIC(4, 2),
    ph_drainage NUMERIC(4, 2),
    ec_input NUMERIC(5, 2),
    ec_drainage NUMERIC(5, 2),
    tensiometer_cbar INT,
    tank_a_recipe TEXT,
    tank_b_recipe TEXT,
    operator VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sanidad Vegetal & Fitosanitarios
CREATE TABLE IF NOT EXISTS pest_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoring_date DATE NOT NULL,
    module_code VARCHAR(20) NOT NULL,
    section VARCHAR(100),
    pest_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    incidence_percent NUMERIC(5, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'vigilancia',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phytosanitary_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_date DATE NOT NULL,
    module_code VARCHAR(20) NOT NULL,
    target_pest VARCHAR(100) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    active_ingredient VARCHAR(100),
    dose_per_100l VARCHAR(50),
    water_volume_liters INT,
    treated_area_m2 NUMERIC(10, 2),
    operator VARCHAR(100),
    reentry_hours INT DEFAULT 24,
    cost_total NUMERIC(10, 2),
    status VARCHAR(30) DEFAULT 'programada',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cosecha, Poscosecha y Empaque
CREATE TABLE IF NOT EXISTS harvest_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    harvest_date DATE NOT NULL,
    module_code VARCHAR(20) NOT NULL,
    variety VARCHAR(100) NOT NULL,
    stems_cut INT NOT NULL,
    harvester_team VARCHAR(100),
    stems_waste INT DEFAULT 0,
    waste_reason TEXT,
    packages_25_stems INT NOT NULL,
    cold_room_code VARCHAR(50),
    solution_treatment VARCHAR(150),
    status VARCHAR(30) DEFAULT 'en_camara_fria',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Ventas, Pedidos y Clientes
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50),
    channel VARCHAR(50),
    contact_phone VARCHAR(30),
    email VARCHAR(100),
    city VARCHAR(100),
    credit_days INT DEFAULT 0,
    credit_limit NUMERIC(12, 2) DEFAULT 0,
    current_balance NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(30) UNIQUE NOT NULL,
    order_date DATE NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    channel VARCHAR(50),
    variety VARCHAR(100),
    grade VARCHAR(50),
    packages_25 INT NOT NULL,
    total_stems INT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_type VARCHAR(20) DEFAULT 'contado',
    due_date DATE,
    status VARCHAR(30) DEFAULT 'pendiente',
    paid_amount NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Finanzas, Costos y Tesorería
CREATE TABLE IF NOT EXISTS financial_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_date DATE NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    scope VARCHAR(20) NOT NULL, -- 'empresarial' o 'personal'
    category VARCHAR(80) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    bank_account VARCHAR(80),
    reconciled BOOLEAN DEFAULT FALSE,
    module_code VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultural_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE irrigation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE phytosanitary_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_movements ENABLE ROW LEVEL SECURITY;
`;
  };

  const generateSupabaseCleanupSql = (): string => {
    return `-- ================================================================
-- SCRIPT DE LIMPIEZA DE DATOS SUPABASE (BORRADO TOTAL DE PRUEBA)
-- Invernadero Aroma Flower
-- ================================================================
BEGIN;
TRUNCATE TABLE financial_movements CASCADE;
TRUNCATE TABLE sales_orders CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE harvest_records CASCADE;
TRUNCATE TABLE phytosanitary_applications CASCADE;
TRUNCATE TABLE pest_monitoring CASCADE;
TRUNCATE TABLE irrigation_logs CASCADE;
TRUNCATE TABLE cultural_tasks CASCADE;
TRUNCATE TABLE modules CASCADE;
COMMIT;
-- Los esquemas se mantienen intactos listos para producción real.
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

  const syncOfflineQueue = () => {
    if (offlineQueue.length === 0) return;
    addAuditLog('Sincronización Offline', `${offlineQueue.length} registros sincronizados con éxito`);
    setOfflineQueue([]);
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
        saveSupabaseConfig,
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
