/**
 * File upload size limits and validation constants
 * These limits help prevent DoS attacks while allowing legitimate large file imports
 */

// Maximum file size for Excel imports (50 MB)
// This is reasonable for large member/system data imports while preventing abuse
export const MAX_EXCEL_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Maximum file size for client-side processing (10 MB)
// Files larger than this should be processed server-side to avoid browser freezes
export const MAX_CLIENT_SIDE_PROCESSING_SIZE = 10 * 1024 * 1024; // 10 MB

// Maximum file size for image uploads (5 MB)
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Format bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate Excel file size
 */
export function validateExcelFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_EXCEL_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${formatFileSize(MAX_EXCEL_FILE_SIZE)}. Please split your file into smaller chunks.`
    };
  }
  return { valid: true };
}

/**
 * Check if file should be processed server-side
 */
export function shouldProcessServerSide(file: File): boolean {
  return file.size > MAX_CLIENT_SIDE_PROCESSING_SIZE;
}

