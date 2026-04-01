// ===========================================
// LVC Media Hub — Token Service Tester
// Testar JWT-generering, refresh rotation, cookies
// ===========================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mocka prisma
vi.mock('../src/config/database.js', () => ({
  default: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { tokenService } from '../src/services/tokenService.js';
import prisma from '../src/config/database.js';

const mockUser = {
  id: 'user-123',
  email: 'test@test.se',
  role: 'viewer',
  username: 'testare',
  name: 'Test Testsson',
  isActive: true
};

describe('tokenService.generateAccessToken', () => {
  it('ska generera en giltig JWT', () => {
    const token = tokenService.generateAccessToken(mockUser);

    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    expect(decoded.userId).toBe(mockUser.id);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.role).toBe(mockUser.role);
  });

  it('ska ha korrekt utgångstid (15m)', () => {
    const token = tokenService.generateAccessToken(mockUser);
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const expectedExpiry = Math.floor(Date.now() / 1000) + 15 * 60;
    // Tillåt 5 sekunders marginal
    expect(decoded.exp).toBeGreaterThan(expectedExpiry - 5);
    expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 5);
  });

  it('ska INTE kunna verifieras med fel secret', () => {
    const token = tokenService.generateAccessToken(mockUser);

    expect(() => {
      jwt.verify(token, 'wrong-secret');
    }).toThrow();
  });
});

describe('tokenService.generateRefreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska generera en kryptografiskt säker token', async () => {
    prisma.refreshToken.create.mockResolvedValue({});

    const token = await tokenService.generateRefreshToken(mockUser);

    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(128); // 64 bytes = 128 hex chars
  });

  it('ska spara hashad token i databasen (aldrig klartext)', async () => {
    prisma.refreshToken.create.mockResolvedValue({});

    const token = await tokenService.generateRefreshToken(mockUser);
    const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: expectedHash,
        userId: mockUser.id
      })
    });
  });

  it('ska sätta utgångsdatum 7 dagar framåt', async () => {
    prisma.refreshToken.create.mockResolvedValue({});

    await tokenService.generateRefreshToken(mockUser);

    const call = prisma.refreshToken.create.mock.calls[0][0];
    const expiresAt = new Date(call.data.expiresAt);
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 7);

    // Tillåt 10 sekunders marginal
    expect(Math.abs(expiresAt.getTime() - expectedDate.getTime())).toBeLessThan(10000);
  });
});

describe('tokenService.rotateRefreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska returnera null för okänd token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    const result = await tokenService.rotateRefreshToken('unknown-token');

    expect(result).toBeNull();
  });

  it('ska invalidera ALLA tokens vid återanvändning av revokerad token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-123',
      isRevoked: true,
      user: mockUser
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    const result = await tokenService.rotateRefreshToken('reused-token');

    expect(result).toBeNull();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-123', isRevoked: false },
      data: { isRevoked: true }
    });
  });

  it('ska returnera null för utgången token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-123',
      isRevoked: false,
      expiresAt: new Date(Date.now() - 1000), // Utgången
      user: mockUser
    });
    prisma.refreshToken.update.mockResolvedValue({});

    const result = await tokenService.rotateRefreshToken('expired-token');

    expect(result).toBeNull();
  });

  it('ska rotera giltig token och returnera ny', async () => {
    const validToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      tokenHash,
      userId: 'user-123',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      user: mockUser
    });
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await tokenService.rotateRefreshToken(validToken);

    expect(result).not.toBeNull();
    expect(result.user.id).toBe(mockUser.id);
    expect(result.newRefreshToken).toBeTruthy();
    expect(result.newRefreshToken).not.toBe(validToken); // Ny token ska vara annorlunda

    // Gamla token ska markeras som revokerad
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { isRevoked: true }
    });
  });

  it('ska neka rotation om användaren är inaktiv', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-123',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      user: { ...mockUser, isActive: false }
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await tokenService.rotateRefreshToken('valid-token');

    expect(result).toBeNull();
  });
});

describe('tokenService.setTokenCookies', () => {
  it('ska sätta httpOnly cookies', () => {
    const res = {
      cookie: vi.fn()
    };

    tokenService.setTokenCookies(res, 'access-123', 'refresh-456');

    expect(res.cookie).toHaveBeenCalledTimes(2);

    // Access token cookie
    const accessCall = res.cookie.mock.calls[0];
    expect(accessCall[0]).toBe('accessToken');
    expect(accessCall[1]).toBe('access-123');
    expect(accessCall[2].httpOnly).toBe(true);
    expect(accessCall[2].sameSite).toBe('strict');

    // Refresh token cookie
    const refreshCall = res.cookie.mock.calls[1];
    expect(refreshCall[0]).toBe('refreshToken');
    expect(refreshCall[1]).toBe('refresh-456');
    expect(refreshCall[2].httpOnly).toBe(true);
    expect(refreshCall[2].path).toBe('/api/auth/refresh'); // Begränsad path
  });

  it('ska inte sätta secure i test/dev-miljö', () => {
    const res = { cookie: vi.fn() };

    tokenService.setTokenCookies(res, 'a', 'r');

    const accessOpts = res.cookie.mock.calls[0][2];
    expect(accessOpts.secure).toBe(false);
  });
});

describe('tokenService.clearTokenCookies', () => {
  it('ska rensa båda cookies', () => {
    const res = {
      clearCookie: vi.fn()
    };

    tokenService.clearTokenCookies(res);

    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(res.clearCookie).toHaveBeenCalledWith('accessToken', { path: '/' });
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth/refresh' });
  });
});

describe('tokenService.revokeAllUserTokens', () => {
  it('ska invalidera alla aktiva tokens för en användare', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });

    await tokenService.revokeAllUserTokens('user-123');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-123', isRevoked: false },
      data: { isRevoked: true }
    });
  });
});
