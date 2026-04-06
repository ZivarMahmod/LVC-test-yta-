// ===========================================
// LVC Media Hub — Auth Controller Tester
// Testar login, register, refresh, logout, me, changePassword, preferences
// ===========================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocka prisma
vi.mock('../src/config/database.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    inviteToken: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn()
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

// Mocka bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn()
  }
}));

// Mocka tokenService
vi.mock('../src/services/tokenService.js', () => ({
  tokenService: {
    generateAccessToken: vi.fn().mockReturnValue('mock-access-token'),
    generateRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
    setTokenCookies: vi.fn(),
    clearTokenCookies: vi.fn(),
    rotateRefreshToken: vi.fn(),
    revokeAllUserTokens: vi.fn()
  }
}));

// Mocka bruteForceService
vi.mock('../src/services/bruteForce.js', () => ({
  bruteForceService: {
    isLocked: vi.fn().mockResolvedValue(false),
    recordAttempt: vi.fn()
  }
}));

import { authController } from '../src/controllers/authController.js';
import prisma from '../src/config/database.js';
import bcrypt from 'bcrypt';
import { tokenService } from '../src/services/tokenService.js';
import { bruteForceService } from '../src/services/bruteForce.js';

// Helper: create mock req/res
function createMockReqRes(overrides = {}) {
  const req = {
    body: {},
    cookies: {},
    params: {},
    ip: '127.0.0.1',
    user: null,
    get: vi.fn().mockReturnValue('test-agent'),
    ...overrides
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis()
  };
  return { req, res };
}

const mockUser = {
  id: 'user-123',
  email: 'testuser@lvcmediahub.local',
  username: 'testuser',
  name: 'Test User',
  role: 'viewer',
  passwordHash: 'hashed-password',
  isActive: true
};

