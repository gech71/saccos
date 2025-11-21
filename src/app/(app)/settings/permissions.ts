
export const permissionsByGroup = {
    'Dashboard': [
        { id: 'dashboard:view', label: 'View Dashboard' },
    ],
    'Schools': [
        { id: 'school:view', label: 'View' },
        { id: 'school:create', label: 'Create' },
        { id: 'school:edit', label: 'Edit' },
        { id: 'school:delete', label: 'Delete' },
    ],
    'Members': [
        { id: 'member:view', label: 'View' },
        { id: 'member:create', label: 'Create' },
        { id: 'member:edit', label: 'Edit' },
        { id: 'member:delete', label: 'Delete' },
    ],
    'Savings Transactions': [
        { id: 'saving:view', label: 'View' },
        { id: 'saving:create', label: 'Create' },
        { id: 'saving:edit', label: 'Edit' },
        { id: 'saving:delete', label: 'Delete' },
    ],
    'Savings Accounts': [
        { id: 'savingAccount:view', label: 'View' },
        { id: 'savingAccount:create', label: 'Create' },
    ],
    'System Import': [
        { id: 'systemImport:view', label: 'View' },
        { id: 'systemImport:create', label: 'Create' },
    ],
    'Savings Interest Calculation': [
        { id: 'savingsInterestCalculation:view', label: 'View' },
        { id: 'savingsInterestCalculation:create', label: 'Create' },
    ],
    'Account Statements': [
        { id: 'accountStatement:view', label: 'View' },
    ],
    'Account Closure': [
        { id: 'accountClosure:view', label: 'View' },
        { id: 'accountClosure:create', label: 'Create' },
    ],
    'Closed Accounts': [
        { id: 'closedAccount:view', label: 'View' },
    ],
    'Loans': [
        { id: 'loan:view', label: 'View' },
        { id: 'loan:create', label: 'Create' },
        { id: 'loan:edit', label: 'Edit' },
        { id: 'loan:delete', label: 'Delete' },
    ],
    'Loan Repayments': [
        { id: 'loanRepayment:view', label: 'View' },
        { id: 'loanRepayment:create', label: 'Create' },
    ],
     'Aggregate Collections': [
        { id: 'groupCollection:view', label: 'View' },
        { id: 'groupCollection:create', label: 'Create' },
    ],
    'Loan Interest Calculation': [
        { id: 'loanInterestCalculation:view', label: 'View' },
        { id: 'loanInterestCalculation:create', label: 'Create' },
    ],
    'Overdue Loans': [
        { id: 'overdueLoan:view', label: 'View' },
    ],
    'Shares': [
        { id: 'share:view', label: 'View' },
        { id: 'share:create', label: 'Create' },
        { id: 'share:edit', label: 'Edit' },
        { id: 'share:delete', label: 'Delete' },
    ],
    'Dividends': [
        { id: 'dividend:view', label: 'View' },
        { id: 'dividend:create', label: 'Create' },
        { id: 'dividend:edit', label: 'Edit' },
        { id: 'dividend:delete', label: 'Delete' },
    ],
    'Transaction Approval': [
        { id: 'transactionApproval:view', label: 'View' },
        { id: 'transactionApproval:edit', label: 'Approve/Reject' },
    ],
    'Service Charges': [
        { id: 'serviceCharge:view', label: 'View' },
        { id: 'serviceCharge:create', label: 'Apply' },
        { id: 'serviceCharge:edit', label: 'Record Payment' },
    ],
    'Overdue Payments': [
        { id: 'overduePayment:view', label: 'View' },
        { id: 'overduePayment:create', label: 'Record Payment' },
    ],
    'Collection Forecast': [
        { id: 'collectionForecast:view', label: 'View' },
    ],
    'Reports': [
        { id: 'report:view', label: 'View' },
    ],
    'Audit Log': [
        { id: 'auditLog:view', label: 'View Audit Log' },
    ],
     'Website Management': [
        { id: 'website:view', label: 'View Website Settings' },
        { id: 'website:edit', label: 'Edit Website Settings' },
    ],
    'News Management': [
        { id: 'news:view', label: 'View News Posts' },
        { id: 'news:create', label: 'Create News Posts' },
        { id: 'news:edit', label: 'Edit News Posts' },
        { id: 'news:delete', label: 'Delete News Posts' },
    ],
    'Settings': [
        { id: 'setting:view', label: 'View App Settings' },
        { id: 'setting:create', label: 'Create Users/Roles' },
        { id: 'setting:edit', label: 'Edit Users/Roles' },
        { id: 'setting:delete', label: 'Delete Users/Roles' },
    ],
    'User Management': [
        { id: 'user:view', label: 'View Users' },
        { id: 'user:create', label: 'Create Users' },
        { id: 'user:edit', label: 'Edit Users' },
        { id: 'user:delete', label: 'Delete Users' },
    ],
    'User Registration': [
        { id: 'registerUser:view', label: 'View Registration Page'}
    ],
    'Configuration': [
        { id: 'configuration:view', label: 'View' },
        { id: 'configuration:create', label: 'Create' },
        { id: 'configuration:edit', label: 'Edit' },
        { id: 'configuration:delete', label: 'Delete' },
    ],
};

export const permissionsList = Object.values(permissionsByGroup).flat();
