// ===========================================
// LVC Media Hub — Test Setup
// Ställer in miljövariabler för tester
// ===========================================

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough-for-jwt-signing-purposes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-long-enough-for-jwt-signing-purposes';
process.env.CSRF_SECRET = 'test-csrf-secret-32chars-long!!';
process.env.BCRYPT_ROUNDS = '4'; // Snabbare i tester
process.env.ACCESS_TOKEN_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';
process.env.STORAGE_PATH = '/tmp/test-storage';
process.env.ALLOWED_FILE_TYPES = 'video/mp4,video/quicktime,video/x-matroska';
process.env.ALLOWED_EXTENSIONS = '.mp4,.mov,.mkv';
process.env.MAX_FILE_SIZE_BYTES = '10737418240';