// ===========================================
// LOGIN
// ===========================================
describe('authController.login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bruteForceService.isLocked.mockResolvedValue(false);
  });

  it('ska logga in med korrekt username och lösenord', async () => {
    const { req, res } = createMockReqRes({
      body: { identifier: 'testuser', password: 'correct-password' }
    });

    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);

    await authController.login(req, res);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'testuser' } });
    expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(mockUser);
    expect(tokenService.generateRefreshToken).toHaveBeenCalledWith(mockUser);
    expect(tokenService.setTokenCookies).toHaveBeenCalledWith(res, 'mock-access-token', 'mock-refresh-token');
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: 'user-123',
        email: 'testuser@lvcmediahub.local',
        username: 'testuser',
        name: 'Test User',
        role: 'viewer'
      }
    });
  });

  it('ska logga in med email-adress (identifier med @)', async () => {
    const { req, res } = createMockReqRes({
      body: { identifier: 'Test@Example.com', password: 'correct-password' }
    });

    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);

    await authController.login(req, res);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }));
  });

  it('ska neka inloggning med fel lösenord', async () => {
    const { req, res } = createMockReqRes({
      body: { identifier: 'testuser', password: 'wrong-password' }
    });

    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false);

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Felaktigt användarnamn eller lösenord.' });
    expect(bruteForceService.recordAttempt).toHaveBeenCalledWith('testuser', '127.0.0.1', false, 'user-123');
    expect(tokenService.generateAccessToken).not.toHaveBeenCalled();
  });

  it('ska neka inloggning om användaren inte finns', async () => {
    const { req, res } = createMockReqRes({
      body: { identifier: 'nonexistent', password: 'any-password' }
    });

    prisma.user.findUnique.mockResolvedValue(null);

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Felaktigt användarnamn eller lösenord.' });
    expect(bruteForceService.recordAttempt).toHaveBeenCalledWith('nonexistent', '127.0.0.1', false);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('ska neka inloggning för inaktiv användare', async () => {
    const inactiveUser = { ...mockUser, isActive: false };
    const { req, res } = createMockReqRes({
      body: { identifier: 'testuser', password: 'correct-password' }
    });

    prisma.user.findUnique.mockResolvedValue(inactiveUser);

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Felaktigt användarnamn eller lösenord.' });
    // Should not even try bcrypt.compare for inactive users
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('ska returnera 429 om brute force-skydd är aktiverat', async () => {
    bruteForceService.isLocked.mockResolvedValue(true);

    const { req, res } = createMockReqRes({
      body: { identifier: 'testuser', password: 'any' }
    });

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'För många misslyckade inloggningsförsök. Försök igen om 15 minuter.'
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('ska registrera lyckad inloggning hos bruteForce', async () => {
    const { req, res } = createMockReqRes({
      body: { identifier: 'testuser', password: 'correct-password' }
    });

    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);

    await authController.login(req, res);

    expect(bruteForceService.recordAttempt).toHaveBeenCalledWith('testuser', '127.0.0.1', true, 'user-123');
  });

  it('ska returnera 500 vid databasfel', async () => {
    const { req, res } = createMockReqRes({
      body: { identifier: 'testuser', password: 'pass' }
    });

    prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ett fel uppstod vid inloggning.' });
  });
});

// ===========================================
// REGISTER
// ===========================================
describe('authController.register', () => {
  const validInvite = {
    id: 'invite-1',
    token: 'valid-invite-token',
    role: 'viewer',
    useCount: 0,
    maxUses: 5,
    expiresAt: new Date(Date.now() + 86400000) // tomorrow
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska registrera ny användare med giltig inbjudan', async () => {
    const { req, res } = createMockReqRes({
      body: { token: 'valid-invite-token', username: 'NewUser', password: 'securepassword', name: 'New User' }
    });

    prisma.inviteToken.findUnique.mockResolvedValue(validInvite);
    prisma.user.findUnique.mockResolvedValue(null); // no existing user
    bcrypt.hash.mockResolvedValue('new-hashed-password');

    const createdUser = {
      id: 'new-user-id',
      email: 'newuser@lvcmediahub.local',
      username: 'newuser',
      name: 'New User',
      role: 'viewer',
      isActive: true
    };
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: { create: vi.fn().mockResolvedValue(createdUser) },
        inviteToken: { update: vi.fn() }
      };
      return callback(tx);
    });

    await authController.register(req, res);

    expect(prisma.inviteToken.findUnique).toHaveBeenCalledWith({ where: { token: 'valid-invite-token' } });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'newuser' } });
    expect(bcrypt.hash).toHaveBeenCalledWith('securepassword', expect.any(Number));
    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(createdUser);
    expect(tokenService.generateRefreshToken).toHaveBeenCalledWith(createdUser);
    expect(tokenService.setTokenCookies).toHaveBeenCalledWith(res, 'mock-access-token', 'mock-refresh-token');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: 'new-user-id',
        username: 'newuser',
        name: 'New User',
        role: 'viewer'
      }
    });
  });

  it('ska neka registrering med ogiltig inbjudan', async () => {
    const { req, res } = createMockReqRes({
      body: { token: 'bad-token', username: 'user', password: 'password', name: 'User' }
    });

    prisma.inviteToken.findUnique.mockResolvedValue(null);

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ogiltig inbjudningslänk.' });
  });

  it('ska neka registrering med utgången inbjudan', async () => {
    const expiredInvite = {
      ...validInvite,
      expiresAt: new Date(Date.now() - 86400000) // yesterday
    };
    const { req, res } = createMockReqRes({
      body: { token: 'valid-invite-token', username: 'user', password: 'password', name: 'User' }
    });

    prisma.inviteToken.findUnique.mockResolvedValue(expiredInvite);

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Inbjudningslänken har gått ut.' });
  });

  it('ska neka registrering om inbjudan har nått max registreringar', async () => {
    const maxedInvite = {
      ...validInvite,
      useCount: 5,
      maxUses: 5
    };
    const { req, res } = createMockReqRes({
      body: { token: 'valid-invite-token', username: 'user', password: 'password', name: 'User' }
    });

    prisma.inviteToken.findUnique.mockResolvedValue(maxedInvite);

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Denna inbjudningslänk har nått max antal registreringar.' });
  });

  it('ska neka registrering om användarnamnet redan finns', async () => {
    const { req, res } = createMockReqRes({
      body: { token: 'valid-invite-token', username: 'ExistingUser', password: 'password', name: 'User' }
    });

    prisma.inviteToken.findUnique.mockResolvedValue(validInvite);
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', username: 'existinguser' });

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Användarnamnet är redan taget.' });
  });

  it('ska använda username som namn om name inte angetts', async () => {
    const { req, res } = createMockReqRes({
      body: { token: 'valid-invite-token', username: 'UserNoName', password: 'securepassword' }
    });

    prisma.inviteToken.findUnique.mockResolvedValue(validInvite);
    prisma.user.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed');

    const createdUser = {
      id: 'new-id',
      email: 'usernoname@lvcmediahub.local',
      username: 'usernoname',
      name: 'UserNoName',
      role: 'viewer',
      isActive: true
    };
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          create: vi.fn().mockImplementation(({ data }) => {
            // Verify name fallback
            expect(data.name).toBe('UserNoName');
            return createdUser;
          })
        },
        inviteToken: { update: vi.fn() }
      };
      return callback(tx);
    });

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('ska returnera 500 vid databasfel under registrering', async () => {
    const { req, res } = createMockReqRes({
      body: { token: 'valid-invite-token', username: 'user', password: 'password', name: 'User' }
    });

    prisma.inviteToken.findUnique.mockResolvedValue(validInvite);
    prisma.user.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed');
    prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Kunde inte registrera användaren.' });
  });
});

