-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactPerson" TEXT,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "salary" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "closureDate" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "subCity" TEXT NOT NULL,
    "wereda" TEXT NOT NULL,
    "kebele" TEXT,
    "houseNumber" TEXT,
    "memberId" TEXT,
    "collateralId" TEXT,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolHistory" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "SchoolHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingAccountType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "contributionType" TEXT NOT NULL DEFAULT 'FIXED',
    "contributionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SavingAccountType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberSavingAccount" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "savingAccountTypeId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedMonthlySaving" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberSavingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Saving" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberSavingAccountId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "month" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "depositMode" TEXT,
    "sourceName" TEXT,
    "transactionReference" TEXT,
    "evidenceUrl" TEXT,
    "userId" TEXT,

    CONSTRAINT "Saving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "paymentType" TEXT NOT NULL DEFAULT 'ONCE',
    "numberOfInstallments" INTEGER,
    "monthlyPayment" DOUBLE PRECISION,

    CONSTRAINT "ShareType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberShareCommitment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shareTypeId" TEXT NOT NULL,
    "totalCommittedAmount" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberShareCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharePayment" (
    "id" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "depositMode" TEXT,
    "sourceName" TEXT,
    "transactionReference" TEXT,
    "evidenceUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "SharePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "distributionDate" TIMESTAMP(3) NOT NULL,
    "shareCountAtDistribution" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "userId" TEXT,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "minLoanAmount" DOUBLE PRECISION NOT NULL,
    "maxLoanAmount" DOUBLE PRECISION NOT NULL,
    "minRepaymentPeriod" INTEGER NOT NULL,
    "maxRepaymentPeriod" INTEGER NOT NULL,
    "repaymentFrequency" TEXT NOT NULL,
    "nplInterestRate" DOUBLE PRECISION NOT NULL,
    "nplGracePeriodDays" INTEGER NOT NULL,
    "allowConcurrent" BOOLEAN NOT NULL DEFAULT false,
    "serviceFee" DOUBLE PRECISION,
    "insuranceFeePercentage" DOUBLE PRECISION,
    "collateralLogic" TEXT,
    "collateralThresholdAmount" DOUBLE PRECISION,
    "minSavingMonths" INTEGER,
    "minSavingBalance" DOUBLE PRECISION,
    "purposes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "LoanType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "loanAccountNumber" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "loanTypeId" TEXT NOT NULL,
    "principalAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "loanTerm" INTEGER NOT NULL,
    "repaymentFrequency" TEXT NOT NULL,
    "disbursementDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "remainingBalance" DOUBLE PRECISION NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "monthlyRepaymentAmount" DOUBLE PRECISION,
    "serviceFee" DOUBLE PRECISION,
    "insuranceFee" DOUBLE PRECISION,
    "purpose" TEXT,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanGuarantor" (
    "loanId" TEXT NOT NULL,
    "guarantorId" TEXT NOT NULL,

    CONSTRAINT "LoanGuarantor_pkey" PRIMARY KEY ("loanId","guarantorId")
);

-- CreateTable
CREATE TABLE "Collateral" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "documentUrl" TEXT,
    "loanId" TEXT NOT NULL,

    CONSTRAINT "Collateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "depositMode" TEXT,
    "sourceName" TEXT,
    "transactionReference" TEXT,
    "evidenceUrl" TEXT,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceChargeType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL,

    CONSTRAINT "ServiceChargeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppliedServiceCharge" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "serviceChargeTypeId" TEXT NOT NULL,
    "amountCharged" DOUBLE PRECISION NOT NULL,
    "dateApplied" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "AppliedServiceCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_userId_key" ON "Member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_memberId_key" ON "Address"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_collateralId_key" ON "Address"("collateralId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyContact_memberId_key" ON "EmergencyContact"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberSavingAccount_accountNumber_key" ON "MemberSavingAccount"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanAccountNumber_key" ON "Loan"("loanAccountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "_UserRoles_AB_unique" ON "_UserRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_UserRoles_B_index" ON "_UserRoles"("B");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_collateralId_fkey" FOREIGN KEY ("collateralId") REFERENCES "Collateral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolHistory" ADD CONSTRAINT "SchoolHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolHistory" ADD CONSTRAINT "SchoolHistory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSavingAccount" ADD CONSTRAINT "MemberSavingAccount_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSavingAccount" ADD CONSTRAINT "MemberSavingAccount_savingAccountTypeId_fkey" FOREIGN KEY ("savingAccountTypeId") REFERENCES "SavingAccountType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saving" ADD CONSTRAINT "Saving_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saving" ADD CONSTRAINT "Saving_memberSavingAccountId_fkey" FOREIGN KEY ("memberSavingAccountId") REFERENCES "MemberSavingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saving" ADD CONSTRAINT "Saving_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberShareCommitment" ADD CONSTRAINT "MemberShareCommitment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberShareCommitment" ADD CONSTRAINT "MemberShareCommitment_shareTypeId_fkey" FOREIGN KEY ("shareTypeId") REFERENCES "ShareType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharePayment" ADD CONSTRAINT "SharePayment_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "MemberShareCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanGuarantor" ADD CONSTRAINT "LoanGuarantor_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanGuarantor" ADD CONSTRAINT "LoanGuarantor_guarantorId_fkey" FOREIGN KEY ("guarantorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collateral" ADD CONSTRAINT "Collateral_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedServiceCharge" ADD CONSTRAINT "AppliedServiceCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedServiceCharge" ADD CONSTRAINT "AppliedServiceCharge_serviceChargeTypeId_fkey" FOREIGN KEY ("serviceChargeTypeId") REFERENCES "ServiceChargeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserRoles" ADD CONSTRAINT "_UserRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserRoles" ADD CONSTRAINT "_UserRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
