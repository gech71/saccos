
# System Design Document: SACCO Management System

## 1. System Architecture

The SACCO Management System is a modern, full-stack web application built on a modular, scalable architecture. It leverages a robust technology stack to provide a secure, reliable, and user-friendly experience for both SACCO administrators and members.

### 1.1. Architectural Layers

The system is organized into the following logical layers:

#### 1.1.1. Presentation Layer (Client-Side)

This layer is responsible for rendering the user interface and handling user interactions.

- **Framework**: **Next.js with React** using the App Router paradigm. This allows for a hybrid rendering model, utilizing both Server Components for performance and Client Components (`'use client'`) for interactivity.
- **UI Components**: **ShadCN UI** provides a set of accessible and reusable components built on top of Radix UI.
- **Styling**: **Tailwind CSS** is used for utility-first styling, enabling rapid and consistent UI development.
- **State Management**: Client-side state is managed using React hooks (`useState`, `useEffect`, `useMemo`). A custom `AuthContext` provides session and user information throughout the application.

#### 1.1.2. Application Layer (Server-Side)

This layer contains the core business logic, data processing, and server-side operations.

- **Framework**: **Next.js Server Actions** (`'use server'`). Business logic, database mutations, and validations are encapsulated within server actions located in `src/app/(app)/**/actions.ts` files. This co-location of logic with features simplifies development and maintenance.
- **Routing**: **Next.js App Router** handles all routing, including dynamic routes for member profiles.
- **API Endpoints**: Traditional API routes are used for specific integrations, such as authentication callbacks (`/api/auth`) and file uploads (`/api/upload`).

#### 1.1.3. Data Layer

This layer is responsible for data persistence and retrieval.

- **Database**: **PostgreSQL** is the primary relational database, providing a robust and scalable data store.
- **ORM**: **Prisma** is used as the Object-Relational Mapper. It provides type-safe database access and manages the schema definition (in `prisma/schema.prisma`) and migrations.

#### 1.1.4. Integration Layer

This layer handles communication with external services.

- **Email**: **Nodemailer** is used for sending transactional emails, such as password reset links.

#### 1.1.5. Security Layer

This layer enforces security policies, authentication, and authorization.

- **Authentication**: **NextAuth.js (Auth.js)** manages user and member authentication using a `CredentialsProvider`. It handles session management via JWTs and includes a secure refresh token rotation mechanism.
- **Authorization**: A robust Role-Based Access Control (RBAC) system is implemented.
  - **Permissions**: A comprehensive list of granular permissions is defined in `src/app/(app)/settings/permissions.ts`.
  - **Roles**: Roles are defined in the database and link users to a set of permissions.
  - **Enforcement**: The `src/middleware.ts` file checks permissions for every route, redirecting unauthorized users. Server actions are protected using the `requirePermission` helper from `src/lib/authorization.ts`.
- **Rate Limiting**: The system implements IP-based and phone number-based rate limiting for login attempts, managed in `src/auth.ts` using a dedicated `RateLimit` database model to prevent brute-force attacks.
- **Content Security Policy (CSP)**: A strict CSP is implemented in `src/middleware.ts` using a nonce to protect against XSS attacks.

#### 1.1.6. Monitoring & Auditing Layer

This layer provides visibility into system activities.

- **Auditing**: A dedicated `AuditLog` model in the database records all significant actions (e.g., creations, updates, deletions, logins). The `logAudit` function in `src/lib/audit-log.ts` provides a centralized way to create audit entries.

### 1.2. Infrastructure Topology Diagram

This diagram illustrates the high-level infrastructure, showing how components interact within a scalable deployment environment.

