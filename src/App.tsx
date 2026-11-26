import React from 'react';
import { GreenhouseProvider, useGreenhouse } from './context/GreenhouseContext';
import { RoleSelector } from './components/roles/RoleSelector';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { BottomBar } from './components/common/BottomBar';
import { WorkflowView } from './components/workflow/WorkflowView';
import { DirectorView } from './components/director/DirectorView';
import { OperationsView } from './components/operations/OperationsView';
import { AgronomyView } from './components/agronomy/AgronomyView';
import { HarvestView } from './components/harvest/HarvestView';
import { SystemView } from './components/system/SystemView';
import { AromaFlowersRoleView } from './components/aroma_flowers/AromaFlowersRoleView';
import { LoginView } from './components/auth/LoginView';
import { AdminRoleView } from './components/admin/AdminRoleView';
import { AdminProductsView } from './components/admin/AdminProductsView';
import { EmployeesView } from './components/admin/EmployeesView';
import { PaymentsView } from './components/admin/PaymentsView';
import { SuppliersView } from './components/admin/SuppliersView';
import { EmployeeIncidentsView } from './components/admin/EmployeeIncidentsView';
import { SuppliesAndAppsView } from './components/admin/SuppliesAndAppsView';
import { CostControlView } from './components/admin/CostControlView';
import { DailyProductionView } from './components/production/DailyProductionView';
import { DailySalesView } from './components/sales/DailySalesView';
import { SalesOperationsView } from './components/sales/SalesOperationsView';
import { BitacoraView } from './components/bitacora/BitacoraView';
import { FoliarApplicationsView } from './components/foliar/FoliarApplicationsView';
import { ProfileView } from './components/profile/ProfileView';
import { PosView } from './components/pos/PosView';
import { ROLES } from './types/greenhouse';

const MainAppLayout: React.FC = () => {
  const {
    currentUser,
    activeRole,
    activeView,
    isOnline,
    canAccessRole,
    canAccessModule,
    hasFullAccess,
    getDefaultAllowedView,
  } = useGreenhouse();
  const activeRoleConfig = ROLES.find((r) => r.id === activeRole);

  // 1. Require authenticated user via LoginView
  if (!currentUser) {
    return <LoginView />;
  }

  // 2. Show Role Selector ONLY for full-access users who haven't chosen a role yet
  if (
    hasFullAccess(currentUser) &&
    (!activeRole || activeRoleConfig?.enabled === false || !canAccessRole(activeRole))
  ) {
    return <RoleSelector />;
  }

  // 3. Enforce per-module permission strictly for every view
  const effectiveView = canAccessModule(activeView)
    ? activeView
    : getDefaultAllowedView(currentUser);

  // Full-screen POS mode (hides global Header, Sidebar & BottomBar)
  if (effectiveView === 'pos_caja') {
    return <PosView />;
  }

  const renderModuleById = (viewId: string) => {
    switch (viewId) {
      case 'mi_perfil':
        return <ProfileView />;
      case 'workflow':
        return <WorkflowView />;
      case 'admin_panel':
        return <AdminRoleView />;
      case 'admin_empleados':
        return <EmployeesView />;
      case 'admin_pagos':
        return <PaymentsView />;
      case 'admin_incidencias':
        return <EmployeeIncidentsView />;
      case 'admin_proveedores':
        return <SuppliersView />;
      case 'admin_insumos':
        return <SuppliesAndAppsView />;
      case 'admin_costos':
        return <CostControlView />;
      case 'admin_productos':
        return <AdminProductsView />;
      case 'produccion_dia':
        return <DailyProductionView />;
      case 'bitacora':
        return <BitacoraView />;
      case 'aplicaciones_foliares':
        return <FoliarApplicationsView />;
      case 'pos_caja':
        return <PosView />;
      case 'ventas_operacion':
        return <SalesOperationsView />;
      case 'resumen_ventas':
        return <DailySalesView />;
      default:
        return null;
    }
  };

  // 4. Render current active role & authorized module view
  const renderRoleView = () => {
    const directView = renderModuleById(effectiveView);
    if (directView) return directView;

    switch (activeRole) {
      case 'admin':
        return <AdminRoleView />;
      case 'ventas':
        return <SalesOperationsView />;
      case 'bitacora':
        return <BitacoraView />;
      case 'produccion':
        return <DailyProductionView />;
      case 'aroma_flowers':
        return <AromaFlowersRoleView />;
      case 'director':
        return <DirectorView />;
      case 'operaciones':
        return <OperationsView />;
      case 'agronomo':
        return <AgronomyView />;
      case 'cosecha':
        return <HarvestView />;
      case 'sistema':
        return <SystemView />;
      default:
        return <ProfileView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col antialiased selection:bg-[#C3A25D]/30 selection:text-[#5C1125]">
      {/* Unified Institutional Header */}
      <Header />

      {/* Offline Toast Banner */}
      {!isOnline && (
        <div className="bg-[#5C1125] text-white text-xs font-bold py-2 px-4 text-center shadow-inner flex items-center justify-center gap-2 border-b border-[#3f0918]">
          <span className="w-2 h-2 rounded-full bg-[#C3A25D] animate-ping" />
          <span>Modo Sin Conexión &bull; Los registros se guardan localmente en tu dispositivo y se sincronizarán al recuperar señal.</span>
        </div>
      )}

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Collapsible Sidebar */}
        <Sidebar />

        {/* Dynamic Content Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            {renderRoleView()}
          </div>
        </main>
      </div>

      {/* Mobile & Tablet Fixed Bottom Bar */}
      <BottomBar />
    </div>
  );
};

export default function App() {
  return (
    <GreenhouseProvider>
      <MainAppLayout />
    </GreenhouseProvider>
  );
}
