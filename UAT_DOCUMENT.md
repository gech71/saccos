
# Saccos Management System - User Acceptance Testing (UAT)

## 1. Introduction

### 1.1 Purpose
This document provides a set of test cases for User Acceptance Testing (UAT) of the Saccos Management System. The goal of this UAT is to verify that the application meets the business requirements and is ready for production use from an end-user perspective.

### 1.2 Scope
This UAT covers the primary functionalities of the Saccos application, including but not limited to:
- User Authentication (Admin and Member)
- Member Management
- Savings and Loan Management
- Share and Dividend Management
- Financial Calculations and Reporting
- System Configuration and Settings

### 1.3 Target Audience
This document is intended for project stakeholders, business users, and designated UAT testers who will execute the test cases.

---

## 2. Prerequisites

### 2.1 Test Environment
- **Application URL:** [Enter the URL of your test application here]
- **Recommended Browsers:** Google Chrome, Mozilla Firefox, Microsoft Edge (latest versions).

### 2.2 Test Accounts
Testers will require access to the following user roles. Please create or use existing test accounts.

| Role         | Username (Email/Phone)          | Password           | Notes                                                    |
|--------------|---------------------------------|--------------------|----------------------------------------------------------|
| **Admin**    | `admin@academinvest.com`        | `[Enter password]` | Has full access to all administrative features.          |
| **Member**   | `[Enter member phone number]`   | `[Enter password]` | A regular member with an active savings account and loan.|
| **New Member**| `[Enter new member phone]`    | `123456`           | A newly created member who needs to change their password. |

---

## 3. Test Cases

Please execute the following test cases and record the outcome.

### 3.1 Authentication

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-001** | Successful Admin Login | 1. Navigate to the login page. <br> 2. Select "Admin" mode. <br> 3. Enter valid admin credentials. <br> 4. Click "Sign In". | User is logged in successfully and redirected to the Admin Dashboard. | | |
| **UAT-002** | Successful Member Login | 1. Navigate to the login page. <br> 2. Select "Member" mode. <br> 3. Enter a valid member phone number and password. <br> 4. Click "Sign In". | User is logged in successfully and redirected to their Member Profile page. | | |
| **UAT-003** | New Member Password Change | 1. Log in as a "New Member" with their phone number and temporary password. <br> 2. Enter a new password. <br> 3. Confirm the new password. <br> 4. Click "Set New Password". | Password is changed successfully, and the user is redirected to the login page. The user can then log in with the new password. | | |
| **UAT-004** | Invalid Login Attempt | 1. Navigate to the login page. <br> 2. Enter invalid credentials (wrong password or username). <br> 3. Click "Sign In". | An error message is displayed, and the user is not logged in. | | |

### 3.2 Member Management

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-005** | View Member List | 1. Log in as Admin. <br> 2. Navigate to "Members" page. | A table of all members is displayed with their details. | | |
| **UAT-006** | Add a New Member | 1. Go to "Members" page. <br> 2. Click "Add Member". <br> 3. Fill in all required fields. <br> 4. Click "Add Member" in the modal. | A success message is shown. The new member appears in the member list. | | |
| **UAT-007** | Edit an Existing Member | 1. Go to "Members" page. <br> 2. Click the action menu (...) for a member and select "Edit". <br> 3. Change a field (e.g., Phone Number). <br> 4. Save changes. | A success message is shown. The member's information is updated in the list. | | |
| **UAT-008** | View Member Profile | 1. Go to "Members" page. <br> 2. Click the action menu for a member and select "View Profile". | The Member Profile page opens and displays all details (savings, loans, shares, etc.) for that member without errors. | | |


