import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  extractTextFromFile,
  extractTextFromString,
  normalizeText,
  setPdfParserForTesting,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/pdf';

// Load real sample PDF from node_modules/pdf-parse/test/data/01-valid.pdf
const VALID_PDF_PATH = path.resolve(
  process.cwd(),
  'node_modules/pdf-parse/test/data/02-valid.pdf'
);
const REAL_VALID_PDF_BUFFER = fs.readFileSync(VALID_PDF_PATH);


describe('lib/pdf', () => {
  afterEach(() => {
    setPdfParserForTesting(null);
  });

  describe('extractTextFromFile with TXT', () => {
    it('extracts and normalizes text from a valid TXT buffer', async () => {
      const txtContent = '  Ana García \r\n\r\n Data Analyst with Python and SQL.   ';
      const buffer = Buffer.from(txtContent, 'utf-8');

      const result = await extractTextFromFile(buffer, 'text/plain', 'cv.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.text).toBe('Ana García\n\nData Analyst with Python and SQL.');
      }
    });

    it('rejects an empty TXT file', async () => {
      const buffer = Buffer.from('   \n\r\t  ', 'utf-8');
      const result = await extractTextFromFile(buffer, 'text/plain', 'empty.txt');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EXTRACTION_FAILED');
      }
    });
  });

  describe('extractTextFromFile with PDF', () => {
    it('extracts text from a valid PDF file under 10 pages', async () => {
      const result = await extractTextFromFile(REAL_VALID_PDF_BUFFER, 'application/pdf', 'cv.pdf');

      expect(result.ok).toBe(true);



      if (result.ok) {
        expect(result.data.text.length).toBeGreaterThan(0);
        expect(result.data.pageCount).toBeDefined();
        expect(result.data.pageCount!).toBeLessThanOrEqual(10);
      }
    });

    it('returns PDF_TOO_MANY_PAGES if PDF exceeds 10 pages', async () => {
      setPdfParserForTesting(async () => ({
        numpages: 12,
        numrender: 12,
        info: {},
        metadata: {},
        version: 'v1.10.100',
        text: 'Extracted content across 12 pages',
      }));

      const mockBuffer = Buffer.from('%PDF-1.4 mock content');
      const result = await extractTextFromFile(mockBuffer, 'application/pdf', 'large.pdf');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PDF_TOO_MANY_PAGES');
        expect(result.error.message).toContain('10 pages');
      }
    });

    it('returns EXTRACTION_FAILED if PDF parsing throws', async () => {
      const malformedBuffer = Buffer.from('not a real pdf content');
      const result = await extractTextFromFile(malformedBuffer, 'application/pdf', 'corrupt.pdf');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EXTRACTION_FAILED');
      }
    });
  });

  describe('Validation rules', () => {
    it('returns FILE_TOO_LARGE if file exceeds 5MB before parsing', async () => {
      const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1);

      const result = await extractTextFromFile(oversizedBuffer, 'application/pdf', 'huge.pdf');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FILE_TOO_LARGE');
        expect(result.error.message).toContain('5MB');
      }
    });

    it('returns INVALID_TYPE for disallowed MIME types', async () => {
      const buffer = Buffer.from('{"data": 123}');
      const result = await extractTextFromFile(buffer, 'application/json', 'data.json');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TYPE');
      }
    });
  });

  describe('extractTextFromString', () => {
    it('extracts and normalizes raw text string', () => {
      const raw = '  Experienced with SQL, Python,\r\n\r\nand Tableau.  ';
      const result = extractTextFromString(raw);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.text).toBe('Experienced with SQL, Python,\n\nand Tableau.');
      }
    });

    it('returns EXTRACTION_FAILED for empty text string', () => {
      const result = extractTextFromString('   \n  ');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EXTRACTION_FAILED');
      }
    });
  });

  describe('normalizeText', () => {
    it('normalizes CRLF, collapses excess spaces, and limits blank lines', () => {
      const input = 'Header line  with   spaces\r\n\r\n\r\n\r\nNext line.\x00\x07';
      const output = normalizeText(input);

      expect(output).toBe('Header line with spaces\n\nNext line.');
    });
  });
});
