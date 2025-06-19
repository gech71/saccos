export interface School {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
}

export interface Member {
  id: string;
  fullName: string;
  email: string;
  schoolId: string;
  schoolName?: string; // Denormalized for display
  joinDate: string; // ISO date string
  savingsBalance: number;
  sharesCount: number;
}

export interface Saving {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  amount: number;
  date: string; // ISO date string
  month: string; // e.g., "January 2024"
  transactionType: 'deposit' | 'withdrawal';
}

export interface Share {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  count: number;
  allocationDate: string; // ISO date string
  valuePerShare: number;
}

export interface Dividend {
  id:string;
  memberId: string;
  memberName?: string; // Denormalized for display
  amount: number;
  distributionDate: string; // ISO date string
  shareCountAtDistribution: number;
}

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
  external?: boolean;
  label?: string;
  description?: string;
  active?: boolean;
}

export type ReportType = 'savings' | 'share allocations' | 'dividend distributions';
export type VisualizationType = 'bar' | 'pie' | 'line' | 'table';
