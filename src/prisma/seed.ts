
import { PrismaClient } from '@prisma/client';
import { permissionsList } from '../src/app/(app)/settings/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  console.log('Cleaning database...');
  await prisma.schoolHistory.deleteMany();
  await prisma.loanGuarantor.deleteMany();
  await prisma.loanRepayment.deleteMany();
  await prisma.collateral.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.loanType.deleteMany();
  await prisma.sharePayment.deleteMany();
  await prisma.memberShareCommitment.deleteMany();
  await prisma.shareType.deleteMany();
  await prisma.dividend.deleteMany();
  await prisma.saving.deleteMany();
  await prisma.memberSavingAccount.deleteMany();
  await prisma.savingAccountType.deleteMany();
  await prisma.appliedServiceCharge.deleteMany();
  await prisma.serviceChargeType.deleteMany();
  await prisma.address.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.member.deleteMany();
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.post.deleteMany();
  await prisma.socialMediaLink.deleteMany();
  await prisma.heroSlide.deleteMany();
  await prisma.service.deleteMany();
  await prisma.websiteContent.deleteMany();
  console.log('Database cleaned.');

  console.log('Seeding admin role...');
  const adminPermissions = permissionsList.map(p => p.id);
  const adminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      description: 'Administrator with full access',
      permissions: adminPermissions.join(','),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

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

  console.log('Seeding default website content...');
  await prisma.websiteContent.create({
    data: {
      saccoName: 'AcademInvest',
      heroTitle: 'Empowering Your Financial Future, Together.',
      heroSubtitle: 'Your trusted partner in savings and credit for the educational community.',
      heroImageUrl: 'https://picsum.photos/seed/finance/1200/800',
      aboutUs: 'We are a member-owned financial cooperative dedicated to providing quality financial services to the educational community. Our mission is to promote thrift, provide access to credit, and support the financial well-being of our members.\n\nFounded on the principles of cooperation and mutual support, we strive to be a trusted partner for all our members, helping them achieve their financial goals through ethical and transparent practices.',
      aboutUsImageUrl: 'https://picsum.photos/seed/community/800/600',
      address: '123 Main Street, Addis Ababa, Ethiopia',
      phone: '+251-911-123-456',
      email: 'contact@academinvest.com',
      logo: '',
      primary: '48 96% 53%',
      accent: '27 38% 15%',
      themeColor: '#FBBF24',
    }
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
