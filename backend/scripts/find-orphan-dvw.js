#!/usr/bin/env node
// ===========================================
// Hitta föräldralösa DVW-filer (dry-run)
//
// Jämför .dvw-filer på disk med dvwPath i databasen.
// Listar filer som INTE tillhör någon video.
//
// Kör med: node scripts/find-orphan-dvw.js
// Radera:  node scripts/find-orphan-dvw.js --delete
// ===========================================
import { PrismaClient } from '@prisma/client';
import { readdir, stat, unlink } from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || '/storage';
const DELETE_MODE = process.argv.includes('--delete');

const prisma = new PrismaClient();

async function findDvwFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findDvwFiles(fullPath));
    } else if (entry.name.toLowerCase().endsWith('.dvw')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  console.log('=== Föräldralösa DVW-filer ===');
  console.log(`Läge: ${DELETE_MODE ? '⚠️  RADERA' : '👁  Dry-run (visar bara)'}`);
  console.log(`Storage: ${STORAGE_PATH}\n`);

  // 1. Hämta alla dvwPath från databasen (inklusive soft-deleted)
  const videos = await prisma.video.findMany({
    select: { id: true, dvwPath: true, title: true, deletedAt: true }
  });

  // Skapa set med normaliserade absoluta sökvägar från DB
  const dbPaths = new Set();
  for (const v of videos) {
    if (v.dvwPath) {
      const abs = path.join(STORAGE_PATH, v.dvwPath.replace(/\.\./g, '').replace(/\\/g, '/'));
      dbPaths.add(path.normalize(abs));
    }
  }

  console.log(`Videor i databasen: ${videos.length}`);
  console.log(`Videor med DVW-sökväg: ${[...dbPaths].length}\n`);

  // 2. Hitta alla .dvw-filer på disk
  const diskFiles = await findDvwFiles(STORAGE_PATH);
  console.log(`DVW-filer på disk: ${diskFiles.length}\n`);

  // 3. Jämför
  const orphans = [];
  const matched = [];
  for (const file of diskFiles) {
    const normalized = path.normalize(file);
    if (dbPaths.has(normalized)) {
      matched.push(normalized);
    } else {
      orphans.push(normalized);
    }
  }

  console.log(`✅ Matchade (tillhör en video): ${matched.length}`);
  console.log(`❌ Föräldralösa (ingen matchande video): ${orphans.length}\n`);

  if (orphans.length === 0) {
    console.log('Inga föräldralösa DVW-filer hittades. Allt ser bra ut!');
    await prisma.$disconnect();
    return;
  }

  // Visa föräldralösa filer med storlek
  console.log('--- Föräldralösa filer ---');
  let totalSize = 0;
  for (const file of orphans) {
    try {
      const s = await stat(file);
      const sizeKB = Math.round(s.size / 1024);
      totalSize += s.size;
      const relPath = file.replace(STORAGE_PATH, '');
      console.log(`  ${relPath}  (${sizeKB} KB)`);
    } catch {
      console.log(`  ${file}  (kunde inte läsa storlek)`);
    }
  }
  console.log(`\nTotal storlek: ${Math.round(totalSize / 1024)} KB`);

  // Visa matchade filer för verifiering
  console.log('\n--- Matchade filer (behålls) ---');
  for (const file of matched) {
    const relPath = file.replace(STORAGE_PATH, '');
    const video = videos.find(v => v.dvwPath && path.normalize(path.join(STORAGE_PATH, v.dvwPath)) === file);
    const label = video ? `→ "${video.title}"${video.deletedAt ? ' [BORTTAGEN]' : ''}` : '';
    console.log(`  ${relPath}  ${label}`);
  }

  if (DELETE_MODE) {
    console.log('\n⚠️  Raderar föräldralösa filer...');
    let deleted = 0;
    for (const file of orphans) {
      try {
        await unlink(file);
        deleted++;
        console.log(`  Raderad: ${file.replace(STORAGE_PATH, '')}`);
      } catch (err) {
        console.log(`  FEL: ${file.replace(STORAGE_PATH, '')} — ${err.message}`);
      }
    }
    console.log(`\n✅ ${deleted} filer raderade.`);
  } else {
    console.log('\n💡 Kör med --delete för att radera dessa filer:');
    console.log('   node scripts/find-orphan-dvw.js --delete');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fel:', err);
  prisma.$disconnect();
  process.exit(1);
});
