import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['customer', 'restaurant_owner', 'admin']);
export const orderStatusEnum = pgEnum('order_status', [
  'created',
  'confirmed', 
  'preparing',
  'out_for_delivery',
  'delivered',
  'canceled'
]);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'completed', 'failed', 'refunded']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  phone: text('phone'),
  role: userRoleEnum('role').notNull().default('customer'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Addresses table
export const addressesTable = pgTable('addresses', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  street_address: text('street_address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  postal_code: text('postal_code').notNull(),
  country: text('country').notNull(),
  is_default: boolean('is_default').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Restaurants table
export const restaurantsTable = pgTable('restaurants', {
  id: serial('id').primaryKey(),
  owner_id: integer('owner_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  opening_hours: text('opening_hours'),
  is_active: boolean('is_active').notNull().default(true),
  rating: numeric('rating', { precision: 3, scale: 2 }),
  total_reviews: integer('total_reviews').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Menu categories table
export const menuCategoriesTable = pgTable('menu_categories', {
  id: serial('id').primaryKey(),
  restaurant_id: integer('restaurant_id').notNull().references(() => restaurantsTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sort_order: integer('sort_order').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Menu items table
export const menuItemsTable = pgTable('menu_items', {
  id: serial('id').primaryKey(),
  restaurant_id: integer('restaurant_id').notNull().references(() => restaurantsTable.id, { onDelete: 'cascade' }),
  category_id: integer('category_id').notNull().references(() => menuCategoriesTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  image_url: text('image_url'),
  is_available: boolean('is_available').notNull().default(true),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Menu item options table
export const menuItemOptionsTable = pgTable('menu_item_options', {
  id: serial('id').primaryKey(),
  menu_item_id: integer('menu_item_id').notNull().references(() => menuItemsTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  price_modifier: numeric('price_modifier', { precision: 10, scale: 2 }).notNull().default('0'),
  is_required: boolean('is_required').notNull().default(false),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Cart items table
export const cartItemsTable = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  menu_item_id: integer('menu_item_id').notNull().references(() => menuItemsTable.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  selected_options: jsonb('selected_options'), // Array of option IDs
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  restaurant_id: integer('restaurant_id').notNull().references(() => restaurantsTable.id, { onDelete: 'cascade' }),
  delivery_address_id: integer('delivery_address_id').notNull().references(() => addressesTable.id),
  status: orderStatusEnum('status').notNull().default('created'),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  delivery_fee: numeric('delivery_fee', { precision: 10, scale: 2 }).notNull().default('0'),
  tax_amount: numeric('tax_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  payment_status: paymentStatusEnum('payment_status').notNull().default('pending'),
  notes: text('notes'),
  estimated_delivery_time: timestamp('estimated_delivery_time'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Order items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull().references(() => ordersTable.id, { onDelete: 'cascade' }),
  menu_item_id: integer('menu_item_id').notNull().references(() => menuItemsTable.id),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  selected_options: jsonb('selected_options'), // Array of option IDs
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Reviews table
export const reviewsTable = pgTable('reviews', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  restaurant_id: integer('restaurant_id').notNull().references(() => restaurantsTable.id, { onDelete: 'cascade' }),
  order_id: integer('order_id').references(() => ordersTable.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  is_approved: boolean('is_approved').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Payments table
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull().references(() => ordersTable.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: text('payment_method').notNull(),
  payment_status: paymentStatusEnum('payment_status').notNull().default('pending'),
  transaction_id: text('transaction_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  addresses: many(addressesTable),
  restaurants: many(restaurantsTable),
  cartItems: many(cartItemsTable),
  orders: many(ordersTable),
  reviews: many(reviewsTable),
}));

export const addressesRelations = relations(addressesTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [addressesTable.user_id],
    references: [usersTable.id],
  }),
  orders: many(ordersTable),
}));

export const restaurantsRelations = relations(restaurantsTable, ({ one, many }) => ({
  owner: one(usersTable, {
    fields: [restaurantsTable.owner_id],
    references: [usersTable.id],
  }),
  categories: many(menuCategoriesTable),
  menuItems: many(menuItemsTable),
  orders: many(ordersTable),
  reviews: many(reviewsTable),
}));

export const menuCategoriesRelations = relations(menuCategoriesTable, ({ one, many }) => ({
  restaurant: one(restaurantsTable, {
    fields: [menuCategoriesTable.restaurant_id],
    references: [restaurantsTable.id],
  }),
  menuItems: many(menuItemsTable),
}));

export const menuItemsRelations = relations(menuItemsTable, ({ one, many }) => ({
  restaurant: one(restaurantsTable, {
    fields: [menuItemsTable.restaurant_id],
    references: [restaurantsTable.id],
  }),
  category: one(menuCategoriesTable, {
    fields: [menuItemsTable.category_id],
    references: [menuCategoriesTable.id],
  }),
  options: many(menuItemOptionsTable),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable),
}));

export const menuItemOptionsRelations = relations(menuItemOptionsTable, ({ one }) => ({
  menuItem: one(menuItemsTable, {
    fields: [menuItemOptionsTable.menu_item_id],
    references: [menuItemsTable.id],
  }),
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [cartItemsTable.user_id],
    references: [usersTable.id],
  }),
  menuItem: one(menuItemsTable, {
    fields: [cartItemsTable.menu_item_id],
    references: [menuItemsTable.id],
  }),
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [ordersTable.user_id],
    references: [usersTable.id],
  }),
  restaurant: one(restaurantsTable, {
    fields: [ordersTable.restaurant_id],
    references: [restaurantsTable.id],
  }),
  deliveryAddress: one(addressesTable, {
    fields: [ordersTable.delivery_address_id],
    references: [addressesTable.id],
  }),
  orderItems: many(orderItemsTable),
  payments: many(paymentsTable),
  reviews: many(reviewsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id],
  }),
  menuItem: one(menuItemsTable, {
    fields: [orderItemsTable.menu_item_id],
    references: [menuItemsTable.id],
  }),
}));

export const reviewsRelations = relations(reviewsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [reviewsTable.user_id],
    references: [usersTable.id],
  }),
  restaurant: one(restaurantsTable, {
    fields: [reviewsTable.restaurant_id],
    references: [restaurantsTable.id],
  }),
  order: one(ordersTable, {
    fields: [reviewsTable.order_id],
    references: [ordersTable.id],
  }),
}));

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [paymentsTable.order_id],
    references: [ordersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Address = typeof addressesTable.$inferSelect;
export type NewAddress = typeof addressesTable.$inferInsert;

export type Restaurant = typeof restaurantsTable.$inferSelect;
export type NewRestaurant = typeof restaurantsTable.$inferInsert;

export type MenuCategory = typeof menuCategoriesTable.$inferSelect;
export type NewMenuCategory = typeof menuCategoriesTable.$inferInsert;

export type MenuItem = typeof menuItemsTable.$inferSelect;
export type NewMenuItem = typeof menuItemsTable.$inferInsert;

export type MenuItemOption = typeof menuItemOptionsTable.$inferSelect;
export type NewMenuItemOption = typeof menuItemOptionsTable.$inferInsert;

export type CartItem = typeof cartItemsTable.$inferSelect;
export type NewCartItem = typeof cartItemsTable.$inferInsert;

export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;

export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;

export type Review = typeof reviewsTable.$inferSelect;
export type NewReview = typeof reviewsTable.$inferInsert;

export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;

// Export all tables for enabling relation queries
export const tables = {
  users: usersTable,
  addresses: addressesTable,
  restaurants: restaurantsTable,
  menuCategories: menuCategoriesTable,
  menuItems: menuItemsTable,
  menuItemOptions: menuItemOptionsTable,
  cartItems: cartItemsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  reviews: reviewsTable,
  payments: paymentsTable,
};