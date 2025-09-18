
# High-Level Design (HLD): AcademInvest Saccos Management System

## 1. Introduction

This document provides a high-level overview of the system architecture, components, and design principles for the AcademInvest Saccos Management System. The system is a comprehensive, full-stack web application designed to automate and streamline the financial operations of a school-based Savings and Credit Co-operative Society (Saccos).

## 2. System Architecture Overview

The system is designed as a modern, multi-tier web application, leveraging a serverless-first approach for scalability and maintainability.

-   **Client-Side (Presentation Tier):** A responsive and interactive web interface built with **Next.js** and **React**. It utilizes **Tailwind CSS** and **ShadCN** for a modern, consistent, and component-based UI. The client is responsible for rendering user interfaces and handling user interactions.

-   **Server-Side (Application Tier):** The backend logic is primarily handled by **Next.js Server Actions**. This server-side environment, running on Node.js, is responsible for all business logic, data processing, authentication checks, and communication with the database. This removes the need for traditional REST or GraphQL API endpoints, simplifying the architecture.

-   **Database Tier:** A **PostgreSQL** database serves as the single source of truth for all persistent data. **Prisma ORM** acts as the data access layer, providing type-safe queries and simplifying database interactions.

-   **Authentication:** User authentication (for admins/staff) is managed by an **external, independent identity provider**. The application backend syncs user profile data (ID, name, email) from the auth service into its local `User` table upon successful login, decoupling core application logic from authentication concerns. Member login is handled internally by verifying a hashed password stored in the `Member` table.

### Architectural Diagram

```
+----------------+      +-------------------------+      +-------------------+
|   Web Browser  | <=>  |   Firebase App Hosting  |      |   External Auth   |
| (Next.js/React)|      |    (Next.js Server)     | <=>  |  (Admins/Staff)   |
+----------------+      +-------------------------+      +-------------------+
        ^                        |
        | (Member Login)         | (Prisma ORM)
        |                        |
        +------------------+-----------+
                           |
                     +----------------+
                     |   PostgreSQL   |
                     |    Database    |
                     +----------------+
```

## 3. Major Components

### 3.1 Frontend Web Application
-   **Framework:** Next.js 14+ (App Router)
-   **UI Library:** React with ShadCN UI components
-   **Styling:** Tailwind CSS
-   **Key Responsibilities:**
    -   Rendering the user interface for both public visitors and authenticated users (Admins and Members).
    -   Handling all user interactions (form submissions, button clicks).
    -   Invoking Server Actions to communicate with the backend for all data-related operations.
    -   Displaying data fetched from the server and managing client-side state.

### 3.2 Backend (Server Actions)
-   **Framework:** Next.js Server Actions
-   **Language:** TypeScript
-   **Key Responsibilities:**
    -   Implementing the core business logic of the Saccos (e.g., interest calculation, loan processing, transaction approvals).
    -   Handling all CRUD (Create, Read, Update, Delete) operations against the database via Prisma.
    -   Enforcing business rules and performing data validation before persisting data.
    -   Implementing security and permission checks based on user roles before executing any action.

### 3.3 Database
-   **System:** PostgreSQL
-   **ORM:** Prisma
-   **Key Responsibilities:**
    -   Storing all application data, including members, schools, accounts, transactions, loans, shares, and system configuration.
    -   Ensuring data integrity and consistency through relational constraints and atomic transactions.
    -   The entire database schema is defined declaratively in `prisma/schema.prisma`.

### 3.4 Authentication Service
-   **Admin/Staff Auth:** An external, independent service responsible for managing admin credentials, validating logins, and issuing tokens. The Next.js backend validates these tokens and syncs user data.
-   **Member Auth:** A simple, internal mechanism. Members are created by Admins with a phone number and a temporary password. The password is hashed and stored in the `Member` table. Members log in using these credentials.

## 4. Data Model (Entity Relationship Overview)

The database schema is designed around several key entities that model the Saccos operations. The relationships are defined in `prisma/schema.prisma`.

-   **Core Entities:**
    -   `User` & `Role`: Manages application access for admins/staff. `Users` are assigned `Roles`, which dictate their `Permissions`.
    -   `School`: Represents a participating institution. A school can have many `Members`.
    -   `Member`: The central entity representing a Saccos member. It is linked to a `School`, and optionally a `User` for login. Each member has associated accounts and transactions.

-   **Financial Product Configuration:**
    -   `SavingAccountType`: Defines different savings products (e.g., Regular, Youth) with specific interest rates and contribution rules.
    -   `LoanType`: Defines loan products (e.g., Emergency, Education) with rules for amounts, terms, and collateral.
    -   `ShareType`: Defines different types of shares members can commit to.
    -   `ServiceChargeType`: Defines fees that can be applied to members (e.g., Annual Fee, Loan Processing Fee).

-   **Transactional Records:**
    -   `MemberSavingAccount` & `Saving`: A `Member` has one or more `MemberSavingAccount`s. All deposits and withdrawals are recorded as `Saving` transactions against an account.
    -   `MemberShareCommitment` & `SharePayment`: A `Member` subscribes to a `ShareType` via a `MemberShareCommitment`. Payments towards this commitment are recorded as `SharePayment`s.
    -   `Loan` & `LoanRepayment`: A `Loan` is created for a member based on a `LoanType`. Repayments are recorded as `LoanRepayment` transactions, which are allocated to principal and interest.
    -   `Dividend`: Records dividend payouts distributed to members.
    -   `AppliedServiceCharge`: Records instances of a `ServiceChargeType` being applied to a member.

-   **Supporting Entities:**
    -   `Address`, `EmergencyContact`: Stores contact information for a `Member`.
    -   `SchoolHistory`: Tracks the transfer history of a member between different schools.
    -   `WebsiteContent`, `Post`, `SocialMediaLink`, `Service`: Entities that store content for the public-facing website, managed by admins.

## 5. Technology Stack Summary

-   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, ShadCN
-   **Backend:** Next.js (Server Actions), Node.js, TypeScript
-   **Database:** PostgreSQL
-   **ORM:** Prisma
-   **Deployment:** Firebase App Hosting (or any platform supporting Next.js)

## 6. Key Design Principles & Considerations

-   **Security:** A robust, permission-based access control model is implemented. All sensitive operations and data mutations are executed exclusively through Server Actions, which first verify the user's role and permissions. There is no direct client-side database access.
-   **Data Integrity:** Complex financial operations, such as approving transactions or closing an account, are wrapped in Prisma's `$transaction` API. This ensures that all related database updates within an operation either succeed together or fail together, preventing inconsistent data states.
-   **Usability & User Experience:** The UI is designed to be intuitive for both technical and non-technical users. Features like search, filtering, pagination, and bulk data entry (Aggregate Collections) are implemented to efficiently manage large datasets.
-   **Maintainability & Scalability:** The codebase is structured by feature within the `src/app/(app)` directory. By co-locating pages with their corresponding Server Actions, the code remains organized and easy to navigate. The serverless nature of Next.js on a platform like Firebase App Hosting allows the application to scale automatically with traffic.
