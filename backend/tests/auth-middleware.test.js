// ===========================================
// LVC Media Hub — Auth Middleware Tester
// Testar JWT-verifiering och rollkontroll
// ===========================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mocka prisma
vi.mock('../src/config/database.js', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    }
  }
}));

// Mocka logger
vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { authenticateToken, requireRole, requireAdmin, requireViewer } from '../src/middleware/auth.js';
import prisma from '../src/config/database.js';

// Hjälpfunktion: skapa mock request/response
function createMockReqRes(overrides = {}) {
  const req = {
    cookies: {},
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('test-agent'),
    ...overrides
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('authenticateToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska neka åtkomst utan access token', async () => {
    const { req, res, next } = createMockReqRes();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('ska neka åtkomst med ogiltig JWT', async () => {
    const { req, res, next } = createMockReqRes({
      cookies: { accessToken: 'invalid-token' }
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('ska neka åtkomst med utgången JWT', async () => {
    const expiredToken = jwt.sign(
      { userId: 'test-id', email: 'test@test.se', role: 'viewer' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '0s' }
    );

    const { req, res, next } = createMockReqRes({
      cookies: { accessToken: expiredToken }
    });

    // Vänta lite så token hinner gå ut
    await new Promise(resolve => setTimeout(resolve, 10));
    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('gått ut') })
    );
  });

  it('ska godkänna giltig JWT och sätta req.user', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@test.se',
      name: 'Testare',
      role: 'admin',
      isActive: true
    };

    const token = jwt.sign(
      { userId: mockUser.id, email: mockUser.email, role: mockUser.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    prisma.user.findUnique.mockResolvedValue(mockUser);

    const { req, res, next } = createMockReqRes({
      cookies: { accessToken: token }
    });

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(mockUser);
  });

  it('ska neka åtkomst för inaktiverad användare', async () => {
    const token = jwt.sign(
      { userId: 'inactive-user', email: 'inactive@test.se', role: 'viewer' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    prisma.user.findUnique.mockResolvedValue({
      id: 'inactive-user',
      email: 'inactive@test.se',
      name: 'Inaktiv',
      role: 'viewer',
      isActive: false
    });

    const { req, res, next } = createMockReqRes({
      cookies: { accessToken: token }
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('ska neka åtkomst om användare inte finns i DB', async () => {
    const token = jwt.sign(
      { userId: 'deleted-user', email: 'deleted@test.se', role: 'viewer' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    prisma.user.findUnique.mockResolvedValue(null);

    const { req, res, next } = createMockReqRes({
      cookies: { accessToken: token }
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('ska neka token signerad med fel secret', async () => {
    const token = jwt.sign(
      { userId: 'test-id', email: 'test@test.se', role: 'admin' },
      'wrong-secret-key',
      { expiresIn: '15m' }
    );

    const { req, res, next } = createMockReqRes({
      cookies: { accessToken: token }
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('ska neka om req.user saknas', () => {
    const middleware = requireRole('admin');
    const { req, res, next } = createMockReqRes();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('ska neka om användaren har fel roll', () => {
    const middleware = requireRole('admin');
    const { req, res, next } = createMockReqRes();
    req.user = { id: '1', role: 'viewer', email: 'v@test.se' };
    req.path = '/admin';
    req.method = 'GET';

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('ska godkänna om användaren har rätt roll', () => {
    const middleware = requireRole('admin', 'coach');
    const { req, res, next } = createMockReqRes();
    req.user = { id: '1', role: 'coach', email: 'c@test.se' };

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('ska godkänna admin', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { id: '1', role: 'admin', email: 'a@test.se' };

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('ska neka viewer', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { id: '1', role: 'viewer', email: 'v@test.se' };
    req.path = '/admin';
    req.method = 'GET';

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('ska neka uploader', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { id: '1', role: 'uploader', email: 'u@test.se' };
    req.path = '/admin';
    req.method = 'GET';

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requireViewer', () => {
  it('ska godkänna alla roller', () => {
    const roles = ['admin', 'uploader', 'coach', 'viewer'];

    roles.forEach(role => {
      const { req, res, next } = createMockReqRes();
      req.user = { id: '1', role, email: `${role}@test.se` };

      requireViewer(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  it('ska neka okänd roll', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { id: '1', role: 'hacker', email: 'h@test.se' };
    req.path = '/videos';
    req.method = 'GET';

    requireViewer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
