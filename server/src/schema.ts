import { z } from 'zod';

// User roles enum
export const userRoleSchema = z.enum(['customer', 'restaurant_owner', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Order status enum
export const orderStatusSchema = z.enum(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Payment status enum
export const paymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Restaurant schema
export const restaurantSchema = z.object({
  id: z.number(),
  owner_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  phone: z.string(),
  image_url: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Restaurant = z.infer<typeof restaurantSchema>;

// Menu item schema
export const menuItemSchema = z.object({
  id: z.number(),
  restaurant_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().positive(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  category: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type MenuItem = z.infer<typeof menuItemSchema>;

// Cart schema
export const cartSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  restaurant_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Cart = z.infer<typeof cartSchema>;

// Cart item schema
export const cartItemSchema = z.object({
  id: z.number(),
  cart_id: z.number(),
  menu_item_id: z.number(),
  quantity: z.number().int().positive(),
  created_at: z.coerce.date()
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Order schema
export const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  restaurant_id: z.number(),
  total_amount: z.number().positive(),
  status: orderStatusSchema,
  delivery_address: z.string(),
  phone: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

// Order item schema
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  menu_item_id: z.number(),
  quantity: z.number().int().positive(),
  price_at_time: z.number().positive(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Payment schema
export const paymentSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  amount: z.number().positive(),
  status: paymentStatusSchema,
  payment_method: z.string(),
  transaction_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

// Input schemas for creating records

// User registration schema
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().nullable(),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// User login schema
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Create restaurant schema
export const createRestaurantInputSchema = z.object({
  owner_id: z.number(),
  name: z.string().min(1),
  description: z.string().nullable(),
  address: z.string().min(1),
  phone: z.string().min(1),
  image_url: z.string().nullable()
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantInputSchema>;

// Create menu item schema
export const createMenuItemInputSchema = z.object({
  restaurant_id: z.number(),
  name: z.string().min(1),
  description: z.string().nullable(),
  price: z.number().positive(),
  image_url: z.string().nullable(),
  category: z.string().nullable()
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemInputSchema>;

// Add to cart schema
export const addToCartInputSchema = z.object({
  user_id: z.number(),
  restaurant_id: z.number(),
  menu_item_id: z.number(),
  quantity: z.number().int().positive()
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

// Create order schema
export const createOrderInputSchema = z.object({
  user_id: z.number(),
  restaurant_id: z.number(),
  cart_id: z.number(),
  delivery_address: z.string().min(1),
  phone: z.string().min(1)
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

// Update order status schema
export const updateOrderStatusInputSchema = z.object({
  order_id: z.number(),
  status: orderStatusSchema
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

// Create payment schema
export const createPaymentInputSchema = z.object({
  order_id: z.number(),
  payment_method: z.string().min(1)
});

export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

// Query schemas
export const getRestaurantsInputSchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetRestaurantsInput = z.infer<typeof getRestaurantsInputSchema>;

export const getMenuItemsInputSchema = z.object({
  restaurant_id: z.number(),
  category: z.string().optional()
});

export type GetMenuItemsInput = z.infer<typeof getMenuItemsInputSchema>;

export const getUserOrdersInputSchema = z.object({
  user_id: z.number(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetUserOrdersInput = z.infer<typeof getUserOrdersInputSchema>;

export const getRestaurantOrdersInputSchema = z.object({
  restaurant_id: z.number(),
  status: orderStatusSchema.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetRestaurantOrdersInput = z.infer<typeof getRestaurantOrdersInputSchema>;