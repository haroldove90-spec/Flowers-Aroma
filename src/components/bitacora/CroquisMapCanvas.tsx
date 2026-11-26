import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import {
  CroquisModuleSpec,
  CroquisSectionSpec,
  CroquisUnitSpec,
  getVarietyZoneFill,
} from '../../data/croquisData';
import { MonitoringPin } from '../../types/greenhouse';

export interface CroquisClickTarget {
  unitId: CroquisUnitSpec['id'];
  unitName: string;
  moduleNumber: number;
  moduleName: string;
  section: 'A' | 'B';
  aisleNumber: number;
  variety: string;
  lengthMeters: number;
  positionPercent: number;
  positionMeters: number;
}

interface CroquisMapCanvasProps {
  unit: CroquisUnitSpec;
  pins: MonitoringPin[];
  selectedPinId: string | null;
  draftTarget: CroquisClickTarget | null;
  onSelectSpot: (target: CroquisClickTarget) => void;
  onSelectPin: (pin: MonitoringPin) => void;
}

interface AisleGeom {
  moduleNumber: number;
  section: 'A' | 'B';
  aisleNumber: number;
  x: number;
  y: number;
  w: number;
  h: number;
  variety: string;
  lengthMeters: number;
}

const getPinColors = (pin: MonitoringPin) => {
  if (pin.status === 'controlado') {
    return { fill: '#64748B', stroke: '#FFFFFF', ring: '#94A3B8' };
  }
  switch (pin.severity) {
    case 'alta':
      return { fill: '#DC2626', stroke: '#FFFFFF', ring: '#FCA5A5' };
    case 'media':
      return { fill: '#D97706', stroke: '#FFFFFF', ring: '#FCD34D' };
    default:
      return { fill: '#16A34A', stroke: '#FFFFFF', ring: '#86EFAC' };
  }
};

