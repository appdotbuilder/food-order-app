import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['customer', 'restaurant_owner', 'admin']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'completed', 'failed', 'refunded']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: userRoleEnum('role').notNull().default('customer'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Restaurants table
export const restaurantsTable = pgTable('restaurants', {
  id: serial('id').primaryKey(),
  owner_id: integer('owner_id').references(() => usersTable.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  image_url: text('image_url'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Menu items table
export const menuItemsTable = pgTable('menu_items', {
  id: serial('id').primaryKey(),
  restaurant_id: integer('restaurant_id').references(() => restaurantsTable.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  image_url: text('image_url'),
  is_available: boolean('is_available').default(true).notNull(),
  category: text('category'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Carts table
export const cartsTable = pgTable('carts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => usersTable.id).notNull(),
  restaurant_id: integer('restaurant_id').references(() => restaurantsTable.id).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Cart items table
export const cartItemsTable = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cart_id: integer('cart_id').references(() => cartsTable.id).notNull(),
  menu_item_id: integer('menu_item_id').references(() => menuItemsTable.id).notNull(),
  quantity: integer('quantity').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => usersTable.id).notNull(),
  restaurant_id: integer('restaurant_id').references(() => restaurantsTable.id).notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').notNull().default('pending'),
  delivery_address: text('delivery_address').notNull(),
  phone: text('phone').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Order items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').references(() => ordersTable.id).notNull(),
  menu_item_id: integer('menu_item_id').references(() => menuItemsTable.id).notNull(),
  quantity: integer('quantity').notNull(),
  price_at_time: numeric('price_at_time', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Payments table
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').references(() => ordersTable.id).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  payment_method: text('payment_method').notNull(),
  transaction_id: text('transaction_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  restaurants: many(restaurantsTable),
  carts: many(cartsTable),
  orders: many(ordersTable),
}));

export const restaurantsRelations = relations(restaurantsTable, ({ one, many }) => ({
  owner: one(usersTable, {
    fields: [restaurantsTable.owner_id],
    references: [usersTable.id],
  }),
  menuItems: many(menuItemsTable),
  carts: many(cartsTable),
  orders: many(ordersTable),
}));

export const menuItemsRelations = relations(menuItemsTable, ({ one, many }) => ({
  restaurant: one(restaurantsTable, {
    fields: [menuItemsTable.restaurant_id],
    references: [restaurantsTable.id],
  }),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable),
}));

export const cartsRelations = relations(cartsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [cartsTable.user_id],
    references: [usersTable.id],
  }),
  restaurant: one(restaurantsTable, {
    fields: [cartsTable.restaurant_id],
    references: [restaurantsTable.id],
  }),
  items: many(cartItemsTable),
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  cart: one(cartsTable, {
    fields: [cartItemsTable.cart_id],
    references: [cartsTable.id],
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
  items: many(orderItemsTable),
  payment: one(paymentsTable),
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

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [paymentsTable.order_id],
    references: [ordersTable.id],
  }),
}));

// Export all tables for drizzle queries
export const tables = {
  users: usersTable,
  restaurants: restaurantsTable,
  menuItems: menuItemsTable,
  carts: cartsTable,
  cartItems: cartItemsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  payments: paymentsTable,
};