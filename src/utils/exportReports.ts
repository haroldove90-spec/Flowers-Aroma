import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AppUser,
  AromaProduct,
  DailyProductionEntry,
} from '../types/greenhouse';

const BURGUNDY: [number, number, number] = [92, 17, 37]; // #5C1125
const OLIVE: [number, number, number] = [83, 91, 40]; // #535B28
const BLACK: [number, number, number] = [20, 20, 20];
const CREAM: [number, number, number] = [250, 248, 245];

const todayIso = () => new Date().toISOString().slice(0, 10);

const setColumnWidths = (ws: XLSX.WorkSheet, rows: Array<Record<string, any> | any[]>) => {
  if (!rows.length) return;
  const colWidths: number[] = [];
  rows.forEach((row) => {
    const values = Array.isArray(row) ? row : Object.values(row);
    values.forEach((val, idx) => {
      const len = String(val ?? '').length;
      colWidths[idx] = Math.min(Math.max(colWidths[idx] || 10, len + 3), 42);
    });
  });
  ws['!cols'] = colWidths.map((wch) => ({ wch }));
};

const addPdfHeader = (doc: jsPDF, title: string, subtitle: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BURGUNDY);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setFillColor(195, 162, 93); // #C3A25D
  doc.rect(0, 26, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('AROMA FLOWER', 14, 11);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(235, 220, 185);
  doc.text(subtitle, 14, 23);

  doc.setTextColor(255, 255, 255);
  doc.text(
    `Generado: ${new Date().toLocaleString('es-MX')}`,
    pageWidth - 14,
    11,
    { align: 'right' }
  );
};

