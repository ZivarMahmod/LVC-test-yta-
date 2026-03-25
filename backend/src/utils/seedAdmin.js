// ===========================================
// LVC Media Hub — Skapa admin-användare
// Kör: node src/utils/seedAdmin.js
// ===========================================
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@lvcmediahub.com';
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');

  if (!password || password.startsWith('ÄNDRA_MIG')) {
    console.error('❌ Ange ADMIN_PASSWORD i .env-filen innan du kör seed.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ️  Admin-användare (${email}) finns redan.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, rounds);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'admin',
      isActive: true
    }
  });

  console.log(`✅ Admin-användare skapad:`);
  console.log(`   E-post: ${user.email}`);
  console.log(`   Namn:   ${user.name}`);
  console.log(`   Roll:   ${user.role}`);

  await prisma.$disconnect();
}

seed().catch((error) => {
  console.error('❌ Seed-fel:', error.message);
  process.exit(1);
});
