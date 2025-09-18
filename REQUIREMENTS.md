# System Requirements Specification (SRS): AcademInvest Saccos Management System

## 1. Introduction

This document provides a detailed specification of the functional and non-functional requirements for the AcademInvest Saccos Management System. The system is a full-stack web application designed to automate and streamline the financial operations of a school-based Savings and Credit Co-operative Society (Saccos).

### 1.1. Purpose
The purpose of this system is to:
-   Automate manual bookkeeping and financial calculations.
-   Provide a secure and centralized database for all member and transaction data.
-   Offer a self-service portal for members to view their financial status.
-   Equip administrators with powerful tools for management, reporting, and configuration.
-   Ensure data integrity, security, and system reliability.

### 1.2. Scope
The system will manage the entire lifecycle of Saccos operations, including member registration, savings and share contributions, loan applications and repayments, dividend distribution, financial reporting, and system configuration. It will also feature a public-facing website to provide information about the Saccos.

### 1.3. User Roles
The system will support two primary user roles with distinct levels of access:

*   **Admin/Staff:** System administrators who manage all Saccos operations. They have full access to create, read, update, and delete (CRUD) all financial and member data.
*   **Member:** The end-users of the Saccos. They have read-only access to their own financial profile and can perform a limited set of actions, such as changing their password.

## 2. Functional Requirements

### FR1: Authentication & Authorization
-   **FR1.1 (Admin Login):** Admins must log in using a phone number and password via an external authentication provider. The system must securely validate the session.
-   **FR1.2 (Member Login):** Members must log in using their registered phone number and a password stored within the system.
-   **FR1.3 (Forced Password Change):** Upon first login, new members must be forced to change their system-generated temporary password to a new, secure password.
-   **FR1.4 (Role-Based Access Control):** The system must enforce a granular, permission-based access control system. All actions on the backend (Server Actions) must be protected by a check to ensure the user's role has the required permission.
-   **FR1.5 (Logout):** All authenticated users must be able to log out securely, terminating their session.

### FR2: Member Management (Admin)
-   **FR2.1 (CRUD Operations):** Admins must be able to create, view, update, and delete member profiles.
-   **FR2.2 (Member List):** Admins must be able to view a paginated and searchable list of all members, showing key details like ID, name, school, and savings balance.
-   **FR2.3 (Filtering):** The member list must be filterable by school.
-   **FR2.4 (Member Profile):** Admins must be able to view a comprehensive profile page for each member, showing all their associated savings, loans, shares, and transaction history.
-   **FR2.5 (School Transfer):** Admins must be able to transfer a member from one school to another. A history of all transfers must be maintained for each member.
-   **FR2.6 (Bulk Import):** The system must support the bulk import of new members from a pre-formatted Excel file.

### FR3: Savings Management
-   **FR3.1 (Transaction Recording):** Admins must be able to record savings deposits and withdrawals for members.
-   **FR3.2 (Approval Workflow):** All savings transactions must be created in a `pending` state and must be explicitly `approved` or `rejected` by an Admin via a dedicated approval interface. The member's account balance is only updated upon approval.
-   **FR3.3 (Interest Calculation):** The system must be able to calculate savings interest for all eligible accounts based on the average daily balance over a specified period.
-   **FR3.4 (Interest Posting):** Calculated interest must be posted as new `pending` savings deposit transactions for Admin approval.
-   **FR3.5 (Account Statement):** Both Admins and Members must be able to generate a savings account statement for a selected date range.

### FR4: Loan Management
-   **FR4.1 (Loan Application):** Admins must be able to create new loan applications for members, based on predefined, configurable `Loan Types`.
-   **FR4.2 (Loan Validation):** The system must validate loan applications against rules defined in the `Loan Type`, including min/max principal amount, loan term, and member eligibility (e.g., minimum savings).
-   **FR4.3 (Collateral & Guarantors):** The system must support adding guarantors and attaching title deed documents as collateral for a loan.
-   **FR4.4 (Approval Workflow):** Loan applications must be created in a `pending` state and require Admin approval to become `active`.
-   **FR4.5 (Loan Repayments):** Admins must be able to record loan repayments. The system must automatically and correctly allocate the paid amount to interest and principal based on the reducing balance method.
-   **FR4.6 (Overdue Loans):** The system must be able to identify and list all loans that are past their due date and have a remaining balance.
-   **FR4.7 (Loan Interest Calculation):** The system must be able to calculate monthly loan interest based on the remaining balance of active loans.