const addPdfPageFooters = (doc: jsPDF) => {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 115, 110);
    doc.text(
      `Aroma Flower • Reporte Administrativo • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }
};

const buildConsolidatedByDate = (
  entries: DailyProductionEntry[],
  aromaProducts: AromaProduct[]
) => {
  const orderMap = new Map<string, number>();
  const modeMap = new Map<string, 'lar_med_chi' | 'direct_total'>();
  aromaProducts.forEach((p, idx) => {
    const key = p.name.trim().toUpperCase();
    orderMap.set(key, p.sortOrder || idx + 1);
    modeMap.set(key, p.captureMode);
  });

  const byDate = new Map<string, DailyProductionEntry[]>();
  entries.forEach((e) => {
    const list = byDate.get(e.productionDate) || [];
    list.push(e);
    byDate.set(e.productionDate, list);
  });

  const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((date) => {
    const dayEntries = [...(byDate.get(date) || [])].sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName)
    );

    interface RowAgg {
      productName: string;
      captureMode: 'lar_med_chi' | 'direct_total';
      lar: number;
      med: number;
      chi: number;
      total: number;
      byEmployee: Record<string, number>;
    }

    const rowMap = new Map<string, RowAgg>();

    dayEntries.forEach((entry) => {
      entry.rows.forEach((r) => {
        const key = r.productName.trim().toUpperCase();
        const mode = modeMap.get(key) || r.captureMode;
        const cur = rowMap.get(key) || {
          productName: r.productName,
          captureMode: mode,
          lar: 0,
          med: 0,
          chi: 0,
          total: 0,
          byEmployee: {},
        };
        if (mode === 'direct_total') {
          cur.total += Number(r.total || 0);
        } else {
          cur.lar += Number(r.lar || 0);
          cur.med += Number(r.med || 0);
          cur.chi += Number(r.chi || 0);
          cur.total += Number(r.lar || 0) + Number(r.med || 0) + Number(r.chi || 0);
        }
        cur.byEmployee[entry.employeeUserId] =
          (cur.byEmployee[entry.employeeUserId] || 0) + Number(r.total || 0);
        rowMap.set(key, cur);
      });
    });

    const rows = Array.from(rowMap.values())
      .filter((r) => r.total > 0)
      .sort((a, b) => {
        const oa = orderMap.get(a.productName.trim().toUpperCase()) ?? 999;
        const ob = orderMap.get(b.productName.trim().toUpperCase()) ?? 999;
        return oa - ob;
      });

    const totals = rows.reduce(
      (acc, r) => {
        if (r.captureMode === 'direct_total') {
          acc.totalDirect += r.total;
          acc.grandTotal += r.total;
        } else {
          acc.totalLar += r.lar;
          acc.totalMed += r.med;
          acc.totalChi += r.chi;
          acc.grandTotal += r.total;
        }
        return acc;
      },
      { totalLar: 0, totalMed: 0, totalChi: 0, totalDirect: 0, grandTotal: 0 }
    );

    return { date, entries: dayEntries, rows, totals };
  });
};

// ==================== 1. FULL ADMIN EXPORT (ALL RECORDS) ====================

export function exportAllAdminRecordsExcel(
  dailyProductions: DailyProductionEntry[],
  aromaProducts: AromaProduct[],
  appUsers: AppUser[]
) {
  const wb = XLSX.utils.book_new();
  const sortedEntries = [...dailyProductions].sort((a, b) =>
    b.productionDate.localeCompare(a.productionDate) ||
    a.employeeName.localeCompare(b.employeeName)
  );

  // Sheet 1: Resumen General
  const summaryRows: any[][] = [
    [
      'Fecha',
      'Empleado',
      'Usuario',
      'LAR',
      'MED',
      'CHI',
      'Directo (STD/Molotes)',
      'Total General',
      'Observaciones',
      'Última Actualización',
    ],
  ];
  let sumLar = 0;
  let sumMed = 0;
  let sumChi = 0;
  let sumDirect = 0;
  let sumGrand = 0;

  sortedEntries.forEach((e) => {
    const direct = e.rows
      .filter((r) => r.captureMode === 'direct_total')
      .reduce((acc, r) => acc + Number(r.total || 0), 0);
    sumLar += Number(e.totalLar || 0);
    sumMed += Number(e.totalMed || 0);
    sumChi += Number(e.totalChi || 0);
    sumDirect += direct;
    sumGrand += Number(e.grandTotal || 0);
    summaryRows.push([
      e.productionDate,
      e.employeeName,
      `@${e.employeeUsername}`,
      Number(e.totalLar || 0),
      Number(e.totalMed || 0),
      Number(e.totalChi || 0),
      direct,
      Number(e.grandTotal || 0),
      e.notes || '',
      e.updatedAt || e.createdAt || '',
    ]);
  });

  summaryRows.push([
    'TOTAL GENERAL',
    `${sortedEntries.length} registros`,
    '',
    sumLar,
    sumMed,
    sumChi,
    sumDirect,
    sumGrand,
    '',
    '',
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  setColumnWidths(wsSummary, summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

  // Sheet 2: Consolidado por Fecha
  const consolidatedByDate = buildConsolidatedByDate(sortedEntries, aromaProducts);
  const consolidatedSheet: any[][] = [
    ['Fecha', 'Empleados Incluidos', 'Variedad / Producto', 'Modo', 'LAR', 'MED', 'CHI', 'TOTAL'],
  ];
  consolidatedByDate.forEach((day) => {
    const empSummary = day.entries.map((e) => `${e.employeeName} (${e.grandTotal})`).join(' + ');
    day.rows.forEach((r) => {
      consolidatedSheet.push([
        day.date,
        empSummary,
        r.productName,
        r.captureMode === 'direct_total' ? 'Directo' : 'LAR/MED/CHI',
        r.captureMode === 'direct_total' ? 0 : r.lar,
        r.captureMode === 'direct_total' ? 0 : r.med,
        r.captureMode === 'direct_total' ? 0 : r.chi,
        r.total,
      ]);
    });
    consolidatedSheet.push([
      day.date,
      empSummary,
      `TOTAL CONSOLIDADO ${day.date}`,
      '',
      day.totals.totalLar,
      day.totals.totalMed,
      day.totals.totalChi,
      day.totals.grandTotal,
    ]);
  });
  const wsConsolidated = XLSX.utils.aoa_to_sheet(consolidatedSheet);
  setColumnWidths(wsConsolidated, consolidatedSheet);
  XLSX.utils.book_append_sheet(wb, wsConsolidated, 'Consolidado por Fecha');

  // Sheet 3: Detalle Completo por Variedad
  const detailSheet: any[][] = [
    ['Fecha', 'Empleado', 'Usuario', 'Variedad / Producto', 'Formato', 'LAR', 'MED', 'CHI', 'Total'],
  ];
  sortedEntries.forEach((e) => {
    e.rows.forEach((r) => {
      detailSheet.push([
        e.productionDate,
        e.employeeName,
        `@${e.employeeUsername}`,
        r.productName,
        r.captureMode === 'direct_total' ? 'Directo' : 'LAR/MED/CHI',
        r.captureMode === 'direct_total' ? 0 : Number(r.lar || 0),
        r.captureMode === 'direct_total' ? 0 : Number(r.med || 0),
        r.captureMode === 'direct_total' ? 0 : Number(r.chi || 0),
        Number(r.total || 0),
      ]);
    });
  });
  const wsDetail = XLSX.utils.aoa_to_sheet(detailSheet);
  setColumnWidths(wsDetail, detailSheet);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle Variedades');

  // Sheet 4: Catálogo de Productos
  const prodSheet: any[][] = [
    ['Orden', 'Producto / Variedad', 'Formato Captura', 'Estado', 'Fecha Alta'],
    ...[...aromaProducts]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => [
        p.sortOrder,
        p.name,
        p.captureMode === 'direct_total' ? 'Monto Directo' : 'LAR / MED / CHI',
        p.active !== false ? 'Activo' : 'Inactivo',
        p.createdAt || '',
      ]),
  ];
  const wsProducts = XLSX.utils.aoa_to_sheet(prodSheet);
  setColumnWidths(wsProducts, prodSheet);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Catálogo Productos');

  // Sheet 5: Usuarios y Personal
  const usersSheet: any[][] = [
    ['Nombre Completo', 'Usuario', 'Rol', 'Correo', 'Teléfono', 'Cargo', 'Área', 'Estado', 'Última Edición'],
    ...appUsers.map((u) => [
      u.fullName,
      u.username,
      u.role === 'admin' ? 'Admin' : 'Producción',
      u.email || '',
      u.phone || '',
      u.jobTitle || '',
      u.department || '',
      u.active !== false ? 'Activo' : 'Inactivo',
      u.updatedAt || u.createdAt || '',
    ]),
  ];
  const wsUsers = XLSX.utils.aoa_to_sheet(usersSheet);
  setColumnWidths(wsUsers, usersSheet);
  XLSX.utils.book_append_sheet(wb, wsUsers, 'Usuarios y Roles');

  XLSX.writeFile(wb, `AromaFlower_Todos_Los_Registros_${todayIso()}.xlsx`);
}

export function exportAllAdminRecordsPdf(
  dailyProductions: DailyProductionEntry[],
  aromaProducts: AromaProduct[],
  appUsers: AppUser[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sortedEntries = [...dailyProductions].sort((a, b) =>
    b.productionDate.localeCompare(a.productionDate) ||
    a.employeeName.localeCompare(b.employeeName)
  );
  const consolidatedByDate = buildConsolidatedByDate(sortedEntries, aromaProducts);
  const totalGrand = sortedEntries.reduce((acc, e) => acc + Number(e.grandTotal || 0), 0);

  addPdfHeader(
    doc,
    'Reporte General de Todos los Registros (Producción, Consolidado y Catálogo)',
    `${sortedEntries.length} planillas registradas • ${consolidatedByDate.length} fecha(s) • Total acumulado: ${totalGrand.toLocaleString()} unidades`
  );

  let y = 34;

  // Section 1: Summary of all entries across all dates
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BURGUNDY);
  doc.text('1. Resumen General de Registros por Fecha y Empleado', 14, y);
  y += 3;

  const summaryBody = sortedEntries.map((e) => {
    const direct = e.rows
      .filter((r) => r.captureMode === 'direct_total')
      .reduce((acc, r) => acc + Number(r.total || 0), 0);
    return [
      e.productionDate,
      e.employeeName,
      Number(e.totalLar || 0),
      Number(e.totalMed || 0),
      Number(e.totalChi || 0),
      direct,
      Number(e.grandTotal || 0),
    ];
  });

  const totLar = sortedEntries.reduce((acc, e) => acc + Number(e.totalLar || 0), 0);
  const totMed = sortedEntries.reduce((acc, e) => acc + Number(e.totalMed || 0), 0);
  const totChi = sortedEntries.reduce((acc, e) => acc + Number(e.totalChi || 0), 0);
  const totDir = sortedEntries.reduce(
    (acc, e) =>
      acc +
      e.rows
        .filter((r) => r.captureMode === 'direct_total')
        .reduce((s, r) => s + Number(r.total || 0), 0),
    0
  );

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Empleado', 'LAR', 'MED', 'CHI', 'Directo', 'TOTAL']],
    body: summaryBody.length
      ? summaryBody
      : [['—', 'Sin registros guardados aún', 0, 0, 0, 0, 0]],
    foot: [['TOTAL ACUMULADO', `${sortedEntries.length} planillas`, totLar, totMed, totChi, totDir, totalGrand]],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 10;

  // Section 2: Consolidated per date
  consolidatedByDate.forEach((day) => {
    if (y > 240) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BURGUNDY);
    doc.text(
      `Consolidado del Día: ${day.date} (${day.entries.map((e) => `${e.employeeName}: ${e.grandTotal}`).join(' + ')})`,
      14,
      y
    );
    y += 3;

    const head = [
      'Variedad',
      'LAR',
      'MED',
      'CHI',
      ...day.entries.map((e) => e.employeeName.toUpperCase()),
      'TOTAL',
    ];
    const body = day.rows.map((r) => [
      r.productName,
      r.captureMode === 'direct_total' ? '—' : r.lar,
      r.captureMode === 'direct_total' ? '—' : r.med,
      r.captureMode === 'direct_total' ? '—' : r.chi,
      ...day.entries.map((e) => r.byEmployee[e.employeeUserId] || 0),
      r.total,
    ]);
    const foot = [
      'TOTAL CONSOLIDADO',
      day.totals.totalLar,
      day.totals.totalMed,
      day.totals.totalChi,
      ...day.entries.map((e) => e.grandTotal),
      day.totals.grandTotal,
    ];

    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      foot: [foot],
      theme: 'grid',
      headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CREAM },
      styles: { fontSize: 7.5, cellPadding: 1.8 },
    });

    y = ((doc as any).lastAutoTable?.finalY || y) + 8;
  });

  // Section 3: Individual entries breakdown
  if (sortedEntries.length > 0) {
    doc.addPage();
    y = 18;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BURGUNDY);
    doc.text('Desglose Individual de Cada Registro', 14, y);
    y += 5;

    sortedEntries.forEach((entry) => {
      if (y > 235) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...OLIVE);
      doc.text(
        `${entry.employeeName.toUpperCase()} (@${entry.employeeUsername}) — Fecha: ${entry.productionDate} — Total: ${entry.grandTotal}`,
        14,
        y
      );
      y += 2.5;

      autoTable(doc, {
        startY: y,
        head: [['Variedad', 'LAR', 'MED', 'CHI', 'TOTAL']],
        body: entry.rows.map((r) => [
          r.productName,
          r.captureMode === 'direct_total' ? '(Directo)' : r.lar,
          r.captureMode === 'direct_total' ? '—' : r.med,
          r.captureMode === 'direct_total' ? '—' : r.chi,
          r.total,
        ]),
        foot: [['TOTAL', entry.totalLar, entry.totalMed, entry.totalChi, entry.grandTotal]],
        theme: 'grid',
        headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 7.5 },
        footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 7.5 },
        styles: { fontSize: 7.2, cellPadding: 1.5 },
      });

      y = ((doc as any).lastAutoTable?.finalY || y) + 7;
    });
  }

  // Section 4: Users & Catalog Summary
  if (y > 220) {
    doc.addPage();
    y = 18;
  }
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BURGUNDY);
  doc.text('Catálogo de Productos y Equipo Registrado', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Nombre Completo', 'Usuario', 'Rol', 'Correo', 'Teléfono', 'Estado']],
    body: appUsers.map((u) => [
      u.fullName,
      `@${u.username}`,
      u.role === 'admin' ? 'Admin' : 'Producción',
      u.email || '—',
      u.phone || '—',
      u.active !== false ? 'Activo' : 'Inactivo',
    ]),
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Todos_Los_Registros_${todayIso()}.pdf`);
}