### 3.3 Savings & Transactions

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-009** | Record a Savings Deposit | 1. Log in as Admin. <br> 2. Navigate to "Savings Transactions". <br> 3. Click "Add Transaction". <br> 4. Select a member, their savings account, enter an amount, and set type to "Deposit". <br> 5. Submit the form. | A success message is shown. The new transaction appears in the "Approve Transactions" list. | | |
| **UAT-010** | Approve a Transaction | 1. Go to "Approve Transactions". <br> 2. Find the pending savings deposit from UAT-009. <br> 3. Click "Approve". | The transaction is approved and removed from the pending list. The member's savings account balance is updated correctly. | | |
| **UAT-011** | Reject a Transaction | 1. Record another deposit. <br> 2. Go to "Approve Transactions". <br> 3. Find the new transaction and click "Reject". <br> 4. Enter a reason and confirm. | The transaction status changes to "rejected" and it no longer appears in the pending list. The member's balance is not affected. | | |
| **UAT-012** | Generate Account Statement | 1. Go to "Account Statement". <br> 2. Select a member, their account, and a date range. <br> 3. Click "Generate Statement". | A detailed statement appears with correct opening balance, transactions, and closing balance. The PDF download works correctly. | | |

### 3.4 Loans Management

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-013** | Create a New Loan Application | 1. Log in as Admin. <br> 2. Navigate to "Loans". <br> 3. Click "New Loan Application". <br> 4. Fill in all details for a member, including principal, loan type, and guarantors. <br> 5. Submit the application. | A success message is shown. The new loan application appears in "Approve Transactions" with a "pending" status. | | |
| **UAT-014** | Approve a Loan Application | 1. Go to "Approve Transactions". <br> 2. Find the pending loan application. <br> 3. Click "Approve". | The loan is approved and its status changes to "active". It appears correctly on the "Loans" page and the member's profile. | | |
| **UAT-015** | Record a Loan Repayment | 1. Go to "Loan Repayments". <br> 2. Click "Record Repayment". <br> 3. Select an active loan and enter a payment amount. <br> 4. Submit the form. | The repayment is recorded. The loan's remaining balance is correctly reduced. The repayment history is visible. | | |
| **UAT-016** | View Overdue Loans | 1. Ensure at least one loan is overdue (by setting its `nextDueDate` in the database to a past date for testing). <br> 2. Navigate to "Overdue Loans". | The overdue loan is listed with the correct member name and days overdue. | | |

### 3.5 Group Collections

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-017** | Load Data for Aggregate Collection | 1. Log in as Admin. <br> 2. Navigate to "Aggregate Collections". <br> 3. Select a school and month/year. <br> 4. Click "Load Data". | A table appears with all active members from the selected school. Expected savings, loan, and share payments are pre-filled. | | |
| **UAT-018** | Submit Aggregate Collection | 1. On the "Aggregate Collections" sheet, verify or edit amounts for a few members. <br> 2. Click "Submit Collection". | A success message appears. The submitted amounts appear as individual pending transactions in the "Approve Transactions" list. | | |

### 3.6 Settings & Configuration

| Test Case ID | Test Scenario | Test Steps | Expected Result | Pass/Fail | Comments |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-019** | Create a New Role | 1. Log in as Admin. <br> 2. Navigate to "Settings" -> "Role Management". <br> 3. Click "Create Role". <br> 4. Enter a role name and select some permissions. <br> 5. Save the role. | The new role is created and appears in the roles list. | | |
| **UAT-020** | Assign a Role to a User | 1. Go to "Settings" -> "User Management". <br> 2. Click "Manage Roles" for a user. <br> 3. Select the new role created in UAT-019. <br> 4. Save the changes. | The user is now assigned the new role. The role appears next to their name in the user list. | | |
| **UAT-021** | Create a New Share Type | 1. Navigate to "Configuration" -> "Share Types". <br> 2. Click "Add Share Type". <br> 3. Fill in the details for a new type of share. <br> 4. Save the new type. | The new share type appears in the list and is available for selection when adding/editing members. | | |


## 4. Test Summary and Sign-off

Upon completion of all test cases, the project stakeholder(s) will review the results and sign off on this document.

### 4.1 Summary of Results
- **Total Test Cases:** 21
- **Passed:** ______
- **Failed:** ______
- **Blocked:** ______

### 4.2 Conclusion
- [ ] **Accepted:** The system meets the acceptance criteria and is approved for production deployment.
- [ ] **Accepted with Conditions:** The system is approved, pending resolution of the minor issues listed below.
- [ ] **Rejected:** The system has critical defects and is not approved for production.

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