### FR5: Share & Dividend Management
-   **FR5.1 (Share Payments):** Admins must be able to record share payments from members against their share commitments.
-   **FR5.2 (Approval Workflow):** All share payments must require Admin approval.
-   **FR5.3 (Dividend Distribution):** Admins must be able to record dividend payouts for members. These transactions also require approval.

### FR6: Financial Operations & Reporting
-   **FR6.1 (Aggregate Collections):** Admins must have a dedicated interface to perform bulk data entry for collections (savings, shares, loan repayments) for all members of a selected school for a specific month. The system should pre-fill expected amounts.
-   **FR6.2 (Collection Forecast):** The system must be able to generate a forecast of expected collections for a future month based on member commitments and loan schedules.
-   **FR6.3 (Reporting):** The system must generate key financial reports (e.g., Savings Report, Loan Report, Dividend Report) and allow them to be exported to Excel.
-   **FR6.4 (Account Closure):** Admins must have a feature to formally close a member's account. This process must calculate the final payout (including any accrued interest and share refunds) and deactivate the member.

### FR7: System Configuration (Admin)
-   **FR7.1 (Financial Products):** Admins must be able to define and manage different types for:
    -   `SavingAccountType` (e.g., Regular, Youth) with varying interest rates and contribution rules.
    -   `LoanType` (e.g., Emergency, Education) with specific rules for amounts, terms, and collateral.
    -   `ShareType` (e.g., Membership, Project) with defined values.
    -   `ServiceChargeType` (e.g., Annual Fee, Loan Processing Fee).
-   **FR7.2 (Data Integrity):** The system must prevent the deletion of a configuration type if it is actively in use by any member, transaction, or account to maintain data integrity.

### FR8: Website Management (Admin)
-   **FR8.1 (Content Management):** Admins must be able to update the content of the public-facing website, including the Sacco name, logo, hero section text/image, and "About Us" content.
-   **FR8.2 (News Management):** Admins must be able to create, edit, publish, and delete news articles that appear on the website.

## 3. Non-Functional Requirements

-   **NFR1 (Performance):** Key user interactions, such as page loads and data filtering, should complete within 3 seconds under normal load. Database queries should be optimized for performance.
-   **NFR2 (Security):**
    -   All data transmission between client and server must be encrypted via HTTPS.
    -   Passwords must be securely hashed using a strong algorithm (e.g., bcrypt).
    -   The system must be protected against common web vulnerabilities (e.g., XSS, CSRF).
    -   Role-based access control must be strictly enforced on all backend server actions.
-   **NFR3 (Usability):** The user interface should be intuitive, responsive, and easy to navigate for users with varying levels of technical expertise. A consistent design language must be used throughout the application.
-   **NFR4 (Scalability):** The architecture (leveraging Next.js serverless functions) must be able to handle a growing number of members, schools, and transactions without a significant drop in performance.
-   **NFR5 (Reliability & Data Integrity):**
    -   The system should be available with minimal downtime.
    -   Complex financial operations that involve multiple database updates (e.g., transaction approvals, account closures) must be wrapped in atomic database transactions to ensure data consistency. All related writes must either succeed or fail together.
-   **NFR6 (Maintainability):** The codebase must be well-organized, commented where necessary, and follow a consistent coding style to facilitate future development and maintenance. The use of TypeScript and a component-based architecture supports this.
-   **NFR7 (Technology Stack):** The application must be built using the prescribed technology stack: Next.js, React, TypeScript, Tailwind CSS, ShadCN, Prisma, and PostgreSQL.
