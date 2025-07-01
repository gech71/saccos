
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // 1. Clean up existing data in the correct order to avoid constraint violations
  console.log('Cleaning database...');
  await prisma.memberShareCommitment.deleteMany();
  await prisma.collateral.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.address.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.loanRepayment.deleteMany();
  await prisma.appliedServiceCharge.deleteMany();
  await prisma.saving.deleteMany();
  await prisma.share.deleteMany();
  await prisma.dividend.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.member.deleteMany();
  await prisma.serviceChargeType.deleteMany();
  await prisma.loanType.deleteMany();
  await prisma.shareType.deleteMany();
  await prisma.savingAccountType.deleteMany();
  await prisma.school.deleteMany();
  await prisma.building.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  console.log('Database cleaned.');

  // 2. Seed Roles
  console.log('Seeding roles...');
  const adminPermissions = [
      'dashboard:view', 'school:view', 'school:create', 'school:edit', 'school:delete',
      'member:view', 'member:create', 'member:edit', 'member:delete',
      'saving:view', 'saving:create', 'saving:edit', 'saving:delete',
      'savingAccount:view', 'groupCollection:view', 'groupCollection:create',
      'interestCalculation:view', 'interestCalculation:create', 'accountStatement:view',
      'accountClosure:view', 'accountClosure:create', 'closedAccount:view',
      'loan:view', 'loan:create', 'loan:edit', 'loan:delete',
      'loanRepayment:view', 'loanRepayment:create', 'groupLoanRepayment:view',
      'groupLoanRepayment:create', 'overdueLoan:view',
      'share:view', 'share:create', 'share:edit', 'share:delete',
      'dividend:view', 'dividend:create', 'dividend:edit', 'dividend:delete',
      'transactionApproval:view', 'transactionApproval:edit',
      'serviceCharge:view', 'serviceCharge:create', 'serviceCharge:edit',
      'overduePayment:view', 'overduePayment:create',
      'report:view', 'setting:view', 'setting:create', 'setting:edit', 'setting:delete',
      'configuration:view', 'configuration:create', 'configuration:edit', 'configuration:delete',
  ];

  const staffPermissions = [
      'dashboard:view', 'school:view', 'member:view', 'member:create', 'member:edit',
      'saving:view', 'saving:create', 'loan:view', 'loan:create', 'share:view',
      'share:create', 'dividend:view', 'loanRepayment:view', 'loanRepayment:create',
      'accountStatement:view'
  ];

  const adminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      description: 'Administrator with full access',
      permissions: adminPermissions,
    },
  });
  
  const staffRole = await prisma.role.create({
    data: {
      name: 'Staff',
      description: 'Regular staff member with limited access',
      permissions: staffPermissions,
    },
  });

  // 3. Seed Users (Application Operators)
  console.log('Seeding users...');
  const adminUser = await prisma.user.create({
    data: {
      userId: 'b1e55c84-9055-4eb5-8bd4-a262538f7e66', // Hardcoded ID from external auth
      email: 'admin@academinvest.com',
      name: 'Academ Admin',
      firstName: 'Academ',
      lastName: 'Admin',
      roles: {
        connect: { id: adminRole.id },
      },
    },
  });
  
  // Seed a building and assign a manager
  await prisma.building.create({
    data: {
      name: 'Head Office',
      address: '123 Admin Way',
      managers: {
        connect: { id: adminUser.id }
      }
    }
  });


  // 4. Seed Core Types
  console.log('Seeding core types...');
  const school1 = await prisma.school.create({ data: { name: 'Greenwood High', address: '123 Oak St', contactPerson: 'Alice Wonderland' } });
  const school2 = await prisma.school.create({ data: { name: 'Riverside Academy', address: '456 Pine Ave', contactPerson: 'Bob Builder' } });
  
  const satRegular = await prisma.savingAccountType.create({ data: { name: 'Regular Savings', interestRate: 0.02, expectedMonthlyContribution: 50 } });
  const satYouth = await prisma.savingAccountType.create({ data: { name: 'Youth Saver', interestRate: 0.035, expectedMonthlyContribution: 25 } });

  const stRegular = await prisma.shareType.create({ data: { name: 'Regular Share', valuePerShare: 10, expectedMonthlyContribution: 20 } });
  const stEducation = await prisma.shareType.create({ data: { name: 'Educational Support Share', valuePerShare: 15, expectedMonthlyContribution: 10 } });

  const ltEmergency = await prisma.loanType.create({ data: { name: 'Emergency Loan', interestRate: 0.12, loanTerm: 12, repaymentFrequency: 'monthly', nplInterestRate: 0.18, allowConcurrent: true } });
  const ltSchoolFees = await prisma.loanType.create({ data: { name: 'School Fee Loan', interestRate: 0.08, loanTerm: 10, repaymentFrequency: 'monthly', nplInterestRate: 0.15, allowConcurrent: false } });

  const sctAnnual = await prisma.serviceChargeType.create({ data: { name: 'Annual Membership Fee', amount: 20, frequency: 'yearly' } });
  const sctLatePay = await prisma.serviceChargeType.create({ data: { name: 'Late Payment Penalty', amount: 5, frequency: 'once' } });
  const sctLoanInterest = await prisma.serviceChargeType.create({ data: { name: 'Monthly Loan Interest', amount: 0, frequency: 'monthly', description: 'Accrued interest on active loans. Amount is calculated dynamically.' } });

  // 5. Seed Members (Customers of the Association)
  console.log('Seeding members...');
  const member1 = await prisma.member.create({
    data: {
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      sex: 'Male',
      phoneNumber: '0911223344',
      schoolId: school1.id,
      joinDate: new Date(2023, 0, 15),
      savingsBalance: 1250.75,
      savingsAccountNumber: 'SA00001',
      sharesCount: 70,
      savingAccountTypeId: satRegular.id,
      expectedMonthlySaving: 50,
      shareCommitments: {
        create: [
          { shareTypeId: stRegular.id, monthlyCommittedAmount: 20 },
          { shareTypeId: stEducation.id, monthlyCommittedAmount: 15 },
        ],
      },
      address: {
        create: { city: 'Metropolis', subCity: 'Downtown', wereda: '01' },
      },
      emergencyContact: {
        create: { name: 'Jane Doe', phone: '555-0101' },
      },
    },
  });

  const member2 = await prisma.member.create({
    data: {
      fullName: 'Jane Smith',
      email: 'jane.smith@example.com',
      sex: 'Female',
      phoneNumber: '0922334455',
      schoolId: school2.id,
      joinDate: new Date(2023, 2, 10),
      savingsBalance: 800.00,
      savingsAccountNumber: 'SA00002',
      sharesCount: 30,
      savingAccountTypeId: satYouth.id,
      expectedMonthlySaving: 25,
      shareCommitments: {
        create: [
          { shareTypeId: stRegular.id, monthlyCommittedAmount: 25 },
        ],
      },
      address: {
        create: { city: 'Star City', subCity: 'Old Town', wereda: '05' },
      },
      emergencyContact: {
        create: { name: 'John Smith', phone: '555-0102' },
      },
    },
  });

  // 6. Seed Transactions
  console.log('Seeding transactions...');
  await prisma.saving.createMany({
    data: [
      { memberId: member1.id, amount: 100.00, date: new Date(2024, 0, 15), transactionType: 'deposit', status: 'approved', depositMode: 'Bank', month: 'January 2024' },
      { memberId: member2.id, amount: 75.00, date: new Date(2024, 0, 20), transactionType: 'deposit', status: 'approved', depositMode: 'Cash', month: 'January 2024' },
      { memberId: member1.id, amount: 50.00, date: new Date(2024, 2, 5), transactionType: 'withdrawal', status: 'approved', month: 'March 2024' },
      { memberId: member2.id, amount: 25.00, date: new Date(), transactionType: 'deposit', status: 'pending', depositMode: 'Cash', month: 'July 2024' },
    ],
  });

  await prisma.share.createMany({
    data: [
      { memberId: member1.id, shareTypeId: stRegular.id, count: 50, allocationDate: new Date(2023, 6, 1), valuePerShare: 10, status: 'approved', contributionAmount: 500 },
      { memberId: member1.id, shareTypeId: stEducation.id, count: 20, allocationDate: new Date(2023, 8, 1), valuePerShare: 15, status: 'approved', contributionAmount: 300 },
      { memberId: member2.id, shareTypeId: stRegular.id, count: 30, allocationDate: new Date(2023, 6, 1), valuePerShare: 10, status: 'approved', contributionAmount: 300 },
    ],
  });

  const loan1 = await prisma.loan.create({
    data: {
      memberId: member1.id,
      loanTypeId: ltEmergency.id,
      principalAmount: 1000,
      disbursementDate: new Date(2024, 0, 20),
      status: 'active',
      remainingBalance: 800,
      nextDueDate: new Date(2024, 4, 20),
      loanAccountNumber: 'LN001',
      interestRate: ltEmergency.interestRate,
      loanTerm: ltEmergency.loanTerm,
      repaymentFrequency: ltEmergency.repaymentFrequency,
      collaterals: {
        create: [{
          fullName: 'Guarantor Person',
          organization: {
            create: {
              name: 'Secure Inc.',
              address: '1 Secure Plaza',
              phone: '555-555-1234'
            },
          },
          address: {
            create: {
              city: 'Metropolis',
              subCity: 'Downtown',
              wereda: '01'
            },
          },
        }],
      },
    },
  });

  await prisma.loanRepayment.create({
    data: {
      loanId: loan1.id,
      amountPaid: 200,
      paymentDate: new Date(2024, 2, 20),
      notes: 'Initial repayment.',
      memberId: loan1.memberId,
    },
  });

  await prisma.appliedServiceCharge.createMany({
    data: [
      { memberId: member1.id, serviceChargeTypeId: sctAnnual.id, amountCharged: 20, dateApplied: new Date(2024, 0, 1), status: 'paid' },
      { memberId: member2.id, serviceChargeTypeId: sctLatePay.id, amountCharged: 5, dateApplied: new Date(2024, 2, 15), status: 'pending' },
    ],
  });

  await prisma.dividend.createMany({
    data: [
      { memberId: member1.id, amount: 25.00, distributionDate: new Date(2023, 11, 31), shareCountAtDistribution: 70, status: 'approved' },
      { memberId: member2.id, amount: 15.00, distributionDate: new Date(2023, 11, 31), shareCountAtDistribution: 30, status: 'approved' },
    ],
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
