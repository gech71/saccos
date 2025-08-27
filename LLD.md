
# Low-Level Design (LLD): AcademInvest Saccos Management System

## 1. Introduction

This document provides a detailed design for key modules within the AcademInvest system. It elaborates on the high-level design by specifying function signatures, data structures, and implementation logic for critical user flows.

## 2. Module: Member Management

### 2.1 Data Structures
-   **`MemberWithDetails` (Type):** Defined in `src/app/(app)/members/actions.ts`. This structure includes the base `Member` model along with relations like `school`, `memberSavingAccounts`, and `totalSavingsBalance`.

### 2.2 Key Functions (`src/app/(app)/members/actions.ts`)

-   **`getMembersPageData(): Promise<MembersPageData>`**
    -   **Logic:** Concurrently fetches all members with their related school and account data, all schools, and all share/saving/service charge types.
    -   Calculates `totalSavingsBalance` for each member by summing balances from their saving accounts.
    -   Returns a consolidated object `MembersPageData` for the client page.

-   **`addMember(data: MemberInput): Promise<{ member: Member }>`**
    -   **Input:** `MemberInput` object containing all form data.
    -   **Logic:**
        1.  Validates input data (e.g., email format, phone format).
        2.  Checks for existing member by ID and email to prevent duplicates.
        3.  Hashes the temporary password using `bcryptjs`.
        4.  Uses `prisma.member.create` within a transaction to create the `Member` record and its nested relations (`Address`, `EmergencyContact`, `MemberShareCommitment`, `AppliedServiceCharge`).
        5.  Creates a `SchoolHistory` record.
    -   **Output:** The newly created member object.

-   **`updateMember(id: string, data: MemberInput): Promise<Member>`**
    -   **Logic:** Similar to `addMember`, but uses `prisma.member.update`. It includes `upsert` logic for address/contact and calculates which share commitments to add or remove.

## 3. Module: Loan Application & Repayment

### 3.1 Data Structures
-   **`LoanWithDetails` (Type):** Defined in `src/app/(app)/loans/actions.ts`. Includes the `Loan` model plus related `guarantors`, `collaterals`, `memberName`, and `loanTypeName`.
-   **`LoanInput` (Type):** A detailed structure for the new loan application form, including nested `collaterals`.

### 3.2 Key Functions

-   **`addLoan(data: LoanInput): Promise<Loan>` (`src/app/(app)/loans/actions.ts`)**
    -   **Logic:**
        1.  Fetches the selected `LoanType` and `Member` to perform validation.
        2.  **Validation Gauntlet:**
            -   Checks `principalAmount` against loan type's `min/max`.
            -   Checks `loanTerm` against loan type's `min/max`.
            -   Validates guarantors (e.g., cannot guarantee more than 2 active loans).
            -   Validates collateral logic (e.g., title deed required over X amount).
            -   Validates member eligibility (e.g., minimum saving months).
        3.  Calculates `insuranceFee` and `serviceFee` based on `LoanType` rules.
        4.  Calculates the estimated first month's repayment amount.
        5.  Uses `prisma.loan.create` to save the loan and create related `Collateral` and `LoanGuarantor` records.

-   **`addLoanRepayment(data: LoanRepaymentInput): Promise<{...}>` (`src/app/(app)/loan-repayments/actions.ts`)**
    -   **Logic:**
        1.  Executes within a `prisma.$transaction`.
        2.  Fetches the current `Loan` state to get `remainingBalance` and `interestRate`.
        3.  Calculates `interestForMonth` on the current remaining balance.
        4.  Allocates the `amountPaid`: `interestPaid` is covered first, the rest is `principalPaid`.
        5.  Creates a `LoanRepayment` record with the detailed allocation.
        6.  Updates the `Loan` record, decrementing `remainingBalance` by `principalPaid`.
        7.  If `remainingBalance` is <= 0, updates the loan `status` to `paid_off`.

## 4. Module: Transaction Approval

### 4.1 Data Structures
-   **`PendingTransaction` (Type):** Defined in `src/app/(app)/approve-transactions/actions.ts`. A union type that normalizes `Saving`, `SharePayment`, `Dividend`, and `Loan` records into a common shape for display in the approval table. Includes a `transactionTypeLabel` and `transactionCategory`.

### 4.2 Key Functions (`src/app/(app)/approve-transactions/actions.ts`)

-   **`getPendingTransactions(): Promise<PendingTransaction[]>`**
    -   **Logic:** Concurrently fetches all records with a `status` of `'pending'` from the `Saving`, `SharePayment`, `Dividend`, and `Loan` tables.
    -   Maps each list to the `PendingTransaction` format.
    -   Merges and sorts all transactions by date.

-   **`approveTransaction(txId: string, txType: string): Promise<{...}>`**
    -   **Logic:**
        1.  Uses a `prisma.$transaction` to ensure atomicity.
        2.  Uses a `switch` or `if/else if` block on `txType`.
        3.  **For Savings:** Updates `Saving` status to `'approved'`. Updates the `MemberSavingAccount` `balance`.
        4.  **For Share Payments:** Updates `SharePayment` status to `'approved'`. Increments `amountPaid` on the parent `MemberShareCommitment`. Checks if the commitment is now fully paid and updates its status to `PAID_OFF`.
        5.  **For Loans:** Updates `Loan` status to `'active'`. Calculates and sets the `nextDueDate`.
        6.  After the transaction, calls `revalidatePath` for all relevant pages.

-   **`rejectTransaction(txId: string, txType: string, reason: string): Promise<{...}>`**
    -   **Logic:** Finds the correct transaction based on `txType` and updates its `status` to `'rejected'` and saves the `reason`.

## 5. UI Component Design: Member Profile Page

-   **File:** `src/app/member-profile/[memberId]/page.tsx`
-   **Data Fetching:** On component mount, calls the `getMemberDetails(memberId)` server action.
-   **State Management:**
    -   `useState<MemberDetails | null>(null)` to hold the fetched data.
    -   `useState<boolean>(true)` for the initial loading state.
    -   `useState` for transaction filters (type and date range).
    -   `useState` for pagination of the savings transaction table.
-   **Component Breakdown:**
    -   **`MemberProfilePage`:** Main component, orchestrates data fetching and state.
    -   **`SectionCard`:** A reusable component for consistent section styling (e.g., "Savings Accounts", "Loan History").
    -   **`StatInfo`:** A small reusable component for displaying a label and value with an icon.
    -   **`Tabs` (ShadCN):** Used to organize the different sections (Overview, Savings, Loans, etc.).
    -   **`Table` (ShadCN):** Used within each tab to display lists of records.
    -   **Pagination Logic:**
        -   The `filteredTransactions` memoized value applies date and type filters.
        -   The `paginatedTransactions` memoized value slices the filtered array based on `currentPage` and `rowsPerPage`.
        -   "Previous" and "Next" buttons update the `currentPage` state.