```plaintext
                               +-------------------------+
                               |      End User (Web)     |
                               +-----------+-------------+
                                           | (HTTPS)
                                           |
+------------------------------------------v------------------------------------------+
|  Public Subnet                                                                        |
|                                                                                       |
|    +-----------------------+       +-------------------------+       +---------------+
|    |  Load Balancer / IIS  |<----->|    Firewall / WAF       |<----->|   Internet    |
|    +-----------------------+       +-------------------------+       +---------------+
|              |                                                                        |
|    +---------v-------------------+--------------------------+       +---------------+
|    |  Application Server (Next.js)|                          |       | Email Service |
|    +-----------------------------+                          |       +---------------+
|              |                                                                        |
|    +---------v-------------+                                                          |
|    |  PostgreSQL Database  |                                                          |
|    +-----------------------+                                                          |
| (Private Subnet)                                                                      |
+---------------------------------------------------------------------------------------+
```

**Deployment Design:**

- **Scalable Deployment**: The application server is stateless and can be scaled horizontally. Multiple instances can be run behind a Load Balancer (LB) to distribute traffic. This setup works for both cloud-based auto-scaling groups and on-premises server clusters.
- **High Availability**: High availability is achieved by deploying redundant application servers and a clustered/replicated PostgreSQL database across different availability zones or physical racks. The load balancer manages health checks and routes traffic away from failed instances.
- **Network Segmentation**: The system is deployed across two main network segments: a Public Subnet and a Private Subnet, ensuring a secure and layered architecture.
  - **Public Subnet**: This is the public-facing zone accessible from the internet. It contains the Firewall/WAF and the Load Balancer/IIS. These components handle incoming user traffic, provide security screening, and distribute requests. The Email Service also resides in or is accessible from this subnet.
  - **Private Subnet**: This isolated network is not directly accessible from the internet. It hosts the core components: the Application Server (Next.js App) and the PostgreSQL Database. The Application Server only accepts traffic from the Load Balancer, and the Database only accepts connections from the Application Server, providing a high level of security.

---

## 2. Data Flow Diagram (DFD)

This Level-2 DFD provides a detailed view of a specific, critical process: **Loan Application, Approval, and Repayment**.

```plaintext
+----------+ (1. Apply for Loan on behalf of Member) +------------------------+ (2. Check Eligibility)
|  Admin   |---------------------------------------->|   Loan Application     |----------------------+
+----------+                                         |      (Process 3.1)     |                      |
     ^                                               +------------------------+                      |
     | (4. Review Loan)                                        | (3. Create Loan Record)            v
     |                                                         v                               +----------+
     +----------------------------------------------+----------+----------+                    | SACCO DB |
       |                                            | Transaction Approval |<-------------------+ (D1, D2) |
       | (8. Submit Repayment on behalf of Member)    |    (Process 3.2)     |                    +----------+
       |                                            +----------+----------+                         ^
       |                                                       | (5. Approve/Reject)               | (7. Fetch Loan Data)
       |                                                       |                                   |
       +---------------------------->+------------------------+<----------+                       |
                                     |   Update Loan Status   |           | (Member)              |
                                     |      (Process 3.3)     |           |                       |
                                     +------------+-----------+           +-----------------------+
                                                  | (6. Disbursement)      (9. Repayment Approval)
                                                  |
                                                  v
                                             +----------+ (10. Update Balance)
                                             | SACCO DB |
                                             | (D1, D2) |
                                             +----------+
```

**Data Stores:**
- **(D1) SACCO DB**: Main PostgreSQL database (Users, Members, Loans, etc.).
- **(D2) Transactions**: Tables for Loan Repayments within SACCO DB.

**Flow Description:**
1.  An **Admin** submits a loan application via the UI on behalf of a member.
2.  The system checks the member's eligibility against business rules in the database (e.g., savings balance, membership duration). This happens within the `addLoan` server action.
3.  A `Loan` record is created with a `pending` status.
4.  An admin reviews the pending loan application on the "Approve Transactions" page.
5.  The admin approves or rejects the application.
6.  Upon approval (`approveTransaction` action), the system updates the loan status to `active` and logs the disbursement details. An audit log is created.
7.  The **Member** views their loan balance and repayment schedule on their profile.
8.  An **Admin** submits a repayment through the "Loan Repayments" page on behalf of a member. A `LoanRepayment` record is created with `pending` status.
9.  The repayment is reviewed and approved by an admin on the "Approve Transactions" page.
10. Upon approval, the `Loan`'s `remainingBalance` is updated in the database, and an audit log is created.