// ===========================================
// VALIDATE INVITE
// ===========================================
describe('authController.validateInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska returnera valid för giltig inbjudan', async () => {
    const invite = {
      token: 'valid-token',
      role: 'coach',
      useCount: 1,
      maxUses: 5,
      expiresAt: new Date(Date.now() + 86400000)
    };
    const { req, res } = createMockReqRes({ params: { token: 'valid-token' } });
    prisma.inviteToken.findUnique.mockResolvedValue(invite);

    await authController.validateInvite(req, res);

    expect(res.json).toHaveBeenCalledWith({ valid: true, role: 'coach' });
  });

  it('ska returnera invalid för ogiltig inbjudan', async () => {
    const { req, res } = createMockReqRes({ params: { token: 'bad-token' } });
    prisma.inviteToken.findUnique.mockResolvedValue(null);

    await authController.validateInvite(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, error: 'Ogiltig eller utgången inbjudan.' });
  });

  it('ska returnera invalid för utgången inbjudan', async () => {
    const invite = {
      token: 'expired-token',
      role: 'viewer',
      useCount: 0,
      maxUses: 5,
      expiresAt: new Date(Date.now() - 86400000) // yesterday
    };
    const { req, res } = createMockReqRes({ params: { token: 'expired-token' } });
    prisma.inviteToken.findUnique.mockResolvedValue(invite);

    await authController.validateInvite(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, error: 'Ogiltig eller utgången inbjudan.' });
  });

  it('ska returnera invalid för inbjudan som nått max uses', async () => {
    const invite = {
      token: 'maxed-token',
      role: 'viewer',
      useCount: 3,
      maxUses: 3,
      expiresAt: new Date(Date.now() + 86400000)
    };
    const { req, res } = createMockReqRes({ params: { token: 'maxed-token' } });
    prisma.inviteToken.findUnique.mockResolvedValue(invite);

    await authController.validateInvite(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, error: 'Ogiltig eller utgången inbjudan.' });
  });
});

