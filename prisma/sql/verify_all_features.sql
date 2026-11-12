-- ============================================================================
-- Restaurant Management System (ERP / POS) — Complete Supabase SQL Verification
-- Covers: SELECT, CREATE (INSERT), UPDATE, and DELETE (Soft & Hard)
-- Target: Supabase PostgreSQL (public schema managed by Prisma)
-- Note: Double-quoted identifiers preserve exact Prisma PascalCase/camelCase names.
-- ============================================================================

-- ============================================================================
-- 0. DATABASE OVERVIEW: ALL TABLES & LIVE ROW COUNTS
-- ============================================================================
SELECT 'Branch' AS table_name, COUNT(*) AS total FROM "Branch" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Setting', COUNT(*) FROM "Setting" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Role', COUNT(*) FROM "Role" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Permission', COUNT(*) FROM "Permission"
UNION ALL SELECT 'User', COUNT(*) FROM "User" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'AuditLog', COUNT(*) FROM "AuditLog"
UNION ALL SELECT 'Category', COUNT(*) FROM "Category" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'MenuItem', COUNT(*) FROM "MenuItem" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Floor', COUNT(*) FROM "Floor" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Table', COUNT(*) FROM "Table" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Reservation', COUNT(*) FROM "Reservation" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Waitlist', COUNT(*) FROM "Waitlist" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Order', COUNT(*) FROM "Order" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'OrderItem', COUNT(*) FROM "OrderItem"
UNION ALL SELECT 'KitchenTicket', COUNT(*) FROM "KitchenTicket"
UNION ALL SELECT 'Payment', COUNT(*) FROM "Payment"
UNION ALL SELECT 'Invoice', COUNT(*) FROM "Invoice"
UNION ALL SELECT 'Coupon', COUNT(*) FROM "Coupon" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Customer', COUNT(*) FROM "Customer" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Ingredient', COUNT(*) FROM "Ingredient" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Recipe', COUNT(*) FROM "Recipe"
UNION ALL SELECT 'WastageLog', COUNT(*) FROM "WastageLog"
UNION ALL SELECT 'Supplier', COUNT(*) FROM "Supplier" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'PurchaseOrder', COUNT(*) FROM "PurchaseOrder" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Employee', COUNT(*) FROM "Employee" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Payroll', COUNT(*) FROM "Payroll"
UNION ALL SELECT 'ExpenseCategory', COUNT(*) FROM "ExpenseCategory" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Expense', COUNT(*) FROM "Expense" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'DeliveryZone', COUNT(*) FROM "DeliveryZone" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Rider', COUNT(*) FROM "Rider" WHERE "deletedAt" IS NULL
UNION ALL SELECT 'Delivery', COUNT(*) FROM "Delivery"
UNION ALL SELECT 'Notification', COUNT(*) FROM "Notification"
ORDER BY table_name;

-- ============================================================================
-- 1. BRANCHES, MULTI-CURRENCY & MULTI-LANGUAGE (Settings)
-- ============================================================================
-- SELECT active branches + localization settings
SELECT
  b."id",
  b."code",
  b."name",
  b."currency",
  b."timezone",
  s."key" AS setting_key,
  s."value" AS setting_value
FROM "Branch" b
LEFT JOIN "Setting" s ON s."branchId" = b."id" AND s."deletedAt" IS NULL
WHERE b."deletedAt" IS NULL;

-- CREATE a test branch + currency/language setting
INSERT INTO "Branch" ("id", "name", "code", "address", "phone", "currency", "timezone", "updatedAt")
VALUES (gen_random_uuid()::text, 'SQL Test Branch', 'SQL-TEST-01', '123 Test Street', '+92-300-0000001', 'PKR', 'Asia/Karachi', NOW());

-- UPDATE active currency / language on a branch
UPDATE "Branch"
SET "currency" = 'USD', "updatedAt" = NOW()
WHERE "code" = 'SQL-TEST-01';

