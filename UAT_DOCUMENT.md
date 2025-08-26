# Saccos Management System - Detailed User Acceptance Testing (UAT)

## 1. Introduction

### 1.1 Purpose
This document provides a comprehensive set of test cases for User Acceptance Testing (UAT) of the AcademInvest Saccos Management System. The goal is to rigorously test all functionalities, including positive paths, negative paths, and edge cases, to ensure the application is robust, reliable, and meets all business requirements before production deployment.

### 1.2 Scope
This UAT covers all primary functionalities of the application:
-   **Authentication:** Admin and Member login, new member password change, logout, and invalid attempts.
-   **Member Management:** Creating, viewing, editing, filtering, and searching for members.
-   **Savings & Transactions:** Deposits, withdrawals, transaction approval/rejection, and statement generation.
-   **Loan Management:** Loan application, approval, repayment, and overdue loan tracking.
-   **Group Collections:** Loading data and submitting batch collections for a school.
-   **System Configuration:** Role management and creation of financial product types (Shares, Loans, etc.).
-   **Reporting & Data Integrity:** Verification of calculations and data consistency across modules.

---

## 2. Prerequisites

### 2.1 Test Environment
-   **Application URL:** [Enter the URL of your test application here]
-   **Recommended Browsers:** Google Chrome, Mozilla Firefox, Microsoft Edge (latest versions).

### 2.2 Test Accounts
Testers will require access to the following user roles. Please create or use existing test accounts.

