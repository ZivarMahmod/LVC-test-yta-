// ===========================================
// LVC Media Hub — Brute Force Service Tester
// Testar inloggningslåsning och försöksregistrering
// ===========================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  default: {
    loginAttempt: {
      count: vi.fn(),
      create: vi.fn(),
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

import { bruteForceService } from '../src/services/bruteForce.js';
import prisma from '../src/config/database.js';

describe('bruteForceService.isLocked', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('ska inte vara låst med 0 misslyckade försök', async () => {
    prisma.loginAttempt.count.mockResolvedValue(0);

    const result = await bruteForceService.isLocked('test@test.se', '127.0.0.1');

    expect(result).toBe(false);
  });

  it('ska inte vara låst med 4 misslyckade försök (under gränsen)', async () => {
    prisma.loginAttempt.count.mockResolvedValue(4);

    const result = await bruteForceService.isLocked('test@test.se', '127.0.0.1');

    expect(result).toBe(false);
  });

  it('ska vara låst med 5 misslyckade försök per email', async () => {
    // Första anropet (email-check) returnerar 5, andra (IP-check) returnerar 0
    prisma.loginAttempt.count
      .mockResolvedValueOnce(5)  // email attempts
      .mockResolvedValueOnce(0); // ip attempts

    const result = await bruteForceService.isLocked('test@test.se', '127.0.0.1');

    expect(result).toBe(true);
  });

  it('ska vara låst med 15 misslyckade försök per IP (5 * 3)', async () => {
    prisma.loginAttempt.count
      .mockResolvedValueOnce(2)   // email attempts (under gräns)
      .mockResolvedValueOnce(15); // ip attempts (5 * 3 = 15)

    const result = await bruteForceService.isLocked('test@test.se', '1.2.3.4');

    expect(result).toBe(true);
  });

  it('ska inte vara låst med 14 IP-försök (precis under gränsen)', async () => {
    prisma.loginAttempt.count
      .mockResolvedValueOnce(2)   // email
      .mockResolvedValueOnce(14); // ip (under 15)

    const result = await bruteForceService.isLocked('test@test.se', '1.2.3.4');

    expect(result).toBe(false);
  });

  it('ska konvertera email till lowercase vid räkning', async () => {
    prisma.loginAttempt.count.mockResolvedValue(0);

    await bruteForceService.isLocked('TEST@TEST.SE', '127.0.0.1');

    const emailCall = prisma.loginAttempt.count.mock.calls[0][0];
    expect(emailCall.where.email).toBe('test@test.se');
  });
});

describe('bruteForceService.recordAttempt', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('ska registrera misslyckat försök', async () => {
    prisma.loginAttempt.create.mockResolvedValue({});

    await bruteForceService.recordAttempt('test@test.se', '127.0.0.1', false);

    expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
      data: {
        email: 'test@test.se',
        ipAddress: '127.0.0.1',
        success: false,
        userId: null
      }
    });
  });

  it('ska registrera lyckat försök med userId', async () => {
    prisma.loginAttempt.create.mockResolvedValue({});

    await bruteForceService.recordAttempt('test@test.se', '127.0.0.1', true, 'user-123');

    expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
      data: {
        email: 'test@test.se',
        ipAddress: '127.0.0.1',
        success: true,
        userId: 'user-123'
      }
    });
  });
});

describe('bruteForceService.cleanup', () => {
  it('ska radera försök äldre än 24 timmar', async () => {
    prisma.loginAttempt.deleteMany.mockResolvedValue({ count: 10 });

    await bruteForceService.cleanup();

    const call = prisma.loginAttempt.deleteMany.mock.calls[0][0];
    const cutoff = new Date(call.where.createdAt.lt);
    const expected = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Tillåt 5 sekunders marginal
    expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(5000);
  });
});
