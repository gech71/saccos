
import { PrismaClient } from '@prisma/client';
import { permissionsList } from '../src/app/(app)/settings/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // 1. Clean up existing data in the correct order to avoid constraint violations
  console.log('Cleaning database...');
  await prisma.saving.deleteMany();
  await prisma.sharePayment.deleteMany();
  await prisma.memberSavingAccount.deleteMany();
  await prisma.memberShareCommitment.deleteMany();
  await prisma.collateral.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.address.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.loanRepayment.deleteMany();
  await prisma.appliedServiceCharge.deleteMany();
  await prisma.dividend.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.member.deleteMany();
  await prisma.serviceChargeType.deleteMany();
  await prisma.loanType.deleteMany();
  await prisma.shareType.deleteMany();
  await prisma.savingAccountType.deleteMany();
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  console.log('Database cleaned.');

  // 2. Seed Admin Role
  console.log('Seeding admin role...');
  const adminPermissions = permissionsList.map(p => p.id);
  const adminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      description: 'Administrator with full access',
      permissions: adminPermissions.join(','),
    },
  });

  // 3. Seed Admin User
  console.log('Seeding admin user...');
  await prisma.user.create({
    data: {
      userId: 'b1e55c84-9055-4eb5-8bd4-a262538f7e66', // Hardcoded ID from external auth
      email: 'admin@academinvest.com',
      name: 'Academ Admin',
      firstName: 'Academ',
      lastName: 'Admin',
      phoneNumber: '0912345678',
      roles: {
        connect: { id: adminRole.id },
      },
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