// ==================== 2. DAILY CONSOLIDATED EXPORT ====================

export interface ConsolidatedRowExport {
  productName: string;
  captureMode: 'lar_med_chi' | 'direct_total';
  lar: number;
  med: number;
  chi: number;
  total: number;
  byEmployee: Record<string, number>;
}

export function exportDailyConsolidatedExcel(
  selectedDate: string,
  rows: ConsolidatedRowExport[],
  totals: { totalLar: number; totalMed: number; totalChi: number; grandTotal: number },
  entries: DailyProductionEntry[]
) {
  const wb = XLSX.utils.book_new();
  const empHeaders = entries.map((e) => e.employeeName.toUpperCase());
  const sheetRows: any[][] = [
    ['VARIEDAD', 'LAR', 'MED', 'CHI', ...empHeaders, 'TOTAL'],
    ...rows.map((r) => [
      r.productName,
      r.captureMode === 'direct_total' ? 0 : r.lar,
      r.captureMode === 'direct_total' ? 0 : r.med,
      r.captureMode === 'direct_total' ? 0 : r.chi,
      ...entries.map((e) => r.byEmployee[e.employeeUserId] || 0),
      r.total,
    ]),
    [
      'TOTAL DEL DÍA',
      totals.totalLar,
      totals.totalMed,
      totals.totalChi,
      ...entries.map((e) => e.grandTotal),
      totals.grandTotal,
    ],
  ];

  const wsMain = XLSX.utils.aoa_to_sheet(sheetRows);
  setColumnWidths(wsMain, sheetRows);
  XLSX.utils.book_append_sheet(wb, wsMain, `Consolidado ${selectedDate}`);

  entries.forEach((entry) => {
    const empData: any[][] = [
      ['EMPLEADO', entry.employeeName, 'FECHA', entry.productionDate],
      ['VARIEDAD', 'LAR', 'MED', 'CHI', 'TOTAL'],
      ...entry.rows.map((r) => [
        r.productName,
        r.captureMode === 'direct_total' ? 0 : r.lar,
        r.captureMode === 'direct_total' ? 0 : r.med,
        r.captureMode === 'direct_total' ? 0 : r.chi,
        r.total,
      ]),
      ['TOTAL', entry.totalLar, entry.totalMed, entry.totalChi, entry.grandTotal],
    ];
    const wsEmp = XLSX.utils.aoa_to_sheet(empData);
    setColumnWidths(wsEmp, empData);
    const safeName = entry.employeeName.replace(/[\\/?*[\]:]/g, '').slice(0, 28) || 'Empleado';
    XLSX.utils.book_append_sheet(wb, wsEmp, safeName);
  });

  XLSX.writeFile(wb, `AromaFlower_Consolidado_${selectedDate}.xlsx`);
}