-- DELETE (Soft Delete & Hard Delete) test branch
UPDATE "Branch" SET "deletedAt" = NOW(), "isActive" = false, "updatedAt" = NOW() WHERE "code" = 'SQL-TEST-01';
DELETE FROM "Branch" WHERE "code" = 'SQL-TEST-01';

-- ============================================================================
-- 2. AUTH, USERS, ROLES, PERMISSIONS & AUDIT LOGS
-- ============================================================================
-- SELECT all active users with roles & recent audit logs
SELECT u."id", u."email", u."firstName", u."lastName", r."slug" AS role_slug, u."isActive", u."lastLoginAt"
FROM "User" u
JOIN "Role" r ON r."id" = u."roleId"
WHERE u."deletedAt" IS NULL
ORDER BY u."createdAt" DESC;

SELECT "action", "entity", "entityId", "newValues", "createdAt"
FROM "AuditLog"
ORDER BY "createdAt" DESC
LIMIT 25;

-- CREATE a test cashier user
INSERT INTO "User" ("id", "branchId", "roleId", "email", "passwordHash", "firstName", "lastName", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  (SELECT "id" FROM "Role" WHERE "slug" = 'cashier' LIMIT 1),
  'sql.test.user@rms-enterprise.local',
  '$2a$12$dummyBcryptHashForSqlVerificationTestOnly00000000000000',
  'SQL',
  'Tester',
  NOW()
);

-- DELETE (Soft Delete & Hard Delete) test user
UPDATE "User" SET "deletedAt" = NOW(), "isActive" = false, "updatedAt" = NOW() WHERE "email" = 'sql.test.user@rms-enterprise.local';
DELETE FROM "User" WHERE "email" = 'sql.test.user@rms-enterprise.local';

-- ============================================================================
-- 3. MENU CATEGORIES & MENU ITEMS (Create, Select, Update, Soft/Hard Delete)
-- ============================================================================
-- SELECT active categories and menu items
SELECT c."id", c."name" AS category_name, c."slug", COUNT(m."id") AS item_count
FROM "Category" c
LEFT JOIN "MenuItem" m ON m."categoryId" = c."id" AND m."deletedAt" IS NULL
WHERE c."deletedAt" IS NULL
GROUP BY c."id", c."name", c."slug"
ORDER BY c."sortOrder";

SELECT m."id", m."sku", m."name", m."price", m."costPrice", m."station", m."isAvailable", c."name" AS category
FROM "MenuItem" m
JOIN "Category" c ON c."id" = m."categoryId"
WHERE m."deletedAt" IS NULL
ORDER BY m."sku";

-- CREATE a test category and menu item
INSERT INTO "Category" ("id", "branchId", "name", "slug", "description", "sortOrder", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SQL Test Category',
  'sql-test-category',
  'Temporary verification category',
  99,
  NOW()
);

INSERT INTO "MenuItem" ("id", "branchId", "categoryId", "sku", "name", "price", "costPrice", "station", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  (SELECT "id" FROM "Category" WHERE "slug" = 'sql-test-category' LIMIT 1),
  'SQL-ITEM-01',
  'SQL Test Burger',
  1250.00,
  450.00,
  'GRILL',
  NOW()
);

-- UPDATE menu item price
UPDATE "MenuItem" SET "price" = 1390.00, "updatedAt" = NOW() WHERE "sku" = 'SQL-ITEM-01';

-- DELETE Menu Item & Category (Soft Delete matches API; Hard Delete cleans up)
UPDATE "MenuItem" SET "deletedAt" = NOW(), "isAvailable" = false, "updatedAt" = NOW() WHERE "sku" = 'SQL-ITEM-01';
DELETE FROM "MenuItem" WHERE "sku" = 'SQL-ITEM-01';

UPDATE "Category" SET "deletedAt" = NOW(), "isActive" = false, "updatedAt" = NOW() WHERE "slug" = 'sql-test-category';
DELETE FROM "Category" WHERE "slug" = 'sql-test-category';

