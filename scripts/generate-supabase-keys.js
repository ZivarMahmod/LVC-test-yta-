#!/usr/bin/env node
// ===========================================
// Genererar JWT-nycklar för self-hosted Supabase
// Kör: node scripts/generate-supabase-keys.js
// ===========================================
import crypto from 'crypto';

// Generera JWT secret
const jwtSecret = crypto.randomBytes(32).toString('base64');

// Enkel JWT-generering (utan externa beroenden)
function createJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const now = Math.floor(Date.now() / 1000);
const tenYears = 10 * 365 * 24 * 60 * 60;

const anonKey = createJwt({
  role: 'anon',
  iss: 'supabase',
  iat: now,
  exp: now + tenYears,
}, jwtSecret);

const serviceRoleKey = createJwt({
  role: 'service_role',
  iss: 'supabase',
  iat: now,
  exp: now + tenYears,
}, jwtSecret);

console.log('===========================================');
console.log('Supabase JWT Keys — Lägg till i .env');
console.log('===========================================');
console.log('');
console.log(`SUPABASE_JWT_SECRET=${jwtSecret}`);
console.log(`SUPABASE_ANON_KEY=${anonKey}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
console.log('');
console.log('===========================================');
