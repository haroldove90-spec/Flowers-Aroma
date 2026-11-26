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
  const { supplyItems, setActiveView, canAccessModule, foliarParchoneos } = useGreenhouse();
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
                Selecciona <strong>Aplicación General</strong> o <strong>Parchoneo</strong> para capturar productos, objetivo y costo de la dosis.
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

            {embedded && canAccessModule('aplicaciones_foliares') && (
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

        {/* Two Prominent Mode Selector Cards: Aplicación General & Parchoneo */}
        <div
          role="tablist"
          aria-label="Modalidad de aplicación foliar"
          className="mt-5 pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <button
            role="tab"
            type="button"
            aria-selected={subView === 'general'}
            onClick={() => setSubView('general')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              subView === 'general'
                ? 'bg-[#5C1125] border-[#5C1125] text-white shadow-xs'
                : 'bg-[#FAF8F5] border-stone-200 text-[#000000] hover:border-[#C3A25D]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                subView === 'general'
                  ? 'bg-white/15 text-[#C3A25D]'
                  : 'bg-white border border-stone-200 text-[#5C1125]'
              }`}
            >
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold">Aplicación General</div>
              <p
                className={`text-xs mt-0.5 ${
                  subView === 'general' ? 'text-[#e5d2a4]' : 'text-stone-500'
                }`}
              >
                Mezclas por Unidad de Producción (Santa Cruz, Saúl, Tlapisaco), objetivo y costo de la dosis.
              </p>
            </div>
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={subView === 'parchoneo'}
            onClick={() => setSubView('parchoneo')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              subView === 'parchoneo'
                ? 'bg-[#5C1125] border-[#5C1125] text-white shadow-xs'
                : 'bg-[#FAF8F5] border-stone-200 text-[#000000] hover:border-[#C3A25D]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                subView === 'parchoneo'
                  ? 'bg-white/15 text-[#C3A25D]'
                  : 'bg-white border border-stone-200 text-[#535B28]'
              }`}
            >
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold">Parchoneo (Regla de Tres)</span>
                {foliarParchoneos.length > 0 && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums ${
                      subView === 'parchoneo'
                        ? 'bg-white/15 text-[#C3A25D]'
                        : 'bg-white border border-stone-200 text-stone-600'
                    }`}
                  >
                    {foliarParchoneos.length} reg.
                  </span>
                )}
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  subView === 'parchoneo' ? 'text-[#e5d2a4]' : 'text-stone-500'
                }`}
              >
                Aplicación localizada por módulo y variedad con cálculo automático de dosis y costo.
              </p>
            </div>
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
