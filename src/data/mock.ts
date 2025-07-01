

import type { School, Member, Saving, Share, Dividend, ShareType, SavingAccountType, MemberShareCommitment, ServiceChargeType, AppliedServiceCharge, LoanType, Loan, LoanRepayment } from '@/types';

export const mockSchools: School[] = [
  { id: 'school-1', name: 'Greenwood High', address: '123 Oak St', contactPerson: 'Alice Wonderland' },
  { id: 'school-2', name: 'Riverside Academy', address: '456 Pine Ave', contactPerson: 'Bob The Builder' },
  { id: 'school-3', name: 'Mountain View School', address: '789 Maple Dr', contactPerson: 'Charlie Brown' },
];

export const mockSubcities: string[] = [
  "Bole",
  "Yeka",
  "Nifas Silk-Lafto",
  "Kirkos",
  "Arada",
  "Gullele",
  "Lideta",
  "Akaky Kaliti",
  "Kolfe Keranio",
  "Lemi Kura",
];

export const mockMembers: Member[] = [
  {
    id: 'member-1',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    sex: 'Male',
    phoneNumber: '123-456-7890',
    address: { city: 'Greenville', subCity: 'Bole', wereda: '01', kebele: '05', houseNumber: '123-A' },
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
    status: 'active',
  },
  {
    id: 'member-2',
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    sex: 'Female',
    phoneNumber: '987-654-3210',
    address: { city: 'Rivertown', subCity: 'Yeka', wereda: '02', kebele: '03', houseNumber: '45-B' },
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
    status: 'active',
  },
  {
    id: 'member-3',
    fullName: 'Mike Johnson',
    email: 'mike.johnson@example.com',
    sex: 'Male',
    phoneNumber: '555-123-4567',
    address: { city: 'Greenville', subCity: 'Nifas Silk-Lafto', wereda: '03', kebele: '01', houseNumber: 'Z-890' },
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
    status: 'active',
  },
  {
    id: 'member-4',
    fullName: 'Sarah Williams',
    email: 'sarah.williams@example.com',
    sex: 'Female',
    phoneNumber: '222-333-4444',
    address: { city: 'Mountain City', subCity: 'Kirkos', wereda: '04', kebele: '12', houseNumber: 'C-Block-1' },
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
    status: 'active',
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
    notes: 'Withdrawal amount exceeds member\\'s current savings balance.'
  },
];