// ===========================================
// REFRESH
// ===========================================
describe('authController.refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska rotera refresh token och returnera ny access token', async () => {
    const refreshedUser = {
      id: 'user-123',
      email: 'test@test.se',
      username: 'testuser',
      name: 'Test',
      role: 'viewer'
    };
    const { req, res } = createMockReqRes({
      cookies: { refreshToken: 'old-refresh-token' }
    });

    tokenService.rotateRefreshToken.mockResolvedValue({
      newRefreshToken: 'new-refresh-token',
      user: refreshedUser
    });
    tokenService.generateAccessToken.mockReturnValue('new-access-token');

    await authController.refresh(req, res);

    expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith('old-refresh-token');
    expect(tokenService.generateAccessToken).toHaveBeenCalledWith(refreshedUser);
    expect(tokenService.setTokenCookies).toHaveBeenCalledWith(res, 'new-access-token', 'new-refresh-token');
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: 'user-123',
        email: 'test@test.se',
        username: 'testuser',
        name: 'Test',
        role: 'viewer'
      }
    });
  });

  it('ska returnera 401 om ingen refresh token finns', async () => {
    const { req, res } = createMockReqRes({ cookies: {} });

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ingen refresh token. Logga in igen.' });
    expect(tokenService.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('ska returnera 401 och rensa cookies vid ogiltig refresh token', async () => {
    const { req, res } = createMockReqRes({
      cookies: { refreshToken: 'invalid-token' }
    });

    tokenService.rotateRefreshToken.mockResolvedValue(null);

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ogiltig eller utgången session. Logga in igen.' });
    expect(tokenService.clearTokenCookies).toHaveBeenCalledWith(res);
  });

  it('ska returnera 500 och rensa cookies vid oväntat fel', async () => {
    const { req, res } = createMockReqRes({
      cookies: { refreshToken: 'some-token' }
    });

    tokenService.rotateRefreshToken.mockRejectedValue(new Error('DB crashed'));

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Kunde inte uppdatera sessionen.' });
    expect(tokenService.clearTokenCookies).toHaveBeenCalledWith(res);
  });
});

// ===========================================
// LOGOUT
// ===========================================
describe('authController.logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska logga ut inloggad användare och rensa cookies', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123', username: 'testuser' }
    });

    await authController.logout(req, res);

    expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
    expect(tokenService.clearTokenCookies).toHaveBeenCalledWith(res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Utloggad.' });
  });

  it('ska rensa cookies även om ingen user finns på req', async () => {
    const { req, res } = createMockReqRes({ user: null });

    await authController.logout(req, res);

    expect(tokenService.revokeAllUserTokens).not.toHaveBeenCalled();
    expect(tokenService.clearTokenCookies).toHaveBeenCalledWith(res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Utloggad.' });
  });

  it('ska rensa cookies och returnera utloggad även vid fel', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' }
    });

    tokenService.revokeAllUserTokens.mockRejectedValue(new Error('DB error'));

    await authController.logout(req, res);

    expect(tokenService.clearTokenCookies).toHaveBeenCalledWith(res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Utloggad.' });
  });
});

// ===========================================
// ME
// ===========================================
describe('authController.me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska returnera inloggad användares data med preferences', async () => {
    const { req, res } = createMockReqRes({
      user: {
        id: 'user-123',
        email: 'test@test.se',
        username: 'testuser',
        name: 'Test User',
        role: 'viewer'
      }
    });

    prisma.user.findUnique.mockResolvedValue({
      preferences: JSON.stringify({ theme: 'dark', gradeSymbols: true })
    });

    await authController.me(req, res);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      select: { preferences: true }
    });
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: 'user-123',
        email: 'test@test.se',
        username: 'testuser',
        name: 'Test User',
        role: 'viewer',
        preferences: { theme: 'dark', gradeSymbols: true }
      }
    });
  });

  it('ska returnera tomt preferences-objekt om inga preferences finns', async () => {
    const { req, res } = createMockReqRes({
      user: {
        id: 'user-123',
        email: 'test@test.se',
        username: 'testuser',
        name: 'Test User',
        role: 'viewer'
      }
    });

    prisma.user.findUnique.mockResolvedValue({ preferences: null });

    await authController.me(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({ preferences: {} })
    });
  });

  it('ska returnera tomt preferences-objekt om user inte hittas', async () => {
    const { req, res } = createMockReqRes({
      user: {
        id: 'deleted-user',
        email: 'x@x.se',
        username: 'x',
        name: 'X',
        role: 'viewer'
      }
    });

    prisma.user.findUnique.mockResolvedValue(null);

    await authController.me(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({ preferences: {} })
    });
  });
});

