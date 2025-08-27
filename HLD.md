
# High-Level Design (HLD): AcademInvest Saccos Management System

## 1. Introduction

This document provides a high-level overview of the system architecture, components, and design principles for the AcademInvest Saccos Management System.

## 2. System Architecture Overview

The system is designed as a modern, full-stack web application utilizing a three-tier architecture.

-   **Client-Side (Presentation Tier):** A responsive web interface built with **Next.js** and **React**. It uses **Tailwind CSS** and **ShadCN** components for a modern, consistent UI.
-   **Server-Side (Application Tier):** The backend logic is handled by **Next.js Server Actions and API Routes**. This server-side environment, running on Node.js, is responsible for business logic, data processing, and communicating with the database.
-   **Database Tier:** A **PostgreSQL** database is used for persistent data storage. **Prisma ORM** is used as the interface between the application and the database, providing type-safe data access.

### Architectural Diagram

```
+----------------+      +-------------------------+      +-------------------+
|   Web Browser  | <=>  |   Firebase App Hosting  | <=>  | External Auth API |
| (React/Next.js)|      |    (Next.js Server)     |      +-------------------+
+----------------+      +-------------------------+
                             |
                             | (Prisma ORM)
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
-   **State Management:** React Context API (for Auth), client-side state hooks (`useState`, `useEffect`).
-   **Key Responsibilities:**
    -   Rendering the user interface.
    -   Handling user interactions.
    -   Making requests to the backend via Server Actions.
    -   Displaying data fetched from the server.

### 3.2 Backend (Server Actions & API)
-   **Framework:** Next.js Server Actions
-   **Language:** TypeScript
-   **Key Responsibilities:**
    -   Implementing the core business logic (e.g., interest calculation, loan processing).
    -   Handling all database CRUD operations via Prisma.
    -   Enforcing business rules and data validation.
    -   Securing endpoints and actions based on user roles and permissions.

### 3.3 Database
-   **System:** PostgreSQL
-   **ORM:** Prisma
-   **Key Responsibilities:**
    -   Storing all application data (members, schools, transactions, etc.).
    -   Ensuring data integrity through relational constraints.
    -   The schema is defined and managed via `prisma/schema.prisma`.

### 3.4 Authentication Service
-   **Provider:** An external, independent authentication service.
-   **Key Responsibilities:**
    -   Managing user registration (creating credentials).
    -   Validating user credentials (login).
    -   Issuing JWTs for session management.
    -   The application backend syncs user profile data (ID, name, email) from the auth service into its local user table.

## 4. Data Model (Entity Overview)

The database schema is centered around the following key entities. Refer to `prisma/schema.prisma` for detailed fields and relations.

-   **Member:** Represents a Saccos member. Linked to a `School`, `User` (for login), `SavingsAccounts`, `Loans`, `ShareCommitments`.
-   **School:** Represents a participating school. Has many `Members`.
-   **User & Role:** Manages application access. `Users` are assigned `Roles`, which have a set of `Permissions`.
-   **SavingAccountType, LoanType, ShareType, ServiceChargeType:** Configuration entities that define the different financial products.
-   **Saving, Loan, SharePayment, AppliedServiceCharge:** Transactional records that log all financial activities.
-   **LoanRepayment, Dividend:** Specific transactional records for loan and dividend operations.

## 5. Technology Stack

-   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, ShadCN
-   **Backend:** Next.js (Server Actions), Node.js, TypeScript
-   **Database:** PostgreSQL, Prisma
-   **Deployment:** Firebase App Hosting

## 6. Key Design Considerations

-   **Security:** Role-based access control (RBAC) is implemented at the server-action level. All data manipulation is performed on the server, never on the client.
-   **Data Integrity:** Complex financial operations (e.g., recording batch payments, closing accounts) use Prisma's `$transaction` API to ensure all steps succeed or fail together, preventing inconsistent data states.
-   **Usability:** The UI prioritizes clarity and ease of use, with features like search, filtering, and pagination to manage large datasets.
-   **Maintainability:** The codebase is structured by feature inside the `src/app/(app)` directory. Server actions are co-located with the pages that use them for better organization.
