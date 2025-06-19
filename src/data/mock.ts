
import type { School, Member, Saving, Share, Dividend, ShareType, SavingAccountType } from '@/types';

export const mockSchools: School[] = [
  { id: 'school-1', name: 'Greenwood High', address: '123 Oak St', contactPerson: 'Alice Wonderland' },
  { id: 'school-2', name: 'Riverside Academy', address: '456 Pine Ave', contactPerson: 'Bob The Builder' },
  { id: 'school-3', name: 'Mountain View School', address: '789 Maple Dr', contactPerson: 'Charlie Brown' },
];

export const mockShareTypes: ShareType[] = [
  { id: 'st-regular', name: 'Regular Share', description: 'Standard membership share.', valuePerShare: 10 },
  { id: 'st-education', name: 'Educational Support Share', description: 'Dedicated to funding educational initiatives.', valuePerShare: 15 },
  { id: 'st-emergency', name: 'Emergency Fund Share', description: 'Contributes to a member emergency fund.', valuePerShare: 5 },
];

export const mockSavingAccountTypes: SavingAccountType[] = [
  { id: 'sat-regular', name: 'Regular Savings', interestRate: 0.02, description: 'Standard savings account with a competitive interest rate.' },
  { id: 'sat-youth', name: 'Youth Saver Account', interestRate: 0.035, description: 'Higher interest account for members under 18.' },
  { id: 'sat-premium', name: 'Premium Tier Savings', interestRate: 0.045, description: 'For members with higher balances, offering premium rates.' },
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
    sharesCount: 125,
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 50 },
      { shareTypeId: 'st-education', shareTypeName: 'Educational Support Share', monthlyCommittedAmount: 20 },
    ],
    savingAccountTypeId: 'sat-regular',
    savingAccountTypeName: 'Regular Savings',
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
    sharesCount: 80,
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 75 },
    ],
    savingAccountTypeId: 'sat-youth',
    savingAccountTypeName: 'Youth Saver Account',
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
    sharesCount: 210,
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 100 },
      { shareTypeId: 'st-emergency', shareTypeName: 'Emergency Fund Share', monthlyCommittedAmount: 25 },
    ],
    savingAccountTypeId: 'sat-premium',
    savingAccountTypeName: 'Premium Tier Savings',
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
    sharesCount: 150,
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 60 },
    ],
    savingAccountTypeId: 'sat-regular',
    savingAccountTypeName: 'Regular Savings',
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
  },
];

export const mockDividends: Dividend[] = [
  {
    id: 'dividend-1',
    memberId: 'member-1',
    memberName: 'John Doe',
    amount: 25.00,
    distributionDate: new Date(2023, 11, 31).toISOString(),
    shareCountAtDistribution: 70,
  },
  {
    id: 'dividend-2',
    memberId: 'member-2',
    memberName: 'Jane Smith',
    amount: 15.00,
    distributionDate: new Date(2023, 11, 31).toISOString(),
    shareCountAtDistribution: 30,
  },
];

