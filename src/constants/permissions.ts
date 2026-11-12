export const PERMISSIONS = {
  // Users, Roles & Permissions
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',

  // Branches & Settings
  BRANCHES_VIEW: 'branches.view',
  BRANCHES_MANAGE: 'branches.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',

  // Menu
  MENU_VIEW: 'menu.view',
  MENU_CREATE: 'menu.create',
  MENU_UPDATE: 'menu.update',
  MENU_DELETE: 'menu.delete',

  // Tables & Reservations
  TABLES_VIEW: 'tables.view',
  TABLES_MANAGE: 'tables.manage',
  RESERVATIONS_VIEW: 'reservations.view',
  RESERVATIONS_MANAGE: 'reservations.manage',

  // Orders
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_REFUND: 'orders.refund',

  // Kitchen (KDS)
  KITCHEN_VIEW: 'kitchen.view',
  KITCHEN_UPDATE: 'kitchen.update',

  // Payments & Billing
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_PROCESS: 'payments.process',
  CASH_DRAWER_MANAGE: 'cash_drawer.manage',

  // Inventory & Recipes
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_MANAGE: 'inventory.manage',

  // Suppliers & Purchasing
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_MANAGE: 'suppliers.manage',
  PURCHASING_MANAGE: 'purchasing.manage',

  // Customers & CRM
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  LOYALTY_MANAGE: 'loyalty.manage',

  // Delivery
  DELIVERY_VIEW: 'delivery.view',
  DELIVERY_MANAGE: 'delivery.manage',

  // Staff & HR
  STAFF_VIEW: 'staff.view',
  STAFF_MANAGE: 'staff.manage',
  PAYROLL_MANAGE: 'payroll.manage',

  // Expenses & Accounting
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_MANAGE: 'expenses.manage',
  ACCOUNTING_VIEW: 'accounting.view',

  // Reports, Dashboard & Audit
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  DASHBOARD_VIEW: 'dashboard.view',
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: { key: PermissionKey; module: string; description: string }[] = [
  { key: PERMISSIONS.USERS_VIEW, module: 'users', description: 'View users list and profiles' },
  { key: PERMISSIONS.USERS_CREATE, module: 'users', description: 'Create new staff users' },
  { key: PERMISSIONS.USERS_UPDATE, module: 'users', description: 'Update user details and status' },
  { key: PERMISSIONS.USERS_DELETE, module: 'users', description: 'Soft delete users' },
  { key: PERMISSIONS.ROLES_VIEW, module: 'roles', description: 'View roles and permissions' },
  { key: PERMISSIONS.ROLES_MANAGE, module: 'roles', description: 'Create roles and assign permissions' },

  { key: PERMISSIONS.BRANCHES_VIEW, module: 'branches', description: 'View branches' },
  { key: PERMISSIONS.BRANCHES_MANAGE, module: 'branches', description: 'Create and update branches' },
  { key: PERMISSIONS.SETTINGS_VIEW, module: 'settings', description: 'View branch settings' },
  { key: PERMISSIONS.SETTINGS_MANAGE, module: 'settings', description: 'Update branch settings' },

  { key: PERMISSIONS.MENU_VIEW, module: 'menu', description: 'View categories, items, combos' },
  { key: PERMISSIONS.MENU_CREATE, module: 'menu', description: 'Create categories, items, combos' },
  { key: PERMISSIONS.MENU_UPDATE, module: 'menu', description: 'Update menu items, prices, availability' },
  { key: PERMISSIONS.MENU_DELETE, module: 'menu', description: 'Delete menu items and categories' },

  { key: PERMISSIONS.TABLES_VIEW, module: 'tables', description: 'View floors and tables' },
  { key: PERMISSIONS.TABLES_MANAGE, module: 'tables', description: 'Manage floors, tables, and layout' },
  { key: PERMISSIONS.RESERVATIONS_VIEW, module: 'reservations', description: 'View reservations and waitlist' },
  { key: PERMISSIONS.RESERVATIONS_MANAGE, module: 'reservations', description: 'Manage reservations and waitlist' },

  { key: PERMISSIONS.ORDERS_VIEW, module: 'orders', description: 'View orders and order history' },
  { key: PERMISSIONS.ORDERS_CREATE, module: 'orders', description: 'Create POS orders' },
  { key: PERMISSIONS.ORDERS_UPDATE, module: 'orders', description: 'Update, hold, split, or merge orders' },
  { key: PERMISSIONS.ORDERS_CANCEL, module: 'orders', description: 'Cancel or void orders' },
  { key: PERMISSIONS.ORDERS_REFUND, module: 'orders', description: 'Issue order refunds' },

  { key: PERMISSIONS.KITCHEN_VIEW, module: 'kitchen', description: 'View kitchen display tickets' },
  { key: PERMISSIONS.KITCHEN_UPDATE, module: 'kitchen', description: 'Update kitchen ticket preparation status' },

  { key: PERMISSIONS.PAYMENTS_VIEW, module: 'payments', description: 'View payments and invoices' },
  { key: PERMISSIONS.PAYMENTS_PROCESS, module: 'payments', description: 'Process order payments' },
  { key: PERMISSIONS.CASH_DRAWER_MANAGE, module: 'payments', description: 'Open, close, and reconcile cash drawers' },

  { key: PERMISSIONS.INVENTORY_VIEW, module: 'inventory', description: 'View ingredients, recipes, and stock' },
  { key: PERMISSIONS.INVENTORY_ADJUST, module: 'inventory', description: 'Adjust stock, record wastage, stock-take' },
  { key: PERMISSIONS.INVENTORY_MANAGE, module: 'inventory', description: 'Create/edit ingredients and recipes' },

  { key: PERMISSIONS.SUPPLIERS_VIEW, module: 'suppliers', description: 'View suppliers and purchase orders' },
  { key: PERMISSIONS.SUPPLIERS_MANAGE, module: 'suppliers', description: 'Manage suppliers' },
  { key: PERMISSIONS.PURCHASING_MANAGE, module: 'suppliers', description: 'Manage POs, goods receipts, supplier payments' },

  { key: PERMISSIONS.CUSTOMERS_VIEW, module: 'customers', description: 'View customer profiles and feedback' },
  { key: PERMISSIONS.CUSTOMERS_MANAGE, module: 'customers', description: 'Create/edit customers and coupons' },
  { key: PERMISSIONS.LOYALTY_MANAGE, module: 'customers', description: 'Manage loyalty points and campaigns' },

  { key: PERMISSIONS.DELIVERY_VIEW, module: 'delivery', description: 'View deliveries, zones, and riders' },
  { key: PERMISSIONS.DELIVERY_MANAGE, module: 'delivery', description: 'Assign riders and manage delivery zones' },

  { key: PERMISSIONS.STAFF_VIEW, module: 'staff', description: 'View employees, shifts, and attendance' },
  { key: PERMISSIONS.STAFF_MANAGE, module: 'staff', description: 'Manage employees, shifts, and leaves' },
  { key: PERMISSIONS.PAYROLL_MANAGE, module: 'staff', description: 'Generate and manage payroll' },

  { key: PERMISSIONS.EXPENSES_VIEW, module: 'expenses', description: 'View expenses' },
  { key: PERMISSIONS.EXPENSES_MANAGE, module: 'expenses', description: 'Record and manage expenses' },
  { key: PERMISSIONS.ACCOUNTING_VIEW, module: 'expenses', description: 'View P&L, cash flow, and tax reports' },

  { key: PERMISSIONS.REPORTS_VIEW, module: 'reports', description: 'View analytics and sales reports' },
  { key: PERMISSIONS.REPORTS_EXPORT, module: 'reports', description: 'Export reports as PDF, Excel, CSV' },
  { key: PERMISSIONS.DASHBOARD_VIEW, module: 'dashboard', description: 'View KPI dashboard' },
  { key: PERMISSIONS.AUDIT_VIEW, module: 'audit', description: 'View security and operational audit logs' },
];

