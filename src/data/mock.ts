import type { School, Member, Saving, Share, Dividend } from '@/types';

export const mockSchools: School[] = [
  { id: 'school-1', name: 'Greenwood High', address: '123 Oak St', contactPerson: 'Alice Wonderland' },
  { id: 'school-2', name: 'Riverside Academy', address: '456 Pine Ave', contactPerson: 'Bob The Builder' },
  { id: 'school-3', name: 'Mountain View School', address: '789 Maple Dr', contactPerson: 'Charlie Brown' },
];

export const mockMembers: Member[] = [
  {
    id: 'member-1',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    schoolId: 'school-1',
    schoolName: 'Greenwood High',
    joinDate: new Date(2023, 0, 15).toISOString(),
    savingsBalance: 1250.75,
    sharesCount: 125,
  },
  {
    id: 'member-2',
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    schoolId: 'school-2',
    schoolName: 'Riverside Academy',
    joinDate: new Date(2023, 2, 10).toISOString(),
    savingsBalance: 800.00,
    sharesCount: 80,
  },
  {
    id: 'member-3',
    fullName: 'Mike Johnson',
    email: 'mike.johnson@example.com',
    schoolId: 'school-1',
    schoolName: 'Greenwood High',
    joinDate: new Date(2023, 5, 20).toISOString(),
    savingsBalance: 2100.50,
    sharesCount: 210,
  },
  {
    id: 'member-4',
    fullName: 'Sarah Williams',
    email: 'sarah.williams@example.com',
    schoolId: 'school-3',
    schoolName: 'Mountain View School',
    joinDate: new Date(2022, 10, 5).toISOString(),
    savingsBalance: 1500.00,
    sharesCount: 150,
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
    count: 50,
    allocationDate: new Date(2023, 6, 1).toISOString(),
    valuePerShare: 10.00,
  },
  {
    id: 'share-2',
    memberId: 'member-2',
    memberName: 'Jane Smith',
    count: 30,
    allocationDate: new Date(2023, 6, 1).toISOString(),
    valuePerShare: 10.00,
  },
];

export const mockDividends: Dividend[] = [
  {
    id: 'dividend-1',
    memberId: 'member-1',
    memberName: 'John Doe',
    amount: 25.00,
    distributionDate: new Date(2023, 11, 31).toISOString(),
    shareCountAtDistribution: 50,
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
