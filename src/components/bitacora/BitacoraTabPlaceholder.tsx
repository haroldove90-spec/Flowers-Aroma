import React from 'react';
import { ArrowRight, CalendarDays, Layers } from 'lucide-react';
import { BitacoraTabDefinition } from './bitacoraTabsConfig';
import { BITACORA_MODULES } from '../../types/greenhouse';
import { useGreenhouse } from '../../context/GreenhouseContext';

interface BitacoraTabPlaceholderProps {
  tab: BitacoraTabDefinition;
  onReturnToLabores: () => void;
}

export const BitacoraTabPlaceholder: React.FC<BitacoraTabPlaceholderProps> = ({
  tab,
  onReturnToLabores,
}) => {
  const { activeRole, setActiveView } = useGreenhouse();
  const Icon = tab.icon;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* Clean header strip */}
      <div className="px-6 py-5 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[#5C1125]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#000000] tracking-tight">{tab.label}</h2>
            <p className="text-sm text-stone-600 mt-0.5 max-w-2xl">{tab.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {tab.relatedAdminView && activeRole === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveView(tab.relatedAdminView!.viewId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#535B28] hover:bg-[#3f461d] text-white text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{tab.relatedAdminView.buttonLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onReturnToLabores}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Volver a Labores culturales</span>
          </button>
        </div>
      </div>

      {/* Prepared base template preview */}
      <div className="p-6 sm:p-8 space-y-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold text-[#535B28] tracking-wide">
            Sección lista para activar
          </p>
          <h3 className="text-base font-bold text-[#000000] mt-1">
            Plantilla base configurada para {tab.label.toLowerCase()}
          </h3>
          <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
            Esta pestaña ya está conectada a la estructura modular de la Bitácora y a la base de
            datos de Aroma Flower. En cuanto se definan las columnas y reglas exactas para{' '}
            <span className="font-semibold text-stone-800">{tab.label}</span>, se habilitará la
            captura directa sin modificar el resto del módulo.
          </p>
        </div>

        {/* Planned columns table skeleton (subtle, structural preview) */}
        {tab.plannedColumns && tab.plannedColumns.length > 0 && (
          <div className="rounded-xl border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-stone-200">
                    {tab.plannedColumns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-xs font-bold text-stone-600 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={tab.plannedColumns.length}
                      className="px-4 py-10 text-center text-sm text-stone-500"
                    >
                      Sin registros todavía — columnas en definición para {tab.label}.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quiet metadata footer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 pt-2 border-t border-stone-100">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#C3A25D]" />
            <span>{BITACORA_MODULES.length} módulos agrícolas vinculados</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[#535B28]" />
            <span>Historial sincronizable con Supabase</span>
          </span>
        </div>
      </div>
    </div>
  );
};