// ===========================================
// CHANGE PASSWORD
// ===========================================
describe('authController.changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska byta lösenord med korrekt gammalt lösenord', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' },
      body: { oldPassword: 'old-pass', newPassword: 'new-secure-pass' }
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      passwordHash: 'old-hash'
    });
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('new-hashed-password');

    await authController.changePassword(req, res);

    expect(bcrypt.compare).toHaveBeenCalledWith('old-pass', 'old-hash');
    expect(bcrypt.hash).toHaveBeenCalledWith('new-secure-pass', expect.any(Number));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { passwordHash: 'new-hashed-password' }
    });
    expect(res.json).toHaveBeenCalledWith({ message: 'Lösenord ändrat.' });
  });

  it('ska neka byte med fel nuvarande lösenord', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' },
      body: { oldPassword: 'wrong-pass', newPassword: 'new-pass-123' }
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      passwordHash: 'old-hash'
    });
    bcrypt.compare.mockResolvedValue(false);

    await authController.changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Felaktigt nuvarande lösenord.' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ska neka byte om nytt lösenord är kortare än 8 tecken', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' },
      body: { oldPassword: 'old-pass', newPassword: 'short' }
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      passwordHash: 'old-hash'
    });
    bcrypt.compare.mockResolvedValue(true);

    await authController.changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nytt lösenord måste vara minst 8 tecken.' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ska returnera 404 om användaren inte hittas', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'missing-user' },
      body: { oldPassword: 'old', newPassword: 'newpassword' }
    });

    prisma.user.findUnique.mockResolvedValue(null);

    await authController.changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Användaren hittades inte.' });
  });

  it('ska returnera 500 vid databasfel', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' },
      body: { oldPassword: 'old-pass', newPassword: 'new-pass-123' }
    });

    prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    await authController.changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Kunde inte ändra lösenord.' });
  });
});

// ===========================================
// GET PREFERENCES
// ===========================================
describe('authController.getPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska returnera sparade preferences', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' }
    });

    prisma.user.findUnique.mockResolvedValue({
      preferences: JSON.stringify({ theme: 'dark', language: 'sv' })
    });

    await authController.getPreferences(req, res);

    expect(res.json).toHaveBeenCalledWith({ theme: 'dark', language: 'sv' });
  });

  it('ska returnera tomt objekt om inga preferences finns', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' }
    });

    prisma.user.findUnique.mockResolvedValue({ preferences: null });

    await authController.getPreferences(req, res);

    expect(res.json).toHaveBeenCalledWith({});
  });

  it('ska returnera 500 vid databasfel', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' }
    });

    prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    await authController.getPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Kunde inte hämta inställningar.' });
  });
});

// ===========================================
// UPDATE PREFERENCES
// ===========================================
describe('authController.updatePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska merga nya preferences med befintliga', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' },
      body: { gradeSymbols: true }
    });

    prisma.user.findUnique.mockResolvedValue({
      preferences: JSON.stringify({ theme: 'dark' })
    });

    await authController.updatePreferences(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { preferences: JSON.stringify({ theme: 'dark', gradeSymbols: true }) }
    });
    expect(res.json).toHaveBeenCalledWith({ theme: 'dark', gradeSymbols: true });
  });

  it('ska hantera tom befintlig preferences', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' },
      body: { theme: 'light' }
    });

    prisma.user.findUnique.mockResolvedValue({ preferences: null });

    await authController.updatePreferences(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { preferences: JSON.stringify({ theme: 'light' }) }
    });
    expect(res.json).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('ska överskriva befintligt värde vid uppdatering', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' },
      body: { theme: 'light' }
    });

    prisma.user.findUnique.mockResolvedValue({
      preferences: JSON.stringify({ theme: 'dark', other: 'val' })
    });

    await authController.updatePreferences(req, res);

    expect(res.json).toHaveBeenCalledWith({ theme: 'light', other: 'val' });
  });

  it('ska returnera 500 vid databasfel', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-123' },
      body: { theme: 'dark' }
    });

    prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    await authController.updatePreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Kunde inte spara inställningar.' });
  });
});