export function exportDailyConsolidatedPdf(
  selectedDate: string,
  rows: ConsolidatedRowExport[],
  totals: { totalLar: number; totalMed: number; totalChi: number; grandTotal: number },
  entries: DailyProductionEntry[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(
    doc,
    `Consolidado Diario de Producción • Fecha: ${selectedDate}`,
    entries.length
      ? entries.map((e) => `${e.employeeName}: ${e.grandTotal}`).join('  +  ') +
          `  =  TOTAL: ${totals.grandTotal}`
      : 'Sin registros para esta fecha'
  );

  const head = [
    'Variedad',
    'LAR',
    'MED',
    'CHI',
    ...entries.map((e) => e.employeeName.toUpperCase()),
    'TOTAL',
  ];
  const body = rows.map((r) => [
    r.productName,
    r.captureMode === 'direct_total' ? '—' : r.lar,
    r.captureMode === 'direct_total' ? '—' : r.med,
    r.captureMode === 'direct_total' ? '—' : r.chi,
    ...entries.map((e) => r.byEmployee[e.employeeUserId] || 0),
    r.total,
  ]);
  const foot = [
    'TOTAL DEL DÍA',
    totals.totalLar,
    totals.totalMed,
    totals.totalChi,
    ...entries.map((e) => e.grandTotal),
    totals.grandTotal,
  ];

  autoTable(doc, {
    startY: 34,
    head: [head],
    body,
    foot: [foot],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  let y = ((doc as any).lastAutoTable?.finalY || 40) + 10;
  entries.forEach((entry) => {
    if (y > 230) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...OLIVE);
    doc.text(
      `Planilla Individual: ${entry.employeeName.toUpperCase()} (${entry.productionDate}) — Total: ${entry.grandTotal}`,
      14,
      y
    );
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [['Variedad', 'LAR', 'MED', 'CHI', 'TOTAL']],
      body: entry.rows.map((r) => [
        r.productName,
        r.captureMode === 'direct_total' ? '(Directo)' : r.lar,
        r.captureMode === 'direct_total' ? '—' : r.med,
        r.captureMode === 'direct_total' ? '—' : r.chi,
        r.total,
      ]),
      foot: [['TOTAL', entry.totalLar, entry.totalMed, entry.totalChi, entry.grandTotal]],
      theme: 'grid',
      headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 8 },
      footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.6 },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 8;
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Consolidado_${selectedDate}.pdf`);
}

// ==================== 3. SINGLE EMPLOYEE ENTRY EXPORT ====================

export function exportSingleEntryExcel(entry: DailyProductionEntry) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [
    ['EMPLEADO', entry.employeeName, 'USUARIO', `@${entry.employeeUsername}`, 'FECHA', entry.productionDate],
    [],
    ['VARIEDAD', 'LAR', 'MED', 'CHI', 'TOTAL'],
    ...entry.rows.map((r) => [
      r.productName,
      r.captureMode === 'direct_total' ? 0 : r.lar,
      r.captureMode === 'direct_total' ? 0 : r.med,
      r.captureMode === 'direct_total' ? 0 : r.chi,
      r.total,
    ]),
    ['TOTAL', entry.totalLar, entry.totalMed, entry.totalChi, entry.grandTotal],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Producción');
  XLSX.writeFile(wb, `Produccion_${entry.employeeName}_${entry.productionDate}.xlsx`);
}

export function exportSingleEntryPdf(entry: DailyProductionEntry) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(
    doc,
    `Registro de Producción: ${entry.employeeName.toUpperCase()}`,
    `Fecha: ${entry.productionDate} • Usuario: @${entry.employeeUsername} • Total: ${entry.grandTotal}`
  );

  autoTable(doc, {
    startY: 34,
    head: [['Variedad', 'LAR', 'MED', 'CHI', 'TOTAL']],
    body: entry.rows.map((r) => [
      r.productName,
      r.captureMode === 'direct_total' ? '(Directo)' : r.lar,
      r.captureMode === 'direct_total' ? '—' : r.med,
      r.captureMode === 'direct_total' ? '—' : r.chi,
      r.total,
    ]),
    foot: [['TOTAL', entry.totalLar, entry.totalMed, entry.totalChi, entry.grandTotal]],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 9, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8.5, cellPadding: 2.2 },
  });

  if (entry.notes) {
    const y = ((doc as any).lastAutoTable?.finalY || 50) + 8;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Observaciones: ${entry.notes}`, 14, y);
  }

  addPdfPageFooters(doc);
  doc.save(`Produccion_${entry.employeeName}_${entry.productionDate}.pdf`);
}

