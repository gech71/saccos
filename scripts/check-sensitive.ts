import prisma from '../src/lib/prisma';
import { findSensitiveKeys } from '../src/lib/sanitize-user-data';

async function main() {
  console.log('Scanning users and members for sensitive fields...');
  const users = await prisma.user.findMany();
  const members = await prisma.member.findMany();

  let issues = false;

  for (const u of users) {
    const hits = findSensitiveKeys(u);
    if (hits.length) {
      console.error(`User ${u.id} has sensitive fields: ${hits.join(', ')}`);
      issues = true;
    }
  }

  for (const m of members) {
    const hits = findSensitiveKeys(m);
    if (hits.length) {
      console.error(`Member ${m.id} has sensitive fields: ${hits.join(', ')}`);
      issues = true;
    }
  }

  if (issues) {
    console.error('Sensitive fields detected. Please investigate and ensure these are not sent to clients.');
    process.exit(2);
  }

  console.log('No sensitive fields found in user/member records.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error while scanning:', err);
  process.exit(1);
});