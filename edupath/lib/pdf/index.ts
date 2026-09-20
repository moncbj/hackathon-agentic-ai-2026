// @ts-expect-error pdf-parse lacks export maps for internal path but lib/pdf-parse.js avoids index.js debug bug
import pdfParse from 'pdf-parse/lib/pdf-parse.js';


export interface ExtractedText {
  text: string;
  pageCount?: number;
}

export interface FileValidationError {
  code: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'PDF_TOO_MANY_PAGES' | 'EXTRACTION_FAILED';
  message: string;
}

export type ExtractionResult =
  | { ok: true; data: ExtractedText }
  | { ok: false; error: FileValidationError };

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB = 5,242,880 bytes
export const MAX_PDF_PAGES = 10;

/**
 * Deterministically normalizes extracted text to reduce noise before passing to LLM.
 * Normalizes line breaks, strips control characters, collapses excess horizontal whitespace,
 * and collapses multiple blank lines while preserving semantic structure and content.
 */
export function normalizeText(text: string): string {
  if (!text) {
    return '';
  }

  return (
    text
      // Normalize CRLF and CR to standard LF
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove non-printable control characters (preserving tab \x09 and newline \x0A)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Collapse horizontal whitespace per line and trim each line
      .split('\n')
      .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
      .join('\n')
      // Collapse 3 or more consecutive newlines into 2 (single blank line separator)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

let customPdfParser: ((buffer: Buffer) => Promise<{ numpages: number; text: string }>) | null = null;

/**
 * Sets a custom PDF parser for testing purposes (e.g. testing page limits without large mock files).
 */
export function setPdfParserForTesting(
  parser: ((buffer: Buffer) => Promise<{ numpages: number; text: string }>) | null,
): void {
  customPdfParser = parser;
}

/**
 * Internal helper to invoke pdf-parse across various module resolution environments.
 */
async function parsePdfBuffer(buffer: Buffer): Promise<{ numpages: number; text: string }> {
  if (customPdfParser) {
    return customPdfParser(buffer);
  }
  const parser = typeof pdfParse === 'function' ? pdfParse : (pdfParse as unknown as { default: typeof pdfParse }).default;
  return parser(buffer);
}


/**
 * Extracts and normalizes text from an uploaded file Buffer (PDF or TXT).
 *
 * Validation order:
 * 1. File size check (must not exceed 5MB before any parsing is attempted)
 * 2. MIME type / file extension check (text/plain or application/pdf)
 * 3. Page count check for PDFs (must not exceed 10 pages)
 * 4. Extraction & non-empty check
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  originalFilename?: string,
): Promise<ExtractionResult> {
  // 1. File size check (checked BEFORE parsing)
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File exceeds 5MB limit',
      },
    };
  }

  const normalizedMime = (mimeType || '').toLowerCase().trim();
  const lowerFilename = (originalFilename || '').toLowerCase();

  const isTxt =
    normalizedMime === 'text/plain' ||
    lowerFilename.endsWith('.txt');

  const isPdf =
    normalizedMime === 'application/pdf' ||
    lowerFilename.endsWith('.pdf');

  if (!isTxt && !isPdf) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TYPE',
        message: 'Only PDF and TXT files are allowed',
      },
    };
  }

  if (isTxt) {
    const rawText = buffer.toString('utf-8');
    const normalized = normalizeText(rawText);

    if (!normalized) {
      return {
        ok: false,
        error: {
          code: 'EXTRACTION_FAILED',
          message: 'Extracted text is empty',
        },
      };
    }

    return {
      ok: true,
      data: {
        text: normalized,
      },
    };
  }

  // PDF extraction
  try {
    const pdfData = await parsePdfBuffer(buffer);

    if (pdfData.numpages > MAX_PDF_PAGES) {
      return {
        ok: false,
        error: {
          code: 'PDF_TOO_MANY_PAGES',
          message: 'PDF must not exceed 10 pages',
        },
      };
    }

    const normalized = normalizeText(pdfData.text);

    if (!normalized) {
      return {
        ok: false,
        error: {
          code: 'EXTRACTION_FAILED',
          message: 'Extracted text is empty',
        },
      };
    }

    return {
      ok: true,
      data: {
        text: normalized,
        pageCount: pdfData.numpages,
      },
    };
  } catch {
    // Privacy: never log raw error with buffer content


    return {
      ok: false,
      error: {
        code: 'EXTRACTION_FAILED',
        message: 'Could not extract text from file',
      },
    };
  }


}

/**
 * Extracts and normalizes text from a raw pasted string.
 */
export function extractTextFromString(text: string): ExtractionResult {
  if (typeof text !== 'string') {
    return {
      ok: false,
      error: {
        code: 'EXTRACTION_FAILED',
        message: 'Invalid text input',
      },
    };
  }

  const normalized = normalizeText(text);

  if (!normalized) {
    return {
      ok: false,
      error: {
        code: 'EXTRACTION_FAILED',
        message: 'Extracted text is empty',
      },
    };
  }

  return {
    ok: true,
    data: {
      text: normalized,
    },
  };
}
