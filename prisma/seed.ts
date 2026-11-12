import {
  DiscountType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  TableStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { env } from '../src/config/env';
import { ALL_PERMISSIONS } from '../src/constants/permissions';
import { DEFAULT_ROLE_DEFINITIONS, ROLES } from '../src/constants/roles';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Restaurant Management System database seed...');

  // 0. Ensure Row Level Security (RLS) is enabled on all public tables with no public policies
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE '_prisma%'
      ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated;', r.tablename);
      END LOOP;
    END $$;
  `);
  console.log('🔒 Enabled Row Level Security (RLS) on all public tables in Supabase');

  // 1. Seed Permissions (Batch createMany for fast execution)
  await prisma.permission.createMany({
    data: ALL_PERMISSIONS,
    skipDuplicates: true,
  });
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map(allPerms.map((p) => [p.key, p.id]));
  console.log(`✅ Verified ${allPerms.length} granular permissions`);

  // 2. Seed Default Roles & RolePermissions
  const roleMap = new Map<string, string>();
  for (const roleDef of DEFAULT_ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { slug: roleDef.slug },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
      create: {
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
    });
    roleMap.set(roleDef.slug, role.id);

    const rolePermData = roleDef.permissions
      .map((key) => permMap.get(key))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({
        roleId: role.id,
        permissionId,
      }));

    await prisma.rolePermission.createMany({
      data: rolePermData,
      skipDuplicates: true,
    });
  }
  console.log(`✅ Verified ${DEFAULT_ROLE_DEFINITIONS.length} roles with permissions`);

  // 3. Seed Flagship Branch
  const branch = await prisma.branch.upsert({
    where: { code: 'HQ-MAIN' },
    update: {},
    create: {
      name: 'Grand Bistro Downtown Flagship',
      code: 'HQ-MAIN',
      address: '450 Culinary Avenue, Suite 100, New York, NY 10001',
      phone: '+1-212-555-0199',
      email: 'downtown@grandbistro.local',
      currency: 'USD',
      timezone: 'America/New_York',
      taxRatePercent: 8.88,
      serviceChargePercent: 5.0,
      orderNumberPrefix: 'ORD',
      receiptHeader: 'GRAND BISTRO — FINE DINING & ARTISAN KITCHEN',
      receiptFooter: 'Thank you for dining with us! Visit grandbistro.local',
      businessHours: {
        monday: { open: '08:00', close: '23:00' },
        tuesday: { open: '08:00', close: '23:00' },
        wednesday: { open: '08:00', close: '23:00' },
        thursday: { open: '08:00', close: '23:30' },
        friday: { open: '08:00', close: '00:30' },
        saturday: { open: '09:00', close: '00:30' },
        sunday: { open: '09:00', close: '22:30' },
      },
    },
  });
  console.log(`✅ Verified flagship branch: ${branch.name} (${branch.code})`);

  // 4. Seed Super Admin User from ENV
  const superAdminRoleId = roleMap.get(ROLES.SUPER_ADMIN)!;
  const adminPasswordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);

  const superAdmin = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL.toLowerCase() },
    update: {
      passwordHash: adminPasswordHash,
      roleId: superAdminRoleId,
      branchId: branch.id,
      isActive: true,
    },
    create: {
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+1-212-555-0100',
      pinCode: '1234',
      roleId: superAdminRoleId,
      branchId: branch.id,
      isActive: true,
    },
  });
  console.log(`✅ Verified Super Admin user: ${superAdmin.email}`);

  // 5. Seed 8 Menu Categories
  const categoryDefs = [
    { name: 'Artisan Starters & Tapas', slug: 'starters-tapas', sortOrder: 1 },
    { name: 'Wood-Fired Neapolitan Pizzas', slug: 'wood-fired-pizzas', sortOrder: 2 },
    { name: 'Handcrafted Pastas & Risotto', slug: 'pastas-risotto', sortOrder: 3 },
    { name: 'Prime Steaks & Grill', slug: 'prime-steaks-grill', sortOrder: 4 },
    { name: 'Fresh Seafood & Raw Bar', slug: 'fresh-seafood', sortOrder: 5 },
    { name: 'Gourmet Burgers & Sandwiches', slug: 'burgers-sandwiches', sortOrder: 6 },
    { name: 'Patisserie & Desserts', slug: 'desserts', sortOrder: 7 },
    { name: 'Craft Beverages & Espresso Bar', slug: 'beverages-espresso', sortOrder: 8 },
  ];

  await prisma.category.createMany({
    data: categoryDefs.map((c) => ({
      branchId: branch.id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder,
      isActive: true,
      createdBy: superAdmin.id,
    })),
    skipDuplicates: true,
  });

  const dbCategories = await prisma.category.findMany({ where: { branchId: branch.id } });
  const catMap = new Map(dbCategories.map((c) => [c.slug, c.id]));
  console.log(`✅ Seeded ${dbCategories.length} menu categories`);

  // 6. Seed 52 Menu Items across the 8 Categories
  const menuItemsData = [
    // Starters (7)
    { cat: 'starters-tapas', sku: 'STR-001', name: 'Burrata & Heirloom Tomato', price: 16.5, costPrice: 4.8, station: 'MAIN_KITCHEN', prepTimeMinutes: 8, isVegetarian: true },
    { cat: 'starters-tapas', sku: 'STR-002', name: 'Crispy Calamari Fritti', price: 18.0, costPrice: 5.5, station: 'MAIN_KITCHEN', prepTimeMinutes: 10, isVegetarian: false },
    { cat: 'starters-tapas', sku: 'STR-003', name: 'Truffle Arancini (4 pcs)', price: 15.0, costPrice: 4.2, station: 'MAIN_KITCHEN', prepTimeMinutes: 10, isVegetarian: true },
    { cat: 'starters-tapas', sku: 'STR-004', name: 'Wagyu Beef Carpaccio', price: 22.0, costPrice: 7.5, station: 'MAIN_KITCHEN', prepTimeMinutes: 8, isVegetarian: false },
    { cat: 'starters-tapas', sku: 'STR-005', name: 'Charred Octopus Tentacle', price: 24.0, costPrice: 8.2, station: 'GRILL', prepTimeMinutes: 12, isVegetarian: false },
    { cat: 'starters-tapas', sku: 'STR-006', name: 'Wild Mushroom Bruschetta', price: 14.0, costPrice: 3.6, station: 'MAIN_KITCHEN', prepTimeMinutes: 8, isVegetarian: true },
    { cat: 'starters-tapas', sku: 'STR-007', name: 'French Onion Soup Gratinée', price: 13.5, costPrice: 3.2, station: 'MAIN_KITCHEN', prepTimeMinutes: 10, isVegetarian: false },
    // Pizzas (7)
    { cat: 'wood-fired-pizzas', sku: 'PIZ-001', name: 'Margherita D.O.P.', price: 19.0, costPrice: 4.5, station: 'MAIN_KITCHEN', prepTimeMinutes: 12, isVegetarian: true },
    { cat: 'wood-fired-pizzas', sku: 'PIZ-002', name: 'Diavola Spicy Soppressata', price: 22.5, costPrice: 6.1, station: 'MAIN_KITCHEN', prepTimeMinutes: 12, isVegetarian: false },
    { cat: 'wood-fired-pizzas', sku: 'PIZ-003', name: 'Tartufo & Black Truffle Cream', price: 26.0, costPrice: 7.8, station: 'MAIN_KITCHEN', prepTimeMinutes: 14, isVegetarian: true },
    { cat: 'wood-fired-pizzas', sku: 'PIZ-004', name: 'Prosciutto di Parma & Arugula', price: 24.5, costPrice: 6.9, station: 'MAIN_KITCHEN', prepTimeMinutes: 13, isVegetarian: false },
    { cat: 'wood-fired-pizzas', sku: 'PIZ-005', name: 'Quattro Formaggi Artisanal', price: 21.5, costPrice: 5.8, station: 'MAIN_KITCHEN', prepTimeMinutes: 12, isVegetarian: true },
    { cat: 'wood-fired-pizzas', sku: 'PIZ-006', name: 'Capricciosa Classica', price: 23.0, costPrice: 6.4, station: 'MAIN_KITCHEN', prepTimeMinutes: 13, isVegetarian: false },
    { cat: 'wood-fired-pizzas', sku: 'PIZ-007', name: 'Fennel Sausage & Caramelized Onion', price: 23.5, costPrice: 6.5, station: 'MAIN_KITCHEN', prepTimeMinutes: 13, isVegetarian: false },
    // Pastas (7)
    { cat: 'pastas-risotto', sku: 'PAS-001', name: 'Tagliatelle al Ragù Bolognese', price: 24.0, costPrice: 6.2, station: 'MAIN_KITCHEN', prepTimeMinutes: 15, isVegetarian: false },
    { cat: 'pastas-risotto', sku: 'PAS-002', name: 'Lobster Ravioli in Saffron Bisque', price: 32.0, costPrice: 10.5, station: 'MAIN_KITCHEN', prepTimeMinutes: 16, isVegetarian: false },
    { cat: 'pastas-risotto', sku: 'PAS-003', name: 'Cacio e Pepe Tonnarelli', price: 21.0, costPrice: 4.9, station: 'MAIN_KITCHEN', prepTimeMinutes: 14, isVegetarian: true },
    { cat: 'pastas-risotto', sku: 'PAS-004', name: 'Porcini & Black Truffle Risotto', price: 28.0, costPrice: 7.9, station: 'MAIN_KITCHEN', prepTimeMinutes: 18, isVegetarian: true },
    { cat: 'pastas-risotto', sku: 'PAS-005', name: 'Spaghetti alle Vongole', price: 26.5, costPrice: 8.1, station: 'MAIN_KITCHEN', prepTimeMinutes: 15, isVegetarian: false },
    { cat: 'pastas-risotto', sku: 'PAS-006', name: 'Pappardelle Short Rib Braise', price: 29.0, costPrice: 8.8, station: 'MAIN_KITCHEN', prepTimeMinutes: 16, isVegetarian: false },
    { cat: 'pastas-risotto', sku: 'PAS-007', name: 'Gnocchi Sorrentina Baked', price: 22.0, costPrice: 5.4, station: 'MAIN_KITCHEN', prepTimeMinutes: 14, isVegetarian: true },
    // Steaks & Grill (6)
    { cat: 'prime-steaks-grill', sku: 'STK-001', name: '8oz Center-Cut Filet Mignon', price: 48.0, costPrice: 17.5, station: 'GRILL', prepTimeMinutes: 20, isVegetarian: false },
    { cat: 'prime-steaks-grill', sku: 'STK-002', name: '14oz Dry-Aged Prime Ribeye', price: 56.0, costPrice: 21.0, station: 'GRILL', prepTimeMinutes: 22, isVegetarian: false },
    { cat: 'prime-steaks-grill', sku: 'STK-003', name: '12oz New York Strip Steak', price: 44.0, costPrice: 15.8, station: 'GRILL', prepTimeMinutes: 18, isVegetarian: false },
    { cat: 'prime-steaks-grill', sku: 'STK-004', name: 'Herb-Crusted Rack of Lamb', price: 46.0, costPrice: 16.5, station: 'GRILL', prepTimeMinutes: 22, isVegetarian: false },
    { cat: 'prime-steaks-grill', sku: 'STK-005', name: 'Roasted Half Organic Chicken', price: 29.5, costPrice: 9.2, station: 'GRILL', prepTimeMinutes: 20, isVegetarian: false },
    { cat: 'prime-steaks-grill', sku: 'STK-006', name: 'Berkshire Pork Chop Milanese', price: 34.0, costPrice: 11.0, station: 'GRILL', prepTimeMinutes: 18, isVegetarian: false },
    // Seafood (6)
    { cat: 'fresh-seafood', sku: 'SEA-001', name: 'Pan-Seared Chilean Sea Bass', price: 42.0, costPrice: 15.2, station: 'MAIN_KITCHEN', prepTimeMinutes: 18, isVegetarian: false },
    { cat: 'fresh-seafood', sku: 'SEA-002', name: 'Scottish King Salmon Fillet', price: 33.0, costPrice: 11.4, station: 'GRILL', prepTimeMinutes: 16, isVegetarian: false },
    { cat: 'fresh-seafood', sku: 'SEA-003', name: 'Diver Scallops & Cauliflower Purée', price: 38.0, costPrice: 13.8, station: 'MAIN_KITCHEN', prepTimeMinutes: 15, isVegetarian: false },
    { cat: 'fresh-seafood', sku: 'SEA-004', name: 'Mediterranean Whole Branzino', price: 39.0, costPrice: 14.0, station: 'GRILL', prepTimeMinutes: 20, isVegetarian: false },
    { cat: 'fresh-seafood', sku: 'SEA-005', name: 'Jumbo Tiger Prawns Garlic Butter', price: 31.0, costPrice: 10.6, station: 'GRILL', prepTimeMinutes: 14, isVegetarian: false },
    { cat: 'fresh-seafood', sku: 'SEA-006', name: 'East Coast Oysters (Half Dozen)', price: 24.0, costPrice: 8.5, station: 'MAIN_KITCHEN', prepTimeMinutes: 6, isVegetarian: false },
    // Burgers & Sandwiches (6)
    { cat: 'burgers-sandwiches', sku: 'BRG-001', name: 'Grand Bistro Wagyu Smash Burger', price: 23.0, costPrice: 7.2, station: 'GRILL', prepTimeMinutes: 14, isVegetarian: false },
    { cat: 'burgers-sandwiches', sku: 'BRG-002', name: 'Black Truffle & Gruyère Burger', price: 25.5, costPrice: 8.1, station: 'GRILL', prepTimeMinutes: 14, isVegetarian: false },
    { cat: 'burgers-sandwiches', sku: 'BRG-003', name: 'Crispy Buttermilk Chicken Brioche', price: 19.5, costPrice: 5.9, station: 'MAIN_KITCHEN', prepTimeMinutes: 12, isVegetarian: false },
    { cat: 'burgers-sandwiches', sku: 'BRG-004', name: 'Prime Rib French Dip Au Jus', price: 24.5, costPrice: 8.0, station: 'MAIN_KITCHEN', prepTimeMinutes: 12, isVegetarian: false },
    { cat: 'burgers-sandwiches', sku: 'BRG-005', name: 'Maine Lobster Roll', price: 31.0, costPrice: 11.2, station: 'MAIN_KITCHEN', prepTimeMinutes: 10, isVegetarian: false },
    { cat: 'burgers-sandwiches', sku: 'BRG-006', name: 'Artisanal Plant-Based Bistro Burger', price: 21.0, costPrice: 6.4, station: 'GRILL', prepTimeMinutes: 12, isVegetarian: true },
    // Desserts (6)
    { cat: 'desserts', sku: 'DES-001', name: 'Classic Tiramisu al Mascarpone', price: 13.0, costPrice: 3.1, station: 'DESSERT', prepTimeMinutes: 6, isVegetarian: true },
    { cat: 'desserts', sku: 'DES-002', name: 'Valrhona Molten Chocolate Lava Cake', price: 15.0, costPrice: 3.9, station: 'DESSERT', prepTimeMinutes: 12, isVegetarian: true },
    { cat: 'desserts', sku: 'DES-003', name: 'Tahitian Vanilla Bean Crème Brûlée', price: 13.5, costPrice: 3.2, station: 'DESSERT', prepTimeMinutes: 6, isVegetarian: true },
    { cat: 'desserts', sku: 'DES-004', name: 'Basque Burnt Cheesecake', price: 14.0, costPrice: 3.5, station: 'DESSERT', prepTimeMinutes: 6, isVegetarian: true },
    { cat: 'desserts', sku: 'DES-005', name: 'Pistachio Cannoli Siciliani', price: 12.5, costPrice: 2.9, station: 'DESSERT', prepTimeMinutes: 5, isVegetarian: true },
    { cat: 'desserts', sku: 'DES-006', name: 'Artisanal Gelato Trio', price: 11.5, costPrice: 2.6, station: 'DESSERT', prepTimeMinutes: 5, isVegetarian: true },
    // Beverages (7)
    { cat: 'beverages-espresso', sku: 'BEV-001', name: 'Double Espresso Macchiato', price: 5.5, costPrice: 0.9, station: 'BAR', prepTimeMinutes: 4, isVegetarian: true },
    { cat: 'beverages-espresso', sku: 'BEV-002', name: 'Artisanal Cappuccino', price: 6.5, costPrice: 1.2, station: 'BAR', prepTimeMinutes: 5, isVegetarian: true },
    { cat: 'beverages-espresso', sku: 'BEV-003', name: 'Iced Matcha Ceremonial Latte', price: 7.5, costPrice: 1.8, station: 'BAR', prepTimeMinutes: 5, isVegetarian: true },
    { cat: 'beverages-espresso', sku: 'BEV-004', name: 'Freshly Squeezed Blood Orange Juice', price: 8.0, costPrice: 2.1, station: 'BAR', prepTimeMinutes: 5, isVegetarian: true },
    { cat: 'beverages-espresso', sku: 'BEV-005', name: 'San Pellegrino Sparkling (750ml)', price: 9.0, costPrice: 2.4, station: 'BAR', prepTimeMinutes: 2, isVegetarian: true },
    { cat: 'beverages-espresso', sku: 'BEV-006', name: 'Passionfruit & Mint Virgin Mojito', price: 11.0, costPrice: 2.5, station: 'BAR', prepTimeMinutes: 6, isVegetarian: true },
    { cat: 'beverages-espresso', sku: 'BEV-007', name: 'House Rosemary Berry Limonata', price: 9.5, costPrice: 2.0, station: 'BAR', prepTimeMinutes: 5, isVegetarian: true },
  ];

  await prisma.menuItem.createMany({
    data: menuItemsData.map((m) => ({
      branchId: branch.id,
      categoryId: catMap.get(m.cat)!,
      sku: m.sku,
      name: m.name,
      price: m.price,
      costPrice: m.costPrice,
      station: m.station,
      prepTimeMinutes: m.prepTimeMinutes,
      isVegetarian: m.isVegetarian,
      isAvailable: true,
      createdBy: superAdmin.id,
    })),
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${menuItemsData.length} menu items across 8 categories`);

  // 7. Seed 2 Floors and 30 Tables
  const existingFloors = await prisma.floor.findMany({ where: { branchId: branch.id } });
  let floor1Id: string;
  let floor2Id: string;

  if (existingFloors.length >= 2) {
    floor1Id = existingFloors[0].id;
    floor2Id = existingFloors[1].id;
  } else {
    const f1 = await prisma.floor.create({
      data: { branchId: branch.id, name: 'Main Dining Hall', floorNumber: 1, createdBy: superAdmin.id },
    });
    const f2 = await prisma.floor.create({
      data: { branchId: branch.id, name: 'Rooftop Terrace & Lounge', floorNumber: 2, createdBy: superAdmin.id },
    });
    floor1Id = f1.id;
    floor2Id = f2.id;
  }

  const tablesData = [];
  for (let i = 1; i <= 30; i++) {
    const isFloor1 = i <= 18;
    const idxOnFloor = isFloor1 ? i - 1 : i - 19;
    const col = idxOnFloor % 6;
    const row = Math.floor(idxOnFloor / 6);
    tablesData.push({
      branchId: branch.id,
      floorId: isFloor1 ? floor1Id : floor2Id,
      tableNumber: `T-${String(i).padStart(2, '0')}`,
      capacity: i % 5 === 0 ? 8 : i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      status: TableStatus.AVAILABLE,
      shape: i % 4 === 0 ? 'CIRCLE' : 'RECTANGLE',
      posX: 60 + col * 140,
      posY: 60 + row * 140,
      width: 100,
      height: 100,
      isActive: true,
      createdBy: superAdmin.id,
    });
  }

  await prisma.table.createMany({
    data: tablesData,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded 30 tables across 2 floors`);

  // 8. Seed 40 Ingredients (Phase 3)
  const ingredientsData = [
    { sku: 'ING-001', name: 'USDA Prime Ribeye Beef', unit: 'kg', currentStock: 42.5, reorderLevel: 15, costPerUnit: 38.0 },
    { sku: 'ING-002', name: 'Filet Mignon Center Cut', unit: 'kg', currentStock: 28.0, reorderLevel: 10, costPerUnit: 46.0 },
    { sku: 'ING-003', name: 'A5 Wagyu Beef Blend', unit: 'kg', currentStock: 35.0, reorderLevel: 12, costPerUnit: 29.5 },
    { sku: 'ING-004', name: 'Organic Free-Range Chicken Breast', unit: 'kg', currentStock: 55.0, reorderLevel: 20, costPerUnit: 11.5 },
    { sku: 'ING-005', name: 'New Zealand Lamb Rack', unit: 'kg', currentStock: 22.0, reorderLevel: 8, costPerUnit: 34.0 },
    { sku: 'ING-006', name: 'Duck Leg Confit', unit: 'pcs', currentStock: 48, reorderLevel: 15, costPerUnit: 6.8 },
    { sku: 'ING-007', name: 'Veal Osso Buco Shanks', unit: 'kg', currentStock: 19.5, reorderLevel: 8, costPerUnit: 28.0 },
    { sku: 'ING-008', name: 'Guanciale Stagionato', unit: 'kg', currentStock: 14.0, reorderLevel: 5, costPerUnit: 24.0 },
    { sku: 'ING-009', name: 'Prosciutto di Parma 24-Month', unit: 'kg', currentStock: 12.5, reorderLevel: 5, costPerUnit: 32.0 },
    { sku: 'ING-010', name: 'Spicy Soppressata Calabrese', unit: 'kg', currentStock: 16.0, reorderLevel: 5, costPerUnit: 22.0 },
    { sku: 'ING-011', name: 'Pan-Seared Sea Scallops U-10', unit: 'kg', currentStock: 18.0, reorderLevel: 8, costPerUnit: 36.0 },
    { sku: 'ING-012', name: 'Norwegian Atlantic Salmon Fillet', unit: 'kg', currentStock: 32.0, reorderLevel: 12, costPerUnit: 21.5 },
    { sku: 'ING-013', name: 'Wild Mediterranean Branzino', unit: 'kg', currentStock: 24.0, reorderLevel: 10, costPerUnit: 26.0 },
    { sku: 'ING-014', name: 'Maine Lobster Tail', unit: 'pcs', currentStock: 36, reorderLevel: 12, costPerUnit: 16.5 },
    { sku: 'ING-015', name: 'Fresh Squid Rings (Calamari)', unit: 'kg', currentStock: 29.0, reorderLevel: 10, costPerUnit: 14.0 },
    { sku: 'ING-016', name: 'Sushi-Grade Yellowfin Tuna', unit: 'kg', currentStock: 15.0, reorderLevel: 6, costPerUnit: 35.0 },
    { sku: 'ING-017', name: 'Manila Clams Fresh', unit: 'kg', currentStock: 25.0, reorderLevel: 10, costPerUnit: 12.0 },
    { sku: 'ING-018', name: 'Mozzarella di Bufala Campana', unit: 'kg', currentStock: 40.0, reorderLevel: 15, costPerUnit: 16.0 },
    { sku: 'ING-019', name: 'Pugliese Fresh Burrata', unit: 'pcs', currentStock: 45, reorderLevel: 15, costPerUnit: 4.2 },
    { sku: 'ING-020', name: 'Parmigiano Reggiano 36-Month', unit: 'kg', currentStock: 30.0, reorderLevel: 10, costPerUnit: 27.0 },
    { sku: 'ING-021', name: 'Pecorino Romano DOP', unit: 'kg', currentStock: 22.0, reorderLevel: 8, costPerUnit: 21.0 },
    { sku: 'ING-022', name: 'Gorgonzola Dolce DOP', unit: 'kg', currentStock: 14.0, reorderLevel: 5, costPerUnit: 19.5 },
    { sku: 'ING-023', name: 'Mascarpone Cream Cheese', unit: 'kg', currentStock: 26.0, reorderLevel: 8, costPerUnit: 13.0 },
    { sku: 'ING-024', name: 'French Unsalted Butter 82%', unit: 'kg', currentStock: 50.0, reorderLevel: 15, costPerUnit: 9.8 },
    { sku: 'ING-025', name: 'Heavy Whipping Cream 36%', unit: 'l', currentStock: 45.0, reorderLevel: 15, costPerUnit: 5.4 },
    { sku: 'ING-026', name: 'Caputo Tipo 00 Pizza Flour', unit: 'kg', currentStock: 120.0, reorderLevel: 40, costPerUnit: 2.4 },
    { sku: 'ING-027', name: 'Carnaroli Risotto Rice', unit: 'kg', currentStock: 65.0, reorderLevel: 20, costPerUnit: 5.8 },
    { sku: 'ING-028', name: 'San Marzano DOP Tomatoes', unit: 'kg', currentStock: 95.0, reorderLevel: 30, costPerUnit: 4.1 },
    { sku: 'ING-029', name: 'Black Winter Truffle Paste', unit: 'kg', currentStock: 8.5, reorderLevel: 3, costPerUnit: 85.0 },
    { sku: 'ING-030', name: 'Wild Porcini Mushrooms Dried', unit: 'kg', currentStock: 15.0, reorderLevel: 5, costPerUnit: 42.0 },
    { sku: 'ING-031', name: 'Extra Virgin Olive Oil Siciliano', unit: 'l', currentStock: 60.0, reorderLevel: 20, costPerUnit: 14.5 },
    { sku: 'ING-032', name: 'Aged Balsamic Vinegar of Modena', unit: 'l', currentStock: 24.0, reorderLevel: 8, costPerUnit: 18.0 },
    { sku: 'ING-033', name: 'Organic Baby Romaine Hearts', unit: 'kg', currentStock: 35.0, reorderLevel: 12, costPerUnit: 6.2 },
    { sku: 'ING-034', name: 'Fresh Sweet Genovese Basil', unit: 'kg', currentStock: 8.0, reorderLevel: 4, costPerUnit: 15.0 },
    { sku: 'ING-035', name: 'Hass Avocados Ripe', unit: 'pcs', currentStock: 70, reorderLevel: 25, costPerUnit: 1.4 },
    { sku: 'ING-036', name: 'Brioche Artisanal Burger Buns', unit: 'pcs', currentStock: 90, reorderLevel: 30, costPerUnit: 0.95 },
    { sku: 'ING-037', name: 'Valrhona 70% Guanaja Dark Chocolate', unit: 'kg', currentStock: 22.0, reorderLevel: 8, costPerUnit: 24.5 },
    { sku: 'ING-038', name: 'Arabica Specialty Espresso Beans', unit: 'kg', currentStock: 38.0, reorderLevel: 12, costPerUnit: 19.0 },
    { sku: 'ING-039', name: 'Ceremonial Grade Uji Matcha Powder', unit: 'kg', currentStock: 6.0, reorderLevel: 2, costPerUnit: 95.0 },
    { sku: 'ING-040', name: 'San Pellegrino Sparkling 750ml Bottles', unit: 'pcs', currentStock: 120, reorderLevel: 36, costPerUnit: 2.4 },
  ];

  await prisma.ingredient.createMany({
    data: ingredientsData.map((ing) => ({
      branchId: branch.id,
      sku: ing.sku,
      name: ing.name,
      unit: ing.unit,
      currentStock: ing.currentStock,
      reorderLevel: ing.reorderLevel,
      costPerUnit: ing.costPerUnit,
      isActive: true,
      createdBy: superAdmin.id,
    })),
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${ingredientsData.length} inventory ingredients`);

  // Link sample recipes between MenuItems and Ingredients
  const dbMenuItems = await prisma.menuItem.findMany({
    where: { branchId: branch.id },
    select: { id: true, sku: true },
  });
  const dbIngredients = await prisma.ingredient.findMany({
    where: { branchId: branch.id },
    select: { id: true, sku: true },
  });
  const menuBySku = new Map(dbMenuItems.map((m) => [m.sku, m.id]));
  const ingBySku = new Map(dbIngredients.map((i) => [i.sku, i.id]));

  const sampleRecipes = [
    {
      menuSku: 'GRL-001',
      instructions: 'Season ribeye with sea salt, sear on cast-iron grill at 550°F for 4 mins per side, baste with truffle herb butter.',
      items: [
        { ingSku: 'ING-001', quantity: 0.34 },
        { ingSku: 'ING-024', quantity: 0.04 },
        { ingSku: 'ING-029', quantity: 0.01 },
      ],
    },
    {
      menuSku: 'PIZ-001',
      instructions: 'Stretch 260g dough ball, top with crushed San Marzano tomatoes, fresh mozzarella di bufala, and basil; bake at 900°F for 90 seconds.',
      items: [
        { ingSku: 'ING-026', quantity: 0.25 },
        { ingSku: 'ING-028', quantity: 0.12 },
        { ingSku: 'ING-018', quantity: 0.11 },
        { ingSku: 'ING-034', quantity: 0.015 },
      ],
    },
    {
      menuSku: 'GRL-006',
      instructions: 'Sear Wagyu patty on flat-top grill, top with aged cheddar and truffle aioli on toasted brioche bun.',
      items: [
        { ingSku: 'ING-003', quantity: 0.22 },
        { ingSku: 'ING-036', quantity: 1 },
        { ingSku: 'ING-029', quantity: 0.01 },
      ],
    },
  ];

  for (const r of sampleRecipes) {
    const menuItemId = menuBySku.get(r.menuSku);
    if (!menuItemId) continue;

    const existingRecipe = await prisma.recipe.findUnique({ where: { menuItemId } });
    if (!existingRecipe) {
      await prisma.recipe.create({
        data: {
          menuItemId,
          instructions: r.instructions,
          yieldQty: 1,
          createdBy: superAdmin.id,
          ingredients: {
            create: r.items
              .filter((i) => ingBySku.has(i.ingSku))
              .map((i) => ({
                ingredientId: ingBySku.get(i.ingSku)!,
                quantity: i.quantity,
              })),
          },
        },
      });
    }
  }
  console.log(`✅ Seeded sample recipes linking menu items to inventory ingredients`);

  // 9. Seed 5 Suppliers (Phase 3)
  const existingSuppliers = await prisma.supplier.count({ where: { branchId: branch.id } });
  if (existingSuppliers === 0) {
    const suppliersData = [
      {
        branchId: branch.id,
        name: 'Hudson Valley Prime Meats & Wagyu',
        contactPerson: 'Arthur Pendelton',
        phone: '+1-212-555-0801',
        email: 'orders@hudsonprimemeats.local',
        address: '410 Gansevoort St, Meatpacking District, NY 10014',
        taxId: 'EIN-84-2991001',
        balanceDue: 1450.0,
        createdBy: superAdmin.id,
      },
      {
        branchId: branch.id,
        name: 'Fulton Pier Atlantic Seafood Co.',
        contactPerson: 'Captain Matteo Conti',
        phone: '+1-212-555-0802',
        email: 'dispatch@fultonseafood.local',
        address: '800 Food Center Dr, Bronx, NY 10474',
        taxId: 'EIN-84-2991002',
        balanceDue: 820.5,
        createdBy: superAdmin.id,
      },
      {
        branchId: branch.id,
        name: 'Campania Artisanal Dairy & Imports',
        contactPerson: 'Lorenzo De Luca',
        phone: '+1-212-555-0803',
        email: 'imports@campaniadairy.local',
        address: '215 Bleecker St, New York, NY 10012',
        taxId: 'EIN-84-2991003',
        balanceDue: 640.0,
        createdBy: superAdmin.id,
      },
      {
        branchId: branch.id,
        name: 'Tri-State Organic Farms & Produce',
        contactPerson: 'Hannah Green',
        phone: '+1-212-555-0804',
        email: 'wholesale@tristatefarms.local',
        address: '1245 Union Square W, New York, NY 10003',
        taxId: 'EIN-84-2991004',
        balanceDue: 0,
        createdBy: superAdmin.id,
      },
      {
        branchId: branch.id,
        name: 'Milano Beverage & Specialty Roasters',
        contactPerson: 'Marco Bellini',
        phone: '+1-212-555-0805',
        email: 'roastery@milanobeverage.local',
        address: '55 Water St, Brooklyn, NY 11201',
        taxId: 'EIN-84-2991005',
        balanceDue: 310.0,
        createdBy: superAdmin.id,
      },
    ];
    await prisma.supplier.createMany({ data: suppliersData });
    console.log(`✅ Seeded 5 suppliers`);
  }

  // 10. Seed 20 Customers, Coupons, Tax Rates & Discounts (Phase 3)
  const customersData = [
    { firstName: 'Alexander', lastName: 'Sterling', phone: '+1-212-555-1001', email: 'alexander.sterling@example.com', loyaltyPoints: 1420, tier: 'PLATINUM', totalSpent: 1420.5, visitCount: 18, segment: 'VIP' },
    { firstName: 'Victoria', lastName: 'Kensington', phone: '+1-212-555-1002', email: 'victoria.k@example.com', loyaltyPoints: 1180, tier: 'PLATINUM', totalSpent: 1180.0, visitCount: 15, segment: 'VIP' },
    { firstName: 'Julian', lastName: 'Vance', phone: '+1-212-555-1003', email: 'julian.vance@example.com', loyaltyPoints: 890, tier: 'GOLD', totalSpent: 890.25, visitCount: 12, segment: 'VIP' },
    { firstName: 'Sophia', lastName: 'Montclair', phone: '+1-212-555-1004', email: 'sophia.m@example.com', loyaltyPoints: 740, tier: 'GOLD', totalSpent: 740.0, visitCount: 10, segment: 'VIP' },
    { firstName: 'Sebastian', lastName: 'Thorne', phone: '+1-212-555-1005', email: 's.thorne@example.com', loyaltyPoints: 610, tier: 'GOLD', totalSpent: 610.75, visitCount: 9, segment: 'REGULAR' },
    { firstName: 'Isabella', lastName: 'Rossi', phone: '+1-212-555-1006', email: 'isabella.rossi@example.com', loyaltyPoints: 530, tier: 'GOLD', totalSpent: 530.0, visitCount: 8, segment: 'REGULAR' },
    { firstName: 'Nathaniel', lastName: 'Brooks', phone: '+1-212-555-1007', email: 'n.brooks@example.com', loyaltyPoints: 440, tier: 'SILVER', totalSpent: 440.5, visitCount: 7, segment: 'REGULAR' },
    { firstName: 'Camille', lastName: 'Laurent', phone: '+1-212-555-1008', email: 'camille.l@example.com', loyaltyPoints: 380, tier: 'SILVER', totalSpent: 380.0, visitCount: 6, segment: 'REGULAR' },
    { firstName: 'Dominic', lastName: 'Castellano', phone: '+1-212-555-1009', email: 'dominic.c@example.com', loyaltyPoints: 315, tier: 'SILVER', totalSpent: 315.2, visitCount: 5, segment: 'REGULAR' },
    { firstName: 'Genevieve', lastName: 'Hayes', phone: '+1-212-555-1010', email: 'g.hayes@example.com', loyaltyPoints: 275, tier: 'SILVER', totalSpent: 275.0, visitCount: 5, segment: 'REGULAR' },
    { firstName: 'Marcus', lastName: 'Chen', phone: '+1-212-555-1011', email: 'marcus.chen@example.com', loyaltyPoints: 230, tier: 'SILVER', totalSpent: 230.0, visitCount: 4, segment: 'REGULAR' },
    { firstName: 'Clara', lastName: 'Lindqvist', phone: '+1-212-555-1012', email: 'clara.l@example.com', loyaltyPoints: 190, tier: 'BRONZE', totalSpent: 190.5, visitCount: 3, segment: 'REGULAR' },
    { firstName: 'Harrison', lastName: 'Fordham', phone: '+1-212-555-1013', email: 'h.fordham@example.com', loyaltyPoints: 165, tier: 'BRONZE', totalSpent: 165.0, visitCount: 3, segment: 'AT_RISK' },
    { firstName: 'Amara', lastName: 'Okafor', phone: '+1-212-555-1014', email: 'amara.okafor@example.com', loyaltyPoints: 140, tier: 'BRONZE', totalSpent: 140.0, visitCount: 2, segment: 'NEW' },
    { firstName: 'Lucas', lastName: 'Gallagher', phone: '+1-212-555-1015', email: 'lucas.g@example.com', loyaltyPoints: 115, tier: 'BRONZE', totalSpent: 115.8, visitCount: 2, segment: 'NEW' },
    { firstName: 'Penelope', lastName: 'Walsh', phone: '+1-212-555-1016', email: 'p.walsh@example.com', loyaltyPoints: 95, tier: 'BRONZE', totalSpent: 95.0, visitCount: 2, segment: 'AT_RISK' },
    { firstName: 'Theodore', lastName: 'Mercer', phone: '+1-212-555-1017', email: 'theo.mercer@example.com', loyaltyPoints: 80, tier: 'BRONZE', totalSpent: 80.0, visitCount: 1, segment: 'NEW' },
    { firstName: 'Aria', lastName: 'patel', phone: '+1-212-555-1018', email: 'aria.patel@example.com', loyaltyPoints: 65, tier: 'BRONZE', totalSpent: 65.5, visitCount: 1, segment: 'NEW' },
    { firstName: 'Gabriel', lastName: 'Mendoza', phone: '+1-212-555-1019', email: 'g.mendoza@example.com', loyaltyPoints: 50, tier: 'BRONZE', totalSpent: 50.0, visitCount: 1, segment: 'NEW' },
    { firstName: 'Nadia', lastName: 'Kowalski', phone: '+1-212-555-1020', email: 'nadia.k@example.com', loyaltyPoints: 45, tier: 'BRONZE', totalSpent: 45.0, visitCount: 1, segment: 'NEW' },
  ];

  await prisma.customer.createMany({
    data: customersData.map((c) => ({
      branchId: branch.id,
      ...c,
      lastVisitAt: new Date(),
      createdBy: superAdmin.id,
    })),
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${customersData.length} CRM customers with loyalty points & tiers`);

  await prisma.coupon.createMany({
    data: [
      {
        branchId: branch.id,
        code: 'WELCOME15',
        description: '15% off first order over $30',
        type: DiscountType.PERCENTAGE,
        value: 15,
        minOrderAmount: 30,
        maxDiscount: 25,
        usageLimit: 500,
        isActive: true,
      },
      {
        branchId: branch.id,
        code: 'VIP25',
        description: '$25 off VIP dinner orders over $100',
        type: DiscountType.FIXED_AMOUNT,
        value: 25,
        minOrderAmount: 100,
        usageLimit: 200,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });
  console.log(`✅ Seeded promo coupons`);

  // Expense Categories (Phase 4)
  const existingExpCats = await prisma.expenseCategory.count({
    where: { branchId: branch.id, deletedAt: null },
  });
  if (existingExpCats === 0) {
    await prisma.expenseCategory.createMany({
      data: [
        { branchId: branch.id, name: 'Utilities & Power', description: 'Electricity, gas, water, and internet bills' },
        { branchId: branch.id, name: 'Rent & Facility Lease', description: 'Monthly restaurant premises lease' },
        { branchId: branch.id, name: 'Kitchen Maintenance & Repairs', description: 'Equipment servicing and repairs' },
        { branchId: branch.id, name: 'Marketing & Promotions', description: 'Local advertising and digital campaigns' },
        { branchId: branch.id, name: 'Packaging & Supplies', description: 'Takeaway containers, napkins, and bags' },
      ],
    });
    console.log('✅ Seeded 5 expense categories');
  }

  // Delivery Zones & Riders (Phase 4)
  const existingZones = await prisma.deliveryZone.count({
    where: { branchId: branch.id, deletedAt: null },
  });
  if (existingZones === 0) {
    await prisma.deliveryZone.createMany({
      data: [
        { branchId: branch.id, name: 'Downtown Core (0-3 km)', deliveryFee: 2.5, minOrderAmount: 15, estimatedTimeMin: 25, isActive: true },
        { branchId: branch.id, name: 'Midtown Zone (3-7 km)', deliveryFee: 4.5, minOrderAmount: 25, estimatedTimeMin: 35, isActive: true },
        { branchId: branch.id, name: 'Suburban Express (7-12 km)', deliveryFee: 7.0, minOrderAmount: 40, estimatedTimeMin: 45, isActive: true },
      ],
    });
    console.log('✅ Seeded 3 delivery zones');
  }

  const existingRiders = await prisma.rider.count({
    where: { branchId: branch.id, deletedAt: null },
  });
  if (existingRiders === 0) {
    await prisma.rider.createMany({
      data: [
        { branchId: branch.id, name: 'Tariq Mahmood', phone: '+92-300-5550101', vehicleNo: 'LHR-9042', status: 'AVAILABLE', isActive: true },
        { branchId: branch.id, name: 'Bilal Ahmed', phone: '+92-321-5550102', vehicleNo: 'LHR-7814', status: 'AVAILABLE', isActive: true },
        { branchId: branch.id, name: 'Usman Raza', phone: '+92-333-5550103', vehicleNo: 'LHR-3329', status: 'AVAILABLE', isActive: true },
      ],
    });
    console.log('✅ Seeded 3 delivery riders');
  }

  // Phase 5: 10 Staff Users + Linked Employee Profiles
  const staffPasswordHash = await hashPassword('Staff@123456!');
  const staffDefs = [
    { email: 'manager.sara@rms-enterprise.local', firstName: 'Sara', lastName: 'Khan', roleSlug: ROLES.MANAGER, code: 'EMP-001', designation: 'Branch Manager', department: 'MANAGEMENT', baseSalary: 120000, hourlyRate: 750 },
    { email: 'cashier.ali@rms-enterprise.local', firstName: 'Ali', lastName: 'Raza', roleSlug: ROLES.CASHIER, code: 'EMP-002', designation: 'Lead Cashier', department: 'FRONT_OF_HOUSE', baseSalary: 55000, hourlyRate: 350 },
    { email: 'cashier.hina@rms-enterprise.local', firstName: 'Hina', lastName: 'Malik', roleSlug: ROLES.CASHIER, code: 'EMP-003', designation: 'POS Cashier', department: 'FRONT_OF_HOUSE', baseSalary: 50000, hourlyRate: 320 },
    { email: 'waiter.hamza@rms-enterprise.local', firstName: 'Hamza', lastName: 'Sheikh', roleSlug: ROLES.WAITER, code: 'EMP-004', designation: 'Senior Waiter', department: 'SERVICE', baseSalary: 42000, hourlyRate: 280 },
    { email: 'waiter.zainab@rms-enterprise.local', firstName: 'Zainab', lastName: 'Farooq', roleSlug: ROLES.WAITER, code: 'EMP-005', designation: 'Dining Server', department: 'SERVICE', baseSalary: 40000, hourlyRate: 260 },
    { email: 'waiter.omar@rms-enterprise.local', firstName: 'Omar', lastName: 'Javed', roleSlug: ROLES.WAITER, code: 'EMP-006', designation: 'Floor Steward', department: 'SERVICE', baseSalary: 40000, hourlyRate: 260 },
    { email: 'chef.kamran@rms-enterprise.local', firstName: 'Kamran', lastName: 'Qureshi', roleSlug: ROLES.CHEF_KITCHEN, code: 'EMP-007', designation: 'Executive Head Chef', department: 'KITCHEN', baseSalary: 135000, hourlyRate: 850 },
    { email: 'chef.nadia@rms-enterprise.local', firstName: 'Nadia', lastName: 'Aslam', roleSlug: ROLES.CHEF_KITCHEN, code: 'EMP-008', designation: 'Sous Chef', department: 'KITCHEN', baseSalary: 85000, hourlyRate: 520 },
    { email: 'inventory.fahad@rms-enterprise.local', firstName: 'Fahad', lastName: 'Nawaz', roleSlug: ROLES.INVENTORY_MANAGER, code: 'EMP-009', designation: 'Inventory Controller', department: 'SUPPLY_CHAIN', baseSalary: 70000, hourlyRate: 440 },
    { email: 'accountant.ayesha@rms-enterprise.local', firstName: 'Ayesha', lastName: 'Siddiqui', roleSlug: ROLES.ACCOUNTANT, code: 'EMP-010', designation: 'Senior Accountant', department: 'FINANCE', baseSalary: 95000, hourlyRate: 600 },
  ];

  const waiterUserIds: string[] = [];
  const cashierUserIds: string[] = [];

  for (const s of staffDefs) {
    const roleId = roleMap.get(s.roleSlug) ?? roleMap.get(ROLES.WAITER)!;
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        firstName: s.firstName,
        lastName: s.lastName,
        roleId,
        branchId: branch.id,
        isActive: true,
      },
      create: {
        branchId: branch.id,
        roleId,
        email: s.email,
        passwordHash: staffPasswordHash,
        firstName: s.firstName,
        lastName: s.lastName,
        isActive: true,
        createdBy: superAdmin.id,
      },
    });

    if (s.roleSlug === ROLES.WAITER) waiterUserIds.push(user.id);
    if (s.roleSlug === ROLES.CASHIER) cashierUserIds.push(user.id);

    await prisma.employee.upsert({
      where: { employeeCode: s.code },
      update: {
        designation: s.designation,
        department: s.department,
        baseSalary: s.baseSalary,
        hourlyRate: s.hourlyRate,
      },
      create: {
        branchId: branch.id,
        userId: user.id,
        employeeCode: s.code,
        designation: s.designation,
        department: s.department,
        baseSalary: s.baseSalary,
        hourlyRate: s.hourlyRate,
        createdBy: superAdmin.id,
      },
    });
  }
  console.log(`✅ Seeded ${staffDefs.length} staff users & linked employee records`);

  // Phase 5: 200 Historical Orders + OrderItems + Payments + Invoices (last 30 days)
  const existingHistOrders = await prisma.order.count({
    where: {
      branchId: branch.id,
      orderNumber: { startsWith: 'ORD-HIST-' },
    },
  });

  if (existingHistOrders === 0) {
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { branchId: branch.id, deletedAt: null },
      select: { id: true, name: true, price: true },
      take: 30,
    });
    const dbTables = await prisma.table.findMany({
      where: { branchId: branch.id, deletedAt: null },
      select: { id: true },
      take: 20,
    });
    const dbCustomers = await prisma.customer.findMany({
      where: { branchId: branch.id, deletedAt: null },
      select: { id: true },
      take: 20,
    });

    if (dbMenuItems.length > 0) {
      const ordersBatch: any[] = [];
      const orderItemsBatch: any[] = [];
      const paymentsBatch: any[] = [];
      const invoicesBatch: any[] = [];

      const orderTypes = [OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY];
      const payMethods = [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.WALLET];
      const nowMs = Date.now();

      for (let i = 1; i <= 200; i++) {
        const orderId = randomUUID();
        const daysAgo = (i * 3) % 30; // Spread evenly across 0..29 days ago (includes today daysAgo=0)
        const hourOffset = 10 + (i % 13); // Peak restaurant hours 10:00..22:00 UTC
        const createdAt = new Date(
          nowMs - daysAgo * 24 * 60 * 60 * 1000
        );
        createdAt.setUTCHours(hourOffset, (i * 7) % 60, 0, 0);

        const orderType = orderTypes[i % orderTypes.length];
        const tableId =
          orderType === OrderType.DINE_IN && dbTables.length > 0
            ? dbTables[i % dbTables.length].id
            : null;
        const customerId =
          dbCustomers.length > 0 && i % 2 === 0
            ? dbCustomers[i % dbCustomers.length].id
            : null;
        const waiterId =
          waiterUserIds.length > 0
            ? waiterUserIds[i % waiterUserIds.length]
            : superAdmin.id;
        const cashierId =
          cashierUserIds.length > 0
            ? cashierUserIds[i % cashierUserIds.length]
            : superAdmin.id;

        const itemCount = (i % 3) + 1;
        let subtotal = 0;

        for (let j = 0; j < itemCount; j++) {
          const menuItem = dbMenuItems[(i + j * 5) % dbMenuItems.length];
          const qty = ((i + j) % 2) + 1;
          const unitPrice = Number(menuItem.price);
          const lineSubtotal = Number((unitPrice * qty).toFixed(2));
          subtotal += lineSubtotal;

          orderItemsBatch.push({
            id: randomUUID(),
            orderId,
            menuItemId: menuItem.id,
            itemName: menuItem.name,
            quantity: qty,
            unitPrice,
            subtotal: lineSubtotal,
            createdAt,
            updatedAt: createdAt,
          });
        }

        const discountAmount = i % 10 === 0 ? Number((subtotal * 0.1).toFixed(2)) : 0;
        const taxAmount = Number(((subtotal - discountAmount) * 0.1).toFixed(2));
        const deliveryFee = orderType === OrderType.DELIVERY ? 3.5 : 0;
        const tipAmount = i % 3 === 0 ? Number((subtotal * 0.05).toFixed(2)) : 0;
        const totalAmount = Number(
          (subtotal - discountAmount + taxAmount + deliveryFee + tipAmount).toFixed(2)
        );
        const orderNumber = `ORD-HIST-${String(i).padStart(3, '0')}`;

        ordersBatch.push({
          id: orderId,
          branchId: branch.id,
          orderNumber,
          tableId,
          customerId,
          waiterId,
          cashierId,
          orderType,
          status: OrderStatus.PAID,
          guestCount: orderType === OrderType.DINE_IN ? (i % 4) + 1 : 1,
          subtotal,
          discountAmount,
          taxAmount,
          deliveryFee,
          tipAmount,
          totalAmount,
          paidAmount: totalAmount,
          couponCode: i % 10 === 0 ? 'WELCOME15' : null,
          stockDeducted: true,
          completedAt: createdAt,
          createdBy: waiterId,
          createdAt,
          updatedAt: createdAt,
        });

        paymentsBatch.push({
          id: randomUUID(),
          branchId: branch.id,
          orderId,
          idempotencyKey: `seed-hist-pay-${i}`,
          method: payMethods[i % payMethods.length],
          status: PaymentStatus.COMPLETED,
          amount: totalAmount,
          tipAmount,
          paidAt: createdAt,
          createdBy: cashierId,
          createdAt,
          updatedAt: createdAt,
        });

        invoicesBatch.push({
          id: randomUUID(),
          orderId,
          invoiceNumber: `INV-HIST-${String(i).padStart(4, '0')}`,
          issuedAt: createdAt,
          createdAt,
        });
      }

      await prisma.order.createMany({ data: ordersBatch });
      await prisma.orderItem.createMany({ data: orderItemsBatch });
      await prisma.payment.createMany({ data: paymentsBatch });
      await prisma.invoice.createMany({ data: invoicesBatch });
      console.log('✅ Seeded 200 historical orders, order items, payments & invoices (last 30 days)');
    }
  }

  // Phase 5: Initial Operational Expenses & Notifications (if empty)
  const existingExpensesCount = await prisma.expense.count({
    where: { branchId: branch.id, deletedAt: null },
  });
  if (existingExpensesCount === 0) {
    const expCats = await prisma.expenseCategory.findMany({
      where: { branchId: branch.id, deletedAt: null },
      take: 3,
    });
    if (expCats.length > 0) {
      await prisma.expense.createMany({
        data: [
          {
            branchId: branch.id,
            categoryId: expCats[0].id,
            title: 'Monthly Commercial Electricity & Gas Bill',
            amount: 1450.0,
            incurredAt: new Date(),
            method: PaymentMethod.CARD,
            notes: 'Vendor: Metro Grid Utilities',
            createdBy: superAdmin.id,
          },
          {
            branchId: branch.id,
            categoryId: expCats[expCats.length > 1 ? 1 : 0].id,
            title: 'Flagship Branch Monthly Premises Lease',
            amount: 4200.0,
            incurredAt: new Date(),
            method: PaymentMethod.CARD,
            notes: 'Vendor: Downtown Commercial Properties',
            createdBy: superAdmin.id,
          },
        ],
      });
      console.log('✅ Seeded sample operational expenses');
    }
  }

  const existingNotifCount = await prisma.notification.count({
    where: { branchId: branch.id },
  });
  if (existingNotifCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          branchId: branch.id,
          type: 'SYSTEM',
          title: 'Restaurant ERP System Initialized',
          message: 'All Phase 1-5 modules are connected live to Supabase PostgreSQL.',
          isRead: false,
        },
        {
          branchId: branch.id,
          type: 'ORDER_NEW',
          title: 'Daily Analytics Ready',
          message: '200 historical orders loaded for multi-currency financial reporting.',
          isRead: false,
        },
      ],
    });
    console.log('✅ Seeded initial system notifications');
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