/** Rosa de los vientos fiel al PDF original: O↑, E↓, S←, N→ */
const CompassRose: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x}, ${y})`} aria-label="Orientación cardinal">
    <line x1={0} y1={-16} x2={0} y2={16} stroke="#1C1917" strokeWidth={1.3} />
    <line x1={-16} y1={0} x2={16} y2={0} stroke="#1C1917" strokeWidth={1.3} />
    <path d="M-3.5 -10 L0 -16 L3.5 -10" fill="none" stroke="#1C1917" strokeWidth={1.2} />
    <path d="M-3.5 10 L0 16 L3.5 10" fill="none" stroke="#1C1917" strokeWidth={1.2} />
    <path d="M-10 -3.5 L-16 0 L-10 3.5" fill="none" stroke="#1C1917" strokeWidth={1.2} />
    <path d="M10 -3.5 L16 0 L10 3.5" fill="none" stroke="#1C1917" strokeWidth={1.2} />
    <text x={0} y={-20} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1C1917">
      O
    </text>
    <text x={0} y={28} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1C1917">
      E
    </text>
    <text x={-23} y={3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1C1917">
      S
    </text>
    <text x={23} y={3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1C1917">
      N
    </text>
  </g>
);

export const CroquisMapCanvas: React.FC<CroquisMapCanvasProps> = ({
  unit,
  pins,
  selectedPinId,
  draftTarget,
  onSelectSpot,
  onSelectPin,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [hoveredAisle, setHoveredAisle] = useState<{
    moduleLabel: string;
    section: 'A' | 'B';
    aisleNumber: number;
    variety: string;
    lengthMeters: number;
  } | null>(null);

  const isSideBySide = unit.layout === 'side_by_side';

  // Canvas dimensions tailored cleanly to each unit's real PDF layout
  const svgWidth = isSideBySide ? 1160 : 1080;
  const svgHeight =
    unit.id === 'santa_cruz' ? 810 : unit.id === 'saul' ? 840 : 870;

  // Build clickable aisle geometry for every module/section so pins & clicks align with 100% precision
  const allAisles: AisleGeom[] = [];
  const renderedModules: React.ReactNode[] = [];

  const handleAisleClick = (
    e: React.MouseEvent<SVGRectElement>,
    mod: CroquisModuleSpec,
    aisle: AisleGeom
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
    const positionPercent = Math.max(4, Math.min(96, Math.round(relX * 100)));
    const positionMeters =
      Math.round(((positionPercent / 100) * aisle.lengthMeters) * 10) / 10;

    onSelectSpot({
      unitId: unit.id,
      unitName: unit.shortName,
      moduleNumber: mod.moduleNumber,
      moduleName: mod.fullModuleName,
      section: aisle.section,
      aisleNumber: aisle.aisleNumber,
      variety: aisle.variety,
      lengthMeters: aisle.lengthMeters,
      positionPercent,
      positionMeters,
    });
  };

  const renderSection = (params: {
    mod: CroquisModuleSpec;
    sec: CroquisSectionSpec;
    baseX: number;
    baseY: number;
    baseWidth: number;
    rowHeight: number;
    alignEdge: 'left' | 'right';
    numberSide: 'left' | 'right' | 'both';
    maxMetersForScale: number;
  }) => {
    const {
      mod,
      sec,
      baseX,
      baseY,
      baseWidth,
      rowHeight,
      alignEdge,
      numberSide,
      maxMetersForScale,
    } = params;

    const sectionNodes: React.ReactNode[] = [];
    const zoneOverlays: React.ReactNode[] = [];

    // Section title centered above the section
    sectionNodes.push(
      <text
        key={`sec-title-${mod.moduleNumber}-${sec.id}`}
        x={baseX + baseWidth / 2}
        y={baseY - 12}
        textAnchor="middle"
        fontSize={13}
        fontWeight={800}
        fill="#1C1917"
      >
        {sec.label}
      </text>
    );

    sec.zones.forEach((zone, zIdx) => {
      // Proportional width reflects exact PDF steps (e.g. 42.25m vs 48.25m or 39m in Santa Cruz)
      const widthRatio =
        maxMetersForScale > 0
          ? Math.max(0.78, Math.min(1, zone.lengthMeters / maxMetersForScale))
          : 1;
      const zoneW = Math.round(baseWidth * widthRatio);
      const zoneX = alignEdge === 'right' ? baseX + (baseWidth - zoneW) : baseX;
      const zoneTopY = baseY + (zone.startAisle - 1) * rowHeight;
      const zoneH = (zone.endAisle - zone.startAisle + 1) * rowHeight;
      const zoneFill = getVarietyZoneFill(zone.variety);

      // Render every individual clickable aisle row inside this variety zone
      for (let aisleNum = zone.startAisle; aisleNum <= zone.endAisle; aisleNum++) {
        const y = baseY + (aisleNum - 1) * rowHeight;
        const geom: AisleGeom = {
          moduleNumber: mod.moduleNumber,
          section: sec.id,
          aisleNumber: aisleNum,
          x: zoneX,
          y,
          w: zoneW,
          h: rowHeight,
          variety: zone.variety,
          lengthMeters: zone.lengthMeters,
        };
        allAisles.push(geom);

        const isHovered =
          hoveredAisle?.moduleLabel === mod.label &&
          hoveredAisle?.section === sec.id &&
          hoveredAisle?.aisleNumber === aisleNum;

        const isDraftRow =
          draftTarget &&
          draftTarget.moduleNumber === mod.moduleNumber &&
          draftTarget.section === sec.id &&
          draftTarget.aisleNumber === aisleNum;

        sectionNodes.push(
          <g key={`aisle-${mod.moduleNumber}-${sec.id}-${aisleNum}`}>
            <rect
              x={zoneX}
              y={y}
              width={zoneW}
              height={rowHeight}
              fill={
                isDraftRow
                  ? 'rgba(92, 17, 37, 0.14)'
                  : isHovered
                  ? 'rgba(195, 162, 93, 0.34)'
                  : zoneFill
              }
              stroke="#A8A29E"
              strokeWidth={0.75}
              className="cursor-crosshair transition-colors"
              onMouseEnter={() =>
                setHoveredAisle({
                  moduleLabel: mod.label,
                  section: sec.id,
                  aisleNumber: aisleNum,
                  variety: zone.variety,
                  lengthMeters: zone.lengthMeters,
                })
              }
              onMouseLeave={() => setHoveredAisle(null)}
              onClick={(e) => handleAisleClick(e, mod, geom)}
            />

            {/* Aisle numbers exactly like PDF */}
            {(numberSide === 'left' || numberSide === 'both') && (
              <text
                x={zoneX + 4}
                y={y + rowHeight * 0.72}
                fontSize={rowHeight < 17 ? 8.5 : 9.5}
                fontWeight={600}
                fill="#44403C"
                className="pointer-events-none select-none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {aisleNum}
              </text>
            )}
            {(numberSide === 'right' || numberSide === 'both') && (
              <text
                x={zoneX + zoneW - 4}
                y={y + rowHeight * 0.72}
                textAnchor="end"
                fontSize={rowHeight < 17 ? 8.5 : 9.5}
                fontWeight={600}
                fill="#44403C"
                className="pointer-events-none select-none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {aisleNum}
              </text>
            )}
          </g>
        );
      }

      // Bold perimeter frame for each variety zone + centered variety & meter label
      const labelCenterX = zoneX + zoneW / 2;
      const labelCenterY = zoneTopY + zoneH / 2;
      const isSingleRow = zone.endAisle === zone.startAisle;

      zoneOverlays.push(
        <g
          key={`zone-frame-${mod.moduleNumber}-${sec.id}-${zIdx}`}
          className="pointer-events-none select-none"
        >
          <rect
            x={zoneX}
            y={zoneTopY}
            width={zoneW}
            height={zoneH}
            fill="none"
            stroke="#292524"
            strokeWidth={1.35}
          />
          {/* Clean white pill-free backing strip only behind text so grid line never crosses letters */}
          <rect
            x={labelCenterX - 54}
            y={isSingleRow ? labelCenterY - 6.5 : labelCenterY - 12}
            width={108}
            height={isSingleRow ? 13 : 24}
            rx={3}
            fill="rgba(255,255,255,0.88)"
          />
          <text
            x={labelCenterX}
            y={isSingleRow ? labelCenterY + 3 : labelCenterY - 1}
            textAnchor="middle"
            fontSize={isSingleRow ? 9.5 : 11}
            fontWeight={800}
            fill="#1C1917"
          >
            {zone.variety}
          </text>
          {!isSingleRow && (
            <text
              x={labelCenterX}
              y={labelCenterY + 10.5}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={600}
              fill="#57534E"
            >
              {zone.lengthMeters} m
            </text>
          )}
        </g>
      );
    });

    return (
      <g key={`section-${mod.moduleNumber}-${sec.id}`}>
        {sectionNodes}
        {zoneOverlays}
      </g>
    );
  };

  if (unit.id === 'santa_cruz') {
    // Santa Cruz: Módulo 1 (left) and Módulo 2 (right), side-by-side matching PDF Page 1
    const rowH = 16.5;
    const topY = 128;
    const secW = 248;
    const gapBetweenSections = 14;
    const mod1X = 30;
    const mod2X = 602;

    unit.modules.forEach((mod, idx) => {
      const originX = idx === 0 ? mod1X : mod2X;
      const modWidth = secW * 2 + gapBetweenSections;
      const maxMeters = idx === 0 ? 42.25 : 48.25;

      renderedModules.push(
        <g key={`mod-${mod.moduleNumber}`}>
          <text
            x={originX + modWidth / 2}
            y={82}
            textAnchor="middle"
            fontSize={16}
            fontWeight={800}
            fill="#5C1125"
          >
            {mod.label}
          </text>
          {renderSection({
            mod,
            sec: mod.sections.A,
            baseX: originX,
            baseY: topY,
            baseWidth: secW,
            rowHeight: rowH,
            alignEdge: idx === 1 ? 'right' : 'left',
            numberSide: 'left',
            maxMetersForScale: maxMeters,
          })}
          {renderSection({
            mod,
            sec: mod.sections.B,
            baseX: originX + secW + gapBetweenSections,
            baseY: topY,
            baseWidth: secW,
            rowHeight: rowH,
            alignEdge: 'left',
            numberSide: 'right',
            maxMetersForScale: maxMeters,
          })}
        </g>
      );
    });
  } else {
    // Saúl (2 stacked modules) and Tlapizaco (3 stacked modules)
    const moduleStartYs = unit.id === 'saul' ? [126, 480] : [116, 376, 636];
    const rowHeight = unit.id === 'saul' ? 16.8 : 16.8;
    const corridorOuterW = 16;
    const corridorCenterW = 22;
    const leftX = 36;
    const secW = 475;

    unit.modules.forEach((mod, idx) => {
      const startY = moduleStartYs[idx] || 116 + idx * 260;
      const firstSecId = mod.sectionsOrder[0];
      const secondSecId = mod.sectionsOrder[1];
      const firstSec = mod.sections[firstSecId];
      const secondSec = mod.sections[secondSecId];
      const blockH = Math.max(firstSec.totalAisles, secondSec.totalAisles) * rowHeight;

      const sec1X = leftX + corridorOuterW;
      const centerX = sec1X + secW;
      const sec2X = centerX + corridorCenterW;
      const rightCorridorX = sec2X + secW;

      renderedModules.push(
        <g key={`mod-${mod.moduleNumber}`}>
          {/* Horizontal separator between modules */}
          {idx > 0 && (
            <line
              x1={26}
              y1={startY - 52}
              x2={svgWidth - 26}
              y2={startY - 52}
              stroke="#D6D3D1"
              strokeWidth={1}
            />
          )}

          {/* Module heading + tunnel dimensions */}
          <text x={leftX} y={startY - 28} fontSize={15} fontWeight={800} fill="#5C1125">
            {mod.label}
          </text>
          {mod.dimensionsNote && (
            <text x={leftX + 95} y={startY - 28} fontSize={11.5} fontWeight={600} fill="#57534E">
              {mod.dimensionsNote}
            </text>
          )}

          {/* Left corridor (1 m) */}
          <rect
            x={leftX}
            y={startY - 6}
            width={corridorOuterW}
            height={blockH + 12}
            fill="#FAF8F5"
            stroke="#292524"
            strokeWidth={1.1}
          />
          <text
            x={leftX + corridorOuterW / 2}
            y={startY + blockH / 2}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill="#57534E"
            transform={`rotate(-90, ${leftX + corridorOuterW / 2}, ${startY + blockH / 2})`}
          >
            {mod.leftCorridorLabel || '1 m'}
          </text>

          {/* Left Section */}
          {renderSection({
            mod,
            sec: firstSec,
            baseX: sec1X,
            baseY: startY,
            baseWidth: secW,
            rowHeight,
            alignEdge: 'left',
            numberSide: 'both',
            maxMetersForScale: firstSec.zones[0]?.lengthMeters || 42.25,
          })}

          {/* Central corridor (1.5 m) */}
          <rect
            x={centerX}
            y={startY - 6}
            width={corridorCenterW}
            height={blockH + 12}
            fill="#FAF8F5"
            stroke="#292524"
            strokeWidth={1.1}
          />
          <text
            x={centerX + corridorCenterW / 2}
            y={startY + blockH / 2}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight={700}
            fill="#57534E"
            transform={`rotate(-90, ${centerX + corridorCenterW / 2}, ${startY + blockH / 2})`}
          >
            {mod.centerCorridorLabel || '1.5 m'}
          </text>

          {/* Right Section */}
          {renderSection({
            mod,
            sec: secondSec,
            baseX: sec2X,
            baseY: startY,
            baseWidth: secW,
            rowHeight,
            alignEdge: 'left',
            numberSide: 'both',
            maxMetersForScale: secondSec.zones[0]?.lengthMeters || 42.25,
          })}

          {/* Right corridor (1 m) */}
          <rect
            x={rightCorridorX}
            y={startY - 6}
            width={corridorOuterW}
            height={blockH + 12}
            fill="#FAF8F5"
            stroke="#292524"
            strokeWidth={1.1}
          />
          <text
            x={rightCorridorX + corridorOuterW / 2}
            y={startY + blockH / 2}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill="#57534E"
            transform={`rotate(-90, ${rightCorridorX + corridorOuterW / 2}, ${startY + blockH / 2})`}
          >
            {mod.rightCorridorLabel || '1 m'}
          </text>
        </g>
      );
    });
  }

  // Lookup helper to place pins at exact aisle coordinates
  const findAisleGeom = (
    moduleNumber: number,
    section: 'A' | 'B',
    aisleNumber: number
  ): AisleGeom | undefined =>
    allAisles.find(
      (a) =>
        a.moduleNumber === moduleNumber &&
        a.section === section &&
        a.aisleNumber === aisleNumber
    );

  // Compute draft pin coordinate if placing a new spot on this unit
  const draftGeom =
    draftTarget && draftTarget.unitId === unit.id
      ? findAisleGeom(
          draftTarget.moduleNumber,
          draftTarget.section,
          draftTarget.aisleNumber
        )
      : undefined;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* Croquis Canvas Top Utility Strip */}
      <div className="px-4 sm:px-5 py-3 bg-[#FAF8F5] border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-[#000000] truncate">
            {unit.name}
          </div>
          <div className="text-xs text-stone-600">
            Haz clic en cualquier pasillo para colocar un marcador de monitoreo exacto
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(75, z - 15))}
            className="w-8 h-8 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 inline-flex items-center justify-center transition cursor-pointer"
            title="Alejar croquis"
            aria-label="Alejar croquis"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-stone-700 tabular-nums w-11 text-center">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(160, z + 15))}
            className="w-8 h-8 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 inline-flex items-center justify-center transition cursor-pointer"
            title="Acercar croquis"
            aria-label="Acercar croquis"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {zoom !== 100 && (
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="w-8 h-8 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 inline-flex items-center justify-center transition cursor-pointer"
              title="Restablecer zoom"
              aria-label="Restablecer zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Blueprint Viewport */}
      <div className="overflow-auto bg-white p-2 sm:p-4 max-h-[720px]">
        <div
          style={{
            width: `${zoom}%`,
            minWidth: isSideBySide ? '860px' : '760px',
            margin: '0 auto',
          }}
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto block select-none"
            role="img"
            aria-label={`Croquis interactivo de ${unit.name}`}
          >
            {/* Clean Paper Blueprint Background */}
            <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#FFFFFF" />

            {/* Blueprint Title & Metadata matching official PDF */}
            <text x={30} y={38} fontSize={22} fontWeight={800} fill="#000000">
              {unit.name}
            </text>
            <text
              x={svgWidth - 95}
              y={32}
              textAnchor="end"
              fontSize={11}
              fontWeight={500}
              fill="#57534E"
            >
              Croquis esquemático · no a escala
            </text>
            <CompassRose x={svgWidth - 46} y={38} />

            {/* All Modules, Sections, Aisles and Variety Zones */}
            {renderedModules}

            {/* Saved Monitoring Pins */}
            {pins.map((pin) => {
              const geom = findAisleGeom(
                pin.moduleNumber,
                pin.section,
                pin.aisleNumber
              );
              if (!geom) return null;
              const pct = Math.max(4, Math.min(96, Number(pin.positionPercent ?? 50)));
              const cx = geom.x + (geom.w * pct) / 100;
              const cy = geom.y + geom.h / 2;
              const colors = getPinColors(pin);
              const isSelected = selectedPinId === pin.id;

              return (
                <g
                  key={pin.id}
                  transform={`translate(${cx}, ${cy})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPin(pin);
                  }}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`Marcador en ${pin.moduleName} Sección ${pin.section} Pasillo ${pin.aisleNumber} - ${pin.pestOrFinding}`}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      r={14}
                      fill="rgba(92, 17, 37, 0.16)"
                      stroke="#5C1125"
                      strokeWidth={2}
                    />
                  )}

                  {/* Outer soft halo for active high severity */}
                  {!isSelected && pin.status === 'activo' && pin.severity === 'alta' && (
                    <circle r={11} fill="rgba(220, 38, 38, 0.2)" />
                  )}

                  {/* Main Pin Circle */}
                  <circle
                    r={isSelected ? 8.5 : 7}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={2}
                  />

                  {/* Center indicator: checkmark if controlado, incidence number otherwise */}
                  <text
                    x={0}
                    y={2.7}
                    textAnchor="middle"
                    fontSize={pin.status === 'controlado' ? 8 : 6.8}
                    fontWeight={800}
                    fill="#FFFFFF"
                    className="pointer-events-none"
                  >
                    {pin.status === 'controlado' ? '✓' : `${Math.round(pin.incidencePercent)}`}
                  </text>

                  {/* Tooltip callout when selected */}
                  {isSelected && (
                    <g transform="translate(0, -20)" className="pointer-events-none">
                      <rect
                        x={-54}
                        y={-18}
                        width={108}
                        height={20}
                        rx={5}
                        fill="#1C1917"
                      />
                      <text
                        x={0}
                        y={-5}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={700}
                        fill="#FFFFFF"
                      >
                        P{pin.aisleNumber} · {pin.incidencePercent}% · {pin.variety}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Draft Pin (live placement preview before saving) */}
            {draftTarget && draftGeom && (
              <g
                transform={`translate(${
                  draftGeom.x + (draftGeom.w * draftTarget.positionPercent) / 100
                }, ${draftGeom.y + draftGeom.h / 2})`}
                className="pointer-events-none"
              >
                <circle
                  r={13}
                  fill="rgba(92, 17, 37, 0.18)"
                  stroke="#5C1125"
                  strokeWidth={2}
                  strokeDasharray="3 2"
                />
                <circle r={6.5} fill="#5C1125" stroke="#FFFFFF" strokeWidth={2} />
                <text
                  x={0}
                  y={2.8}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={800}
                  fill="#C3A25D"
                >
                  +
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Footer: Live Coordinate Readout + Explicit Legend */}
      <div className="px-4 sm:px-5 py-2.5 bg-[#FAF8F5] border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="font-medium text-stone-700 min-w-0 truncate">
          {hoveredAisle ? (
            <span>
              <strong className="text-[#5C1125]">{hoveredAisle.moduleLabel}</strong> · Sección{' '}
              <strong>{hoveredAisle.section}</strong> · Pasillo{' '}
              <strong className="tabular-nums">{hoveredAisle.aisleNumber}</strong> ·{' '}
              <strong className="text-[#000000]">{hoveredAisle.variety}</strong>{' '}
              <span className="text-stone-500">({hoveredAisle.lengthMeters} m)</span>
            </span>
          ) : (
            <span className="text-stone-500">
              Pasa el cursor o toca cualquier pasillo para ver su variedad y marcar monitoreo.
            </span>
          )}
        </div>

        {/* Explicit Color + Text Legend (no color-only signaling) */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-stone-600 shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] inline-block" />
            <span>Baja</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] inline-block" />
            <span>Media</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block" />
            <span>Alta</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#64748B] inline-block" />
            <span>Controlado</span>
          </span>
        </div>
      </div>
    </div>
  );
};
