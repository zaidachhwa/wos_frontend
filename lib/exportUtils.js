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