-- ============================================================================
-- 4. FLOORS, TABLES, RESERVATIONS & WAITLIST
-- ============================================================================
-- SELECT tables, floors, reservations, waitlist
SELECT f."name" AS floor_name, t."tableNumber", t."capacity", t."status"
FROM "Table" t
JOIN "Floor" f ON f."id" = t."floorId"
WHERE t."deletedAt" IS NULL
ORDER BY f."floorNumber", t."tableNumber";

SELECT "id", "guestName", "guestPhone", "partySize", "reservationTime", "status"
FROM "Reservation"
WHERE "deletedAt" IS NULL
ORDER BY "reservationTime" DESC;

-- CREATE & DELETE a test reservation and waitlist entry
INSERT INTO "Reservation" ("id", "branchId", "tableId", "guestName", "guestPhone", "partySize", "reservationTime", "status", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  (SELECT "id" FROM "Table" WHERE "deletedAt" IS NULL LIMIT 1),
  'SQL Test Guest',
  '+92-300-1112233',
  4,
  NOW() + INTERVAL '1 day',
  'CONFIRMED'::"ReservationStatus",
  NOW()
);
DELETE FROM "Reservation" WHERE "guestName" = 'SQL Test Guest';

INSERT INTO "Waitlist" ("id", "branchId", "guestName", "guestPhone", "partySize", "estimatedWaitMinutes", "status", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SQL Waitlist Guest',
  '+92-300-1112244',
  2,
  15,
  'WAITING'::"WaitlistStatus",
  NOW()
);
DELETE FROM "Waitlist" WHERE "guestName" = 'SQL Waitlist Guest';

-- ============================================================================
-- 5. ORDERS, ORDER ITEMS & KITCHEN DISPLAY SYSTEM (KDS)
-- ============================================================================
-- SELECT recent orders and revenue summary
SELECT
  COUNT(*) AS total_orders,
  SUM("totalAmount") AS gross_revenue,
  SUM("taxAmount") AS total_tax,
  SUM("discountAmount") AS total_discounts
FROM "Order"
WHERE "deletedAt" IS NULL AND "status" <> 'CANCELLED'::"OrderStatus";

SELECT o."orderNumber", o."orderType", o."status", o."totalAmount", o."createdAt"
FROM "Order" o
WHERE o."deletedAt" IS NULL
ORDER BY o."createdAt" DESC
LIMIT 20;

