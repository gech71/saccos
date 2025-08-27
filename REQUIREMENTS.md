
# Requirement Analysis: AcademInvest Saccos Management System

## 1. Introduction

This document outlines the functional and non-functional requirements for the AcademInvest Saccos Management System. The system is designed to automate and streamline the operations of a school-based Savings and Credit Co-operative Society (Saccos).

## 2. User Roles & Permissions

The system will support two primary user roles with distinct permissions:

*   **Admin/Staff:** System administrators who manage the entire Saccos operations. They have full access to all features.
*   **Member:** The end-users of the Saccos who can view their profile, statements, and perform limited actions.

## 3. Functional Requirements

### 3.1 Authentication
- **FR3.1.1 (Admin Login):** Admins must be able to log in using their phone number and password via an external authentication provider.
- **FR3.1.2 (Member Login):** Members must be able to log in using their registered phone number and password.
- **FR3.1.3 (Forced Password Change):** New members must be forced to change their temporary password upon their first login.
- **FR3.1.4 (Logout):** All users must be able to log out securely.

### 3.2 Member Management (Admin)
- **FR3.2.1:** Admins must be able to create, view, update, and delete member profiles.
- **FR3.2.2:** Admins must be able to view a comprehensive list of all members.
- **FR3.2.3:** The system must support filtering the member list by school and searching by name or ID.
- **FR3.2.4:** Admins must be able to transfer a member from one school to another, maintaining a history of transfers.
- **FR3.2.5:** The system must support bulk import of members from an Excel file.

### 3.3 Savings Management
- **FR3.3.1:** Admins must be able to record savings deposits and withdrawals for members.
- **FR3.3.2:** All savings transactions must go through an approval process (pending -> approved/rejected).
- **FR3.3.3:** The system must automatically calculate savings interest based on a defined period and average daily balance.
- **FR3.3.4:** Calculated interest must be posted as pending transactions for approval.
- **FR3.3.5:** Members must be able to view their account statement for a selected date range.

### 3.4 Loan Management
- **FR3.4.1:** Admins must be able to create new loan applications for members based on predefined loan types.
- **FR3.4.2:** Loan applications must go through an approval process.
- **FR3.4.3:** Admins must be able to record loan repayments, which should correctly allocate funds to principal and interest.
- **FR3.4.4:** The system must identify and list overdue loans.
- **FR3.4.5:** The system must be able to calculate monthly loan interest based on the remaining balance.

### 3.5 Share & Dividend Management
- **FR3.5.1:** Admins must be able to record share payments from members against their commitments.
- **FR3.5.2:** Share payments must go through an approval process.
- **FR3.5.3:** Admins must be able to record dividend distributions for members, which require approval.

### 3.6 System Configuration
- **FR3.6.1:** Admins must be able to define and manage different types for:
    - Saving Accounts (e.g., Regular, Youth)
    - Loan Types (e.g., Emergency, Education)
    - Share Types (e.g., Membership, Project)
    - Service Charges (e.g., Annual Fee, Loan Processing Fee)
- **FR3.6.2:** The system must prevent the deletion of a configuration type if it is actively being used.

### 3.7 Financial Operations & Reporting
- **FR3.7.1 (Aggregate Collections):** Admins must be able to perform bulk data entry for collections (savings, shares, loans) for an entire school for a specific month.
- **FR3.7.2 (Collection Forecast):** The system must be able to generate a forecast of expected collections based on member commitments.
- **FR3.7.3 (Reporting):** The system must generate various reports (e.g., Savings Report, Loan Report) and allow exporting them to Excel.
- **FR3.7.4 (Account Closure):** Admins must be able to close a member's account, which calculates final payouts and deactivates the member.

## 4. Non-Functional Requirements

- **NFR4.1 (Performance):** The system should be responsive, with page loads and data filtering completing within 3 seconds under normal load.
- **NFR4.2 (Security):** User authentication must be secure. Role-based access control (RBAC) must be strictly enforced on all actions. Sensitive data should be handled securely.
- **NFR4.3 (Usability):** The user interface should be intuitive and easy to navigate for both admin and member users.
- **NFR4.4 (Scalability):** The system should be able to handle a growing number of members, schools, and transactions without significant degradation in performance.
- **NFR4.5 (Reliability):** The system should be available and function correctly with minimal downtime. Database transactions should be used for complex operations to ensure data integrity.
