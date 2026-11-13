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
import { SalesView } from './components/sales/SalesView';
import { SystemView } from './components/system/SystemView';
import { AromaFlowersRoleView } from './components/aroma_flowers/AromaFlowersRoleView';
import { ROLES } from './types/greenhouse';

const MainAppLayout: React.FC = () => {
  const { activeRole, activeView, isOnline } = useGreenhouse();
  const activeRoleConfig = ROLES.find((r) => r.id === activeRole);

  // If no active role is selected or the role is disabled, show the clean Role Selector on Home
  if (!activeRole || activeRoleConfig?.enabled === false) {
    return <RoleSelector />;
  }

  // Render current active module view
  const renderRoleView = () => {
    if (activeView === 'workflow') {
      return <WorkflowView />;
    }

    switch (activeRole) {
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
      case 'ventas':
        return <SalesView />;
      case 'sistema':
        return <SystemView />;
      default:
        return <AromaFlowersRoleView />;
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
