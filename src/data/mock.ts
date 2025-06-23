

import type { School, Member, Saving, Share, Dividend, ShareType, SavingAccountType, MemberShareCommitment, ServiceChargeType, AppliedServiceCharge, LoanType } from '@/types';

export const mockSchools: School[] = [
  { id: 'school-1', name: 'Greenwood High', address: '123 Oak St', contactPerson: 'Alice Wonderland' },
  { id: 'school-2', name: 'Riverside Academy', address: '456 Pine Ave', contactPerson: 'Bob The Builder' },
  { id: 'school-3', name: 'Mountain View School', address: '789 Maple Dr', contactPerson: 'Charlie Brown' },
];

export const mockShareTypes: ShareType[] = [
  { id: 'st-regular', name: 'Regular Share', description: 'Standard membership share.', valuePerShare: 10, expectedMonthlyContribution: 20 },
  { id: 'st-education', name: 'Educational Support Share', description: 'Dedicated to funding educational initiatives.', valuePerShare: 15, expectedMonthlyContribution: 10 },
  { id: 'st-emergency', name: 'Emergency Fund Share', description: 'Contributes to a member emergency fund.', valuePerShare: 5, expectedMonthlyContribution: 0 },
  { id: 'st-project', name: 'Project Specific Share', description: 'Shares for a specific school project.', valuePerShare: 25 }, // No expectedMonthlyContribution
];

export const mockSavingAccountTypes: SavingAccountType[] = [
  { id: 'sat-regular', name: 'Regular Savings', interestRate: 0.02, description: 'Standard savings account with a competitive interest rate.', expectedMonthlyContribution: 50 },
  { id: 'sat-youth', name: 'Youth Saver Account', interestRate: 0.035, description: 'Higher interest account for members under 18.', expectedMonthlyContribution: 25 },
  { id: 'sat-premium', name: 'Premium Tier Savings', interestRate: 0.045, description: 'For members with higher balances, offering premium rates.', expectedMonthlyContribution: 100 },
  { id: 'sat-no-expect', name: 'Flexible Saver', interestRate: 0.01, description: 'Basic account with no minimum contribution expected.', expectedMonthlyContribution: 0 },
];

export const mockLoanTypes: LoanType[] = [
  {
    id: 'lt-emergency',
    name: 'Emergency Loan',
    description: 'Short-term loan for unforeseen emergencies.',
    interestRate: 0.12, // 12%
    loanTerm: 12, // 12 months
    repaymentFrequency: 'monthly',
    nplInterestRate: 0.18, // 18%
    nplGracePeriodDays: 30,
    allowConcurrent: true,
  },
  {
    id: 'lt-school-fees',
    name: 'School Fee Loan',
    description: 'Loan to cover school or tuition fees.',
    interestRate: 0.08, // 8%
    loanTerm: 10, // 10 months
    repaymentFrequency: 'monthly',
    nplInterestRate: 0.15, // 15%
    nplGracePeriodDays: 15,
    allowConcurrent: false,
  },
  {
    id: 'lt-business',
    name: 'Small Business Loan',
    description: 'For starting or expanding a small business.',
    interestRate: 0.10, // 10%
    loanTerm: 24, // 24 months
    repaymentFrequency: 'monthly',
    nplInterestRate: 0.16, // 16%
    nplGracePeriodDays: 45,
    allowConcurrent: false,
  },
];


