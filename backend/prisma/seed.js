import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// OWASP-recommended Argon2id parameters.
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

async function main() {
  const username = process.env.DEFAULT_ADMIN_USER || 'admin';
  const password = process.env.DEFAULT_ADMIN_PASS;

  if (!password) {
    console.error('DEFAULT_ADMIN_PASS is not set — refusing to seed a blank-password admin.');
    process.exit(1);
  }

  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log('Users already exist; skipping seed.');
    return;
  }

  const passwordHash = await argon2.hash(password, ARGON_OPTS);
  await prisma.user.create({ data: { username, passwordHash, role: 'SUPERADMIN', isActive: true } });
  console.log(`Seeded bootstrap admin "${username}" (role SUPERADMIN).`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
