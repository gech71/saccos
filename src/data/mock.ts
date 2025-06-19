import type { School, Member, Saving, Share, Dividend, ShareType } from '@/types';

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
    sharesCount: 125, // This would be total count from mockShares
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 50 },
      { shareTypeId: 'st-education', shareTypeName: 'Educational Support Share', monthlyCommittedAmount: 20 },
    ],
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
    sharesCount: 80,
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 75 },
    ],
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
    sharesCount: 210,
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 100 },
      { shareTypeId: 'st-emergency', shareTypeName: 'Emergency Fund Share', monthlyCommittedAmount: 25 },
    ],
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
    sharesCount: 150,
    shareCommitments: [
      { shareTypeId: 'st-regular', shareTypeName: 'Regular Share', monthlyCommittedAmount: 60 },
    ],
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
  },
  {
    id: 'saving-2',
    memberId: 'member-2',
    memberName: 'Jane Smith',
    amount: 75.00,
    date: new Date(2024, 0, 20).toISOString(),
    month: 'January 2024',
    transactionType: 'deposit',
  },
  {
    id: 'saving-3',
    memberId: 'member-1',
    memberName: 'John Doe',
    amount: 120.00,
    date: new Date(2024, 1, 15).toISOString(),
    month: 'February 2024',
    transactionType: 'deposit',
  },
  {
    id: 'saving-4',
    memberId: 'member-3',
    memberName: 'Mike Johnson',
    amount: 200.00,
    date: new Date(2024, 1, 18).toISOString(),
    month: 'February 2024',
    transactionType: 'deposit',
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
    valuePerShare: 10.00, // From st-regular
  },
  {
    id: 'share-2',
    memberId: 'member-2',
    memberName: 'Jane Smith',
    shareTypeId: 'st-regular',
    shareTypeName: 'Regular Share',
    count: 30,
    allocationDate: new Date(2023, 6, 1).toISOString(),
    valuePerShare: 10.00, // From st-regular
  },
  {
    id: 'share-3',
    memberId: 'member-1',
    memberName: 'John Doe',
    shareTypeId: 'st-education',
    shareTypeName: 'Educational Support Share',
    count: 20,
    allocationDate: new Date(2023, 8, 1).toISOString(),
    valuePerShare: 15.00, // From st-education
  },
];

export const mockDividends: Dividend[] = [
  {
    id: 'dividend-1',
    memberId: 'member-1',
    memberName: 'John Doe',
    amount: 25.00, // This amount might need to be re-evaluated based on share types
    distributionDate: new Date(2023, 11, 31).toISOString(),
    shareCountAtDistribution: 70, // Total shares for John (50 regular + 20 education)
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