export const mockMembers: Member[] = [
  {
    id: 'member-1',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    sex: 'Male',
    phoneNumber: '123-456-7890',
    address: { city: 'Greenville', subCity: 'Downtown', wereda: '01' },
    emergencyContact: { name: 'Jane Doe', phone: '111-222-3333' },
    schoolId: 'school-1',
    schoolName: 'Greenwood High',
    joinDate: new Date(2023, 0, 15).toISOString(),
    savingsBalance: 1250.75,
    savingsAccountNumber: 'SA00001',
    sharesCount: 70, // Sum of shares from mockShares below for this member
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 20 },
      { shareTypeId: 'st-education', shareTypeName: 'Educational Support Share', monthlyCommittedAmount: 15 },
    ],
    savingAccountTypeId: 'sat-regular',
    savingAccountTypeName: 'Regular Savings',
    expectedMonthlySaving: 50,
  },
  {
    id: 'member-2',
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    sex: 'Female',
    phoneNumber: '987-654-3210',
    address: { city: 'Rivertown', subCity: 'Riverside', wereda: '02' },
    emergencyContact: { name: 'John Smith', phone: '444-555-6666' },
    schoolId: 'school-2',
    schoolName: 'Riverside Academy',
    joinDate: new Date(2023, 2, 10).toISOString(),
    savingsBalance: 800.00,
    savingsAccountNumber: 'SA00002',
    sharesCount: 30, // Sum of shares from mockShares below for this member
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 25 },
    ],
    savingAccountTypeId: 'sat-youth',
    savingAccountTypeName: 'Youth Saver Account',
    expectedMonthlySaving: 25,
  },
  {
    id: 'member-3',
    fullName: 'Mike Johnson',
    email: 'mike.johnson@example.com',
    sex: 'Male',
    phoneNumber: '555-123-4567',
    address: { city: 'Greenville', subCity: 'Uptown', wereda: '03' },
    emergencyContact: { name: 'Mary Johnson', phone: '777-888-9999' },
    schoolId: 'school-1',
    schoolName: 'Greenwood High',
    joinDate: new Date(2023, 5, 20).toISOString(),
    savingsBalance: 2100.50,
    savingsAccountNumber: 'SA00003',
    sharesCount: 0, // No shares yet for this member
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 20 },
      { shareTypeId: 'st-emergency', shareTypeName: 'Emergency Fund Share', monthlyCommittedAmount: 5 },
    ],
    savingAccountTypeId: 'sat-premium',
    savingAccountTypeName: 'Premium Tier Savings',
    expectedMonthlySaving: 100,
  },
  {
    id: 'member-4',
    fullName: 'Sarah Williams',
    email: 'sarah.williams@example.com',
    sex: 'Female',
    phoneNumber: '222-333-4444',
    address: { city: 'Mountain City', subCity: 'Valley View', wereda: '04' },
    emergencyContact: { name: 'David Williams', phone: '000-111-2222' },
    schoolId: 'school-3',
    schoolName: 'Mountain View School',
    joinDate: new Date(2022, 10, 5).toISOString(),
    savingsBalance: 1500.00,
    savingsAccountNumber: 'SA00004',
    sharesCount: 0, // No shares yet for this member
    shareCommitments: [
      { shareTypeId: 'st-project', shareTypeName: 'Project Specific Share', monthlyCommittedAmount: 30 },
    ],
    savingAccountTypeId: 'sat-no-expect',
    savingAccountTypeName: 'Flexible Saver',
    expectedMonthlySaving: 0,
  },
];

export const mockSavings: Saving[] = [
  {
    id: 'saving-1',
    memberId: 'member-1',
    memberName: 'John Doe',
    amount: 100.00,
    date: new Date(2024, 0, 15).toISOString(),
    month: 'January 2024',
    transactionType: 'deposit',
    status: 'approved',
    depositMode: 'Bank',
    paymentDetails: {
      sourceName: 'Bank of Academ',
      transactionReference: 'TRX12345JAN',
      evidenceUrl: 'http://example.com/receipt1.pdf'
    }
  },
  {
    id: 'saving-2',
    memberId: 'member-2',
    memberName: 'Jane Smith',
    amount: 75.00,
    date: new Date(2024, 0, 20).toISOString(),
    month: 'January 2024',
    transactionType: 'deposit',
    status: 'approved',
    depositMode: 'Cash',
  },
  {
    id: 'saving-3',
    memberId: 'member-1',
    memberName: 'John Doe',
    amount: 120.00,
    date: new Date(2024, 1, 15).toISOString(),
    month: 'February 2024',
    transactionType: 'deposit',
    status: 'approved',
    depositMode: 'Wallet',
    paymentDetails: {
      sourceName: 'AcademPay Wallet',
      transactionReference: 'WALLETFEB001',
      evidenceUrl: 'payment_evidence/feb_john_doe.png'
    }
  },
  {
    id: 'saving-4',
    memberId: 'member-3',
    memberName: 'Mike Johnson',
    amount: 200.00,
    date: new Date(2024, 1, 18).toISOString(),
    month: 'February 2024',
    transactionType: 'deposit',
    status: 'approved',
    depositMode: 'Bank',
    paymentDetails: {
        sourceName: 'Investment Bank Inc.',
        transactionReference: 'INVTRX002FEB',
        evidenceUrl: 'http://example.com/deposit_slip_mj.jpg'
    }
  },
  {
    id: 'saving-5',
    memberId: 'member-1',
    memberName: 'John Doe',
    amount: 50.00,
    date: new Date(2024, 2, 5).toISOString(),
    month: 'March 2024',
    transactionType: 'withdrawal',
    status: 'approved',
  },
  {
    id: 'saving-pending-1',
    memberId: 'member-2',
    memberName: 'Jane Smith',
    amount: 25.00,
    date: new Date(2024, 2, 28).toISOString(),
    month: 'March 2024',
    transactionType: 'deposit',
    status: 'pending',
    depositMode: 'Cash',
  },
  {
    id: 'saving-pending-2',
    memberId: 'member-3',
    memberName: 'Mike Johnson',
    amount: 100.00,
    date: new Date(2024, 2, 29).toISOString(),
    month: 'March 2024',
    transactionType: 'withdrawal',
    status: 'pending',
  },
  {
    id: 'saving-rejected-1',
    memberId: 'member-4',
    memberName: 'Sarah Williams',
    amount: 500.00,
    date: new Date(2024, 2, 20).toISOString(),
    month: 'March 2024',
    transactionType: 'withdrawal',
    status: 'rejected',
    notes: 'Withdrawal amount exceeds member\'s current savings balance.'
  },
];

