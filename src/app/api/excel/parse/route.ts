import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import ExcelJS from 'exceljs';
import { MAX_EXCEL_FILE_SIZE } from '@/lib/file-upload-constants';

/**
 * Server-side Excel file parsing endpoint
 * This endpoint processes Excel files on the server to avoid browser memory issues
 * and enforce server-side size limits for security
 */
export async function POST(req: NextRequest) {
  try {
    // Require authenticated session
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name || '';
    const isExcelFile = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    if (!isExcelFile) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed.' }, { status: 400 });
    }

    // Enforce server-side file size limit
    if (file.size > MAX_EXCEL_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size of ${(MAX_EXCEL_FILE_SIZE / 1024 / 1024).toFixed(2)} MB. Please split your file into smaller chunks.` 
        },
        { status: 413 }
      );
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();
    
    // Parse Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      return NextResponse.json({ success: false, error: 'No worksheet found in the Excel file.' }, { status: 400 });
    }

    // Extract headers
    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values as string[];
    // Filter out undefined/null values from headers
    const cleanHeaders = headers.filter((h): h is string => typeof h === 'string' && h.trim() !== '');

    // Extract data rows
    const dataRows: Record<string, any>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const rowData: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          // Use cleanHeaders index, accounting for 1-based indexing
          const headerIndex = colNumber - 1;
          if (headerIndex < cleanHeaders.length) {
            rowData[cleanHeaders[headerIndex]] = cell.value;
          }
        });
        dataRows.push(rowData);
      }
    });

    return NextResponse.json({
      success: true,
      headers: cleanHeaders,
      data: dataRows,
      rowCount: dataRows.length
    });

  } catch (error: any) {
    console.error('Excel parsing error:', error);
    
    // Handle specific error types
    if (error.message?.includes('file size') || error.message?.includes('too large')) {
      return NextResponse.json(
        { success: false, error: 'File is too large to process. Please split it into smaller files.' },
        { status: 413 }
      );
    }

    if (error.message?.includes('worksheet') || error.message?.includes('No worksheet')) {
      return NextResponse.json(
        { success: false, error: 'Invalid Excel file format. Please ensure the file contains at least one worksheet.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to parse Excel file. Please check the file format and try again.' },
      { status: 500 }
    );
  }
}

