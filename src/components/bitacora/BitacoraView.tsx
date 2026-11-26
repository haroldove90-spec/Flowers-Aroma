import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { BitacoraCategory } from '../../types/greenhouse';
import { BITACORA_TABS } from './bitacoraTabsConfig';
import { CulturalLaborTable } from './CulturalLaborTable';
import { BitacoraTabPlaceholder } from './BitacoraTabPlaceholder';
import { FoliarApplicationsView } from '../foliar/FoliarApplicationsView';
import { RiegoApplicationsView } from './RiegoApplicationsView';
import { MonitoringCroquisView } from './MonitoringCroquisView';

export const BitacoraView: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<BitacoraCategory>('labores_culturales');

  const activeTab =
    BITACORA_TABS.find((tab) => tab.id === activeTabId) || BITACORA_TABS[0];

  const renderActiveTabContent = () => {
    switch (activeTab.id) {
      case 'labores_culturales':
        return <CulturalLaborTable />;
      case 'aplicaciones_foliares':
        return <FoliarApplicationsView embedded />;
      case 'riego':
        return <RiegoApplicationsView />;
      case 'monitoreo':
        return <MonitoringCroquisView />;
      default:
        return (
          <BitacoraTabPlaceholder
            tab={activeTab}
            onReturnToLabores={() => setActiveTabId('labores_culturales')}
          />
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Module Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#5C1125] text-[#C3A25D] flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#000000] tracking-tight">
                Bitácora de Operaciones Agrícolas
              </h1>
              <p className="text-sm text-stone-600 mt-0.5">
                Registro diario por módulo de labores culturales, aplicaciones, riego y monitoreo.
              </p>
            </div>
          </div>
        </div>

        {/* Scalable Modular Tabs Navigation */}
        <div
          role="tablist"
          aria-label="Categorías de bitácora agrícola"
          className="mt-5 pt-4 border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {BITACORA_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                onClick={() => setActiveTabId(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-[#5C1125] text-white shadow-xs'
                    : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 hover:text-[#000000]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? 'text-[#C3A25D]' : 'text-stone-500'
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Category Workspace */}
      <div>{renderActiveTabContent()}</div>
    </div>
  );
};