// ==================== 4. PRODUCTS CATALOG EXPORT ====================

export function exportProductsCatalogExcel(products: AromaProduct[]) {
  const wb = XLSX.utils.book_new();
  const sorted = [...products].sort((a, b) => a.sortOrder - b.sortOrder);
  const rows: any[][] = [
    ['Orden', 'Producto / Variedad', 'Formato Captura', 'Estado', 'Fecha Alta'],
    ...sorted.map((p) => [
      p.sortOrder,
      p.name,
      p.captureMode === 'direct_total' ? 'Monto Directo' : 'LAR / MED / CHI',
      p.active !== false ? 'Activo' : 'Inactivo',
      p.createdAt || '',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Catálogo Productos');
  XLSX.writeFile(wb, `AromaFlower_Catalogo_Productos_${todayIso()}.xlsx`);
}

export function exportProductsCatalogPdf(products: AromaProduct[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sorted = [...products].sort((a, b) => a.sortOrder - b.sortOrder);
  addPdfHeader(
    doc,
    'Catálogo Oficial de Productos y Variedades',
    `${sorted.length} productos registrados • ${sorted.filter((p) => p.active !== false).length} activos`
  );

  autoTable(doc, {
    startY: 34,
    head: [['Orden', 'Producto / Variedad', 'Formato', 'Estado', 'Alta']],
    body: sorted.map((p) => [
      p.sortOrder,
      p.name,
      p.captureMode === 'direct_total' ? 'Monto Directo' : 'LAR / MED / CHI',
      p.active !== false ? 'Activo' : 'Inactivo',
      p.createdAt || '',
    ]),
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Catalogo_Productos_${todayIso()}.pdf`);
}