---

## 3. Business Logic

The system's business logic is primarily enforced within the **Next.js Server Actions** (`/actions.ts` files) and the **database schema** (`prisma/schema.prisma`).

### 3.1. Business Rules & Validation Logic

- **Data Integrity**: Enforced by Prisma schema constraints (e.g., unique fields, required fields, relations).
- **Input Validation**: Server Actions use **Zod** schemas (`memberInputSchema`) to validate incoming data for correctness, type, and format before processing.
- **Loan Eligibility**:
  - A member's savings duration and balance are checked against the `LoanType` requirements (`minSavingMonths`, `minSavingBalance`).
  - The requested loan amount must be within the `minLoanAmount` and `maxLoanAmount` defined for the `LoanType`.
  - The repayment term must be within the defined `minRepaymentPeriod` and `maxRepaymentPeriod`.
- **Guarantor Limits**: A member cannot guarantee more than a set number of active loans simultaneously (currently hardcoded to 2). This is checked during the loan application process.
- **Rate Limiting**: Login attempts are limited per IP and per phone number to prevent brute-force attacks. Lockouts are temporary and tracked in the `RateLimit` table.

### 3.2. Workflows

#### 3.2.1. Member & User Onboarding

1.  An admin creates a new member or user via the UI.
2.  The system generates a secure, random temporary password.
3.  The `mustChangePassword` flag is set to `true` for the new user/member.
4.  The creating admin is shown the temporary password to securely communicate to the new user.
5.  Upon first login, the middleware (`src/middleware.ts`) intercepts the user and forces a redirect to a dedicated password change page (`/admin-change-password` or `/member-change-password`).
6.  The user sets a new private password, and the `mustChangePassword` flag is set to `false`.

#### 3.2.2. Transaction Approval Workflow

All financial transactions (savings deposits, share payments, loan disbursements, loan repayments) follow a two-step approval process:
1.  **Creation**: A transaction is created with a `pending` status. It does not affect any account balances at this stage.
2.  **Approval**: An admin with `transactionApproval:edit` permission reviews the pending transaction on the "Approve Transactions" page.
3.  **Confirmation**:
    - Upon **approval**, the system updates the transaction status to `approved` and atomically updates the relevant account balances (e.g., `MemberSavingAccount.balance`, `Loan.remainingBalance`).
    - Upon **rejection**, the status is updated to `rejected`, and a reason is recorded. No balances are changed.

### 3.3. Configurable Business Rules

While many core rules are hardcoded for security and stability, the following are designed to be configurable by an administrator through the UI without code changes:

- **Loan Types**: All loan parameters (interest rates, amounts, terms, collateral logic) are stored in the `LoanType` model and are fully configurable.
- **Saving Account Types**: Interest rates and contribution rules (fixed vs. percentage) are configurable.
- **Share Types**: Total amounts and payment structures (one-time vs. installment) are configurable.
- **Service Charge Types**: Names, amounts, and frequencies are configurable.
- **User Roles and Permissions**: Admins can create and modify roles, dynamically assigning any combination of the granular permissions defined in `src/app/(app)/settings/permissions.ts`.

### 3.4. Traceability, Logging, and Auditing

- **Traceability**: Every significant database record (e.g., `Loan`, `Saving`, `Member`) has a unique ID and timestamps (`createdAt`, `updatedAt`). Financial transactions are linked directly to the member who initiated them.
- **Logging**: All critical operations, from user creation to transaction approvals, are logged in the `AuditLog` table via the `logAudit` function.
- **Auditing**: The Audit Log page provides admins with a searchable and filterable view of all actions performed in the system, showing who did what, and when. This ensures full accountability.
- **Exception Handling**: Server actions use `try...catch` blocks to handle errors gracefully, providing clear feedback to the user via toast notifications without exposing sensitive system details.
