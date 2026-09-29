import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

export const exportToCSV = (data, filename = "export.csv") => {
  if (!data || data.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (data, filename = "export.xlsx") => {
  if (!data || data.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
};

// sheets: [{ name, rows: [{...}] }] — one workbook, one sheet per entry.
// Empty sheets are kept (with a note) so the workbook shape never changes.
export const exportWorkbook = (sheets, filename = "export.xlsx") => {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["No data"]]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
};

// sections: [{ title, headers: [], rows: [[]] }] — sequential tables in one PDF.
export const exportSectionsToPDF = (title, sections, filename = "export.pdf") => {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  let y = 22;
  for (const section of sections) {
    if (!section.rows.length) continue;
    doc.setFontSize(11);
    doc.text(section.title, 14, y);
    doc.autoTable({ startY: y + 3, head: [section.headers], body: section.rows, theme: "striped", styles: { fontSize: 8 } });
    y = doc.lastAutoTable.finalY + 12;
    if (y > 180) {
      doc.addPage();
      y = 15;
    }
  }
  doc.save(filename);
};

export const exportToPDF = (headers, dataRows, title = "Report", filename = "export.pdf") => {
  if (!dataRows || dataRows.length === 0) return;
  const doc = new jsPDF();
  doc.text(title, 14, 15);
  doc.autoTable({
    startY: 20,
    head: [headers],
    body: dataRows,
    theme: "striped",
  });
  doc.save(filename);
};
