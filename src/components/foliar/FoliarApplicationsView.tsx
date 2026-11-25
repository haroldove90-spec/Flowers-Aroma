import React, { useMemo, useState } from 'react';
import {
  SprayCan,
  Layers,
  Calculator,
  FlaskConical,
  ExternalLink,
} from 'lucide-react';
import { useGreenhouse } from '../../context/GreenhouseContext';
import { GeneralApplicationView } from './GeneralApplicationView';
import { ParchoneoCalculatorView } from './ParchoneoCalculatorView';
import { AgrochemicalsCatalogPanel } from './AgrochemicalsCatalogPanel';

type FoliarSubView = 'general' | 'parchoneo';

interface FoliarApplicationsViewProps {
  /** Cuando se renderiza incrustado dentro de la pestaña de Bitácora */
  embedded?: boolean;
}

export const FoliarApplicationsView: React.FC<FoliarApplicationsViewProps> = ({
  embedded = false,
}) => {
  const { supplyItems, setActiveView } = useGreenhouse();
  const [subView, setSubView] = useState<FoliarSubView>('general');
  const [showCatalog, setShowCatalog] = useState(false);

  const agrochemicalCount = useMemo(
    () => supplyItems.filter((s) => s.active !== false && s.area === 'invernadero').length,
    [supplyItems]
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Internal Sub-View Switcher */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {!embedded && (
              <div className="w-11 h-11 rounded-xl bg-[#5C1125] text-[#C3A25D] flex items-center justify-center shrink-0">
                <SprayCan className="w-5 h-5" />
              </div>
            )}
            <div>
              <h1 className={`${embedded ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-extrabold text-[#000000] tracking-tight`}>
                Aplicaciones Foliares
              </h1>
              <p className="text-sm text-stone-600 mt-0.5">
                Mezclas por Unidad de Producción y cálculo de Parchoneo por regla de tres vinculados al costo real en Compras.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCatalog(true)}
              className="h-10 px-4 rounded-xl border border-stone-200 bg-[#FAF8F5] hover:bg-stone-100 text-[#000000] text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <FlaskConical className="w-4 h-4 text-[#535B28]" />
              <span>Catálogo de Agroquímicos ({agrochemicalCount})</span>
            </button>

            {embedded && (
              <button
                type="button"
                onClick={() => setActiveView('aplicaciones_foliares')}
                className="h-10 px-3.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                title="Abrir Aplicaciones Foliares en vista completa"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#5C1125]" />
                <span>Abrir módulo completo</span>
              </button>
            )}
          </div>
        </div>

        {/* Two Internal Sub-Views Switcher */}
        <div
          role="tablist"
          aria-label="Sub-vistas de Aplicaciones Foliares"
          className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-2"
        >
          <button
            role="tab"
            type="button"
            aria-selected={subView === 'general'}
            onClick={() => setSubView('general')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'general'
                ? 'bg-[#5C1125] text-white shadow-xs'
                : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 hover:text-[#000000]'
            }`}
          >
            <Layers
              className={`w-4 h-4 shrink-0 ${
                subView === 'general' ? 'text-[#C3A25D]' : 'text-stone-500'
              }`}
            />
            <span>Aplicación General</span>
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={subView === 'parchoneo'}
            onClick={() => setSubView('parchoneo')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'parchoneo'
                ? 'bg-[#5C1125] text-white shadow-xs'
                : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 hover:text-[#000000]'
            }`}
          >
            <Calculator
              className={`w-4 h-4 shrink-0 ${
                subView === 'parchoneo' ? 'text-[#C3A25D]' : 'text-stone-500'
              }`}
            />
            <span>Parchoneo (Regla de Tres)</span>
          </button>
        </div>
      </div>

      {/* Active Sub-View Content */}
      {subView === 'general' ? <GeneralApplicationView /> : <ParchoneoCalculatorView />}

      {/* Linked Agrochemicals Catalog Modal */}
      <AgrochemicalsCatalogPanel
        isOpen={showCatalog}
        onClose={() => setShowCatalog(false)}
      />
    </div>
  );
};