-- CREATE an order + order item + kitchen ticket, then UPDATE & DELETE cleanly
WITH new_order AS (
  INSERT INTO "Order" (
    "id", "branchId", "orderNumber", "orderType", "status",
    "guestCount", "subtotal", "taxAmount", "totalAmount", "updatedAt"
  )
  VALUES (
    gen_random_uuid()::text,
    (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
    'ORD-SQL-TEST-001',
    'TAKEAWAY'::"OrderType",
    'NEW'::"OrderStatus",
    1,
    1000.00,
    100.00,
    1100.00,
    NOW()
  )
  RETURNING "id", "branchId"
)
INSERT INTO "OrderItem" ("id", "orderId", "menuItemId", "itemName", "quantity", "unitPrice", "subtotal", "status", "updatedAt")
SELECT
  gen_random_uuid()::text,
  no."id",
  m."id",
  m."name",
  1,
  1000.00,
  1000.00,
  'QUEUED'::"KitchenTicketStatus",
  NOW()
FROM new_order no
CROSS JOIN (SELECT "id", "name" FROM "MenuItem" WHERE "deletedAt" IS NULL LIMIT 1) m;

UPDATE "Order" SET "status" = 'PREPARING'::"OrderStatus", "updatedAt" = NOW() WHERE "orderNumber" = 'ORD-SQL-TEST-001';
DELETE FROM "Order" WHERE "orderNumber" = 'ORD-SQL-TEST-001';

-- ============================================================================
-- 6. PAYMENTS, INVOICES & COUPONS
-- ============================================================================
-- SELECT payment breakdown & active coupons
SELECT "method", "status", COUNT(*) AS tx_count, SUM("amount") AS total_amount, SUM("tipAmount") AS total_tips
FROM "Payment"
GROUP BY "method", "status"
ORDER BY total_amount DESC;

SELECT "code", "type", "value", "usedCount", "usageLimit", "isActive"
FROM "Coupon"
WHERE "deletedAt" IS NULL;

-- CREATE, UPDATE & DELETE a test coupon
INSERT INTO "Coupon" ("id", "branchId", "code", "description", "type", "value", "minOrderAmount", "isActive", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SQLTEST10',
  'Temporary SQL verification coupon',
  'PERCENTAGE'::"DiscountType",
  10.00,
  50.00,
  true,
  NOW()
);
UPDATE "Coupon" SET "value" = 15.00, "updatedAt" = NOW() WHERE "code" = 'SQLTEST10';
DELETE FROM "Coupon" WHERE "code" = 'SQLTEST10';

-- ============================================================================
-- 7. INVENTORY INGREDIENTS, RECIPES & WASTAGE
-- ============================================================================
-- SELECT inventory stock valuation & low-stock items
SELECT "sku", "name", "unit", "currentStock", "reorderLevel", "costPerUnit",
       ROUND(("currentStock" * "costPerUnit")::numeric, 2) AS stock_value
FROM "Ingredient"
WHERE "deletedAt" IS NULL
ORDER BY stock_value DESC;

SELECT "sku", "name", "currentStock", "reorderLevel"
FROM "Ingredient"
WHERE "deletedAt" IS NULL AND "currentStock" <= "reorderLevel";

-- CREATE, UPDATE & DELETE a test ingredient
INSERT INTO "Ingredient" ("id", "branchId", "sku", "name", "unit", "currentStock", "reorderLevel", "costPerUnit", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'ING-SQL-999',
  'SQL Test Saffron',
  'g',
  250.000,
  50.000,
  15.00,
  NOW()
);
UPDATE "Ingredient" SET "currentStock" = 300.000, "updatedAt" = NOW() WHERE "sku" = 'ING-SQL-999';
DELETE FROM "Ingredient" WHERE "sku" = 'ING-SQL-999';

-- ============================================================================
-- 8. SUPPLIERS & PURCHASE ORDERS
-- ============================================================================
-- SELECT suppliers & purchase orders
SELECT "name", "contactPerson", "phone", "balanceDue", "isActive"
FROM "Supplier"
WHERE "deletedAt" IS NULL;

-- CREATE, UPDATE & DELETE a test supplier
INSERT INTO "Supplier" ("id", "branchId", "name", "contactPerson", "phone", "email", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SQL Test Food Distributors',
  'Bilal Khan',
  '+92-300-8889999',
  'sql.supplier@example.com',
  NOW()
);
UPDATE "Supplier" SET "balanceDue" = 5000.00, "updatedAt" = NOW() WHERE "email" = 'sql.supplier@example.com';
DELETE FROM "Supplier" WHERE "email" = 'sql.supplier@example.com';

-- ============================================================================
-- 9. CUSTOMERS CRM, LOYALTY & FEEDBACK
-- ============================================================================
-- SELECT top customers by spend & loyalty tier
SELECT "firstName", "lastName", "phone", "tier", "segment", "loyaltyPoints", "visitCount", "totalSpent"
FROM "Customer"
WHERE "deletedAt" IS NULL
ORDER BY "totalSpent" DESC
LIMIT 20;

-- CREATE, UPDATE & DELETE a test customer
INSERT INTO "Customer" ("id", "branchId", "firstName", "lastName", "phone", "email", "loyaltyPoints", "tier", "segment", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SQL',
  'Customer',
  '+92-300-7770001',
  'sql.customer@example.com',
  100,
  'BRONZE',
  'NEW',
  NOW()
);
UPDATE "Customer" SET "loyaltyPoints" = 300, "tier" = 'SILVER', "updatedAt" = NOW() WHERE "phone" = '+92-300-7770001';
DELETE FROM "Customer" WHERE "phone" = '+92-300-7770001';

-- ============================================================================
-- 10. STAFF, EMPLOYEES, ATTENDANCE & PAYROLL
-- ============================================================================
-- SELECT employees joined with User accounts
SELECT e."employeeCode", u."firstName", u."lastName", e."designation", e."department", e."baseSalary", e."hourlyRate"
FROM "Employee" e
JOIN "User" u ON u."id" = e."userId"
WHERE e."deletedAt" IS NULL
ORDER BY e."employeeCode";

-- SELECT payrolls
SELECT p."periodYear", p."periodMonth", e."employeeCode", p."baseSalary", p."overtimePay", p."tipsShare", p."netPay", p."status"
FROM "Payroll" p
JOIN "Employee" e ON e."id" = p."employeeId"
ORDER BY p."periodYear" DESC, p."periodMonth" DESC;

-- ============================================================================
-- 11. EXPENSE CATEGORIES & EXPENSES
-- ============================================================================
-- SELECT expenses by category
SELECT ec."name" AS category, e."title", e."amount", e."method", e."incurredAt"
FROM "Expense" e
JOIN "ExpenseCategory" ec ON ec."id" = e."categoryId"
WHERE e."deletedAt" IS NULL
ORDER BY e."incurredAt" DESC;

-- CREATE, UPDATE & DELETE a test expense category & expense
INSERT INTO "ExpenseCategory" ("id", "branchId", "name", "description", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SQL Test Expense Cat',
  'Temporary category',
  NOW()
);

INSERT INTO "Expense" ("id", "branchId", "categoryId", "title", "amount", "method", "notes", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  (SELECT "id" FROM "ExpenseCategory" WHERE "name" = 'SQL Test Expense Cat' LIMIT 1),
  'SQL Test Receipt',
  500.00,
  'CASH'::"PaymentMethod",
  'Verification check',
  NOW()
);

DELETE FROM "Expense" WHERE "title" = 'SQL Test Receipt';
DELETE FROM "ExpenseCategory" WHERE "name" = 'SQL Test Expense Cat';

-- ============================================================================
-- 12. DELIVERY ZONES, RIDERS & DELIVERIES
-- ============================================================================
-- SELECT delivery zones & riders
SELECT "name", "deliveryFee", "minOrderAmount", "estimatedTimeMin", "isActive"
FROM "DeliveryZone"
WHERE "deletedAt" IS NULL;

SELECT "name", "phone", "vehicleNo", "status", "isActive"
FROM "Rider"
WHERE "deletedAt" IS NULL;

-- CREATE, UPDATE & DELETE a test delivery zone & rider
INSERT INTO "DeliveryZone" ("id", "branchId", "name", "deliveryFee", "minOrderAmount", "estimatedTimeMin", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SQL Test Zone',
  150.00,
  500.00,
  30,
  NOW()
);
DELETE FROM "DeliveryZone" WHERE "name" = 'SQL Test Zone';

INSERT INTO "Rider" ("id", "branchId", "name", "phone", "vehicleNo", "status", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SQL Test Rider',
  '+92-300-9990001',
  'SQL-123',
  'AVAILABLE',
  NOW()
);
DELETE FROM "Rider" WHERE "name" = 'SQL Test Rider';

-- ============================================================================
-- 13. NOTIFICATIONS & USER NOTIFICATION PREFERENCES
-- ============================================================================
-- SELECT recent notifications
SELECT "id", "type", "title", "message", "isRead", "createdAt"
FROM "Notification"
ORDER BY "createdAt" DESC
LIMIT 20;

-- CREATE, UPDATE (mark read) & DELETE a test notification
INSERT INTO "Notification" ("id", "branchId", "type", "title", "message", "isRead")
VALUES (
  gen_random_uuid()::text,
  (SELECT "id" FROM "Branch" WHERE "code" = 'HQ-MAIN' LIMIT 1),
  'SYSTEM',
  'SQL Verification Alert',
  'Verified live PostgreSQL insert on Notification table.',
  false
);
UPDATE "Notification" SET "isRead" = true, "readAt" = NOW() WHERE "title" = 'SQL Verification Alert';
DELETE FROM "Notification" WHERE "title" = 'SQL Verification Alert';