export const mockShares: Share[] = [
  {
    id: 'share-1',
    memberId: 'member-1',
    memberName: 'John Doe',
    shareTypeId: 'st-regular',
    shareTypeName: 'Regular Share',
    count: 50,
    allocationDate: new Date(2023, 6, 1).toISOString(),
    valuePerShare: 10.00,
    status: 'approved',
    contributionAmount: 500.00,
    totalValueForAllocation: 500.00,
    depositMode: 'Bank',
    paymentDetails: { sourceName: 'Initial Capital Bank', transactionReference: 'ICB001'}
  },
  {
    id: 'share-2',
    memberId: 'member-2',
    memberName: 'Jane Smith',
    shareTypeId: 'st-regular',
    shareTypeName: 'Regular Share',
    count: 30,
    allocationDate: new Date(2023, 6, 1).toISOString(),
    valuePerShare: 10.00,
    status: 'approved',
    contributionAmount: 300.00,
    totalValueForAllocation: 300.00,
    depositMode: 'Cash',
  },
  {
    id: 'share-3',
    memberId: 'member-1',
    memberName: 'John Doe',
    shareTypeId: 'st-education',
    shareTypeName: 'Educational Support Share',
    count: 20,
    allocationDate: new Date(2023, 8, 1).toISOString(),
    valuePerShare: 15.00,
    status: 'approved',
    contributionAmount: 300.00,
    totalValueForAllocation: 300.00,
    depositMode: 'Wallet',
    paymentDetails: { sourceName: 'EduPay Wallet', transactionReference: 'EDUPAY002'}
  },
  {
    id: 'share-pending-1',
    memberId: 'member-3',
    memberName: 'Mike Johnson',
    shareTypeId: 'st-regular',
    shareTypeName: 'Regular Share',
    count: 10,
    allocationDate: new Date(2024, 2, 25).toISOString(),
    valuePerShare: 10.00,
    status: 'pending',
    contributionAmount: 100.00,
    totalValueForAllocation: 100.00,
    depositMode: 'Bank',
    paymentDetails: { sourceName: 'Capital One', transactionReference: 'CO-SHARE-001'}
  },
];

export const mockDividends: Dividend[] = [
  {
    id: 'dividend-1',
    memberId: 'member-1',
    memberName: 'John Doe',
    amount: 25.00,
    distributionDate: new Date(2023, 11, 31).toISOString(),
    shareCountAtDistribution: 70, // sum of shares for member-1
    status: 'approved',
  },
  {
    id: 'dividend-2',
    memberId: 'member-2',
    memberName: 'Jane Smith',
    amount: 15.00,
    distributionDate: new Date(2023, 11, 31).toISOString(),
    shareCountAtDistribution: 30, // sum of shares for member-2
    status: 'approved',
  },
  {
    id: 'dividend-pending-1',
    memberId: 'member-4',
    memberName: 'Sarah Williams',
    amount: 50.00,
    distributionDate: new Date(2024, 2, 30).toISOString(),
    shareCountAtDistribution: 0, // No approved shares for this member yet
    status: 'pending',
    notes: 'Project-based dividend proposal'
  },
];

export const mockServiceChargeTypes: ServiceChargeType[] = [
    { id: 'sc-annual', name: 'Annual Membership Fee', description: 'Standard annual fee for all members.', amount: 20.00, frequency: 'yearly' },
    { id: 'sc-latepay', name: 'Late Payment Penalty', description: 'Penalty for overdue contributions.', amount: 5.00, frequency: 'once' },
    { id: 'sc-idcard', name: 'ID Card Replacement', description: 'Fee for replacing a lost member ID card.', amount: 2.50, frequency: 'once' },
    { id: 'sc-monthly-admin', name: 'Monthly Admin Fee', description: 'Small fee for account maintenance.', amount: 1.00, frequency: 'monthly' },
];

export const mockAppliedServiceCharges: AppliedServiceCharge[] = [
    {
        id: 'asc-1',
        memberId: 'member-1',
        memberName: 'John Doe',
        serviceChargeTypeId: 'sc-annual',
        serviceChargeTypeName: 'Annual Membership Fee',
        amountCharged: 20.00,
        dateApplied: new Date(2024, 0, 1).toISOString(),
        status: 'pending',
        notes: 'Annual fee for 2024',
    },
    {
        id: 'asc-2',
        memberId: 'member-2',
        memberName: 'Jane Smith',
        serviceChargeTypeId: 'sc-latepay',
        serviceChargeTypeName: 'Late Payment Penalty',
        amountCharged: 5.00,
        dateApplied: new Date(2024, 2, 15).toISOString(),
        status: 'pending',
        notes: 'Late payment for Feb 2024 savings.',
    },
     {
        id: 'asc-3',
        memberId: 'member-1',
        memberName: 'John Doe',
        serviceChargeTypeId: 'sc-monthly-admin',
        serviceChargeTypeName: 'Monthly Admin Fee',
        amountCharged: 1.00,
        dateApplied: new Date(2024, 0, 31).toISOString(),
        status: 'paid',
        notes: 'Jan 2024 Admin Fee',
    },
];
