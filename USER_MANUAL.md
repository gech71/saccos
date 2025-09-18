# AcademInvest Saccos Management System - User Manual

## 1. Introduction

Welcome to the AcademInvest Saccos Management System. This manual provides a comprehensive guide for **Visitors**, **Admin/Staff** users, and **Members** to effectively use the platform.

---

## 2. For Public Visitors

Anyone can visit the AcademInvest public website without needing an account. The public site provides:
-   **General Information:** Learn about the Saccos, its mission, and the services it offers.
-   **News & Updates:** Stay informed about the latest news and announcements.
-   **Contact Details:** Find information on how to get in touch with the Saccos.

---

## 3. For Members

As a member, you have access to your personal financial dashboard, allowing you to monitor your savings, loans, and shares.

### 3.1 First-Time Login & Password Change
-   **Login:** Use your registered phone number and the temporary password provided to you.
-   **Password Change:** Upon your first login, the system will require you to change your temporary password to a new, secure password of your choosing. This is a mandatory security step.

### 3.2 Member Profile Page
Once logged in, you will be directed to your Member Profile page. This page is your central hub and is organized into several tabs:
-   **Overview:** A summary of your key financial information, including total savings balance, active loan balance, and total shares paid.
-   **Savings:** View a detailed history of all your savings deposits and withdrawals. You can filter your transaction history by date to generate an account statement.
-   **Loans:** See a complete history of your loans, including principal amounts, remaining balances, and repayment schedules.
-   **Shares:** Track your share commitments and view a history of all payments made.
-   **Dividends:** View a history of all dividend payouts you have received.

---

## 4. For Admins/Staff

As an Admin or Staff member, you have access to the full suite of management tools to run the Saccos operations smoothly.

### 4.1 Dashboard
The dashboard provides a high-level overview of the Saccos's health, including:
-   Total Members, Total Savings, Total Loan Principal.
-   Monthly savings trends and school performance charts.

### 4.2 Member Management
-   **Location:** `Basic Information > Members`
-   **Create:** Click the "Add Member" button to open a form where you can input all personal, contact, and financial details for a new member. You can also subscribe them to initial shares and apply registration fees here.
-   **View/Update:** The main table lists all members. You can search by name/ID or filter by school. Click the actions menu on any member's row to edit their details or transfer them to another school.
-   **Import:** Use the "Import Members" feature to bulk-upload new members from a pre-formatted Excel file.

### 4.3 Financial Transactions: A Detailed Walkthrough

This section provides step-by-step instructions for common financial workflows. The core principle is that most transactions are a two-step process: **Recording** and **Approval**.

#### Step 1: Recording a Transaction

First, you record the transaction that has occurred (e.g., a member makes a cash deposit). This creates a `pending` record in the system.

#### Step 2: Approving the Transaction

Next, a user with approval permissions (or a different user, for checks and balances) reviews the `pending` transaction and either **approves** or **rejects** it. Once approved, the member's account balances are updated.

---

#### 4.3.1 Workflow: Managing Member Savings

**A. Creating a New Savings Account for a Member**

Before a member can save, they need a saving account.

1.  **Navigate:** Go to `Basic Information > Add Saving Account`.
2.  **Select Member:** Choose the member from the dropdown list.
3.  **Select Account Type:** Choose the type of savings account (e.g., "Regular Savings"). The "Expected Monthly Saving" will be calculated automatically based on the account type's rules.
4.  **Enter Initial Balance:** If the member is opening the account with an initial deposit, enter the amount in the "Initial Savings Balance" field. Otherwise, leave it at 0.
5.  **Create Account:** Click the "Create Account" button. The account is now active and ready for transactions.

**B. Recording a Savings Deposit**

1.  **Navigate:** Go to `Savings > Savings Transactions`.
2.  **Add Transaction:** Click the "Add Transaction" button.
3.  **Select Member & Account:** Choose the member and then select their specific savings account from the dropdowns.
4.  **Set Transaction Type:** Ensure "Deposit" is selected.
5.  **Enter Details:** Fill in the deposit amount, date, and payment method (e.g., Cash, Bank). If using Bank or Wallet, provide the transaction reference.
6.  **Submit:** Click "Submit for Approval". The transaction is now in the approval queue.

**C. Recording a Savings Withdrawal**

1.  **Navigate:** Go to `Savings > Savings Transactions`.
2.  **Add Transaction:** Click "Add Transaction".
3.  **Select Member & Account:** Choose the member and their account. The current balance will be shown for reference.
4.  **Set Transaction Type:** Select "Withdrawal".
5.  **Enter Amount:** Enter the amount to be withdrawn. You cannot withdraw more than the account's balance.
6.  **Submit:** Click "Submit for Approval".

---

#### 4.3.2 Workflow: Managing Loans

**A. Creating a New Loan Application**

