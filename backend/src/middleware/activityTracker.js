// ===========================================
// LVC Media Hub — Activity Tracker
// Spårar inloggade användares aktivitet (i minne)
// ===========================================

// Map: userId → { name, role, lastSeen, path }
const activeUsers = new Map();

// Rensa inaktiva användare var 5:e minut
const INACTIVE_TIMEOUT = 10 * 60 * 1000; // 10 min
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of activeUsers) {
    if (now - data.lastSeen > INACTIVE_TIMEOUT) {
      activeUsers.delete(id);
    }
  }
}, 5 * 60 * 1000);

// Middleware: registrera aktivitet efter response (req.user satt av auth)
export const trackActivity = (req, res, next) => {
  res.on('finish', () => {
    if (req.user && res.statusCode < 400) {
      activeUsers.set(req.user.id, {
        name: req.user.name || req.user.email,
        role: req.user.role,
        lastSeen: Date.now(),
        path: req.originalUrl || req.path
      });
    }
  });
  next();
};

// Hämta aktiva användare
export const getActiveUsers = () => {
  const now = Date.now();
  const online = [];
  const recent = [];

  for (const [id, data] of activeUsers) {
    const ago = now - data.lastSeen;
    const entry = {
      id,
      name: data.name,
      role: data.role,
      lastSeen: new Date(data.lastSeen).toISOString(),
      agoSeconds: Math.round(ago / 1000),
      path: data.path
    };
    if (ago < 2 * 60 * 1000) {
      online.push(entry);
    } else if (ago < INACTIVE_TIMEOUT) {
      recent.push(entry);
    }
  }

  return {
    online: online.sort((a, b) => a.agoSeconds - b.agoSeconds),
    recent: recent.sort((a, b) => a.agoSeconds - b.agoSeconds),
    totalOnline: online.length,
    totalRecent: recent.length
  };
};