| Role | Username (Email/Phone) | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@academinvest.com` | `[Enter password]` | Has full access to all administrative features. |
| **Member** | `[Enter member phone number]` | `[Enter password]` | A regular member with an active savings account and loan. |
| **New Member**| `[Enter new member phone]` | `123456` | A newly created member who needs to change their password. |

---

## 3. Test Cases

Please execute the following test cases and record the outcome.

### 3.1 Authentication

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-AUTH-001** | **(Positive)** Successful Admin Login | 1. Navigate to the login page. <br> 2. Ensure "Admin" mode is selected. <br> 3. Enter valid admin credentials. <br> 4. Click "Sign In". | User is logged in successfully and redirected to the Admin Dashboard. The header should show the admin's name. | | |
| **UAT-AUTH-002** | **(Positive)** Successful Member Login | 1. Navigate to the login page. <br> 2. Select "Member" mode. <br> 3. Enter a valid member phone number and their current password. <br> 4. Click "Sign In". | User is logged in successfully and redirected to their Member Profile page. | | |
| **UAT-AUTH-003** | **(Positive)** New Member Forced Password Change | 1. Log in as a "New Member" with their phone number and the temporary password (`123456`). <br> 2. Observe you are redirected to the "Change Your Password" page. <br> 3. Enter a new, secure password. <br> 4. Confirm the new password. <br> 5. Click "Set New Password". | Password is changed successfully. A success message is shown. User is redirected to the login page. | | |
| **UAT-AUTH-004** | **(Positive)** Login After Password Change | 1. After completing UAT-AUTH-003, log in again as the same member. <br> 2. Use the **new** password. <br> 3. Click "Sign In". | User is logged in successfully and redirected to their Member Profile page. | | |
| **UAT-AUTH-005** | **(Negative)** Invalid Admin Password | 1. Navigate to the login page. <br> 2. Select "Admin" mode. <br> 3. Enter a valid admin email but an **incorrect** password. <br> 4. Click "Sign In". | An error message is displayed (e.g., "Login Failed: Incorrect password."). The user is not logged in. | | |
| **UAT-AUTH-006** | **(Negative)** Non-Existent Admin User | 1. Navigate to the login page. <br> 2. Select "Admin" mode. <br> 3. Enter an email address that is not registered as an admin. <br> 4. Click "Sign In". | An error message is displayed (e.g., "Login Failed: User not found."). The user is not logged in. | | |
| **UAT-AUTH-007** | **(Negative)** Invalid Member Phone Number | 1. Navigate to the login page. <br> 2. Select "Member" mode. <br> 3. Enter a phone number that is not registered. <br> 4. Click "Sign In". | An error message is displayed (e.g., "Login Failed: Phone number not found."). The user is not logged in. | | |
| **UAT-AUTH-008** | **(Positive)** Successful Logout | 1. Log in as any user (Admin or Member). <br> 2. Click the user avatar in the top-right corner. <br> 3. Select "Log out" from the dropdown menu. | User is logged out and redirected to the login page. Access to internal pages is denied. | | |

### 3.2 Member Management (Admin)

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-MEM-001** | **(Positive)** View Member List | 1. Log in as Admin. <br> 2. Navigate to "Members" page. | A table of all members is displayed with their ID, name, contact, school, and savings balance. | | |
| **UAT-MEM-002** | **(Positive)** Add a New Member | 1. Go to "Members" page. <br> 2. Click "Add Member". <br> 3. Fill in all required fields with valid data. <br> 4. Assign a school and select share/service charge commitments. <br> 5. Click "Add Member" in the modal. | A success message is shown. The new member appears in the member list. | | |
| **UAT-MEM-003** | **(Negative)** Add Member with Duplicate ID | 1. Go to "Members" page. <br> 2. Click "Add Member". <br> 3. Enter an ID that already exists for another member. <br> 4. Fill other fields. <br> 5. Click "Add Member". | An error message is displayed (e.g., "Member ID already exists"). The member is not created. | | |
| **UAT-MEM-004** | **(Negative)** Add Member with Missing Required Fields | 1. Go to "Members" page. <br> 2. Click "Add Member". <br> 3. Leave a required field (e.g., Full Name) blank. <br> 4. Click "Add Member". | The form should show a validation error indicating the missing field. The member is not created. | | |
| **UAT-MEM-005** | **(Positive)** Edit an Existing Member | 1. Go to "Members" page. <br> 2. Click the action menu (...) for a member and select "Edit". <br> 3. Change a field (e.g., Phone Number). <br> 4. Save changes. | A success message is shown. The member's information is updated in the list. | | |
| **UAT-MEM-006** | **(Positive)** Filter Members by School | 1. Go to "Members" page. <br> 2. Use the "Filter by school" dropdown and select a specific school. | The table updates to show only members from the selected school. | | |
| **UAT-MEM-007** | **(Positive)** Search for a Member | 1. Go to "Members" page. <br> 2. Use the search bar and type a member's name or ID. | The table updates to show only the member(s) matching the search term. | | |
| **UAT-MEM-008** | **(Positive)** View Member Profile | 1. Go to "Members" page. <br> 2. Click the action menu for a member and select "View Profile". | The Member Profile page opens and displays all details (savings, loans, shares, etc.) for that member without errors. The page should load and not get stuck. | | |

### 3.3 Savings & Transactions (Admin)

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-SAV-001** | **(Positive)** Record a Savings Deposit | 1. Log in as Admin. <br> 2. Navigate to "Savings Transactions". <br> 3. Click "Add Transaction". <br> 4. Select a member, their savings account, enter a valid amount, and set type to "Deposit". <br> 5. Submit the form. | A success message is shown. The new transaction appears in the "Approve Transactions" list with a "pending" status. | | |
| **UAT-SAV-002** | **(Positive)** Approve a Transaction | 1. Go to "Approve Transactions". <br> 2. Find the pending savings deposit from UAT-SAV-001. <br> 3. Click "Approve". | The transaction is approved and removed from the pending list. The member's savings account balance is updated correctly. | | |
| **UAT-SAV-003** | **(Negative)** Reject a Transaction | 1. Record another deposit. <br> 2. Go to "Approve Transactions". <br> 3. Find the new transaction and click "Reject". <br> 4. Enter a reason and confirm. | The transaction status changes to "rejected" and it no longer appears in the pending list. The member's balance is not affected. | | |
| **UAT-SAV-004** | **(Negative)** Attempt Withdrawal Exceeding Balance | 1. Go to "Savings Transactions" and click "Add Transaction". <br> 2. Select a member and choose "Withdrawal". <br> 3. Enter an amount **greater** than the member's account balance. <br> 4. Try to submit. | An error message should appear, preventing the submission (e.g., "Withdrawal amount cannot exceed balance."). | | |
| **UAT-SAV-005** | **(Positive)** Generate Account Statement | 1. Go to "Account Statement". <br> 2. Select a member, their account, and a date range. <br> 3. Click "Generate Statement". | A detailed statement appears with correct opening balance, transactions, and closing balance. The PDF download works correctly. | | |

### 3.4 Loans Management (Admin)

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-LOAN-001** | **(Positive)** Create a New Loan Application | 1. Log in as Admin. <br> 2. Navigate to "Loans". <br> 3. Click "New Loan Application". <br> 4. Fill in all details for a member, including principal, loan type, and guarantors. <br> 5. Submit the application. | A success message is shown. The new loan application appears in "Approve Transactions" with a "pending" status. | | |
| **UAT-LOAN-002** | **(Negative)** Create Loan Exceeding Type Limits | 1. Go to "Loans" and click "New Loan Application". <br> 2. Select a loan type. <br> 3. Enter a principal amount **greater** than the `maxLoanAmount` for that type. <br> 4. Try to submit. | An error message is displayed indicating the amount is out of range. The application is not created. | | |
| **UAT-LOAN-003** | **(Positive)** Approve a Loan Application | 1. Go to "Approve Transactions". <br> 2. Find the pending loan application from UAT-LOAN-001. <br> 3. Click "Approve". | The loan is approved and its status changes to "active". It appears correctly on the "Loans" page and the member's profile. | | |
| **UAT-LOAN-004** | **(Positive)** Record a Loan Repayment | 1. Go to "Loan Repayments". <br> 2. Click "Record Repayment". <br> 3. Select an active loan and enter a valid payment amount. <br> 4. Submit the form. | The repayment is recorded successfully. The loan's remaining balance is correctly reduced. The repayment history is visible on the member's profile. | | |
| **UAT-LOAN-005** | **(Negative)** Repayment Exceeding Balance | 1. Go to "Loan Repayments". <br> 2. Select an active loan. <br> 3. Enter a payment amount **greater** than the remaining balance + interest. <br> 4. Try to submit. | An error message is shown, preventing the overpayment. | | |
| **UAT-LOAN-006** | **(Positive)** View Overdue Loans | 1. Ensure at least one loan is overdue (by setting its `nextDueDate` in the database to a past date for testing). <br> 2. Navigate to "Overdue Loans". | The overdue loan is listed with the correct member name and days overdue. | | |

### 3.5 Group Collections (Admin)

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-COLL-001** | **(Positive)** Load Data for Aggregate Collection | 1. Log in as Admin. <br> 2. Navigate to "Aggregate Collections". <br> 3. Select a school and month/year. <br> 4. Click "Load Data". | A table appears with all active members from the selected school. Expected savings, loan, and share payments are pre-filled correctly. | | |
| **UAT-COLL-002** | **(Positive)** Submit Aggregate Collection | 1. On the "Aggregate Collections" sheet, verify or edit amounts for a few members. <br> 2. Click "Submit Collection". | A success message appears. The submitted amounts appear as individual pending transactions in the "Approve Transactions" list. | | |
| **UAT-COLL-003** | **(Positive)** Export/Import Collection Sheet | 1. Load data for a school. <br> 2. Click "Export" to download the Excel sheet. <br> 3. Open the file, modify some values, and save it. <br> 4. On the "Import" tab, upload the modified file. <br> 5. Click "Process File". | The values in the on-screen collection table should update to match the imported file. | | |

---

## 4. Test Summary and Sign-off

Upon completion of all test cases, the project stakeholder(s) will review the results and sign off on this document.

### 4.1 Summary of Results
-   **Total Test Cases:** 23
-   **Passed:** ______
-   **Failed:** ______
-   **Blocked:** ______

### 4.2 Conclusion
-   [ ] **Accepted:** The system meets the acceptance criteria and is approved for production deployment.
-   [ ] **Accepted with Conditions:** The system is approved, pending resolution of the minor issues listed below.
-   [ ] **Rejected:** The system has critical defects and is not approved for production.

**Issues to be addressed (if any):**
1.
2.
3.

### 4.3 Sign-off

| Name | Role | Signature | Date |
| :--- | :--- | :--- | :--- |
| | Project Manager | | |
| | Lead Tester | | |
| | Business Stakeholder | | |
