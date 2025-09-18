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

### 4.3 Financial Transactions

#### 4.3.1 Transaction Approval
-   **Location:** `Administration > Approve Transactions`
-   All financial transactions (savings, loan applications, share payments, dividends, service charges) that are recorded in the system appear here first with a `pending` status.
-   Review each transaction and click **Approve** to confirm it or **Reject** to cancel it. You can also approve or reject multiple transactions in bulk by selecting them with the checkboxes.

#### 4.3.2 Savings
-   **Location:** `Savings > Savings Transactions`
-   Record a new deposit or withdrawal for a member. Select the member, their specific savings account, and enter the transaction details. The transaction will then go to the approval queue.

#### 4.3.3 Loans
-   **Location:** `Loans > Loans`
-   Create a new loan application for a member. Select the member, loan type, and enter all required details like principal amount, term, and collateral (guarantors, title deeds). The system performs validation checks based on the loan type's rules.
-   **Location:** `Loans > Loan Repayments`
-   Record a repayment for an active loan. The system automatically calculates the interest and principal allocation based on the remaining balance.

#### 4.3.4 Shares & Dividends
-   **Location:** `Shares & Dividends > Share Payments`
-   Record payments made by members towards their share commitments.
-   **Location:** `Shares & Dividends > Dividend Payouts`
-   Record dividend distributions for members. These transactions also require approval.

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