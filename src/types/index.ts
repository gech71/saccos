

export interface School {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
}

export interface ShareType {
  id: string;
  name: string;
  description?: string;
  valuePerShare: number;
  expectedMonthlyContribution?: number;
}

export interface SavingAccountType {
  id: string;
  name: string;
  interestRate: number; // Store as decimal, e.g., 0.05 for 5%
  description?: string;
  expectedMonthlyContribution?: number;
}

export interface LoanType {
  id: string;
  name: string;
  description?: string;
  interestRate: number; // Annual interest rate, e.g., 0.08 for 8%
  loanTerm: number; // in months
  repaymentFrequency: 'monthly' | 'quarterly' | 'yearly';
  nplInterestRate: number; // Non-Performing Loan interest rate, annual
  allowConcurrent?: boolean;
}

export interface MemberShareCommitment {
  shareTypeId: string;
  shareTypeName: string; // Denormalized for easier display
  monthlyCommittedAmount: number;
}

export interface Member {
  id: string;
  fullName: string;
  email: string;
  sex: 'Male' | 'Female' | 'Other';
  phoneNumber: string;
  address: {
    city: string;
    subCity: string;
    wereda: string;
  };
  emergencyContact: {
    name: string;
    phone: string;
  };
  schoolId: string;
  schoolName?: string; // Denormalized for display
  joinDate: string; // ISO date string
  savingsBalance: number;
  savingsAccountNumber?: string;
  sharesCount: number; // Total shares across all types for this member - should be sum of all their Share records' counts.
  shareCommitments?: MemberShareCommitment[];
  savingAccountTypeId?: string;
  savingAccountTypeName?: string; // Denormalized for display
  expectedMonthlySaving?: number; 
}

export interface Saving {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  amount: number;
  date: string; // ISO date string
  month: string; // e.g., "January 2024"
  transactionType: 'deposit' | 'withdrawal';
  status: 'pending' | 'approved' | 'rejected';
  notes?: string; // For rejection reasons or other comments
  depositMode?: 'Cash' | 'Bank' | 'Wallet'; // Only applicable for deposits
  paymentDetails?: { // Only applicable for 'Bank' or 'Wallet' deposits
    sourceName?: string; // e.g., Bank Name or Wallet Provider Name
    transactionReference?: string;
    evidenceUrl?: string; // URL to the uploaded evidence (text input for now)
  };
}

export interface Share {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  shareTypeId: string;
  shareTypeName?: string; // Denormalized for display
  count: number; // Number of shares allocated
  allocationDate: string; // ISO date string
  valuePerShare: number; // Value per share at the time of allocation
  status: 'pending' | 'approved' | 'rejected';
  notes?: string; // For rejection reasons or other comments
  contributionAmount?: number; // The monetary amount input by the user for this specific allocation
  totalValueForAllocation?: number; // Actual value of shares allocated (count * valuePerShare)
  depositMode?: 'Cash' | 'Bank' | 'Wallet';
  paymentDetails?: {
    sourceName?: string;
    transactionReference?: string;
    evidenceUrl?: string; 
  };
}

export interface Dividend {
  id:string;
  memberId: string;
  memberName?: string; // Denormalized for display
  amount: number;
  distributionDate: string; // ISO date string
  shareCountAtDistribution: number; // Could be refined to be per share type if dividends vary
  status: 'pending' | 'approved' | 'rejected';
  notes?: string; // For rejection reasons or other comments
}

export interface ServiceChargeType {
  id: string;
  name: string;
  description?: string;
  amount: number;
  frequency: 'once' | 'monthly' | 'yearly'; // Informational for now, auto-application is future scope
}

export interface AppliedServiceCharge {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  serviceChargeTypeId: string;
  serviceChargeTypeName: string; // Denormalized for display
  amountCharged: number;
  dateApplied: string; // ISO date string
  status: 'pending' | 'paid' | 'waived';
  notes?: string;
  // paymentTransactionId?: string; // Future: link to a master payment transaction
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
  roles?: ('admin' | 'member')[];
  memberTitle?: string;
}

export type ReportType = 'savings' | 'share allocations' | 'dividend distributions';
export type VisualizationType = 'bar' | 'pie' | 'line' | 'table';
