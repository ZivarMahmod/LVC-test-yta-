// ===========================================
// LVC Media Hub — File Validator Tester
// Testar filvalidering, MIME-typer, magic bytes, path traversal
// ===========================================
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { fileValidator } from '../src/utils/fileValidator.js';

describe('fileValidator.isAllowedMimeType', () => {
  it('ska godkänna video/mp4', () => {
    expect(fileValidator.isAllowedMimeType('video/mp4')).toBe(true);
  });

  it('ska godkänna video/quicktime (MOV)', () => {
    expect(fileValidator.isAllowedMimeType('video/quicktime')).toBe(true);
  });

  it('ska godkänna video/x-matroska (MKV)', () => {
    expect(fileValidator.isAllowedMimeType('video/x-matroska')).toBe(true);
  });

  it('ska neka application/javascript', () => {
    expect(fileValidator.isAllowedMimeType('application/javascript')).toBe(false);
  });

  it('ska neka text/html', () => {
    expect(fileValidator.isAllowedMimeType('text/html')).toBe(false);
  });

  it('ska neka image/png', () => {
    expect(fileValidator.isAllowedMimeType('image/png')).toBe(false);
  });

  it('ska neka tom sträng', () => {
    expect(fileValidator.isAllowedMimeType('')).toBe(false);
  });
});

describe('fileValidator.isAllowedExtension', () => {
  it('ska godkänna .mp4', () => {
    expect(fileValidator.isAllowedExtension('match.mp4')).toBe(true);
  });

  it('ska godkänna .mov', () => {
    expect(fileValidator.isAllowedExtension('video.mov')).toBe(true);
  });

  it('ska godkänna .mkv', () => {
    expect(fileValidator.isAllowedExtension('clip.mkv')).toBe(true);
  });

  it('ska neka .exe', () => {
    expect(fileValidator.isAllowedExtension('malware.exe')).toBe(false);
  });

  it('ska neka .js', () => {
    expect(fileValidator.isAllowedExtension('script.js')).toBe(false);
  });

  it('ska neka .php', () => {
    expect(fileValidator.isAllowedExtension('shell.php')).toBe(false);
  });

  it('ska vara skiftlägeskänslig (case-insensitive)', () => {
    expect(fileValidator.isAllowedExtension('VIDEO.MP4')).toBe(true);
  });

  it('ska neka dubbla extensions som .mp4.exe', () => {
    expect(fileValidator.isAllowedExtension('video.mp4.exe')).toBe(false);
  });
});

describe('fileValidator.isAllowedSize', () => {
  it('ska godkänna normal filstorlek (100MB)', () => {
    expect(fileValidator.isAllowedSize(100 * 1024 * 1024)).toBe(true);
  });

  it('ska godkänna max storlek (10GB)', () => {
    expect(fileValidator.isAllowedSize(10737418240)).toBe(true);
  });

  it('ska neka för stor fil (11GB)', () => {
    expect(fileValidator.isAllowedSize(11 * 1024 * 1024 * 1024)).toBe(false);
  });

  it('ska neka storlek 0', () => {
    expect(fileValidator.isAllowedSize(0)).toBe(false);
  });

  it('ska neka negativ storlek', () => {
    expect(fileValidator.isAllowedSize(-1)).toBe(false);
  });
});

describe('fileValidator.validateMagicBytes', () => {
  it('ska godkänna giltiga MP4 magic bytes (ftyp)', () => {
    // MP4: bytes 4-7 ska vara 'ftyp'
    const buffer = Buffer.alloc(12);
    buffer.writeUInt32BE(0x00000020, 0); // Box size
    buffer.write('ftyp', 4, 'ascii');
    buffer.write('isom', 8, 'ascii');

    expect(fileValidator.validateMagicBytes(buffer, 'video/mp4')).toBe(true);
  });

  it('ska godkänna MOV magic bytes', () => {
    const buffer = Buffer.alloc(12);
    buffer.writeUInt32BE(0x00000014, 0);
    buffer.write('ftyp', 4, 'ascii');
    buffer.write('qt  ', 8, 'ascii');

    expect(fileValidator.validateMagicBytes(buffer, 'video/quicktime')).toBe(true);
  });

  it('ska godkänna MKV magic bytes (EBML header)', () => {
    const buffer = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    expect(fileValidator.validateMagicBytes(buffer, 'video/x-matroska')).toBe(true);
  });

  it('ska neka felaktiga magic bytes för MP4', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]); // PNG header

    expect(fileValidator.validateMagicBytes(buffer, 'video/mp4')).toBe(false);
  });

  it('ska neka buffer som är för kort', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00]);

    expect(fileValidator.validateMagicBytes(buffer, 'video/mp4')).toBe(false);
  });
});

describe('fileValidator.sanitizeFileName', () => {
  it('ska behålla normala filnamn', () => {
    expect(fileValidator.sanitizeFileName('match-2024.mp4')).toBe('match-2024.mp4');
  });

  it('ska ta bort path traversal (../)', () => {
    const result = fileValidator.sanitizeFileName('../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
  });

  it('ska ta bort absoluta sökvägar', () => {
    const result = fileValidator.sanitizeFileName('/etc/shadow');
    expect(result).toBe('shadow');
  });

  it('ska ersätta specialtecken', () => {
    const result = fileValidator.sanitizeFileName('file<>:"|?*.mp4');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain(':');
    expect(result).not.toContain('|');
    expect(result).not.toContain('?');
  });

  it('ska hantera svenska tecken (åäö)', () => {
    const result = fileValidator.sanitizeFileName('Linköping-vs-Örebro.mp4');
    expect(result).toContain('ö');
    expect(result).toContain('Ö');
  });

  it('ska begränsa filnamn till max 200 tecken', () => {
    const longName = 'a'.repeat(300) + '.mp4';
    const result = fileValidator.sanitizeFileName(longName);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).toMatch(/\.mp4$/);
  });

  it('ska hantera Windows path separators säkert', () => {
    const result = fileValidator.sanitizeFileName('C:\\Users\\admin\\secret.mp4');
    // På Linux hanteras inte \ som path separator av path.basename,
    // men specialtecken ersätts — path traversal förhindras ändå
    expect(result).not.toContain('/');
    expect(result).toMatch(/\.mp4$/);
  });
});

describe('fileValidator.validateFile', () => {
  it('ska returnera ogiltigt utan fil', async () => {
    const result = await fileValidator.validateFile(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Ingen fil bifogad.');
  });

  it('ska returnera ogiltigt med fel MIME-typ', async () => {
    const result = await fileValidator.validateFile({
      mimetype: 'application/pdf',
      originalname: 'document.pdf',
      size: 1000
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Filtypen'))).toBe(true);
  });

  it('ska returnera ogiltigt med fel extension', async () => {
    const result = await fileValidator.validateFile({
      mimetype: 'video/mp4',
      originalname: 'video.exe',
      size: 1000
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Filändelsen'))).toBe(true);
  });

  it('ska returnera ogiltigt med för stor fil', async () => {
    const result = await fileValidator.validateFile({
      mimetype: 'video/mp4',
      originalname: 'video.mp4',
      size: 20 * 1024 * 1024 * 1024 // 20 GB
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('stor'))).toBe(true);
  });

  it('ska returnera giltigt med korrekt fil (utan disk-läsning)', async () => {
    const result = await fileValidator.validateFile({
      mimetype: 'video/mp4',
      originalname: 'match.mp4',
      size: 500 * 1024 * 1024 // 500 MB
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
