import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AppUser,
  AromaProduct,
  ClientPayment,
  DailyProductionEntry,
  DailySalesEntry,
  EmployeeLoanMovement,
  EmployeeAdjustment,
  GreenhouseApplication,
  PayrollEmployee,
  PayrollWeekEntry,
  PayrollWeekRow,
  RemissionNote,
  SalesClient,
  Supplier,
  SupplierPayment,
  SupplyItem,
  SupplyPurchase,
  TruckLoad,
} from '../types/greenhouse';
import { GeneralInventoryRow } from '../context/GreenhouseContext';

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
  appUsers: AppUser[],
  dailySales: DailySalesEntry[] = []
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

  // Sheet 5: Resumen de Ventas Diarias (CEDA CDMX)
  const sortedSales = [...dailySales].sort((a, b) =>
    b.saleDate.localeCompare(a.saleDate) || a.employeeName.localeCompare(b.employeeName)
  );
  const salesSummarySheet: any[][] = [
    ['Fecha Venta', 'Empleado', 'Usuario', 'Canal', 'Paquetes Vendidos', 'Total Venta ($ MXN)', 'Notas', 'Última Edición'],
    ...sortedSales.map((s) => [
      s.saleDate,
      s.employeeName,
      `@${s.employeeUsername}`,
      s.channel || 'CEDA CDMX',
      Number(s.totalPackages || 0),
      Number(s.totalAmount || 0),
      s.notes || '',
      s.updatedAt || s.createdAt || '',
    ]),
    [
      'TOTAL VENTAS',
      `${sortedSales.length} registros`,
      '',
      '',
      sortedSales.reduce((acc, s) => acc + Number(s.totalPackages || 0), 0),
      sortedSales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0),
      '',
      '',
    ],
  ];
  const wsSalesSummary = XLSX.utils.aoa_to_sheet(salesSummarySheet);
  setColumnWidths(wsSalesSummary, salesSummarySheet);
  XLSX.utils.book_append_sheet(wb, wsSalesSummary, 'Resumen Ventas');

  // Sheet 6: Detalle de Ventas por Variedad
  const salesDetailSheet: any[][] = [
    ['Fecha Venta', 'Empleado', 'Canal', 'Variedad / Producto', 'Paquetes Vendidos', 'Precio Unitario ($)', 'Subtotal ($ MXN)'],
  ];
  sortedSales.forEach((s) => {
    s.rows.forEach((r) => {
      salesDetailSheet.push([
        s.saleDate,
        s.employeeName,
        s.channel || 'CEDA CDMX',
        r.productName,
        Number(r.packagesSold || 0),
        Number(r.unitPrice || 0),
        Number(r.subtotal || 0),
      ]);
    });
  });
  const wsSalesDetail = XLSX.utils.aoa_to_sheet(salesDetailSheet);
  setColumnWidths(wsSalesDetail, salesDetailSheet);
  XLSX.utils.book_append_sheet(wb, wsSalesDetail, 'Detalle Ventas');

  // Sheet 7: Usuarios y Personal
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
  appUsers: AppUser[],
  dailySales: DailySalesEntry[] = []
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sortedEntries = [...dailyProductions].sort((a, b) =>
    b.productionDate.localeCompare(a.productionDate) ||
    a.employeeName.localeCompare(b.employeeName)
  );
  const sortedSales = [...dailySales].sort((a, b) =>
    b.saleDate.localeCompare(a.saleDate) || a.employeeName.localeCompare(b.employeeName)
  );
  const consolidatedByDate = buildConsolidatedByDate(sortedEntries, aromaProducts);
  const totalGrand = sortedEntries.reduce((acc, e) => acc + Number(e.grandTotal || 0), 0);
  const totalSalesAmount = sortedSales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

  addPdfHeader(
    doc,
    'Reporte General Completo (Producción CEDA CDMX, Ventas, Catálogo y Usuarios)',
    `${sortedEntries.length} planillas prod. (${totalGrand.toLocaleString()} u.) • ${sortedSales.length} reg. ventas ($${totalSalesAmount.toLocaleString('es-MX')})`
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

  // Section 4: Resumen de Ventas (CEDA CDMX)
  if (y > 215) {
    doc.addPage();
    y = 18;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BURGUNDY);
  doc.text('Resumen de Ventas Diarias ( CEDA CDMX )', 14, y);
  y += 3;

  const salesFootPackages = sortedSales.reduce((acc, s) => acc + Number(s.totalPackages || 0), 0);
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Empleado', 'Canal', 'Paquetes Vendidos', 'Total Venta ($ MXN)']],
    body: sortedSales.length
      ? sortedSales.map((s) => [
          s.saleDate,
          s.employeeName,
          s.channel || 'CEDA CDMX',
          Number(s.totalPackages || 0),
          `$${Number(s.totalAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ])
      : [['—', 'Sin ventas registradas', '—', 0, '$0.00']],
    foot: [
      [
        'TOTAL VENTAS',
        `${sortedSales.length} reg.`,
        'CEDA CDMX',
        salesFootPackages,
        `$${totalSalesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 10;

  // Section 5: Users & Catalog Summary
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

// ==================== 5. FILTERED PRODUCTIONS BY EMPLOYEE / RANGE ====================

export function exportFilteredProductionsExcel(
  entries: DailyProductionEntry[],
  filterLabel: string
) {
  const wb = XLSX.utils.book_new();
  const sorted = [...entries].sort(
    (a, b) =>
      b.productionDate.localeCompare(a.productionDate) ||
      a.employeeName.localeCompare(b.employeeName)
  );

  // Sheet 1: Totales por Empleado
  const empAgg = new Map<
    string,
    { name: string; username: string; count: number; lar: number; med: number; chi: number; direct: number; total: number }
  >();
  sorted.forEach((e) => {
    const direct = e.rows
      .filter((r) => r.captureMode === 'direct_total')
      .reduce((acc, r) => acc + Number(r.total || 0), 0);
    const cur = empAgg.get(e.employeeUserId) || {
      name: e.employeeName,
      username: e.employeeUsername,
      count: 0,
      lar: 0,
      med: 0,
      chi: 0,
      direct: 0,
      total: 0,
    };
    cur.count += 1;
    cur.lar += Number(e.totalLar || 0);
    cur.med += Number(e.totalMed || 0);
    cur.chi += Number(e.totalChi || 0);
    cur.direct += direct;
    cur.total += Number(e.grandTotal || 0);
    empAgg.set(e.employeeUserId, cur);
  });

  const empRows: any[][] = [
    ['Filtro Aplicado', filterLabel],
    [],
    ['Empleado', 'Usuario', 'Planillas', 'LAR', 'MED', 'CHI', 'Directo', 'Total Acumulado'],
    ...Array.from(empAgg.values()).map((x) => [
      x.name,
      `@${x.username}`,
      x.count,
      x.lar,
      x.med,
      x.chi,
      x.direct,
      x.total,
    ]),
  ];
  const wsEmp = XLSX.utils.aoa_to_sheet(empRows);
  setColumnWidths(wsEmp, empRows);
  XLSX.utils.book_append_sheet(wb, wsEmp, 'Total por Empleado');

  // Sheet 2: Historial Filtrado
  const listRows: any[][] = [
    ['Fecha', 'Empleado', 'Usuario', 'LAR', 'MED', 'CHI', 'Directo', 'Total', 'Observaciones'],
    ...sorted.map((e) => {
      const direct = e.rows
        .filter((r) => r.captureMode === 'direct_total')
        .reduce((acc, r) => acc + Number(r.total || 0), 0);
      return [
        e.productionDate,
        e.employeeName,
        `@${e.employeeUsername}`,
        e.totalLar,
        e.totalMed,
        e.totalChi,
        direct,
        e.grandTotal,
        e.notes || '',
      ];
    }),
  ];
  const wsList = XLSX.utils.aoa_to_sheet(listRows);
  setColumnWidths(wsList, listRows);
  XLSX.utils.book_append_sheet(wb, wsList, 'Historial Filtrado');

  XLSX.writeFile(wb, `AromaFlower_Produccion_CEDA_${todayIso()}.xlsx`);
}

export function exportFilteredProductionsPdf(
  entries: DailyProductionEntry[],
  filterLabel: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sorted = [...entries].sort(
    (a, b) =>
      b.productionDate.localeCompare(a.productionDate) ||
      a.employeeName.localeCompare(b.employeeName)
  );
  const grandTotal = sorted.reduce((acc, e) => acc + Number(e.grandTotal || 0), 0);

  addPdfHeader(
    doc,
    'Histórico de Producción por Empleado ( CEDA CDMX )',
    `${filterLabel} • ${sorted.length} planillas • Total: ${grandTotal.toLocaleString()} unidades`
  );

  const empAgg = new Map<
    string,
    { name: string; count: number; lar: number; med: number; chi: number; direct: number; total: number }
  >();
  sorted.forEach((e) => {
    const direct = e.rows
      .filter((r) => r.captureMode === 'direct_total')
      .reduce((acc, r) => acc + Number(r.total || 0), 0);
    const cur = empAgg.get(e.employeeUserId) || {
      name: e.employeeName,
      count: 0,
      lar: 0,
      med: 0,
      chi: 0,
      direct: 0,
      total: 0,
    };
    cur.count += 1;
    cur.lar += Number(e.totalLar || 0);
    cur.med += Number(e.totalMed || 0);
    cur.chi += Number(e.totalChi || 0);
    cur.direct += direct;
    cur.total += Number(e.grandTotal || 0);
    empAgg.set(e.employeeUserId, cur);
  });

  autoTable(doc, {
    startY: 34,
    head: [['Empleado', 'Planillas', 'LAR', 'MED', 'CHI', 'Directo', 'Total Acumulado']],
    body: Array.from(empAgg.values()).map((x) => [
      x.name,
      x.count,
      x.lar,
      x.med,
      x.chi,
      x.direct,
      x.total,
    ]),
    foot: [
      [
        'TOTAL FILTRADO',
        sorted.length,
        sorted.reduce((a, e) => a + e.totalLar, 0),
        sorted.reduce((a, e) => a + e.totalMed, 0),
        sorted.reduce((a, e) => a + e.totalChi, 0),
        sorted.reduce(
          (a, e) =>
            a +
            e.rows
              .filter((r) => r.captureMode === 'direct_total')
              .reduce((s, r) => s + Number(r.total || 0), 0),
          0
        ),
        grandTotal,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  let y = ((doc as any).lastAutoTable?.finalY || 50) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Empleado', 'LAR', 'MED', 'CHI', 'TOTAL']],
    body: sorted.map((e) => [e.productionDate, e.employeeName, e.totalLar, e.totalMed, e.totalChi, e.grandTotal]),
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Produccion_CEDA_${todayIso()}.pdf`);
}

// ==================== 6. DAILY SALES EXPORTS (RESUMEN DE VENTAS) ====================

export function exportDailySalesExcel(
  sales: DailySalesEntry[],
  label = 'General'
) {
  const wb = XLSX.utils.book_new();
  const sorted = [...sales].sort(
    (a, b) =>
      b.saleDate.localeCompare(a.saleDate) ||
      a.employeeName.localeCompare(b.employeeName)
  );

  const summaryRows: any[][] = [
    ['REPORTE RESUMEN DE VENTAS (CEDA CDMX)', label],
    [],
    ['Fecha Venta', 'Empleado', 'Usuario', 'Canal', 'Paquetes Vendidos', 'Total Venta ($ MXN)', 'Observaciones'],
    ...sorted.map((s) => [
      s.saleDate,
      s.employeeName,
      `@${s.employeeUsername}`,
      s.channel || 'CEDA CDMX',
      Number(s.totalPackages || 0),
      Number(s.totalAmount || 0),
      s.notes || '',
    ]),
    [
      'TOTAL',
      `${sorted.length} registros`,
      '',
      '',
      sorted.reduce((a, s) => a + Number(s.totalPackages || 0), 0),
      sorted.reduce((a, s) => a + Number(s.totalAmount || 0), 0),
      '',
    ],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  setColumnWidths(wsSummary, summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Ventas');

  const detailRows: any[][] = [
    ['Fecha', 'Empleado', 'Canal', 'Variedad / Producto', 'Paquetes Vendidos', 'Precio Unitario ($)', 'Subtotal ($ MXN)'],
  ];
  sorted.forEach((s) => {
    s.rows.forEach((r) => {
      detailRows.push([
        s.saleDate,
        s.employeeName,
        s.channel || 'CEDA CDMX',
        r.productName,
        Number(r.packagesSold || 0),
        Number(r.unitPrice || 0),
        Number(r.subtotal || 0),
      ]);
    });
  });
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  setColumnWidths(wsDetail, detailRows);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle por Variedad');

  XLSX.writeFile(wb, `AromaFlower_Resumen_Ventas_${todayIso()}.xlsx`);
}

export function exportDailySalesPdf(
  sales: DailySalesEntry[],
  label = 'General'
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sorted = [...sales].sort(
    (a, b) =>
      b.saleDate.localeCompare(a.saleDate) ||
      a.employeeName.localeCompare(b.employeeName)
  );
  const totPkg = sorted.reduce((a, s) => a + Number(s.totalPackages || 0), 0);
  const totAmt = sorted.reduce((a, s) => a + Number(s.totalAmount || 0), 0);

  addPdfHeader(
    doc,
    `Resumen de Ventas CEDA CDMX (${label})`,
    `${sorted.length} registros • ${totPkg.toLocaleString()} paquetes • Total: $${totAmt.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  );

  autoTable(doc, {
    startY: 34,
    head: [['Fecha', 'Empleado', 'Canal', 'Paquetes', 'Total Venta ($ MXN)']],
    body: sorted.length
      ? sorted.map((s) => [
          s.saleDate,
          s.employeeName,
          s.channel || 'CEDA CDMX',
          Number(s.totalPackages || 0),
          `$${Number(s.totalAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ])
      : [['—', 'Sin registros de venta', '—', 0, '$0.00']],
    foot: [
      [
        'TOTAL GENERAL',
        `${sorted.length} reg.`,
        'CEDA CDMX',
        totPkg,
        `$${totAmt.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  let y = ((doc as any).lastAutoTable?.finalY || 50) + 10;
  sorted.forEach((s) => {
    if (y > 235) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...OLIVE);
    doc.text(
      `Venta ${s.employeeName.toUpperCase()} (${s.saleDate} • ${s.channel || 'CEDA CDMX'}) — $${Number(s.totalAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
      14,
      y
    );
    y += 2.5;
    autoTable(doc, {
      startY: y,
      head: [['Variedad', 'Paquetes Vendidos', 'Precio Unitario ($)', 'Subtotal ($ MXN)']],
      body: s.rows.map((r) => [
        r.productName,
        r.packagesSold,
        `$${Number(r.unitPrice || 0).toFixed(2)}`,
        `$${Number(r.subtotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ]),
      foot: [
        [
          'TOTAL',
          s.totalPackages,
          '—',
          `$${Number(s.totalAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 7.5 },
      footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 7.5 },
      styles: { fontSize: 7.2, cellPadding: 1.5 },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 7;
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Resumen_Ventas_${todayIso()}.pdf`);
}

export function exportSingleSaleExcel(entry: DailySalesEntry) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [
    ['EMPLEADO', entry.employeeName, 'CANAL', entry.channel || 'CEDA CDMX', 'FECHA', entry.saleDate],
    [],
    ['VARIEDAD / PRODUCTO', 'PAQUETES VENDIDOS', 'PRECIO UNITARIO ($)', 'SUBTOTAL ($ MXN)'],
    ...entry.rows.map((r) => [
      r.productName,
      Number(r.packagesSold || 0),
      Number(r.unitPrice || 0),
      Number(r.subtotal || 0),
    ]),
    ['TOTAL', entry.totalPackages, '', entry.totalAmount],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Venta Diaria');
  XLSX.writeFile(wb, `Venta_${entry.employeeName}_${entry.saleDate}.xlsx`);
}

export function exportSingleSalePdf(entry: DailySalesEntry) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(
    doc,
    `Resumen de Venta: ${entry.employeeName.toUpperCase()}`,
    `Fecha: ${entry.saleDate} • Canal: ${entry.channel || 'CEDA CDMX'} • Total: $${Number(entry.totalAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  );

  autoTable(doc, {
    startY: 34,
    head: [['Variedad / Producto', 'Paquetes Vendidos', 'Precio Unitario ($)', 'Subtotal ($ MXN)']],
    body: entry.rows.map((r) => [
      r.productName,
      r.packagesSold,
      `$${Number(r.unitPrice || 0).toFixed(2)}`,
      `$${Number(r.subtotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ]),
    foot: [
      [
        'TOTAL VENTA',
        entry.totalPackages,
        '—',
        `$${Number(entry.totalAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
    ],
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
  doc.save(`Venta_${entry.employeeName}_${entry.saleDate}.pdf`);
}

// ==================== 7. PAYROLL, LOANS, SUPPLIERS & EMPLOYEES EXPORTS ====================

const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function exportPayrollWeekExcel(week: PayrollWeekEntry) {
  const wb = XLSX.utils.book_new();
  const totalAttendanceDiscounts = week.rows.reduce(
    (a, r) => a + Number(r.attendanceDiscount || 0),
    0
  );
  const totalCommissions = week.rows.reduce(
    (a, r) => a + Number(r.commissionBonusAmount || 0),
    0
  );
  const rows: any[][] = [
    [week.weekLabel, '', 'EQUIPO / GRUPO:', week.teamGroup, 'ESTATUS:', week.status.toUpperCase()],
    [
      'NOMBRE',
      'DIAS',
      'P/ SEMANAL',
      'SEMANA',
      'BONO/AyP',
      'DESC. FALTAS / AyP',
      'FUMIGADAS (Cant)',
      'FUMIGADAS ($)',
      'CARGADAS (Cant)',
      'CARGADAS ($)',
      'HORAS EXTRAS (Cant)',
      'HORAS EXTRAS ($)',
      'DESTAJOS (Cant)',
      'DESTAJOS ($)',
      'TRABAJO EXTRA ($)',
      'COMISION / BONO PROD ($)',
      'OTROS DESC ($)',
      'PAGO DE PRESTAMO',
      'PRESTAMO',
      'RESTA DEL PRESTAMO',
      'TOTAL NETO',
      'PAGADO',
    ],
    ...week.rows.map((r) => [
      r.employeeName,
      Number(r.daysWorked || 0),
      Number(r.weeklySalary || 0),
      Number(r.weekPay || 0),
      Number(r.attendanceBonus || 0),
      Number(r.attendanceDiscount || 0),
      Number(r.fumigadasQty || 0),
      Number(r.fumigadasAmount || 0),
      Number(r.cargadasQty || 0),
      Number(r.cargadasAmount || 0),
      Number(r.extraHoursQty || 0),
      Number(r.extraHoursAmount || 0),
      Number(r.destajosQty || 0),
      Number(r.destajosAmount || 0),
      Number(r.extraWorkAmount || 0),
      Number(r.commissionBonusAmount || 0),
      Number(r.otherDeductions || 0),
      Number(r.loanPayment || 0),
      Number(r.loanPreviousBalance || 0),
      Number(r.loanRemainingBalance || 0),
      Number(r.totalNetPay || 0),
      r.paid ? 'SI' : 'NO',
    ]),
    [
      'TOTAL',
      '',
      '',
      Number(week.totalWeekPay || 0),
      Number(week.totalBonus || 0),
      totalAttendanceDiscounts,
      '',
      Number(week.totalFumigadas || 0),
      '',
      Number(week.totalCargadas || 0),
      '',
      Number(week.totalExtraHours || 0),
      '',
      Number(week.totalDestajos || 0),
      Number(week.totalExtraWork || 0),
      totalCommissions,
      Number(week.totalOtherDeductions || 0),
      Number(week.totalLoanPayments || 0),
      '',
      Number(week.totalLoanRemaining || 0),
      Number(week.grandTotalPay || 0),
      '',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, rows);
  const safeSheet = `Nomina ${week.startDate}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  XLSX.writeFile(wb, `AromaFlower_Nomina_${week.startDate}_${week.teamGroup}.xlsx`);
}

export function exportPayrollWeekPdf(week: PayrollWeekEntry) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalAttendanceDiscounts = week.rows.reduce(
    (a, r) => a + Number(r.attendanceDiscount || 0),
    0
  );
  const totalCommissions = week.rows.reduce(
    (a, r) => a + Number(r.commissionBonusAmount || 0),
    0
  );
  addPdfHeader(
    doc,
    `Nómina Semanal: ${week.weekLabel}`,
    `Equipo: ${week.teamGroup} • Del ${week.startDate} al ${week.endDate} • Total Neto a Pagar: ${fmtMoney(week.grandTotalPay)}`
  );

  autoTable(doc, {
    startY: 32,
    head: [
      [
        'NOMBRE',
        'DIAS',
        'SEMANA',
        'BONO AyP',
        'DESC. AyP',
        'FUMIG.',
        'H.EXT/CARG',
        'TR.EXT',
        'COM/BONO+',
        'OTR.DESC',
        'ABONO PR.',
        'RESTA PR.',
        'TOTAL NETO',
      ],
    ],
    body: week.rows.map((r) => [
      r.employeeName,
      r.daysWorked,
      fmtMoney(r.weekPay),
      fmtMoney(r.attendanceBonus),
      Number(r.attendanceDiscount || 0) > 0 ? `- ${fmtMoney(Number(r.attendanceDiscount || 0))}` : '$0.00',
      r.fumigadasQty ? `${r.fumigadasQty} (${fmtMoney(r.fumigadasAmount)})` : '$0.00',
      fmtMoney(Number(r.extraHoursAmount || 0) + Number(r.cargadasAmount || 0) + Number(r.destajosAmount || 0)),
      fmtMoney(r.extraWorkAmount),
      fmtMoney(Number(r.commissionBonusAmount || 0)),
      Number(r.otherDeductions || 0) > 0 ? `- ${fmtMoney(r.otherDeductions)}` : '$0.00',
      Number(r.loanPayment || 0) > 0 ? `- ${fmtMoney(r.loanPayment)}` : '$0.00',
      fmtMoney(r.loanRemainingBalance),
      fmtMoney(r.totalNetPay),
    ]),
    foot: [
      [
        'TOTALES',
        `${week.rows.length} emp.`,
        fmtMoney(week.totalWeekPay),
        fmtMoney(week.totalBonus),
        totalAttendanceDiscounts > 0 ? `- ${fmtMoney(totalAttendanceDiscounts)}` : '$0.00',
        fmtMoney(week.totalFumigadas),
        fmtMoney(
          Number(week.totalExtraHours || 0) +
            Number(week.totalCargadas || 0) +
            Number(week.totalDestajos || 0)
        ),
        fmtMoney(week.totalExtraWork),
        fmtMoney(totalCommissions),
        Number(week.totalOtherDeductions || 0) > 0
          ? `- ${fmtMoney(week.totalOtherDeductions)}`
          : '$0.00',
        Number(week.totalLoanPayments || 0) > 0
          ? `- ${fmtMoney(week.totalLoanPayments)}`
          : '$0.00',
        fmtMoney(week.totalLoanRemaining),
        fmtMoney(week.grandTotalPay),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 6.8, fontStyle: 'bold' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 6.6, cellPadding: 1.5 },
    columnStyles: {
      1: { halign: 'center' },
      12: { halign: 'right', fontStyle: 'bold' },
    },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Nomina_${week.startDate}_${week.teamGroup}.pdf`);
}

export function exportEmployeePaySlipPdf(week: PayrollWeekEntry, row: PayrollWeekRow) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(
    doc,
    `Recibo Individual de Pago — ${row.employeeName}`,
    `Periodo: ${week.weekLabel} (${week.startDate} al ${week.endDate}) • Grupo: ${row.teamGroup || week.teamGroup}`
  );

  let y = 36;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BURGUNDY);
  doc.text('Detalle de Percepciones y Deducciones', 14, y);
  y += 4;

  const lines: Array<[string, string, string]> = [
    ['Sueldo Semanal Base (6 días)', `${row.daysWorked} días trabajados`, fmtMoney(row.weekPay)],
    ['Bono de Asistencia y Puntualidad (AyP)', row.attendanceBonus > 0 ? 'Aplicado' : 'No aplica', fmtMoney(row.attendanceBonus)],
    ['Fumigadas', `${row.fumigadasQty || 0} tambos 200L`, fmtMoney(row.fumigadasAmount)],
    ['Cargadas', `${row.cargadasQty || 0} u.`, fmtMoney(row.cargadasAmount)],
    ['Horas Extras', `${row.extraHoursQty || 0} hrs`, fmtMoney(row.extraHoursAmount)],
    ['Destajos (Estajos)', `${row.destajosQty || 0} u.`, fmtMoney(row.destajosAmount)],
    ['Trabajo Extra', row.extraWorkDescription || (row.extraWorkAmount > 0 ? 'Extra registrado' : '—'), fmtMoney(row.extraWorkAmount)],
    [
      'Comisiones / Bono Productividad / Adicionales (+)',
      row.commissionBonusNotes || (Number(row.commissionBonusAmount || 0) > 0 ? 'Pago adicional' : '—'),
      fmtMoney(Number(row.commissionBonusAmount || 0)),
    ],
    [
      'Descuento por Faltas / Asistencia (-)',
      Number(row.attendanceDiscount || 0) > 0 ? 'Descuento aplicado' : '—',
      Number(row.attendanceDiscount || 0) > 0 ? `- ${fmtMoney(Number(row.attendanceDiscount || 0))}` : '$0.00',
    ],
    [
      'Descuento / Abono a Préstamo (-)',
      `Saldo anterior: ${fmtMoney(row.loanPreviousBalance)}`,
      row.loanPayment > 0 ? `- ${fmtMoney(row.loanPayment)}` : '$0.00',
    ],
    [
      'Otros Descuentos (-)',
      row.otherDeductions > 0 ? 'Aplicado' : '—',
      row.otherDeductions > 0 ? `- ${fmtMoney(row.otherDeductions)}` : '$0.00',
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Referencia / Cantidad', 'Importe ($ MXN)']],
    body: lines,
    foot: [['TOTAL NETO A RECIBIR', row.paid ? 'ESTATUS: PAGADO' : 'ESTATUS: PENDIENTE', fmtMoney(row.totalNetPay)]],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 10, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8.8, cellPadding: 2.8 },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 10;
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(`Estado de Préstamo Personal:`, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Saldo Anterior: ${fmtMoney(row.loanPreviousBalance)}   |   Abono en esta Nómina: ${fmtMoney(row.loanPayment)}   |   Saldo Restante: ${fmtMoney(row.loanRemainingBalance)}`,
    14,
    y + 6
  );

  y += 28;
  doc.setDrawColor(140, 140, 140);
  doc.line(20, y, 85, y);
  doc.line(125, y, 190, y);
  doc.setFontSize(8.5);
  doc.text(`Firma de Conformidad (${row.employeeName})`, 52.5, y + 5, { align: 'center' });
  doc.text('Autorización Administración Aroma Flower', 157.5, y + 5, { align: 'center' });

  addPdfPageFooters(doc);
  doc.save(`Recibo_${row.employeeName}_${week.startDate}.pdf`);
}

export function exportEmployeeLoansExcel(
  employees: PayrollEmployee[],
  movements: EmployeeLoanMovement[]
) {
  const wb = XLSX.utils.book_new();
  const balRows: any[][] = [
    ['Empleado', 'Equipo', 'Sueldo Semanal', 'Saldo Pendiente ($ MXN)', 'Estado'],
    ...employees.map((e) => [
      e.fullName,
      e.teamGroup,
      Number(e.weeklySalary || 0),
      Number(e.loanBalance || 0),
      e.active ? 'Activo' : 'Baja',
    ]),
  ];
  const wsBal = XLSX.utils.aoa_to_sheet(balRows);
  setColumnWidths(wsBal, balRows);
  XLSX.utils.book_append_sheet(wb, wsBal, 'Saldos Préstamos');

  const movRows: any[][] = [
    ['Fecha', 'Empleado', 'Tipo', 'Monto ($ MXN)', 'Saldo Después', 'Concepto', 'Notas'],
    ...movements.map((m) => [
      m.movementDate,
      m.employeeName,
      m.movementType.toUpperCase(),
      Number(m.amount || 0),
      Number(m.balanceAfter || 0),
      m.concept,
      m.notes || '',
    ]),
  ];
  const wsMov = XLSX.utils.aoa_to_sheet(movRows);
  setColumnWidths(wsMov, movRows);
  XLSX.utils.book_append_sheet(wb, wsMov, 'Historial Movimientos');

  XLSX.writeFile(wb, `AromaFlower_Prestamos_Empleados_${todayIso()}.xlsx`);
}

export function exportEmployeeLoansPdf(
  employees: PayrollEmployee[],
  movements: EmployeeLoanMovement[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totalDebt = employees.reduce((acc, e) => acc + Number(e.loanBalance || 0), 0);
  addPdfHeader(
    doc,
    'Control de Préstamos y Descuentos a Empleados',
    `Saldo Total por Cobrar: ${fmtMoney(totalDebt)} • ${movements.length} movimientos registrados`
  );

  const activeDebtors = employees.filter((e) => Number(e.loanBalance || 0) > 0);
  autoTable(doc, {
    startY: 34,
    head: [['Empleado', 'Grupo', 'Sueldo Semanal', 'Saldo Pendiente']],
    body: activeDebtors.length
      ? activeDebtors.map((e) => [
          e.fullName,
          e.teamGroup,
          fmtMoney(e.weeklySalary),
          fmtMoney(e.loanBalance),
        ])
      : [['Sin adeudos pendientes', '—', '—', '$0.00']],
    foot: [['TOTAL CARTERA DE PRÉSTAMOS', `${activeDebtors.length} emp.`, '—', fmtMoney(totalDebt)]],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8.5 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  const y = ((doc as any).lastAutoTable?.finalY || 50) + 10;
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Empleado', 'Tipo', 'Monto', 'Saldo Final', 'Concepto']],
    body: movements.length
      ? movements.map((m) => [
          m.movementDate,
          m.employeeName,
          m.movementType.toUpperCase(),
          fmtMoney(m.amount),
          fmtMoney(m.balanceAfter),
          m.concept,
        ])
      : [['—', 'Sin movimientos', '—', '$0.00', '$0.00', '—']],
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Prestamos_Empleados_${todayIso()}.pdf`);
}

export function exportSupplierPaymentsExcel(payments: SupplierPayment[]) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [
    ['Fecha', 'Proveedor / Beneficiario', 'Categoría', 'Concepto', 'Referencia', 'Monto Total', 'Pagado', 'Saldo Pendiente', 'Método', 'Estatus', 'Notas'],
    ...payments.map((p) => [
      p.paymentDate,
      p.supplierName,
      p.category,
      p.concept,
      p.reference || '',
      Number(p.amount || 0),
      Number(p.paidAmount || 0),
      Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0)),
      p.paymentMethod,
      p.status.toUpperCase(),
      p.notes || '',
    ]),
    [
      'TOTALES',
      `${payments.length} registros`,
      '',
      '',
      '',
      payments.reduce((a, p) => a + Number(p.amount || 0), 0),
      payments.reduce((a, p) => a + Number(p.paidAmount || 0), 0),
      payments.reduce((a, p) => a + Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0)), 0),
      '',
      '',
      '',
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos Proveedores');
  XLSX.writeFile(wb, `AromaFlower_Pagos_Proveedores_${todayIso()}.xlsx`);
}

export function exportSupplierPaymentsPdf(payments: SupplierPayment[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totAmt = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const totPaid = payments.reduce((a, p) => a + Number(p.paidAmount || 0), 0);
  addPdfHeader(
    doc,
    'Reporte de Pagos a Proveedores y Gastos Operativos',
    `${payments.length} registros • Total Facturado: ${fmtMoney(totAmt)} • Total Pagado: ${fmtMoney(totPaid)}`
  );

  autoTable(doc, {
    startY: 32,
    head: [['Fecha', 'Proveedor', 'Categoría', 'Concepto', 'Ref.', 'Monto', 'Pagado', 'Método', 'Estatus']],
    body: payments.length
      ? payments.map((p) => [
          p.paymentDate,
          p.supplierName,
          p.category,
          p.concept,
          p.reference || '—',
          fmtMoney(p.amount),
          fmtMoney(p.paidAmount),
          p.paymentMethod,
          p.status.toUpperCase(),
        ])
      : [['—', 'Sin pagos registrados', '—', '—', '—', '$0.00', '$0.00', '—', '—']],
    foot: [
      [
        'TOTALES',
        `${payments.length} pagos`,
        '',
        '',
        '',
        fmtMoney(totAmt),
        fmtMoney(totPaid),
        '',
        '',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Pagos_Proveedores_${todayIso()}.pdf`);
}

export function exportEmployeesDirectoryExcel(
  employees: PayrollEmployee[],
  appUsers: AppUser[]
) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [
    [
      'Nombre',
      'Equipo / Grupo',
      'Puesto',
      'Teléfono WhatsApp',
      'Correo',
      'Sueldo Semanal',
      'Bono AyP',
      'Saldo Préstamo',
      'Usuario Sistema',
      'Rol Acceso',
      'Estatus',
      'Fecha Ingreso',
      'Fecha Baja',
      'Motivo Baja',
    ],
    ...employees.map((e) => {
      const linked = e.linkedUserId ? appUsers.find((u) => u.id === e.linkedUserId) : undefined;
      return [
        e.fullName,
        e.teamGroup,
        e.jobTitle,
        e.phone,
        e.email,
        Number(e.weeklySalary || 0),
        e.hasAttendanceBonus ? Number(e.defaultBonusAmount || 150) : 0,
        Number(e.loanBalance || 0),
        linked ? linked.username : 'Sin acceso',
        linked ? linked.role.toUpperCase() : '—',
        e.active ? 'ACTIVO' : 'BAJA',
        e.hireDate || '',
        e.terminationDate || '',
        e.terminationReason || '',
      ];
    }),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Empleados');
  XLSX.writeFile(wb, `AromaFlower_Empleados_${todayIso()}.xlsx`);
}

export function exportEmployeesDirectoryPdf(
  employees: PayrollEmployee[],
  appUsers: AppUser[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const activos = employees.filter((e) => e.active !== false).length;
  addPdfHeader(
    doc,
    'Directorio Oficial de Empleados y Credenciales',
    `Total: ${employees.length} • Activos: ${activos} • Bajas: ${employees.length - activos}`
  );

  autoTable(doc, {
    startY: 32,
    head: [['Nombre', 'Equipo', 'Puesto', 'WhatsApp', 'Sueldo Sem.', 'Bono AyP', 'Préstamo', 'Usuario', 'Estatus']],
    body: employees.map((e) => {
      const linked = e.linkedUserId ? appUsers.find((u) => u.id === e.linkedUserId) : undefined;
      return [
        e.fullName,
        e.teamGroup,
        e.jobTitle || '—',
        e.phone || '—',
        fmtMoney(e.weeklySalary),
        e.hasAttendanceBonus ? fmtMoney(e.defaultBonusAmount || 150) : 'No',
        fmtMoney(e.loanBalance),
        linked ? `@${linked.username} (${linked.role})` : 'Sin cuenta',
        e.active !== false ? 'ACTIVO' : `BAJA (${e.terminationDate || ''})`,
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Empleados_${todayIso()}.pdf`);
}

// ==================== 8. INVENTARIO GENERAL ÚNICO ====================

export function exportGeneralInventoryExcel(rows: GeneralInventoryRow[]) {
  const wb = XLSX.utils.book_new();
  const sheetRows: any[][] = [
    ['INVENTARIO GENERAL ÚNICO DE FLORES / TALLOS - AROMA FLOWER', `Generado: ${todayIso()}`],
    [],
    [
      'Variedad',
      'Prod. LAR',
      'Prod. MED',
      'Prod. CHI',
      'Total Producido',
      'Desp. LAR',
      'Desp. MED',
      'Desp. CHI',
      'Total Despachado',
      'Disp. LAR',
      'Disp. MED',
      'Disp. CHI',
      'Stock Disponible',
      'Desglose Productores',
    ],
    ...rows.map((r) => [
      r.productName,
      r.captureMode === 'direct_total' ? 0 : r.producedLar,
      r.captureMode === 'direct_total' ? 0 : r.producedMed,
      r.captureMode === 'direct_total' ? 0 : r.producedChi,
      r.producedTotal,
      r.captureMode === 'direct_total' ? 0 : r.dispatchedLar,
      r.captureMode === 'direct_total' ? 0 : r.dispatchedMed,
      r.captureMode === 'direct_total' ? 0 : r.dispatchedChi,
      r.dispatchedTotal,
      r.captureMode === 'direct_total' ? 0 : r.availableLar,
      r.captureMode === 'direct_total' ? 0 : r.availableMed,
      r.captureMode === 'direct_total' ? 0 : r.availableChi,
      r.availableTotal,
      Object.entries(r.byProducer)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | '),
    ]),
    [
      'TOTALES',
      rows.reduce((a, r) => a + r.producedLar, 0),
      rows.reduce((a, r) => a + r.producedMed, 0),
      rows.reduce((a, r) => a + r.producedChi, 0),
      rows.reduce((a, r) => a + r.producedTotal, 0),
      rows.reduce((a, r) => a + r.dispatchedLar, 0),
      rows.reduce((a, r) => a + r.dispatchedMed, 0),
      rows.reduce((a, r) => a + r.dispatchedChi, 0),
      rows.reduce((a, r) => a + r.dispatchedTotal, 0),
      rows.reduce((a, r) => a + r.availableLar, 0),
      rows.reduce((a, r) => a + r.availableMed, 0),
      rows.reduce((a, r) => a + r.availableChi, 0),
      rows.reduce((a, r) => a + r.availableTotal, 0),
      '',
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  setColumnWidths(ws, sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario General');
  XLSX.writeFile(wb, `AromaFlower_Inventario_General_${todayIso()}.xlsx`);
}

export function exportGeneralInventoryPdf(rows: GeneralInventoryRow[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totProd = rows.reduce((a, r) => a + r.producedTotal, 0);
  const totDisp = rows.reduce((a, r) => a + r.dispatchedTotal, 0);
  const totAvail = rows.reduce((a, r) => a + r.availableTotal, 0);
  addPdfHeader(
    doc,
    'Inventario General Único de Flores y Paquetes',
    `Producido: ${totProd.toLocaleString()} • Despachado/Vendido: ${totDisp.toLocaleString()} • Stock Disponible: ${totAvail.toLocaleString()}`
  );
  autoTable(doc, {
    startY: 32,
    head: [['Variedad', 'Prod. Total', 'Despachado', 'Disp. LAR', 'Disp. MED', 'Disp. CHI', 'STOCK DISP.', 'Productores']],
    body: rows.map((r) => [
      r.productName,
      r.producedTotal,
      r.dispatchedTotal,
      r.captureMode === 'direct_total' ? '—' : r.availableLar,
      r.captureMode === 'direct_total' ? '—' : r.availableMed,
      r.captureMode === 'direct_total' ? '—' : r.availableChi,
      r.availableTotal,
      Object.entries(r.byProducer)
        .map(([k, v]) => `${k}(${v})`)
        .join(', ') || '—',
    ]),
    foot: [
      [
        'TOTALES',
        totProd,
        totDisp,
        rows.reduce((a, r) => a + r.availableLar, 0),
        rows.reduce((a, r) => a + r.availableMed, 0),
        rows.reduce((a, r) => a + r.availableChi, 0),
        totAvail,
        '',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });
  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Inventario_General_${todayIso()}.pdf`);
}

// ==================== 9. REPORTE DE CARGA DE CAMIONETA (CHOFER) ====================

export function exportTruckLoadReportPdf(load: TruckLoad) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(
    doc,
    `Reporte de Carga de Camioneta — ${load.folio}`,
    `Fecha: ${load.loadDate} • Destino: ${load.salesPointName} • Chofer/Vendedor: ${load.driverName}`
  );

  let y = 34;
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(`Vehículo: ${load.vehicleLabel || 'No especificado'}   |   Total Paquetes: ${load.totalPackages}   |   Estatus: ${load.status.toUpperCase()}`, 14, y);
  y += 5;

  const activeRows = load.rows.filter((r) => Number(r.total || 0) > 0);
  autoTable(doc, {
    startY: y,
    head: [['Variedad', 'LAR', 'MED', 'CHI', 'TOTAL PAQUETES']],
    body: activeRows.length
      ? activeRows.map((r) => [
          r.productName,
          r.captureMode === 'direct_total' ? '(Directo)' : r.lar,
          r.captureMode === 'direct_total' ? '—' : r.med,
          r.captureMode === 'direct_total' ? '—' : r.chi,
          r.total,
        ])
      : [['Sin paquetes cargados', 0, 0, 0, 0]],
    foot: [['TOTAL CARGA', load.totalLar, load.totalMed, load.totalChi, load.totalPackages]],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8.5 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8.5 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 8;

  // Expenses & Prorating
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BURGUNDY);
  doc.text('Gastos de Viaje y Prorrateo por Dueño de Mercancía', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Casetas', 'Gasolina', 'Pago de Piso', 'Comida', 'Extra', 'TOTAL GASTOS', 'Costo / Paquete']],
    body: [
      [
        fmtMoney(load.expenses?.casetas || 0),
        fmtMoney(load.expenses?.gasolina || 0),
        fmtMoney(load.expenses?.pagoPiso || 0),
        fmtMoney(load.expenses?.comida || 0),
        fmtMoney(load.expenses?.extra || 0),
        fmtMoney(load.totalExpenses || 0),
        fmtMoney(load.costPerPackage || 0),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2, halign: 'right' },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 6;
  if (load.ownerShares && load.ownerShares.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Dueño de Mercancía', 'Paquetes', '% Participación', 'Gasto Prorrateado', 'Venta Bruta', 'Pago Neto']],
      body: load.ownerShares.map((o) => {
        const pct = load.totalPackages > 0 ? ((o.packages / load.totalPackages) * 100).toFixed(1) : '0.0';
        return [
          o.ownerName,
          o.packages,
          `${pct}%`,
          fmtMoney(o.expenseShare),
          fmtMoney(o.grossSales),
          fmtMoney(o.netPayout),
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });
  }

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Carga_${load.folio}_${load.loadDate}.pdf`);
}

// ==================== 10. NOTA DE REMISIÓN (TICKET / WHATSAPP) ====================

export function exportRemissionNotePdf(note: RemissionNote) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(
    doc,
    `NOTA DE REMISIÓN — ${note.folio}`,
    `Fecha: ${note.noteDate} • Punto de Venta: ${note.salesPointName} • Vendedor: ${note.sellerName}`
  );

  let y = 35;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text(`Cliente: ${note.clientName}`, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Tel / WhatsApp: ${note.clientPhone || '—'}   |   Forma de Pago: ${note.paymentMethod.toUpperCase()}   |   Estatus: ${note.paymentStatus.toUpperCase()}`, 14, y + 6);
  if (note.loadFolio) {
    doc.text(`Carga de Camioneta: ${note.loadFolio}`, 14, y + 11);
    y += 16;
  } else {
    y += 12;
  }

  autoTable(doc, {
    startY: y,
    head: [['Variedad', 'Color / Nota', 'LAR', 'MED', 'CHI', 'Paq.', 'Precio Unit.', 'Subtotal']],
    body: note.rows.map((r) => [
      r.productName,
      r.colorNote || '—',
      r.lar,
      r.med,
      r.chi,
      r.totalPackages,
      fmtMoney(r.unitPrice),
      fmtMoney(r.subtotal),
    ]),
    foot: [
      [
        'TOTAL NOTA',
        '',
        note.rows.reduce((a, r) => a + Number(r.lar || 0), 0),
        note.rows.reduce((a, r) => a + Number(r.med || 0), 0),
        note.rows.reduce((a, r) => a + Number(r.chi || 0), 0),
        note.totalPackages,
        '',
        fmtMoney(note.totalAmount),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8.5 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8.5 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Total Nota', 'Monto Pagado / Abonado', 'Saldo Pendiente']],
    body: [[fmtMoney(note.totalAmount), fmtMoney(note.paidAmount), fmtMoney(note.balanceDue)]],
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 9 },
    styles: { fontSize: 10, fontStyle: 'bold', halign: 'center', cellPadding: 3 },
  });

  if (note.notes) {
    const ny = ((doc as any).lastAutoTable?.finalY || y) + 8;
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text(`Observaciones: ${note.notes}`, 14, ny);
  }

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Remision_${note.folio}_${note.clientName.replace(/\s+/g, '_')}.pdf`);
}

// ==================== 11. LIQUIDACIÓN DE VENTA POR CHOFER / VENDEDOR ====================

export interface DriverLiquidationSummary {
  driverName: string;
  dateLabel: string;
  totalPackagesSold: number;
  totalSales: number;
  cashSales: number;
  depositSales: number;
  creditSales: number;
  creditCollectedAtDelivery: number;
  tripExpenses: number;
  netCashToDeliver: number;
  notes: RemissionNote[];
  loads: TruckLoad[];
}

export function exportDriverLiquidationExcel(summary: DriverLiquidationSummary) {
  const wb = XLSX.utils.book_new();
  const resumen: any[][] = [
    ['REPORTE DE LIQUIDACIÓN DE VENTA — AROMA FLOWER'],
    ['Chofer / Vendedor', summary.driverName, 'Periodo', summary.dateLabel],
    [],
    ['Concepto', 'Monto ($ MXN)'],
    ['Total Vendido (Bruto)', summary.totalSales],
    ['Ventas de Contado (Efectivo)', summary.cashSales],
    ['Cobros Parciales en Entrega (Crédito)', summary.creditCollectedAtDelivery],
    ['Ventas por Depósito / Transferencia', summary.depositSales],
    ['Saldo Quedado a Crédito', summary.creditSales],
    ['(-) Gastos de Viaje Comprobados', summary.tripExpenses],
    ['EFECTIVO NETO A ENTREGAR', summary.netCashToDeliver],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumen);
  setColumnWidths(ws1, resumen);
  XLSX.utils.book_append_sheet(wb, ws1, 'Liquidación');

  const detalle: any[][] = [
    ['Folio', 'Fecha', 'Punto de Venta', 'Cliente', 'Paquetes', 'Método', 'Total', 'Cobrado', 'Saldo Crédito'],
    ...summary.notes.map((n) => [
      n.folio,
      n.noteDate,
      n.salesPointName,
      n.clientName,
      n.totalPackages,
      n.paymentMethod.toUpperCase(),
      n.totalAmount,
      n.paidAmount,
      n.balanceDue,
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(detalle);
  setColumnWidths(ws2, detalle);
  XLSX.utils.book_append_sheet(wb, ws2, 'Notas de Remisión');

  XLSX.writeFile(wb, `AromaFlower_Liquidacion_${summary.driverName.replace(/\s+/g, '_')}_${todayIso()}.xlsx`);
}

export function exportDriverLiquidationPdf(summary: DriverLiquidationSummary) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(
    doc,
    `Liquidación de Venta — ${summary.driverName}`,
    `Periodo: ${summary.dateLabel} • ${summary.notes.length} notas • ${summary.totalPackagesSold} paquetes vendidos`
  );

  autoTable(doc, {
    startY: 34,
    head: [['Concepto de Liquidación', 'Importe ($ MXN)']],
    body: [
      ['Total Vendido (Contado + Depósito + Crédito)', fmtMoney(summary.totalSales)],
      ['Ventas de Contado (Efectivo Recibido)', fmtMoney(summary.cashSales)],
      ['Abonos en Efectivo Recibidos en Entrega', fmtMoney(summary.creditCollectedAtDelivery)],
      ['Ventas por Depósito Bancario (No efectivo en mano)', fmtMoney(summary.depositSales)],
      ['Saldo Pendiente a Crédito (Cuentas por Cobrar)', fmtMoney(summary.creditSales)],
      ['(-) Gastos de Viaje (Casetas, Gasolina, Piso, Comida, Extra)', `- ${fmtMoney(summary.tripExpenses)}`],
    ],
    foot: [['EFECTIVO NETO A ENTREGAR POR EL CHOFER', fmtMoney(summary.netCashToDeliver)]],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 9 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 10 },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  const y = ((doc as any).lastAutoTable?.finalY || 90) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Folio', 'Fecha', 'Cliente', 'Punto', 'Paq.', 'Método', 'Total', 'Cobrado', 'Pendiente']],
    body: summary.notes.map((n) => [
      n.folio,
      n.noteDate,
      n.clientName,
      n.salesPointName,
      n.totalPackages,
      n.paymentMethod.toUpperCase(),
      fmtMoney(n.totalAmount),
      fmtMoney(n.paidAmount),
      fmtMoney(n.balanceDue),
    ]),
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 7.5 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.2, cellPadding: 1.6 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Liquidacion_${summary.driverName.replace(/\s+/g, '_')}_${todayIso()}.pdf`);
}

// ==================== 12. ESTADO DE CUENTA POR CLIENTE (CUENTAS POR COBRAR) ====================

export function exportClientStatementExcel(
  client: SalesClient,
  notes: RemissionNote[],
  payments: ClientPayment[]
) {
  const wb = XLSX.utils.book_new();
  const notasSheet: any[][] = [
    ['ESTADO DE CUENTA CLIENTE — AROMA FLOWER'],
    ['Cliente', client.name, 'Teléfono', client.phone || '', 'Saldo Pendiente Actual', client.balance],
    [],
    ['Folio', 'Fecha', 'Punto de Venta', 'Paquetes', 'Método', 'Total Nota', 'Pagado', 'Saldo Pendiente', 'Estatus'],
    ...notes.map((n) => [
      n.folio,
      n.noteDate,
      n.salesPointName,
      n.totalPackages,
      n.paymentMethod.toUpperCase(),
      n.totalAmount,
      n.paidAmount,
      n.balanceDue,
      n.paymentStatus.toUpperCase(),
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(notasSheet);
  setColumnWidths(ws1, notasSheet);
  XLSX.utils.book_append_sheet(wb, ws1, 'Notas y Créditos');

  const pagosSheet: any[][] = [
    ['Fecha', 'Tipo', 'Método', 'Nota Aplicada', 'Referencia', 'Monto Pagado', 'Notas'],
    ...payments.map((p) => [
      p.paymentDate,
      p.paymentType === 'pago_total' ? 'PAGO TOTAL' : 'ABONO',
      p.paymentMethod.toUpperCase(),
      p.remissionFolio || 'Saldo general',
      p.reference || '',
      p.amount,
      p.notes || '',
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(pagosSheet);
  setColumnWidths(ws2, pagosSheet);
  XLSX.utils.book_append_sheet(wb, ws2, 'Abonos y Pagos');

  XLSX.writeFile(wb, `AromaFlower_EstadoCuenta_${client.name.replace(/\s+/g, '_')}_${todayIso()}.xlsx`);
}

export function exportClientStatementPdf(
  client: SalesClient,
  notes: RemissionNote[],
  payments: ClientPayment[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totBilled = notes.reduce((a, n) => a + Number(n.totalAmount || 0), 0);
  const totPaid = notes.reduce((a, n) => a + Number(n.paidAmount || 0), 0);

  addPdfHeader(
    doc,
    `Estado de Cuenta — ${client.name}`,
    `Tel: ${client.phone || '—'} • Punto habitual: ${client.defaultSalesPointName || '—'} • Saldo Pendiente: ${fmtMoney(client.balance)}`
  );

  autoTable(doc, {
    startY: 34,
    head: [['Folio', 'Fecha', 'Punto de Venta', 'Paq.', 'Total', 'Pagado', 'Pendiente', 'Estatus']],
    body: notes.length
      ? notes.map((n) => [
          n.folio,
          n.noteDate,
          n.salesPointName,
          n.totalPackages,
          fmtMoney(n.totalAmount),
          fmtMoney(n.paidAmount),
          fmtMoney(n.balanceDue),
          n.paymentStatus.toUpperCase(),
        ])
      : [['—', 'Sin notas registradas', '—', 0, '$0.00', '$0.00', '$0.00', '—']],
    foot: [['TOTALES', `${notes.length} notas`, '', notes.reduce((a, n) => a + n.totalPackages, 0), fmtMoney(totBilled), fmtMoney(totPaid), fmtMoney(client.balance), '']],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  const y = ((doc as any).lastAutoTable?.finalY || 60) + 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...OLIVE);
  doc.text('Historial de Abonos y Pagos a Cuenta', 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [['Fecha', 'Tipo', 'Método', 'Nota', 'Referencia', 'Monto', 'Notas']],
    body: payments.length
      ? payments.map((p) => [
          p.paymentDate,
          p.paymentType === 'pago_total' ? 'PAGO TOTAL' : 'ABONO',
          p.paymentMethod.toUpperCase(),
          p.remissionFolio || 'General',
          p.reference || '—',
          fmtMoney(p.amount),
          p.notes || '—',
        ])
      : [['—', 'Sin abonos registrados', '—', '—', '—', '$0.00', '—']],
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_EstadoCuenta_${client.name.replace(/\s+/g, '_')}_${todayIso()}.pdf`);
}

// ==================== 13. HISTORIAL ANUAL DE NÓMINA ====================

export interface AnnualPayrollSummaryRow {
  employeeName: string;
  teamGroup: string;
  weeksCount: number;
  totalDaysWorked: number;
  totalBasePay: number;
  totalBonusesAndExtras: number;
  totalFumigadasCount: number;
  totalExtraHours: number;
  totalDeductionsAndLoans: number;
  totalNetPaid: number;
}

export function exportAnnualPayrollHistoryExcel(year: string, rows: AnnualPayrollSummaryRow[]) {
  const wb = XLSX.utils.book_new();
  const data: any[][] = [
    [`HISTORIAL ANUAL DE NÓMINA Y DÍAS TRABAJADOS — AÑO ${year}`],
    [],
    ['Trabajador', 'Equipo', 'Semanas', 'Días Trabajados', 'Sueldo Base', 'Fumigadas (200L)', 'Horas Extra', 'Bonos y Extras', 'Descuentos/Préstamos', 'Total Pagado Año'],
    ...rows.map((r) => [
      r.employeeName,
      r.teamGroup,
      r.weeksCount,
      r.totalDaysWorked,
      r.totalBasePay,
      r.totalFumigadasCount,
      r.totalExtraHours,
      r.totalBonusesAndExtras,
      r.totalDeductionsAndLoans,
      r.totalNetPaid,
    ]),
    [
      'TOTAL ANUAL',
      '',
      '',
      rows.reduce((a, r) => a + r.totalDaysWorked, 0),
      rows.reduce((a, r) => a + r.totalBasePay, 0),
      rows.reduce((a, r) => a + r.totalFumigadasCount, 0),
      rows.reduce((a, r) => a + r.totalExtraHours, 0),
      rows.reduce((a, r) => a + r.totalBonusesAndExtras, 0),
      rows.reduce((a, r) => a + r.totalDeductionsAndLoans, 0),
      rows.reduce((a, r) => a + r.totalNetPaid, 0),
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, data);
  XLSX.utils.book_append_sheet(wb, ws, `Historial ${year}`);
  XLSX.writeFile(wb, `AromaFlower_Historial_Nomina_${year}.xlsx`);
}

export function exportAnnualPayrollHistoryPdf(year: string, rows: AnnualPayrollSummaryRow[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const grandTotal = rows.reduce((a, r) => a + r.totalNetPaid, 0);
  const grandDays = rows.reduce((a, r) => a + r.totalDaysWorked, 0);
  addPdfHeader(
    doc,
    `Historial Anual de Nómina y Días Trabajados — Año ${year}`,
    `${rows.length} trabajadores • Total Días Trabajados: ${grandDays} • Total Pagado en el Año: ${fmtMoney(grandTotal)}`
  );
  autoTable(doc, {
    startY: 32,
    head: [['Trabajador', 'Equipo', 'Sem.', 'Días Trab.', 'Sueldo Base', 'Tambos 200L', 'Hrs Extra', 'Bonos/Extras', 'Desc./Prést.', 'TOTAL PAGADO']],
    body: rows.map((r) => [
      r.employeeName,
      r.teamGroup,
      r.weeksCount,
      r.totalDaysWorked,
      fmtMoney(r.totalBasePay),
      r.totalFumigadasCount,
      r.totalExtraHours,
      fmtMoney(r.totalBonusesAndExtras),
      fmtMoney(r.totalDeductionsAndLoans),
      fmtMoney(r.totalNetPaid),
    ]),
    foot: [
      [
        'TOTAL ANUAL',
        '',
        '',
        grandDays,
        fmtMoney(rows.reduce((a, r) => a + r.totalBasePay, 0)),
        rows.reduce((a, r) => a + r.totalFumigadasCount, 0),
        rows.reduce((a, r) => a + r.totalExtraHours, 0),
        fmtMoney(rows.reduce((a, r) => a + r.totalBonusesAndExtras, 0)),
        fmtMoney(rows.reduce((a, r) => a + r.totalDeductionsAndLoans, 0)),
        fmtMoney(grandTotal),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });
  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Historial_Nomina_${year}.pdf`);
}

// ==================== 14. INSUMOS, COMPRAS Y APLICACIONES ====================

export function exportSuppliesAndAppsExcel(
  items: SupplyItem[],
  purchases: SupplyPurchase[],
  apps: GreenhouseApplication[]
) {
  const wb = XLSX.utils.book_new();
  const s1: any[][] = [
    ['Nombre', 'Área', 'Categoría', '¿Para qué sirve?', 'Dosis Recomendada', 'Stock', 'Stock Mín.', 'Unidad', 'Costo Unit.', 'Proveedor'],
    ...items.map((i) => [
      i.name,
      i.area.toUpperCase(),
      i.category,
      i.purpose,
      i.recommendedDose || '',
      i.stock,
      i.minStock,
      i.unit,
      i.unitCost,
      i.supplier || '',
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(s1);
  setColumnWidths(ws1, s1);
  XLSX.utils.book_append_sheet(wb, ws1, 'Inventario Insumos');

  const s2: any[][] = [
    ['Fecha', 'Insumo', 'Área', 'Proveedor', 'Cantidad', 'Unidad', 'Costo Unit.', 'Total', 'Factura/Ref.', 'Notas'],
    ...purchases.map((p) => [
      p.purchaseDate,
      p.supplyName,
      p.area.toUpperCase(),
      p.supplierName,
      p.quantity,
      p.unit,
      p.unitCost,
      p.totalCost,
      p.invoiceRef || '',
      p.notes || '',
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(s2);
  setColumnWidths(ws2, s2);
  XLSX.utils.book_append_sheet(wb, ws2, 'Compras');

  const appRows: any[][] = [
    [
      'Folio',
      'Fecha',
      'Unidad',
      'Módulo',
      'Tipo',
      'No.',
      'Producto',
      'Dosis',
      'Objetivo',
      'Costo Línea',
      'Costo Total Hoja',
      'Tambos 200L',
      'Aplicador',
      'Observaciones',
    ],
  ];
  apps.forEach((a) => {
    const lineItems =
      a.items && a.items.length > 0
        ? a.items
        : [
            {
              lineNo: 1,
              productName: a.supplyName,
              dose: a.doseUsed || `${a.quantityUsed} ${a.unit}`,
              objective: a.supplyPurpose,
              cost: a.totalCost,
            },
          ];
    lineItems.forEach((it, idx) => {
      appRows.push([
        a.folio || a.id,
        a.applicationDate,
        a.unitName || a.greenhouseName,
        a.moduleName || 'General',
        a.applicationType === 'fertilizacion' ? 'NUTRICIÓN' : a.applicationType.toUpperCase(),
        it.lineNo || idx + 1,
        it.productName,
        it.dose,
        it.objective,
        Number(it.cost || 0),
        idx === 0 ? Number(a.totalCost || 0) : '',
        idx === 0 ? Number(a.drums200L || 0) : '',
        idx === 0 ? a.applicatorName : '',
        idx === 0 ? a.notes || '' : '',
      ]);
    });
  });

  const ws3 = XLSX.utils.aoa_to_sheet(appRows);
  setColumnWidths(ws3, appRows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Foliares y Nutricion');

  XLSX.writeFile(wb, `AromaFlower_Insumos_y_Aplicaciones_${todayIso()}.xlsx`);
}

export function exportSuppliesAndAppsPdf(
  items: SupplyItem[],
  purchases: SupplyPurchase[],
  apps: GreenhouseApplication[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totPurchases = purchases.reduce((a, p) => a + Number(p.totalCost || 0), 0);
  const totApps = apps.reduce((a, ap) => a + Number(ap.totalCost || 0), 0);
  addPdfHeader(
    doc,
    'Reporte de Insumos por Área, Compras y Aplicaciones Foliares / Nutrición',
    `${items.length} insumos • ${purchases.length} compras (${fmtMoney(totPurchases)}) • ${apps.length} hojas de aplicación (${fmtMoney(totApps)})`
  );

  autoTable(doc, {
    startY: 32,
    head: [['Insumo', 'Área', 'Categoría', '¿Para qué sirve?', 'Stock', 'Costo Unit.']],
    body: items.map((i) => [
      i.name,
      i.area.toUpperCase(),
      i.category,
      i.purpose,
      `${i.stock} ${i.unit}`,
      fmtMoney(i.unitCost),
    ]),
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.3, cellPadding: 1.8 },
    columnStyles: { 3: { cellWidth: 105 } },
  });

  doc.addPage();
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...OLIVE);
  doc.text('Bitácora de Hojas de Aplicación Foliar y Nutrición por Unidad y Módulo', 14, 18);

  const flatRows: any[][] = [];
  apps.forEach((a) => {
    const lineItems =
      a.items && a.items.length > 0
        ? a.items
        : [
            {
              lineNo: 1,
              productName: a.supplyName,
              dose: a.doseUsed || `${a.quantityUsed} ${a.unit}`,
              objective: a.supplyPurpose,
              cost: a.totalCost,
            },
          ];
    lineItems.forEach((it, idx) => {
      flatRows.push([
        idx === 0 ? a.applicationDate : '',
        idx === 0 ? a.unitName || a.greenhouseName : '',
        idx === 0 ? a.moduleName || '—' : '',
        idx === 0 ? (a.applicationType === 'fertilizacion' ? 'NUTRICIÓN' : a.applicationType.toUpperCase()) : '',
        it.lineNo || idx + 1,
        it.productName,
        it.dose,
        it.objective,
        fmtMoney(it.cost),
      ]);
    });
  });

  autoTable(doc, {
    startY: 22,
    head: [['Fecha', 'Unidad', 'Módulo', 'Tipo', 'No.', 'Producto', 'Dosis', 'Objetivo', 'Costo']],
    body: flatRows.length > 0 ? flatRows : [['—', 'Sin aplicaciones registradas', '—', '—', '—', '—', '—', '—', '$0.00']],
    foot: [['', '', '', '', '', '', '', 'COSTO TOTAL BITÁCORA', fmtMoney(totApps)]],
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 7.5 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7.2, cellPadding: 1.6 },
    columnStyles: { 4: { halign: 'center', cellWidth: 10 }, 7: { cellWidth: 78 }, 8: { halign: 'right' } },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Insumos_y_Aplicaciones_${todayIso()}.pdf`);
}

export function exportSingleApplicationSheetPdf(app: GreenhouseApplication) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const typeLabel =
    app.applicationType === 'fertilizacion'
      ? 'NUTRICIÓN / FERTIRRIEGO'
      : app.applicationType === 'foliar'
      ? 'APLICACIÓN FOLIAR'
      : app.applicationType === 'drench'
      ? 'APLICACIÓN DRENCH'
      : 'APLICACIÓN EN INVERNADERO';

  addPdfHeader(
    doc,
    `Hoja de Control — ${typeLabel}`,
    `Folio: ${app.folio || app.id} • Aplicador: ${app.applicatorName || 'Operador'}${app.drums200L ? ` • Tambos 200L: ${app.drums200L}` : ''}`
  );

  // Encabezado exacto del formato del cliente: UNIDAD | MODULO | FECHA
  autoTable(doc, {
    startY: 33,
    head: [['UNIDAD', 'MÓDULO', 'FECHA']],
    body: [[app.unitName || app.greenhouseName, app.moduleName || 'General', app.applicationDate]],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10, fontStyle: 'bold', textColor: [20, 20, 20], cellPadding: 3 },
  });

  const lineItems =
    app.items && app.items.length > 0
      ? app.items
      : [
          {
            lineNo: 1,
            productName: app.supplyName,
            dose: app.doseUsed || `${app.quantityUsed} ${app.unit}`,
            objective: app.supplyPurpose,
            cost: app.totalCost,
          },
        ];

  // Mostrar mínimo 8 filas numeradas como el formato físico del cliente
  const minRows = Math.max(8, lineItems.length);
  const tableBody: any[][] = [];
  for (let i = 0; i < minRows; i++) {
    const it = lineItems[i];
    if (it) {
      tableBody.push([
        i + 1,
        it.productName,
        it.dose,
        it.objective,
        fmtMoney(it.cost),
      ]);
    } else {
      tableBody.push([i + 1, '', '', '', '']);
    }
  }

  const startTableY = ((doc as any).lastAutoTable?.finalY || 50) + 6;
  autoTable(doc, {
    startY: startTableY,
    head: [['No.', 'PRODUCTO', 'DOSIS', 'OBJETIVO', 'COSTO']],
    body: tableBody,
    foot: [['', '', '', 'Costo total:', fmtMoney(app.totalCost)]],
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 10, fontStyle: 'bold', halign: 'right' },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 8.5, cellPadding: 2.6, minCellHeight: 8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      1: { cellWidth: 44, fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 70 },
      4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
  });

  // Cuadro de Observaciones igual al formato
  const obsY = ((doc as any).lastAutoTable?.finalY || 140) + 7;
  autoTable(doc, {
    startY: obsY,
    head: [['OBSERVACIONES']],
    body: [[app.notes?.trim() || 'Sin observaciones adicionales registradas.']],
    theme: 'grid',
    headStyles: { fillColor: [245, 243, 238], textColor: [40, 40, 40], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.8, cellPadding: 3.5, minCellHeight: 16 },
  });

  // Firmas de campo
  const sigY = Math.min(265, ((doc as any).lastAutoTable?.finalY || 180) + 22);
  doc.setDrawColor(140, 140, 140);
  doc.line(22, sigY, 88, sigY);
  doc.line(122, sigY, 188, sigY);
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`Aplicador: ${app.applicatorName || '____________________'}`, 55, sigY + 5, { align: 'center' });
  doc.text('Vo. Bo. Supervisión / Administración', 155, sigY + 5, { align: 'center' });

  addPdfPageFooters(doc);
  const safeUnit = (app.unitName || 'Unidad').replace(/\s+/g, '_');
  const safeMod = (app.moduleName || 'Modulo').replace(/\s+/g, '_');
  doc.save(`Hoja_Aplicacion_${safeUnit}_${safeMod}_${app.applicationDate}.pdf`);
}

// ==================== 15. CONTROL DE COSTOS DE PRODUCCIÓN Y UTILIDAD REAL ====================

export interface CostAnalysisExportData {
  periodLabel: string;
  stemsPerPackage: number;
  totalPackagesProduced: number;
  totalStemsProduced: number;
  totalPackagesSold: number;
  payrollCost: number;
  suppliesAndAppsCost: number;
  supplierOpsCost: number;
  productionTotalCost: number;
  logisticsTripCost: number;
  totalCombinedCost: number;
  totalRevenue: number;
  costPerStem: number;
  costPerPackageGreenhouse: number;
  deliveryCostPerPackage: number;
  totalCostPerPackageDelivered: number;
  avgSalePricePerPackage: number;
  netProfit: number;
  profitMarginPct: number;
}

export function exportCostAnalysisExcel(data: CostAnalysisExportData) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [
    ['CONTROL DE COSTOS DE PRODUCCIÓN Y UTILIDAD REAL — AROMA FLOWER'],
    ['Periodo Analizado', data.periodLabel, 'Tallos por Paquete', data.stemsPerPackage],
    [],
    ['INDICADOR FINANCIERO / OPERATIVO', 'VALOR'],
    ['Total Paquetes Producidos', data.totalPackagesProduced],
    ['Total Tallos Producidos', data.totalStemsProduced],
    ['Total Paquetes Vendidos / Despachados', data.totalPackagesSold],
    [],
    ['DESGLOSE DE COSTOS', 'MONTO ($ MXN)'],
    ['Nómina y Mano de Obra', data.payrollCost],
    ['Compras de Insumos / Aplicaciones Invernadero', data.suppliesAndAppsCost],
    ['Pagos a Proveedores y Gastos Operativos', data.supplierOpsCost],
    ['TOTAL COSTO DE PRODUCCIÓN (EN INVERNADERO)', data.productionTotalCost],
    ['Gastos de Viaje y Traslado a Puntos de Venta', data.logisticsTripCost],
    ['COSTO TOTAL INTEGRADO (PRODUCCIÓN + ENTREGA)', data.totalCombinedCost],
    [],
    ['COSTOS UNITARIOS Y UTILIDAD REAL', 'RESULTADO'],
    ['Costo Real por Tallo Producido ($)', Number(data.costPerStem.toFixed(4))],
    ['Costo Real por Paquete en Invernadero ($)', Number(data.costPerPackageGreenhouse.toFixed(2))],
    ['Costo de Llevar 1 Paquete al Punto de Venta ($)', Number(data.deliveryCostPerPackage.toFixed(2))],
    ['Costo Total Puesto en Punto de Venta ($/paq.)', Number(data.totalCostPerPackageDelivered.toFixed(2))],
    ['Precio Promedio de Venta por Paquete ($)', Number(data.avgSalePricePerPackage.toFixed(2))],
    ['Ingresos Totales por Ventas ($)', data.totalRevenue],
    ['UTILIDAD NETA REAL ($ MXN)', data.netProfit],
    ['MARGEN DE UTILIDAD REAL (%)', `${data.profitMarginPct.toFixed(2)}%`],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Costos y Utilidad');
  XLSX.writeFile(wb, `AromaFlower_Control_Costos_${todayIso()}.xlsx`);
}

export function exportCostAnalysisPdf(data: CostAnalysisExportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(
    doc,
    'Análisis de Costos de Producción y Utilidad Real',
    `Periodo: ${data.periodLabel} • ${data.totalPackagesProduced.toLocaleString()} paquetes (${data.totalStemsProduced.toLocaleString()} tallos)`
  );

  autoTable(doc, {
    startY: 34,
    head: [['Indicador Unitario Clave', 'Valor Real']],
    body: [
      ['Costo Real por 1 Tallo Producido', `$${data.costPerStem.toFixed(2)} MXN`],
      [`Costo Real por 1 Paquete (${data.stemsPerPackage} tallos) en Invernadero`, fmtMoney(data.costPerPackageGreenhouse)],
      ['Costo de Traslado al Punto de Venta (por Paquete)', fmtMoney(data.deliveryCostPerPackage)],
      ['Costo Total Puesto en Punto de Venta (por Paquete)', fmtMoney(data.totalCostPerPackageDelivered)],
      ['Precio Promedio de Venta por Paquete', fmtMoney(data.avgSalePricePerPackage)],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  const y = ((doc as any).lastAutoTable?.finalY || 80) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Estado de Resultados Operativo', 'Monto ($ MXN)']],
    body: [
      ['Ingresos Totales por Ventas', fmtMoney(data.totalRevenue)],
      ['(-) Nómina de Trabajadores', `- ${fmtMoney(data.payrollCost)}`],
      ['(-) Compras de Insumos y Aplicaciones', `- ${fmtMoney(data.suppliesAndAppsCost)}`],
      ['(-) Proveedores y Gastos Operativos', `- ${fmtMoney(data.supplierOpsCost)}`],
      ['(-) Gastos de Viaje / Venta (Casetas, Gasolina, Piso)', `- ${fmtMoney(data.logisticsTripCost)}`],
    ],
    foot: [
      [
        `UTILIDAD NETA REAL (Margen: ${data.profitMarginPct.toFixed(1)}%)`,
        fmtMoney(data.netProfit),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: OLIVE, textColor: 255, fontSize: 9 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Control_Costos_${todayIso()}.pdf`);
}

// ==================== 12. PROVEEDORES (ESTADOS DE CUENTA) & INCIDENCIAS DE EMPLEADOS ====================

export function exportSuppliersSummaryExcel(
  suppliers: Supplier[],
  payments: SupplierPayment[]
) {
  const wb = XLSX.utils.book_new();
  const dirRows: any[][] = [
    [
      'Proveedor / Razón Social',
      'Categoría',
      'Contacto',
      'Teléfono',
      'RFC',
      'Banco / CLABE',
      'Días Crédito',
      'Límite Crédito',
      'Total Facturado ($)',
      'Total Pagado ($)',
      'Saldo por Pagar ($)',
      'Estatus',
    ],
    ...suppliers.map((s) => {
      const sp = payments.filter(
        (p) =>
          p.supplierId === s.id ||
          p.supplierName.trim().toLowerCase() === s.name.trim().toLowerCase()
      );
      const billed = sp.reduce((a, p) => a + Number(p.amount || 0), 0);
      const paid = sp.reduce((a, p) => a + Number(p.paidAmount || 0), 0);
      const pending = Math.max(0, billed - paid);
      return [
        s.name,
        s.category,
        s.contactName || '',
        s.phone || '',
        s.rfc || '',
        s.bankInfo || '',
        s.creditDays,
        s.creditLimit,
        billed,
        paid,
        pending,
        s.active ? 'Activo' : 'Inactivo',
      ];
    }),
  ];
  const wsDir = XLSX.utils.aoa_to_sheet(dirRows);
  setColumnWidths(wsDir, dirRows);
  XLSX.utils.book_append_sheet(wb, wsDir, 'Directorio y Deudas');

  const movRows: any[][] = [
    ['Fecha', 'Proveedor', 'Categoría', 'Concepto', 'Factura / Ref.', 'Monto ($)', 'Pagado ($)', 'Saldo Pendiente ($)', 'Método', 'Estatus'],
    ...payments.map((p) => [
      p.paymentDate,
      p.supplierName,
      p.category,
      p.concept,
      p.reference || '',
      Number(p.amount || 0),
      Number(p.paidAmount || 0),
      Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0)),
      p.paymentMethod,
      p.status.toUpperCase(),
    ]),
  ];
  const wsMov = XLSX.utils.aoa_to_sheet(movRows);
  setColumnWidths(wsMov, movRows);
  XLSX.utils.book_append_sheet(wb, wsMov, 'Facturas y Pagos');

  XLSX.writeFile(wb, `AromaFlower_Proveedores_${todayIso()}.xlsx`);
}

export function exportSupplierStatementPdf(
  supplier: Supplier,
  payments: SupplierPayment[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const billed = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const paid = payments.reduce((a, p) => a + Number(p.paidAmount || 0), 0);
  const balance = Math.max(0, billed - paid);

  addPdfHeader(
    doc,
    `Estado de Cuenta de Proveedor — ${supplier.name}`,
    `Contacto: ${supplier.contactName || '—'} • Tel: ${supplier.phone || '—'} • Saldo Pendiente: ${fmtMoney(balance)}`
  );

  autoTable(doc, {
    startY: 34,
    head: [['Fecha', 'Factura / Ref.', 'Concepto', 'Facturado', 'Pagado', 'Saldo', 'Estatus']],
    body: payments.length
      ? payments.map((p) => [
          p.paymentDate,
          p.reference || '—',
          p.concept,
          fmtMoney(p.amount),
          fmtMoney(p.paidAmount),
          fmtMoney(Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || 0))),
          p.status.toUpperCase(),
        ])
      : [['—', '—', 'Sin movimientos registrados', '$0.00', '$0.00', '$0.00', '—']],
    foot: [
      [
        'TOTALES',
        `${payments.length} mov.`,
        supplier.bankInfo ? `Cuenta: ${supplier.bankInfo}` : '',
        fmtMoney(billed),
        fmtMoney(paid),
        fmtMoney(balance),
        balance > 0 ? 'CON SALDO' : 'LIQUIDADO',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: BLACK, textColor: [195, 162, 93], fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });

  addPdfPageFooters(doc);
  doc.save(`EstadoCuenta_Proveedor_${supplier.name.replace(/\s+/g, '_')}_${todayIso()}.pdf`);
}

const ADJUSTMENT_LABELS: Record<string, string> = {
  descuento_falta: 'Descuento por Falta / Retardo',
  otro_descuento: 'Otro Descuento',
  bono_productividad: 'Bono de Productividad',
  comision: 'Comisión',
  pago_adicional: 'Pago Adicional',
};

export function exportEmployeeAdjustmentsExcel(
  adjustments: EmployeeAdjustment[],
  employees: PayrollEmployee[]
) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [
    [
      'Fecha',
      'Empleado',
      'Tipo de Movimiento',
      'Efecto en Nómina',
      'Monto ($ MXN)',
      'Concepto',
      'Estatus',
      'Semana Aplicada',
      'Notas',
    ],
    ...adjustments.map((a) => [
      a.adjustmentDate,
      a.employeeName,
      ADJUSTMENT_LABELS[a.adjustmentType] || a.adjustmentType,
      a.direction === 'suma' ? '+ SUMA' : '- RESTA',
      Number(a.amount || 0),
      a.concept,
      a.status === 'aplicado' ? 'APLICADO EN NÓMINA' : 'PENDIENTE',
      a.appliedWeekLabel || '',
      a.notes || '',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Descuentos y Comisiones');

  const empSummary: any[][] = [
    ['Empleado', 'Equipo', 'Saldo Préstamo ($)', 'Desc. Pendientes ($)', 'Bonos/Com. Pendientes ($)'],
    ...employees.map((e) => {
      const pend = adjustments.filter((a) => a.employeeId === e.id && a.status === 'pendiente');
      const desc = pend.filter((a) => a.direction === 'resta').reduce((s, a) => s + a.amount, 0);
      const bon = pend.filter((a) => a.direction === 'suma').reduce((s, a) => s + a.amount, 0);
      return [e.fullName, e.teamGroup, e.loanBalance, desc, bon];
    }),
  ];
  const wsSum = XLSX.utils.aoa_to_sheet(empSummary);
  setColumnWidths(wsSum, empSummary);
  XLSX.utils.book_append_sheet(wb, wsSum, 'Resumen por Empleado');

  XLSX.writeFile(wb, `AromaFlower_Incidencias_Empleados_${todayIso()}.xlsx`);
}

export function exportEmployeeAdjustmentsPdf(
  adjustments: EmployeeAdjustment[],
  employees: PayrollEmployee[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pendingDesc = adjustments
    .filter((a) => a.status === 'pendiente' && a.direction === 'resta')
    .reduce((s, a) => s + a.amount, 0);
  const pendingBon = adjustments
    .filter((a) => a.status === 'pendiente' && a.direction === 'suma')
    .reduce((s, a) => s + a.amount, 0);
  const totalLoans = employees.reduce((s, e) => s + Number(e.loanBalance || 0), 0);

  addPdfHeader(
    doc,
    'Reporte de Préstamos, Descuentos, Bonos y Comisiones de Empleados',
    `Préstamos por Cobrar: ${fmtMoney(totalLoans)} • Desc. Pendientes: ${fmtMoney(pendingDesc)} • Bonos/Com. Pendientes: ${fmtMoney(pendingBon)}`
  );

  autoTable(doc, {
    startY: 32,
    head: [['Fecha', 'Empleado', 'Tipo', 'Efecto', 'Monto', 'Concepto', 'Estatus', 'Nómina Aplicada']],
    body: adjustments.length
      ? adjustments.map((a) => [
          a.adjustmentDate,
          a.employeeName,
          ADJUSTMENT_LABELS[a.adjustmentType] || a.adjustmentType,
          a.direction === 'suma' ? '+ SUMA' : '- RESTA',
          `${a.direction === 'suma' ? '+' : '-'} ${fmtMoney(a.amount)}`,
          a.concept,
          a.status === 'aplicado' ? 'APLICADO' : 'PENDIENTE',
          a.appliedWeekLabel || 'Por sincronizar',
        ])
      : [['—', 'Sin movimientos registrados', '—', '—', '$0.00', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: BURGUNDY, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  addPdfPageFooters(doc);
  doc.save(`AromaFlower_Incidencias_Empleados_${todayIso()}.pdf`);
}




