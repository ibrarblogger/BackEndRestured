import { env } from './env';

const idPathParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description: 'UUID of the resource',
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Restaurant Management System (ERP/POS) API',
    version: '1.0.0',
    description:
      'Production-grade Node.js + TypeScript + Express + Prisma (Supabase PostgreSQL) + Socket.io REST API for Restaurant Management System Admin Panel & POS.\n\n' +
      '**Default Super Admin Credentials:**\n' +
      '- **Email:** `admin@rms-enterprise.local`\n' +
      '- **Password:** `Admin@123456!`',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 (Same-Origin / Production)',
    },
    {
      url: `${env.API_BASE_URL}/api/v1`,
      description: 'API v1 (Configured Base URL)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the `accessToken` returned from `POST /auth/login` here.',
      },
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@rms-enterprise.local' },
          password: { type: 'string', format: 'password', example: 'Admin@123456!' },
        },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@rms-enterprise.local' },
        },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string', example: 'paste_reset_token_here' },
          newPassword: { type: 'string', example: 'NewAdmin@123456!' },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', example: 'Admin@123456!' },
          newPassword: { type: 'string', example: 'NewAdmin@123456!' },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: {
          firstName: { type: 'string', example: 'System' },
          lastName: { type: 'string', example: 'Administrator' },
          phone: { type: 'string', example: '+1-212-555-0100' },
          avatarUrl: { type: 'string', example: 'https://example.com/avatar.png' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        required: ['roleId', 'email', 'password', 'firstName', 'lastName'],
        properties: {
          branchId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            example: '2a6afa14-7e63-48a5-9291-3d52bba2c3be',
          },
          roleId: {
            type: 'string',
            format: 'uuid',
            example: '5aa8d3d9-2dce-4056-b712-e7cf1564df62',
          },
          email: { type: 'string', format: 'email', example: 'manager@rms-enterprise.local' },
          password: { type: 'string', example: 'Manager@12345!' },
          firstName: { type: 'string', example: 'Sarah' },
          lastName: { type: 'string', example: 'Connor' },
          phone: { type: 'string', example: '+1-212-555-0144' },
          pinCode: { type: 'string', example: '4321' },
          isActive: { type: 'boolean', example: true },
        },
      },
      UpdateUserRequest: {
        type: 'object',
        properties: {
          firstName: { type: 'string', example: 'Sarah' },
          lastName: { type: 'string', example: 'Connor' },
          phone: { type: 'string', example: '+1-212-555-0144' },
          isActive: { type: 'boolean', example: true },
        },
      },
      CreateRoleRequest: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', example: 'Shift Supervisor' },
          slug: { type: 'string', example: 'shift-supervisor' },
          description: { type: 'string', example: 'Supervises floor staff and approves voids' },
          permissionKeys: {
            type: 'array',
            items: { type: 'string' },
            example: ['orders.view', 'orders.create', 'orders.cancel', 'tables.view'],
          },
        },
      },
      CreateBranchRequest: {
        type: 'object',
        required: ['name', 'code', 'address', 'phone'],
        properties: {
          name: { type: 'string', example: 'Midtown Terrace Branch' },
          code: { type: 'string', example: 'MT-02' },
          address: { type: 'string', example: '780 Madison Ave, New York, NY 10065' },
          phone: { type: 'string', example: '+1-212-555-0250' },
          email: { type: 'string', example: 'midtown@grandbistro.local' },
          currency: { type: 'string', example: 'USD' },
          timezone: { type: 'string', example: 'America/New_York' },
          taxRatePercent: { type: 'number', example: 8.88 },
          serviceChargePercent: { type: 'number', example: 5.0 },
          orderNumberPrefix: { type: 'string', example: 'MT' },
        },
      },
      CreateCategoryRequest: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', example: 'Wood-Fired Pizzas' },
          slug: { type: 'string', example: 'wood-fired-pizzas' },
          description: { type: 'string', example: 'Artisan Neapolitan pizzas baked at 900°F' },
          sortOrder: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
        },
      },
      UpdateCategoryRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Artisan Wood-Fired Pizzas' },
          slug: { type: 'string', example: 'artisan-wood-fired-pizzas' },
          description: { type: 'string', example: 'Updated category description' },
          sortOrder: { type: 'integer', example: 2 },
          isActive: { type: 'boolean', example: true },
        },
      },
      CreateMenuItemRequest: {
        type: 'object',
        required: ['categoryId', 'sku', 'name', 'price'],
        properties: {
          categoryId: { type: 'string', format: 'uuid' },
          sku: { type: 'string', example: 'PIZ-MARG-01' },
          name: { type: 'string', example: 'Margherita Classica' },
          description: {
            type: 'string',
            example: 'San Marzano tomatoes, fresh mozzarella di bufala, basil',
          },
          price: { type: 'number', example: 18.5 },
          costPrice: { type: 'number', example: 5.25 },
          station: { type: 'string', example: 'MAIN_KITCHEN' },
          prepTimeMinutes: { type: 'integer', example: 12 },
          isVegetarian: { type: 'boolean', example: true },
          isAvailable: { type: 'boolean', example: true },
          variants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Large 14"' },
                sku: { type: 'string', example: 'PIZ-MARG-LG' },
                priceDelta: { type: 'number', example: 4.0 },
                isDefault: { type: 'boolean', example: false },
              },
            },
          },
          addOns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Burrata Upgrade' },
                price: { type: 'number', example: 3.5 },
              },
            },
          },
        },
      },
      UpdateMenuItemRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Margherita Di Bufala' },
          price: { type: 'number', example: 19.5 },
          costPrice: { type: 'number', example: 5.5 },
          description: { type: 'string', example: 'Updated description' },
          isAvailable: { type: 'boolean', example: true },
        },
      },
      ToggleAvailabilityRequest: {
        type: 'object',
        required: ['isAvailable'],
        properties: {
          isAvailable: { type: 'boolean', example: false },
        },
      },
      UpdateDaypartRequest: {
        type: 'object',
        required: ['daypartSchedule'],
        properties: {
          daypartSchedule: {
            type: 'object',
            properties: {
              days: {
                type: 'array',
                items: { type: 'string' },
                example: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
              },
              startTime: { type: 'string', example: '11:00' },
              endTime: { type: 'string', example: '22:00' },
            },
          },
        },
      },
      CreateVariantRequest: {
        type: 'object',
        required: ['name', 'sku'],
        properties: {
          name: { type: 'string', example: 'Family Size 16"' },
          sku: { type: 'string', example: 'VAR-FAM-16' },
          priceDelta: { type: 'number', example: 6.0 },
          isDefault: { type: 'boolean', example: false },
        },
      },
      CreateAddOnRequest: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string', example: 'Extra Truffle Oil' },
          price: { type: 'number', example: 3.5 },
        },
      },
      CreateComboRequest: {
        type: 'object',
        required: ['sku', 'name', 'price', 'items'],
        properties: {
          sku: { type: 'string', example: 'CMB-LUNCH-01' },
          name: { type: 'string', example: 'Executive Lunch Combo' },
          description: { type: 'string', example: 'Starter + Main + Beverage' },
          price: { type: 'number', example: 29.0 },
          isAvailable: { type: 'boolean', example: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['menuItemId', 'quantity'],
              properties: {
                menuItemId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', example: 1 },
              },
            },
          },
        },
      },
      CreateFloorRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Main Dining Room' },
          floorNumber: { type: 'integer', example: 1 },
        },
      },
      CreateTableRequest: {
        type: 'object',
        required: ['floorId', 'tableNumber'],
        properties: {
          floorId: { type: 'string', format: 'uuid' },
          tableNumber: { type: 'string', example: 'T-31' },
          capacity: { type: 'integer', example: 4 },
          shape: { type: 'string', enum: ['RECTANGLE', 'CIRCLE', 'SQUARE'], example: 'RECTANGLE' },
          posX: { type: 'number', example: 120 },
          posY: { type: 'number', example: 80 },
        },
      },
      UpdateTableStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'],
            example: 'AVAILABLE',
          },
        },
      },
      CreateReservationRequest: {
        type: 'object',
        required: ['tableId', 'guestName', 'guestPhone', 'partySize', 'reservationTime'],
        properties: {
          tableId: { type: 'string', format: 'uuid' },
          guestName: { type: 'string', example: 'Michael Vance' },
          guestPhone: { type: 'string', example: '+1-212-555-0188' },
          guestEmail: { type: 'string', example: 'michael@example.com' },
          partySize: { type: 'integer', example: 4 },
          reservationTime: { type: 'string', format: 'date-time', example: '2026-11-12T19:00:00Z' },
          durationMinutes: { type: 'integer', example: 90 },
          specialRequests: { type: 'string', example: 'Window table if possible' },
        },
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['orderType', 'items'],
        properties: {
          orderType: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'], example: 'DINE_IN' },
          tableId: { type: 'string', format: 'uuid' },
          guestCount: { type: 'integer', example: 2 },
          notes: { type: 'string', example: 'Serve starters together' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['menuItemId', 'quantity'],
              properties: {
                menuItemId: { type: 'string', format: 'uuid' },
                variantId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', example: 2 },
                notes: { type: 'string', example: 'Crispy crust' },
              },
            },
          },
        },
      },
      UpdateOrderStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['NEW', 'PREPARING', 'READY', 'SERVED', 'PAID', 'COMPLETED', 'CANCELLED', 'HOLD'],
            example: 'PREPARING',
          },
        },
      },
      CancelOrderRequest: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', example: 'Customer changed mind before preparation' },
        },
      },
      UpdateKitchenTicketStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['QUEUED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'],
            example: 'PREPARING',
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        security: [],
        summary: 'Health check endpoint',
        responses: { 200: { description: 'Service is healthy' } },
      },
    },
    // Auth
    '/auth/login': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Login with email and password (sets httpOnly refresh_token cookie)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: { 200: { description: 'Returns JWT accessToken and user profile' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Rotate refresh token and issue new access token',
        responses: { 200: { description: 'Refreshed access token' } },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke refresh token and clear cookie',
        responses: { 200: { description: 'Logged out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile & permissions',
        responses: { 200: { description: 'User profile' } },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update current user profile',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } } },
        },
        responses: { 200: { description: 'Updated profile' } },
      },
    },
    // Users & RBAC
    '/users': {
      get: {
        tags: ['Users & RBAC'],
        summary: 'List users with pagination and filters',
        responses: { 200: { description: 'Users list' } },
      },
      post: {
        tags: ['Users & RBAC'],
        summary: 'Create a new staff user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserRequest' } } },
        },
        responses: { 201: { description: 'User created' } },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users & RBAC'],
        summary: 'Get user by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'User details' } },
      },
      patch: {
        tags: ['Users & RBAC'],
        summary: 'Update user by ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateUserRequest' } } },
        },
        responses: { 200: { description: 'User updated' } },
      },
      delete: {
        tags: ['Users & RBAC'],
        summary: 'Soft-delete user by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'User deleted' } },
      },
    },
    '/users/roles': {
      get: {
        tags: ['Users & RBAC'],
        summary: 'List all roles and assigned permissions',
        responses: { 200: { description: 'Roles list' } },
      },
      post: {
        tags: ['Users & RBAC'],
        summary: 'Create a custom role',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRoleRequest' } } },
        },
        responses: { 201: { description: 'Role created' } },
      },
    },
    '/users/roles/{id}': {
      patch: {
        tags: ['Users & RBAC'],
        summary: 'Update role by ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRoleRequest' } } },
        },
        responses: { 200: { description: 'Role updated' } },
      },
      delete: {
        tags: ['Users & RBAC'],
        summary: 'Delete custom role by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Role deleted' } },
      },
    },
    '/users/permissions': {
      get: {
        tags: ['Users & RBAC'],
        summary: 'List all granular RBAC permission keys',
        responses: { 200: { description: 'Permissions list' } },
      },
    },
    // Branches, Multi-Currency & Multi-Language Configuration (Admin-Only)
    '/branches/localization': {
      get: {
        tags: ['Branches & Settings'],
        summary: 'Get both active currency (PKR, USD, etc.) and active language (en, ur, ar, etc. + translations) from database',
        responses: { 200: { description: 'Combined currency and language localization config' } },
      },
    },
    '/branches/currencies': {
      get: {
        tags: ['Branches & Settings'],
        summary: 'Get active currency from database and all 35 supported currencies (PKR, USD, AED, SAR, GBP, EUR, etc.)',
        responses: { 200: { description: 'Active currency and supported currencies list' } },
      },
    },
    '/branches/currency': {
      patch: {
        tags: ['Branches & Settings'],
        summary: 'Admin-Only: Select & update system currency (PKR, USD, AED, SAR, GBP, EUR, CAD, AUD, etc.) across all operations',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currency'],
                properties: {
                  currency: {
                    type: 'string',
                    enum: [
                      'PKR',
                      'USD',
                      'AED',
                      'SAR',
                      'GBP',
                      'EUR',
                      'CAD',
                      'AUD',
                      'QAR',
                      'KWD',
                      'OMR',
                      'BHD',
                      'INR',
                      'BDT',
                      'LKR',
                      'MYR',
                      'SGD',
                      'IDR',
                      'THB',
                      'PHP',
                      'TRY',
                      'EGP',
                      'ZAR',
                      'NGN',
                      'CHF',
                      'SEK',
                      'NOK',
                      'DKK',
                      'CNY',
                      'HKD',
                      'JPY',
                      'KRW',
                      'NZD',
                      'BRL',
                      'MXN',
                    ],
                    example: 'PKR',
                    description: 'Select currency code (e.g. PKR for Pakistani Rupee, USD for US Dollar)',
                  },
                  applyToAllBranches: {
                    type: 'boolean',
                    example: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Currency updated in Supabase database' },
          403: { description: 'Forbidden: Only Admin can change the currency' },
        },
      },
    },
    '/branches/{id}/currency': {
      patch: {
        tags: ['Branches & Settings'],
        summary: 'Admin-Only: Select & update currency for a specific branch ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currency'],
                properties: {
                  currency: {
                    type: 'string',
                    enum: ['PKR', 'USD', 'AED', 'SAR', 'GBP', 'EUR', 'CAD', 'AUD', 'INR', 'MYR', 'TRY'],
                    example: 'PKR',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Branch currency updated' },
          403: { description: 'Forbidden: Only Admin can change the currency' },
        },
      },
    },
    '/branches/languages': {
      get: {
        tags: ['Branches & Settings'],
        summary: 'Get active language (en, ur, ar, etc.), RTL/LTR direction, POS translations, and all 14 supported languages',
        responses: { 200: { description: 'Active language, translations, and supported languages list' } },
      },
    },
    '/branches/language': {
      patch: {
        tags: ['Branches & Settings'],
        summary: 'Admin-Only: Select & update system language (en, ur, ar, es, fr, de, tr, hi, zh, ja, pt, ru, it, ms)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['language'],
                properties: {
                  language: {
                    type: 'string',
                    enum: ['en', 'ur', 'ar', 'es', 'fr', 'de', 'tr', 'hi', 'zh', 'ja', 'pt', 'ru', 'it', 'ms'],
                    example: 'ur',
                    description: 'Select language code (e.g. en = English, ur = Urdu RTL, ar = Arabic RTL)',
                  },
                  applyToAllBranches: {
                    type: 'boolean',
                    example: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Language updated in Supabase database' },
          403: { description: 'Forbidden: Only Admin can change the language' },
        },
      },
    },
    '/branches/{id}/language': {
      patch: {
        tags: ['Branches & Settings'],
        summary: 'Admin-Only: Select & update language for a specific branch ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['language'],
                properties: {
                  language: {
                    type: 'string',
                    enum: ['en', 'ur', 'ar', 'es', 'fr', 'de', 'tr', 'hi', 'zh', 'ja', 'pt', 'ru', 'it', 'ms'],
                    example: 'en',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Branch language updated' },
          403: { description: 'Forbidden: Only Admin can change the language' },
        },
      },
    },
    '/branches': {
      get: {
        tags: ['Branches & Settings'],
        summary: 'List all restaurant branches',
        responses: { 200: { description: 'Branches list' } },
      },
      post: {
        tags: ['Branches & Settings'],
        summary: 'Create a new branch',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateBranchRequest' } } },
        },
        responses: { 201: { description: 'Branch created' } },
      },
    },
    '/branches/{id}': {
      get: {
        tags: ['Branches & Settings'],
        summary: 'Get branch by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Branch details' } },
      },
      patch: {
        tags: ['Branches & Settings'],
        summary: 'Update branch by ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateBranchRequest' } } },
        },
        responses: { 200: { description: 'Branch updated' } },
      },
      delete: {
        tags: ['Branches & Settings'],
        summary: 'Soft-delete branch by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Branch deleted' } },
      },
    },
    '/audit': {
      get: {
        tags: ['Audit Logs'],
        summary: 'Query security & operational audit logs',
        responses: { 200: { description: 'Audit logs list' } },
      },
    },
    // Phase 2: Menu Categories
    '/menu/categories': {
      get: {
        tags: ['Menu'],
        summary: 'List menu categories',
        responses: { 200: { description: 'Categories list' } },
      },
      post: {
        tags: ['Menu'],
        summary: 'Create a menu category',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCategoryRequest' } } },
        },
        responses: { 201: { description: 'Category created' } },
      },
    },
    '/menu/categories/{id}': {
      get: {
        tags: ['Menu'],
        summary: 'Get menu category by ID (with items)',
        parameters: [idPathParam],
        responses: { 200: { description: 'Category details' } },
      },
      patch: {
        tags: ['Menu'],
        summary: 'Update menu category by ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateCategoryRequest' } } },
        },
        responses: { 200: { description: 'Category updated' } },
      },
      delete: {
        tags: ['Menu'],
        summary: 'Delete (soft-delete) menu category by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Category deleted' } },
      },
    },
    // Phase 2: Menu Items
    '/menu/items': {
      get: {
        tags: ['Menu'],
        summary: 'List menu items with variants and add-ons',
        responses: { 200: { description: 'Menu items list' } },
      },
      post: {
        tags: ['Menu'],
        summary: 'Create a menu item with optional variants and add-ons',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateMenuItemRequest' } } },
        },
        responses: { 201: { description: 'Menu item created' } },
      },
    },
    '/menu/items/{id}': {
      get: {
        tags: ['Menu'],
        summary: 'Get menu item by ID (with variants, add-ons, and recipe)',
        parameters: [idPathParam],
        responses: { 200: { description: 'Menu item details' } },
      },
      patch: {
        tags: ['Menu'],
        summary: 'Update menu item by ID (logs PRICE_CHANGE audit if price changes)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateMenuItemRequest' } } },
        },
        responses: { 200: { description: 'Menu item updated' } },
      },
      delete: {
        tags: ['Menu'],
        summary: 'Delete (soft-delete) menu item by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Menu item deleted' } },
      },
    },
    '/menu/items/{id}/availability': {
      patch: {
        tags: ['Menu'],
        summary: 'Toggle menu item availability (in-stock / 86ed)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ToggleAvailabilityRequest' } } },
        },
        responses: { 200: { description: 'Availability updated' } },
      },
    },
    '/menu/items/{id}/daypart': {
      patch: {
        tags: ['Menu'],
        summary: 'Update menu item daypart schedule (e.g. breakfast/lunch/dinner hours)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateDaypartRequest' } } },
        },
        responses: { 200: { description: 'Daypart schedule updated' } },
      },
    },
    '/menu/items/{id}/variants': {
      post: {
        tags: ['Menu'],
        summary: 'Add a size/portion variant to a menu item',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVariantRequest' } } },
        },
        responses: { 201: { description: 'Variant added' } },
      },
    },
    '/menu/variants/{id}': {
      delete: {
        tags: ['Menu'],
        summary: 'Delete a menu item variant by variant ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Variant deleted' } },
      },
    },
    '/menu/items/{id}/addons': {
      post: {
        tags: ['Menu'],
        summary: 'Add an extra/modifier add-on to a menu item',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAddOnRequest' } } },
        },
        responses: { 201: { description: 'Add-on added' } },
      },
    },
    '/menu/addons/{id}': {
      delete: {
        tags: ['Menu'],
        summary: 'Delete a menu item add-on by add-on ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Add-on deleted' } },
      },
    },
    // Phase 2: Combos
    '/menu/combos': {
      get: {
        tags: ['Menu'],
        summary: 'List combo meals',
        responses: { 200: { description: 'Combos list' } },
      },
      post: {
        tags: ['Menu'],
        summary: 'Create a combo meal',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateComboRequest' } } },
        },
        responses: { 201: { description: 'Combo created' } },
      },
    },
    '/menu/combos/{id}': {
      get: {
        tags: ['Menu'],
        summary: 'Get combo meal by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Combo details' } },
      },
      patch: {
        tags: ['Menu'],
        summary: 'Update combo meal by ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateComboRequest' } } },
        },
        responses: { 200: { description: 'Combo updated' } },
      },
      delete: {
        tags: ['Menu'],
        summary: 'Delete (soft-delete) combo meal by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Combo deleted' } },
      },
    },
    '/menu/upload-image': {
      post: {
        tags: ['Menu'],
        summary: 'Upload menu image to Supabase Storage (menu-images bucket)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { 201: { description: 'Uploaded image URL' } },
      },
    },
    '/menu/items/export/csv': {
      get: {
        tags: ['Menu'],
        summary: 'Export menu items as CSV',
        responses: { 200: { description: 'CSV download' } },
      },
    },
    '/menu/items/import/csv': {
      post: {
        tags: ['Menu'],
        summary: 'Bulk import menu items from CSV file',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { 200: { description: 'CSV imported' } },
      },
    },
    // Phase 2: Tables, Floors, Reservations & Waitlist
    '/tables/floors': {
      get: {
        tags: ['Tables & Reservations'],
        summary: 'List floors with nested tables',
        responses: { 200: { description: 'Floors list' } },
      },
      post: {
        tags: ['Tables & Reservations'],
        summary: 'Create a floor',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateFloorRequest' } } },
        },
        responses: { 201: { description: 'Floor created' } },
      },
    },
    '/tables/floors/{id}': {
      patch: {
        tags: ['Tables & Reservations'],
        summary: 'Update floor by ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateFloorRequest' } } },
        },
        responses: { 200: { description: 'Floor updated' } },
      },
      delete: {
        tags: ['Tables & Reservations'],
        summary: 'Delete (soft-delete) floor by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Floor deleted' } },
      },
    },
    '/tables': {
      get: {
        tags: ['Tables & Reservations'],
        summary: 'List tables with status and floor info',
        responses: { 200: { description: 'Tables list' } },
      },
      post: {
        tags: ['Tables & Reservations'],
        summary: 'Create a table',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTableRequest' } } },
        },
        responses: { 201: { description: 'Table created' } },
      },
    },
    '/tables/{id}': {
      get: {
        tags: ['Tables & Reservations'],
        summary: 'Get table by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Table details' } },
      },
      patch: {
        tags: ['Tables & Reservations'],
        summary: 'Update table details by ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTableRequest' } } },
        },
        responses: { 200: { description: 'Table updated' } },
      },
      delete: {
        tags: ['Tables & Reservations'],
        summary: 'Delete (soft-delete) table by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Table deleted' } },
      },
    },
    '/tables/{id}/status': {
      patch: {
        tags: ['Tables & Reservations'],
        summary: 'Update table status (AVAILABLE, OCCUPIED, RESERVED, CLEANING)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateTableStatusRequest' } } },
        },
        responses: { 200: { description: 'Table status updated' } },
      },
    },
    '/tables/layout': {
      put: {
        tags: ['Tables & Reservations'],
        summary: 'Batch update floor plan table coordinates',
        responses: { 200: { description: 'Layout updated' } },
      },
    },
    '/tables/reservations': {
      get: {
        tags: ['Tables & Reservations'],
        summary: 'List reservations',
        responses: { 200: { description: 'Reservations list' } },
      },
      post: {
        tags: ['Tables & Reservations'],
        summary: 'Create a reservation (with automatic table time-conflict check)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateReservationRequest' } } },
        },
        responses: { 201: { description: 'Reservation created' }, 409: { description: 'Time conflict on table' } },
      },
    },
    '/tables/reservations/{id}': {
      get: {
        tags: ['Tables & Reservations'],
        summary: 'Get reservation by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Reservation details' } },
      },
      patch: {
        tags: ['Tables & Reservations'],
        summary: 'Update reservation by ID',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateReservationRequest' } } },
        },
        responses: { 200: { description: 'Reservation updated' } },
      },
    },
    '/tables/waitlist': {
      get: {
        tags: ['Tables & Reservations'],
        summary: 'List waitlist entries',
        responses: { 200: { description: 'Waitlist entries' } },
      },
      post: {
        tags: ['Tables & Reservations'],
        summary: 'Add guest to waitlist',
        responses: { 201: { description: 'Added to waitlist' } },
      },
    },
    '/tables/waitlist/{id}': {
      delete: {
        tags: ['Tables & Reservations'],
        summary: 'Remove guest from waitlist by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Removed from waitlist' } },
      },
    },
    // Phase 2: Orders & Kitchen (KDS)
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List POS orders with filters',
        responses: { 200: { description: 'Paginated orders' } },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create POS order (transactional: order + KDS ticket routing + recipe stock deduction)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrderRequest' } } },
        },
        responses: { 201: { description: 'Order created' } },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order details by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Order details' } },
      },
      patch: {
        tags: ['Orders'],
        summary: 'Update order items/notes/discounts by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Order updated' } },
      },
    },
    '/orders/{id}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Transition order status (NEW -> PREPARING -> READY -> SERVED -> COMPLETED)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrderStatusRequest' } } },
        },
        responses: { 200: { description: 'Order status updated' } },
      },
    },
    '/orders/{id}/hold': {
      post: {
        tags: ['Orders'],
        summary: 'Place active order on HOLD',
        parameters: [idPathParam],
        responses: { 200: { description: 'Order placed on hold' } },
      },
    },
    '/orders/{id}/resume': {
      post: {
        tags: ['Orders'],
        summary: 'Resume order from HOLD',
        parameters: [idPathParam],
        responses: { 200: { description: 'Order resumed' } },
      },
    },
    '/orders/{id}/cancel': {
      post: {
        tags: ['Orders'],
        summary: 'Cancel order with mandatory reason (writes ORDER_CANCEL audit log)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CancelOrderRequest' } } },
        },
        responses: { 200: { description: 'Order cancelled' } },
      },
    },
    '/orders/{id}/split': {
      post: {
        tags: ['Orders'],
        summary: 'Split order items into a new child order bill',
        parameters: [idPathParam],
        responses: { 201: { description: 'Order split' } },
      },
    },
    '/orders/{id}/invoice/pdf': {
      get: {
        tags: ['Orders'],
        summary: 'Download thermal PDF invoice/receipt for order',
        parameters: [idPathParam],
        responses: { 200: { description: 'PDF binary stream' } },
      },
    },
    '/orders/merge': {
      post: {
        tags: ['Orders'],
        summary: 'Merge multiple order bills into a target order',
        responses: { 200: { description: 'Orders merged' } },
      },
    },
    '/kitchen/stations': {
      get: {
        tags: ['Kitchen (KDS)'],
        summary: 'Get active ticket counts per kitchen station',
        responses: { 200: { description: 'Station summary' } },
      },
    },
    '/kitchen/tickets': {
      get: {
        tags: ['Kitchen (KDS)'],
        summary: 'List active KDS tickets with live prep timers',
        responses: { 200: { description: 'Kitchen tickets' } },
      },
    },
    '/kitchen/tickets/{id}': {
      get: {
        tags: ['Kitchen (KDS)'],
        summary: 'Get kitchen ticket by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Kitchen ticket details' } },
      },
    },
    '/kitchen/tickets/{id}/status': {
      patch: {
        tags: ['Kitchen (KDS)'],
        summary: 'Update kitchen ticket status (QUEUED -> PREPARING -> READY -> SERVED)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateKitchenTicketStatusRequest' } } },
        },
        responses: { 200: { description: 'Ticket status updated' } },
      },
    },
    // Phase 3: Payments, Refunds, Cash Drawer, Tax Rates & Discounts
    '/payments': {
      get: {
        tags: ['Payments & Cash Drawer'],
        summary: 'List payments with filters',
        responses: { 200: { description: 'Payments list' } },
      },
      post: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Process order payment (requires Idempotency-Key header or idempotencyKey body field)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId', 'idempotencyKey', 'method', 'amount'],
                properties: {
                  orderId: { type: 'string', format: 'uuid' },
                  idempotencyKey: { type: 'string', example: 'idem-pay-2026-001' },
                  method: { type: 'string', enum: ['CASH', 'CARD', 'WALLET', 'SPLIT', 'GATEWAY'], example: 'CASH' },
                  amount: { type: 'number', example: 45.0 },
                  tipAmount: { type: 'number', example: 5.0 },
                  tenderedAmount: { type: 'number', example: 50.0 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Payment processed' }, 200: { description: 'Idempotent replay' } },
      },
    },
    '/payments/{id}': {
      get: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Get payment details by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Payment details' } },
      },
    },
    '/payments/{id}/refund': {
      post: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Refund payment (partial or full, writes ORDER_REFUND audit log)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount', 'reason'],
                properties: {
                  amount: { type: 'number', example: 15.0 },
                  reason: { type: 'string', example: 'Item returned by guest' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Refund created' } },
      },
    },
    '/payments/refunds': {
      get: {
        tags: ['Payments & Cash Drawer'],
        summary: 'List all payment refunds',
        responses: { 200: { description: 'Refunds list' } },
      },
    },
    '/payments/cash-drawer/current': {
      get: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Get currently open cash drawer session for branch',
        responses: { 200: { description: 'Current cash drawer session' } },
      },
    },
    '/payments/cash-drawer': {
      get: {
        tags: ['Payments & Cash Drawer'],
        summary: 'List cash drawer sessions history',
        responses: { 200: { description: 'Cash drawer sessions list' } },
      },
    },
    '/payments/cash-drawer/open': {
      post: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Open a new cash drawer shift',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['openingBalance'],
                properties: {
                  openingBalance: { type: 'number', example: 250.0 },
                  notes: { type: 'string', example: 'Morning shift float' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Cash drawer opened' } },
      },
    },
    '/payments/cash-drawer/{id}/close': {
      post: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Close and reconcile cash drawer shift (computes discrepancy)',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['closingBalance'],
                properties: {
                  closingBalance: { type: 'number', example: 540.0 },
                  notes: { type: 'string', example: 'End of shift count verified' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Cash drawer closed' } },
      },
    },
    '/payments/tax-rates': {
      get: {
        tags: ['Payments & Cash Drawer'],
        summary: 'List tax rates',
        responses: { 200: { description: 'Tax rates list' } },
      },
      post: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Create a tax rate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'ratePercent'],
                properties: {
                  name: { type: 'string', example: 'State Sales Tax' },
                  ratePercent: { type: 'number', example: 8.88 },
                  isInclusive: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Tax rate created' } },
      },
    },
    '/payments/tax-rates/{id}': {
      patch: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Update tax rate by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Tax rate updated' } },
      },
      delete: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Delete tax rate by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Tax rate deleted' } },
      },
    },
    '/payments/discounts': {
      get: {
        tags: ['Payments & Cash Drawer'],
        summary: 'List POS discounts',
        responses: { 200: { description: 'Discounts list' } },
      },
      post: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Create a POS discount',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type', 'value'],
                properties: {
                  name: { type: 'string', example: 'Staff Meal Discount 25%' },
                  type: { type: 'string', enum: ['PERCENTAGE', 'FIXED_AMOUNT'], example: 'PERCENTAGE' },
                  value: { type: 'number', example: 25 },
                  minOrderAmount: { type: 'number', example: 10 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Discount created' } },
      },
    },
    '/payments/discounts/{id}': {
      patch: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Update POS discount by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Discount updated' } },
      },
      delete: {
        tags: ['Payments & Cash Drawer'],
        summary: 'Delete POS discount by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Discount deleted' } },
      },
    },
    // Phase 3: Inventory & Recipes
    '/inventory/ingredients': {
      get: {
        tags: ['Inventory & Recipes'],
        summary: 'List inventory ingredients with stock levels and valuation',
        responses: { 200: { description: 'Ingredients list' } },
      },
      post: {
        tags: ['Inventory & Recipes'],
        summary: 'Create an inventory ingredient',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sku', 'name', 'unit', 'costPerUnit'],
                properties: {
                  sku: { type: 'string', example: 'ING-WAGYU-01' },
                  name: { type: 'string', example: 'A5 Wagyu Beef Striploin' },
                  unit: { type: 'string', example: 'kg' },
                  currentStock: { type: 'number', example: 25.0 },
                  reorderLevel: { type: 'number', example: 8.0 },
                  costPerUnit: { type: 'number', example: 68.5 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Ingredient created' } },
      },
    },
    '/inventory/ingredients/{id}': {
      get: {
        tags: ['Inventory & Recipes'],
        summary: 'Get ingredient by ID (with recent stock movements and linked recipes)',
        parameters: [idPathParam],
        responses: { 200: { description: 'Ingredient details' } },
      },
      patch: {
        tags: ['Inventory & Recipes'],
        summary: 'Update ingredient by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Ingredient updated' } },
      },
      delete: {
        tags: ['Inventory & Recipes'],
        summary: 'Delete (soft-delete) ingredient by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Ingredient deleted' } },
      },
    },
    '/inventory/recipes': {
      get: {
        tags: ['Inventory & Recipes'],
        summary: 'List all menu item recipes (Bill of Materials)',
        responses: { 200: { description: 'Recipes list' } },
      },
      post: {
        tags: ['Inventory & Recipes'],
        summary: 'Create or update a recipe for a menu item (auto-updates MenuItem costPrice)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['menuItemId', 'ingredients'],
                properties: {
                  menuItemId: { type: 'string', format: 'uuid' },
                  yieldQty: { type: 'integer', example: 1 },
                  instructions: { type: 'string', example: 'Sear 3 mins per side, rest 4 mins' },
                  ingredients: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['ingredientId', 'quantity'],
                      properties: {
                        ingredientId: { type: 'string', format: 'uuid' },
                        quantity: { type: 'number', example: 0.25 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Recipe saved' } },
      },
    },
    '/inventory/recipes/{menuItemId}': {
      get: {
        tags: ['Inventory & Recipes'],
        summary: 'Get recipe by menuItemId',
        parameters: [
          {
            name: 'menuItemId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { 200: { description: 'Recipe details' } },
      },
      delete: {
        tags: ['Inventory & Recipes'],
        summary: 'Delete recipe by menuItemId',
        parameters: [
          {
            name: 'menuItemId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { 200: { description: 'Recipe deleted' } },
      },
    },
    '/inventory/adjustments': {
      post: {
        tags: ['Inventory & Recipes'],
        summary: 'Manual stock adjustment (writes INVENTORY_ADJUST audit log & emits low-stock alert)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ingredientId', 'quantityDelta', 'notes'],
                properties: {
                  ingredientId: { type: 'string', format: 'uuid' },
                  type: {
                    type: 'string',
                    enum: ['MANUAL_ADJUSTMENT', 'PURCHASE', 'TRANSFER'],
                    example: 'MANUAL_ADJUSTMENT',
                  },
                  quantityDelta: { type: 'number', example: 10 },
                  notes: { type: 'string', example: 'Restocked from central kitchen' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Stock adjusted' } },
      },
    },
    '/inventory/movements': {
      get: {
        tags: ['Inventory & Recipes'],
        summary: 'List stock movement ledger entries',
        responses: { 200: { description: 'Stock movements list' } },
      },
    },
    '/inventory/wastage': {
      get: {
        tags: ['Inventory & Recipes'],
        summary: 'List wastage & spoilage logs',
        responses: { 200: { description: 'Wastage logs list' } },
      },
      post: {
        tags: ['Inventory & Recipes'],
        summary: 'Record ingredient wastage/spoilage and deduct stock',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ingredientId', 'quantity', 'reason'],
                properties: {
                  ingredientId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number', example: 1.5 },
                  reason: { type: 'string', example: 'Expired batch discarded during morning prep' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Wastage recorded' } },
      },
    },
    '/inventory/stock-take': {
      post: {
        tags: ['Inventory & Recipes'],
        summary: 'Reconcile physical stock-take counts against system inventory',
        responses: { 200: { description: 'Stock-take reconciled' } },
      },
    },
    '/inventory/alerts/low-stock': {
      get: {
        tags: ['Inventory & Recipes'],
        summary: 'List ingredients at or below reorder level',
        responses: { 200: { description: 'Low-stock alerts' } },
      },
    },
    '/inventory/alerts/expiring': {
      get: {
        tags: ['Inventory & Recipes'],
        summary: 'List ingredients expiring soon',
        responses: { 200: { description: 'Expiring ingredients' } },
      },
    },
    // Phase 3: Suppliers & Purchase Orders
    '/suppliers': {
      get: {
        tags: ['Suppliers & Purchasing'],
        summary: 'List suppliers with balances due',
        responses: { 200: { description: 'Suppliers list' } },
      },
      post: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Create a supplier',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone'],
                properties: {
                  name: { type: 'string', example: 'Hudson Valley Prime Meats' },
                  contactPerson: { type: 'string', example: 'Arthur Pendelton' },
                  phone: { type: 'string', example: '+1-212-555-0811' },
                  email: { type: 'string', example: 'orders@hudsonprime.local' },
                  address: { type: 'string', example: '410 Gansevoort St, New York, NY' },
                  taxId: { type: 'string', example: 'EIN-84-2991042' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Supplier created' } },
      },
    },
    '/suppliers/{id}': {
      get: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Get supplier by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Supplier details' } },
      },
      patch: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Update supplier by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Supplier updated' } },
      },
      delete: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Delete (soft-delete) supplier by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Supplier deleted' } },
      },
    },
    '/suppliers/{id}/ledger': {
      get: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Get supplier financial ledger (POs, GRNs, payments, and balance due)',
        parameters: [idPathParam],
        responses: { 200: { description: 'Supplier ledger' } },
      },
    },
    '/suppliers/purchase-orders': {
      get: {
        tags: ['Suppliers & Purchasing'],
        summary: 'List purchase orders',
        responses: { 200: { description: 'Purchase orders list' } },
      },
      post: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Create a purchase order',
        responses: { 201: { description: 'Purchase order created' } },
      },
    },
    '/suppliers/purchase-orders/{id}': {
      get: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Get purchase order by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Purchase order details' } },
      },
    },
    '/suppliers/purchase-orders/{id}/receive': {
      post: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Receive goods against PO (creates GRN, increments ingredient stock, updates supplier balanceDue)',
        parameters: [idPathParam],
        responses: { 201: { description: 'Goods received' } },
      },
    },
    '/suppliers/payments': {
      post: {
        tags: ['Suppliers & Purchasing'],
        summary: 'Record payment to supplier (decrements supplier balanceDue)',
        responses: { 201: { description: 'Supplier payment recorded' } },
      },
    },
    // Phase 3: Customers & Loyalty CRM
    '/customers': {
      get: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'List customers with loyalty points, tiers, and segments',
        responses: { 200: { description: 'Customers list' } },
      },
      post: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Create a customer profile',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['firstName', 'lastName', 'phone'],
                properties: {
                  firstName: { type: 'string', example: 'Elena' },
                  lastName: { type: 'string', example: 'Rostova' },
                  phone: { type: 'string', example: '+1-212-555-0921' },
                  email: { type: 'string', example: 'elena.rostova@example.com' },
                  segment: { type: 'string', enum: ['NEW', 'REGULAR', 'VIP', 'AT_RISK'], example: 'REGULAR' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Customer created' } },
      },
    },
    '/customers/{id}': {
      get: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Get customer profile by ID (with order history and loyalty transactions)',
        parameters: [idPathParam],
        responses: { 200: { description: 'Customer profile' } },
      },
      patch: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Update customer profile by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Customer updated' } },
      },
      delete: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Delete (soft-delete) customer by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Customer deleted' } },
      },
    },
    '/customers/{id}/loyalty': {
      get: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Get customer loyalty transaction ledger',
        parameters: [idPathParam],
        responses: { 200: { description: 'Loyalty transactions' } },
      },
    },
    '/customers/{id}/loyalty/earn': {
      post: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Award loyalty points to customer',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['points'],
                properties: {
                  points: { type: 'integer', example: 150 },
                  description: { type: 'string', example: 'Bonus dining points' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Points earned' } },
      },
    },
    '/customers/{id}/loyalty/redeem': {
      post: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Redeem customer loyalty points',
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['points'],
                properties: {
                  points: { type: 'integer', example: 100 },
                  description: { type: 'string', example: 'Redeemed on dinner bill' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Points redeemed' } },
      },
    },
    '/customers/coupons': {
      get: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'List promo coupons',
        responses: { 200: { description: 'Coupons list' } },
      },
      post: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Create a promo coupon code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'type', 'value'],
                properties: {
                  code: { type: 'string', example: 'WELCOME20' },
                  description: { type: 'string', example: '20% off orders over $40' },
                  type: { type: 'string', enum: ['PERCENTAGE', 'FIXED_AMOUNT'], example: 'PERCENTAGE' },
                  value: { type: 'number', example: 20 },
                  minOrderAmount: { type: 'number', example: 40 },
                  maxDiscount: { type: 'number', example: 30 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Coupon created' } },
      },
    },
    '/customers/coupons/{id}': {
      patch: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Update coupon by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Coupon updated' } },
      },
      delete: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Delete coupon by ID',
        parameters: [idPathParam],
        responses: { 200: { description: 'Coupon deleted' } },
      },
    },
    '/customers/coupons/validate': {
      post: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Validate promo coupon code and calculate discount',
        responses: { 200: { description: 'Coupon validation result' } },
      },
    },
    '/customers/feedbacks': {
      get: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'List guest feedbacks and ratings',
        responses: { 200: { description: 'Feedbacks list' } },
      },
      post: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Submit guest feedback and 1-5 rating',
        responses: { 201: { description: 'Feedback submitted' } },
      },
    },
    '/customers/segments': {
      get: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Get customer segmentation & loyalty tier analytics from database',
        responses: { 200: { description: 'Segments summary' } },
      },
    },
    '/customers/campaigns/trigger': {
      post: {
        tags: ['Customers & Loyalty CRM'],
        summary: 'Trigger targeted Email/SMS CRM campaign to a customer segment',
        responses: { 201: { description: 'Campaign triggered' } },
      },
    },
    // ==========================================
    // PHASE 4: STAFF, PAYROLL, EXPENSES, DELIVERY, REPORTS & DASHBOARD
    // ==========================================
    '/staff/employees': {
      get: {
        tags: ['Staff & Payroll'],
        summary: 'List employees',
        responses: { 200: { description: 'Employees list' } },
      },
      post: {
        tags: ['Staff & Payroll'],
        summary: 'Create employee profile',
        responses: { 201: { description: 'Employee created' } },
      },
    },
    '/staff/employees/{id}': {
      get: {
        tags: ['Staff & Payroll'],
        summary: 'Get employee details',
        parameters: [idPathParam],
        responses: { 200: { description: 'Employee details' } },
      },
      patch: {
        tags: ['Staff & Payroll'],
        summary: 'Update employee profile',
        parameters: [idPathParam],
        responses: { 200: { description: 'Employee updated' } },
      },
      delete: {
        tags: ['Staff & Payroll'],
        summary: 'Soft delete employee',
        parameters: [idPathParam],
        responses: { 200: { description: 'Employee deleted' } },
      },
    },
    '/staff/shifts': {
      get: {
        tags: ['Staff & Payroll'],
        summary: 'List staff shifts',
        responses: { 200: { description: 'Shifts list' } },
      },
      post: {
        tags: ['Staff & Payroll'],
        summary: 'Schedule staff shift',
        responses: { 201: { description: 'Shift created' } },
      },
    },
    '/staff/attendance': {
      get: {
        tags: ['Staff & Payroll'],
        summary: 'List attendance records',
        responses: { 200: { description: 'Attendance logs' } },
      },
    },
    '/staff/attendance/clock-in': {
      post: {
        tags: ['Staff & Payroll'],
        summary: 'Clock in employee',
        responses: { 201: { description: 'Clocked in' } },
      },
    },
    '/staff/attendance/clock-out': {
      post: {
        tags: ['Staff & Payroll'],
        summary: 'Clock out employee and calculate regular/overtime hours',
        responses: { 200: { description: 'Clocked out' } },
      },
    },
    '/staff/leaves': {
      get: {
        tags: ['Staff & Payroll'],
        summary: 'List leave requests',
        responses: { 200: { description: 'Leave requests' } },
      },
      post: {
        tags: ['Staff & Payroll'],
        summary: 'Submit leave request',
        responses: { 201: { description: 'Leave request created' } },
      },
    },
    '/staff/leaves/{id}/status': {
      patch: {
        tags: ['Staff & Payroll'],
        summary: 'Approve or reject leave request',
        parameters: [idPathParam],
        responses: { 200: { description: 'Leave status updated' } },
      },
    },
    '/staff/payroll': {
      get: {
        tags: ['Staff & Payroll'],
        summary: 'List monthly payroll runs',
        responses: { 200: { description: 'Payroll records' } },
      },
    },
    '/staff/payroll/generate': {
      post: {
        tags: ['Staff & Payroll'],
        summary: 'Generate monthly payroll for branch staff',
        responses: { 201: { description: 'Payroll generated' } },
      },
    },
    '/staff/payroll/{id}/pay': {
      patch: {
        tags: ['Staff & Payroll'],
        summary: 'Mark payroll record as paid',
        parameters: [idPathParam],
        responses: { 200: { description: 'Payroll marked paid' } },
      },
    },
    '/staff/payroll/distribute-tips': {
      post: {
        tags: ['Staff & Payroll'],
        summary: 'Distribute tips pool across eligible staff payrolls',
        responses: { 200: { description: 'Tips distributed' } },
      },
    },
    '/expenses/categories': {
      get: {
        tags: ['Expenses & Accounting'],
        summary: 'List expense categories',
        responses: { 200: { description: 'Expense categories' } },
      },
      post: {
        tags: ['Expenses & Accounting'],
        summary: 'Create expense category',
        responses: { 201: { description: 'Category created' } },
      },
    },
    '/expenses': {
      get: {
        tags: ['Expenses & Accounting'],
        summary: 'List recorded expenses',
        responses: { 200: { description: 'Expenses list' } },
      },
      post: {
        tags: ['Expenses & Accounting'],
        summary: 'Record operational expense',
        responses: { 201: { description: 'Expense recorded' } },
      },
    },
    '/expenses/upload-receipt': {
      post: {
        tags: ['Expenses & Accounting'],
        summary: 'Upload expense receipt image to Supabase Storage (receipts bucket)',
        responses: { 201: { description: 'Receipt uploaded' } },
      },
    },
    '/expenses/accounting/pnl': {
      get: {
        tags: ['Expenses & Accounting'],
        summary: 'Profit & Loss (P&L) statement in branch currency',
        responses: { 200: { description: 'P&L statement' } },
      },
    },
    '/expenses/accounting/daily-closing': {
      get: {
        tags: ['Expenses & Accounting'],
        summary: 'Daily financial closing summary',
        responses: { 200: { description: 'Daily closing summary' } },
      },
    },
    '/expenses/accounting/cash-flow': {
      get: {
        tags: ['Expenses & Accounting'],
        summary: 'Cash flow statement (inflows vs outflows)',
        responses: { 200: { description: 'Cash flow report' } },
      },
    },
    '/expenses/accounting/tax-report': {
      get: {
        tags: ['Expenses & Accounting'],
        summary: 'Tax liability & collection summary',
        responses: { 200: { description: 'Tax report' } },
      },
    },
    '/delivery/zones': {
      get: {
        tags: ['Delivery & Riders'],
        summary: 'List delivery zones and fees',
        responses: { 200: { description: 'Delivery zones' } },
      },
      post: {
        tags: ['Delivery & Riders'],
        summary: 'Create delivery zone',
        responses: { 201: { description: 'Delivery zone created' } },
      },
    },
    '/delivery/riders': {
      get: {
        tags: ['Delivery & Riders'],
        summary: 'List delivery riders',
        responses: { 200: { description: 'Riders list' } },
      },
      post: {
        tags: ['Delivery & Riders'],
        summary: 'Create delivery rider',
        responses: { 201: { description: 'Rider created' } },
      },
    },
    '/delivery': {
      get: {
        tags: ['Delivery & Riders'],
        summary: 'List dispatched deliveries',
        responses: { 200: { description: 'Deliveries list' } },
      },
      post: {
        tags: ['Delivery & Riders'],
        summary: 'Dispatch delivery for an order',
        responses: { 201: { description: 'Delivery dispatched' } },
      },
    },
    '/delivery/{id}/assign': {
      patch: {
        tags: ['Delivery & Riders'],
        summary: 'Assign rider to delivery',
        parameters: [idPathParam],
        responses: { 200: { description: 'Rider assigned' } },
      },
    },
    '/delivery/{id}/status': {
      patch: {
        tags: ['Delivery & Riders'],
        summary: 'Update delivery lifecycle status',
        parameters: [idPathParam],
        responses: { 200: { description: 'Delivery status updated' } },
      },
    },
    '/reports/sales-by-item': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Sales by menu item (supports ?format=json|csv|excel|pdf)',
        parameters: [
          {
            name: 'format',
            in: 'query',
            schema: { type: 'string', enum: ['json', 'csv', 'excel', 'pdf'], default: 'json' },
          },
        ],
        responses: { 200: { description: 'Report generated or exported' } },
      },
    },
    '/reports/sales-by-category': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Sales by category (supports ?format=json|csv|excel|pdf)',
        responses: { 200: { description: 'Report generated' } },
      },
    },
    '/reports/sales-by-staff': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Sales by waiter/cashier (supports ?format=json|csv|excel|pdf)',
        responses: { 200: { description: 'Report generated' } },
      },
    },
    '/reports/sales-by-payment': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Sales by payment method (supports ?format=json|csv|excel|pdf)',
        responses: { 200: { description: 'Report generated' } },
      },
    },
    '/reports/sales-by-time': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Daily sales trend & 24h peak hours (supports ?format=json|csv|excel|pdf)',
        responses: { 200: { description: 'Report generated' } },
      },
    },
    '/reports/inventory-valuation': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Inventory valuation & low stock report',
        responses: { 200: { description: 'Report generated' } },
      },
    },
    '/reports/wastage': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Wastage & spoilage cost loss report',
        responses: { 200: { description: 'Report generated' } },
      },
    },
    '/reports/customer-retention': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Customer retention, segment & LTV report',
        responses: { 200: { description: 'Report generated' } },
      },
    },
    '/reports/discount-usage': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Promo coupons & discounts usage report',
        responses: { 200: { description: 'Report generated' } },
      },
    },
    '/dashboard/kpis': {
      get: {
        tags: ['Dashboard KPIs'],
        summary: 'Executive KPIs (today/period revenue, operations, low stock, top items, hourly & 7d trends)',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 7 } },
          { name: 'lang', in: 'query', schema: { type: 'string', example: 'ur' } },
          { name: 'refresh', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: { 200: { description: 'KPI dashboard payload' } },
      },
    },
    // ==========================================
    // PHASE 5: NOTIFICATIONS & BACKGROUND JOBS
    // ==========================================
    '/notifications': {
      get: {
        tags: ['Notifications & Alerts'],
        summary: 'List notifications & unread count for current user/branch',
        responses: { 200: { description: 'Notifications list' } },
      },
      post: {
        tags: ['Notifications & Alerts'],
        summary: 'Create & broadcast notification over Socket.io',
        responses: { 201: { description: 'Notification emitted' } },
      },
    },
    '/notifications/read-all': {
      patch: {
        tags: ['Notifications & Alerts'],
        summary: 'Mark all unread notifications as read',
        responses: { 200: { description: 'All notifications marked read' } },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['Notifications & Alerts'],
        summary: 'Mark a notification as read',
        parameters: [idPathParam],
        responses: { 200: { description: 'Notification marked read' } },
      },
    },
    '/notifications/preferences': {
      get: {
        tags: ['Notifications & Alerts'],
        summary: 'Get user notification preferences',
        responses: { 200: { description: 'Preferences retrieved' } },
      },
      put: {
        tags: ['Notifications & Alerts'],
        summary: 'Save user notification preferences in Supabase Setting table',
        responses: { 200: { description: 'Preferences saved' } },
      },
    },
    '/jobs/status': {
      get: {
        tags: ['Background Jobs'],
        summary: 'Inspect background job runner mode (BullMQ / in-memory) and recent jobs',
        responses: { 200: { description: 'Job queue status' } },
      },
    },
    '/jobs/low-stock-scan': {
      post: {
        tags: ['Background Jobs'],
        summary: 'Enqueue asynchronous low-stock alert scan & notification job',
        responses: { 202: { description: 'Job queued' } },
      },
    },
    '/jobs/daily-closing-digest': {
      post: {
        tags: ['Background Jobs'],
        summary: 'Enqueue asynchronous daily closing summary digest notification',
        responses: { 202: { description: 'Job queued' } },
      },
    },
  },
};