1.  **Navigate:** Go to `Loans > Loans`.
2.  **New Application:** Click the "New Loan Application" button.
3.  **Select Member & Loan Type:** Choose the member and the type of loan they are applying for. The form will dynamically show rules and limits based on the selected loan type.
4.  **Enter Loan Details:** Input the `Principal Amount` and `Repayment Period (Months)`. The system will validate these against the loan type's rules.
5.  **Add Collateral:**
    *   **Guarantors:** Select eligible members from the dropdown to add as guarantors.
    *   **Title Deeds:** If required, use the "Add Title Deed" button to upload the document and provide a description.
6.  **Submit:** Review the estimated repayment details and click "Submit Application". The loan is now pending approval.

**B. Approving a Loan to Make it Active**

1.  **Navigate:** Go to `Administration > Approve Transactions`.
2.  **Find Loan:** Locate the pending loan application in the table. It will be labeled "Loan Application".
3.  **Approve:** Review the details and click the "Approve" button.
4.  **Result:** The loan's status changes from `pending` to `active`. The principal amount is now considered disbursed, and it will appear in the member's loan history.

**C. Recording a Loan Repayment**

1.  **Navigate:** Go to `Loans > Loan Repayments`.
2.  **Record Repayment:** Click "Record Repayment".
3.  **Select Loan:** Choose the member's active loan from the dropdown. The system will display the minimum payment and the final settlement amount for that period.
4.  **Enter Amount:** Input the amount the member has paid. The system will automatically calculate how much goes to interest and how much to principal.
5.  **Enter Details:** Fill in the payment date and method.
6.  **Submit:** Click "Submit for Approval".

---

#### 4.3.3 Workflow: The Approval Process

All recorded financial transactions must be approved to take effect.

1.  **Navigate:** Go to `Administration > Approve Transactions`. This page shows a consolidated list of all pending transactions.
2.  **Review:** Examine each transaction's details: the member, the type, and the amount.
3.  **Take Action:**
    *   **Approve:** Click the "Approve" button to confirm a single transaction. Its status will change to `approved`, and the relevant account balances (savings, loan balance, etc.) will be updated.
    *   **Reject:** Click the "Reject" button. You will be prompted to provide a reason for the rejection. The transaction status will change to `rejected`, and no balances will be affected.
    *   **Bulk Actions:** Select multiple transactions using the checkboxes and use the "Approve (x)" or "Reject (x)" buttons at the top of the table to process them in a batch.

---

### 4.4 Aggregate Collections
-   **Location:** `Administration > Aggregate Collections`
-   This powerful feature allows for bulk data entry for an entire school for a specific month.
-   **How to Use:**
    1.  Select a school and the collection month/year.
    2.  Click "Load Data". The system will generate a table with all members of that school and pre-fill it with their *expected* monthly contributions for savings, shares, and loan repayments.
    3.  You can either edit the values directly on the screen or **Export** the sheet to Excel.
    4.  Fill out the collected amounts in the Excel file and then use the **Import from Excel** tab to upload it. The system will validate the file and show a preview.
    5.  Once you submit, the system creates individual pending transactions for each entry, ready for approval.

### 4.5 System Configuration
-   **Location:** `Configuration` section in the sidebar.
-   This is where you define the financial products of the Saccos.
-   You can create, edit, or delete types for:
    -   **Saving Account Types:** (e.g., Regular, Youth, with different interest rates).
    -   **Loan Types:** (e.g., Emergency, Education, with specific rules for amounts, terms, and collateral).
    -   **Share Types:** (e.g., Membership, Project).
    -   **Service Charge Types:** (e.g., Annual Fee, Loan Processing Fee).
-   **Note:** You cannot delete a type if it is currently being used by any member or transaction to maintain data integrity.

### 4.6 Reports & Calculations
-   **Interest Calculation:** Navigate to `Calculate Savings Interest` or `Calculate Loan Interest` to run calculations for a specific period and scope. The system will show a preview, and you can then post the calculated amounts as pending transactions for approval.
-   **Account Statement:** Generate a detailed PDF statement for any member's savings account for a specific date range.
-   **Reports:** The `Reports` page allows you to generate and export various financial reports in Excel format.

### 4.7 Website Management
-   **Location:** `Website Management` section in the sidebar.
-   **Website Settings:** From here, you can update the content that appears on the public-facing website. This includes:
    -   The SACCO's name and logo.
    -   The main title, subtitle, and background image for the homepage hero section.
    -   The "About Us" text and image.
    -   Contact details like address, phone, and email.
    -   Social media links.
-   **Manage News:** Create, edit, publish, and delete news posts that will be displayed on the website's "News" page.

### 4.8 User & Role Management
-   **Location:** `Administration > Settings`
-   **Users Tab:** View all admin/staff users. You can register a new user or manage the roles of an existing user.
-   **Roles Tab:** Create or edit roles. For each role, you can assign granular permissions that control what actions a user with that role can perform.