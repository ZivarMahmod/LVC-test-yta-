// ===========================================
// LVC Media Hub — Error Handler Tester
// Säkerställer att inga interna detaljer läcker
// ===========================================
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler.js';

function createMockReqRes() {
  return {
    req: { path: '/api/test', method: 'GET', ip: '127.0.0.1', user: null },
    res: {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    }
  };
}

describe('errorHandler', () => {
  it('ska ALDRIG returnera stack trace till klient', () => {
    const { req, res } = createMockReqRes();
    const error = new Error('Database connection failed');
    error.stack = 'Error: Database connection failed\n    at /app/src/secret/path.js:42';

    errorHandler(error, req, res, vi.fn());

    const response = res.json.mock.calls[0][0];
    expect(JSON.stringify(response)).not.toContain('stack');
    expect(JSON.stringify(response)).not.toContain('secret/path');
    expect(JSON.stringify(response)).not.toContain('Database connection');
  });

  it('ska returnera generiskt meddelande för 500-fel', () => {
    const { req, res } = createMockReqRes();

    errorHandler(new Error('Internal error'), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toContain('serverfel');
  });

  it('ska hantera LIMIT_FILE_SIZE (Multer)', () => {
    const { req, res } = createMockReqRes();
    const error = new Error('File too large');
    error.code = 'LIMIT_FILE_SIZE';

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(413);
  });

  it('ska hantera LIMIT_UNEXPECTED_FILE (Multer)', () => {
    const { req, res } = createMockReqRes();
    const error = new Error('Unexpected file');
    error.code = 'LIMIT_UNEXPECTED_FILE';

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('ska använda clientMessage om det finns', () => {
    const { req, res } = createMockReqRes();
    const error = new Error('Internal detail');
    error.statusCode = 422;
    error.clientMessage = 'Ogiltigt format.';

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json.mock.calls[0][0].error).toBe('Ogiltigt format.');
  });
});

describe('notFoundHandler', () => {
  it('ska returnera 404', () => {
    const { req, res } = createMockReqRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0]).toHaveProperty('error');
  });
});
