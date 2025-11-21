export type RoutePermission = {
  prefix: string;
  permission: string;
};

// Ordered from most specific to least specific for predictable matching.
const rawRoutePermissions: RoutePermission[] = [
  { prefix: "/settings/website", permission: "website:view" },
  { prefix: "/settings/news", permission: "news:view" },
  { prefix: "/settings/register", permission: "registerUser:view" },
  { prefix: "/settings/profile", permission: "setting:view" },
  { prefix: "/settings/sms", permission: "setting:view" },
  { prefix: "/settings", permission: "setting:view" },
  { prefix: "/saving-account-types", permission: "configuration:view" },
  { prefix: "/share-types", permission: "configuration:view" },
  { prefix: "/loan-types", permission: "configuration:view" },
  { prefix: "/service-charge-types", permission: "configuration:view" },
  { prefix: "/schools", permission: "school:view" },
  { prefix: "/members", permission: "member:view" },
  { prefix: "/add-saving-account", permission: "savingAccount:create" },
  { prefix: "/savings-accounts", permission: "savingAccount:view" },
  { prefix: "/savings", permission: "saving:view" },
  { prefix: "/calculate-interest", permission: "savingsInterestCalculation:view" },
  { prefix: "/account-statement", permission: "accountStatement:view" },
  { prefix: "/close-account", permission: "accountClosure:view" },
  { prefix: "/closed-accounts", permission: "closedAccount:view" },
  { prefix: "/applied-service-charges", permission: "serviceCharge:view" },
  { prefix: "/approve-transactions", permission: "transactionApproval:view" },
  { prefix: "/aggregate-collections", permission: "groupCollection:view" },
  { prefix: "/system-import", permission: "systemImport:view" },
  { prefix: "/collection-forecast", permission: "collectionForecast:view" },
  { prefix: "/overdue-payments", permission: "overduePayment:view" },
  { prefix: "/calculate-loan-interest", permission: "loanInterestCalculation:view" },
  { prefix: "/loan-repayments", permission: "loanRepayment:view" },
  { prefix: "/loans", permission: "loan:view" },
  { prefix: "/overdue-loans", permission: "overdueLoan:view" },
  { prefix: "/shares", permission: "share:view" },
  { prefix: "/dividends", permission: "dividend:view" },
  { prefix: "/reports", permission: "report:view" },
  { prefix: "/audit-log", permission: "auditLog:view" },
  { prefix: "/dashboard", permission: "dashboard:view" },
];

export const routePermissions = rawRoutePermissions.sort(
  (a, b) => b.prefix.length - a.prefix.length
);

const normalizePath = (pathname: string) => {
  if (!pathname) return "/";
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
};

export function getRequiredPermission(pathname: string): string | null {
  const normalized = normalizePath(pathname);
  const match = routePermissions.find(({ prefix }) => {
    if (normalized === prefix) return true;
    return normalized.startsWith(`${prefix}/`);
  });
  return match?.permission ?? null;
}

export function getFirstPermittedRoute(userPermissions: string[]): string {
  for (const { prefix, permission } of routePermissions) {
    if (userPermissions.includes(permission)) {
      return prefix;
    }
  }
  return "/dashboard";
}

