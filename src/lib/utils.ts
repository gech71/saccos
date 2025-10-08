import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  fileName: string,
  sheetName: string = 'Sheet1'
): Promise<void> {
  if (data.length === 0) {
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Add header row
  const headers = Object.keys(data[0]);
  worksheet.addRow(headers);

  // Add data rows
  data.forEach(item => {
    const row = headers.map(header => item[header]);
    worksheet.addRow(row);
  });
  
  worksheet.getRow(1).font = { bold: true };

  // Write to buffer and save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
