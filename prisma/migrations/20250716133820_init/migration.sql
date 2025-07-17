-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "salary" DOUBLE PRECISION,
    "schoolId" TEXT NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "savingsBalance" DOUBLE PRECISION NOT NULL,
    "savingsAccountNumber" TEXT,
    "sharesCount" INTEGER NOT NULL,
    "savingAccountTypeId" TEXT,
    "expectedMonthlySaving" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "closureDate" TIMESTAMP(3),

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "subCity" TEXT,
    "wereda" TEXT,
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
CREATE TABLE "SavingAccountType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "contributionType" TEXT NOT NULL,
    "contributionValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SavingAccountType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "valuePerShare" DOUBLE PRECISION NOT NULL,
    "expectedMonthlyContribution" DOUBLE PRECISION,

    CONSTRAINT "ShareType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberShareCommitment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shareTypeId" TEXT NOT NULL,
    "monthlyCommittedAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MemberShareCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Saving" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
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

    CONSTRAINT "Saving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shareTypeId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL,
    "valuePerShare" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "contributionAmount" DOUBLE PRECISION,
    "totalValueForAllocation" DOUBLE PRECISION,
    "depositMode" TEXT,
    "sourceName" TEXT,
    "transactionReference" TEXT,
    "evidenceUrl" TEXT,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "loanTerm" INTEGER NOT NULL,
    "repaymentFrequency" TEXT NOT NULL,
    "nplInterestRate" DOUBLE PRECISION NOT NULL,
    "nplGracePeriodDays" INTEGER,
    "allowConcurrent" BOOLEAN,

    CONSTRAINT "LoanType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "loanAccountNumber" TEXT,
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

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "depositMode" TEXT,
    "sourceName" TEXT,
    "transactionReference" TEXT,
    "evidenceUrl" TEXT,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collateral" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "organizationId" TEXT,
    "addressId" TEXT,

    CONSTRAINT "Collateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_BuildingToUser" (
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
CREATE UNIQUE INDEX "Member_savingsAccountNumber_key" ON "Member"("savingsAccountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Address_memberId_key" ON "Address"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_collateralId_key" ON "Address"("collateralId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyContact_memberId_key" ON "EmergencyContact"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "SavingAccountType_name_key" ON "SavingAccountType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ShareType_name_key" ON "ShareType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MemberShareCommitment_memberId_shareTypeId_key" ON "MemberShareCommitment"("memberId", "shareTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanType_name_key" ON "LoanType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanAccountNumber_key" ON "Loan"("loanAccountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Collateral_organizationId_key" ON "Collateral"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Collateral_addressId_key" ON "Collateral"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceChargeType_name_key" ON "ServiceChargeType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BuildingToUser_AB_unique" ON "_BuildingToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_BuildingToUser_B_index" ON "_BuildingToUser"("B");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_savingAccountTypeId_fkey" FOREIGN KEY ("savingAccountTypeId") REFERENCES "SavingAccountType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_collateralId_fkey" FOREIGN KEY ("collateralId") REFERENCES "Collateral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberShareCommitment" ADD CONSTRAINT "MemberShareCommitment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberShareCommitment" ADD CONSTRAINT "MemberShareCommitment_shareTypeId_fkey" FOREIGN KEY ("shareTypeId") REFERENCES "ShareType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saving" ADD CONSTRAINT "Saving_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_shareTypeId_fkey" FOREIGN KEY ("shareTypeId") REFERENCES "ShareType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Collateral" ADD CONSTRAINT "Collateral_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collateral" ADD CONSTRAINT "Collateral_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedServiceCharge" ADD CONSTRAINT "AppliedServiceCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedServiceCharge" ADD CONSTRAINT "AppliedServiceCharge_serviceChargeTypeId_fkey" FOREIGN KEY ("serviceChargeTypeId") REFERENCES "ServiceChargeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuildingToUser" ADD CONSTRAINT "_BuildingToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuildingToUser" ADD CONSTRAINT "_BuildingToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
