import { z } from 'zod';

// Enum schemas
export const userRoleSchema = z.enum(['customer', 'restaurant_owner', 'admin']);
export const orderStatusSchema = z.enum([
  'created',
  'confirmed', 
  'preparing',
  'out_for_delivery',
  'delivered',
  'canceled'
]);
export const paymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded']);

// User schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Address schemas
export const addressSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  street_address: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
  is_default: z.boolean(),
  created_at: z.coerce.date()
});

export type Address = z.infer<typeof addressSchema>;

export const createAddressInputSchema = z.object({
  user_id: z.number(),
  street_address: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
  is_default: z.boolean().optional()
});

export type CreateAddressInput = z.infer<typeof createAddressInputSchema>;

// Restaurant schemas
export const restaurantSchema = z.object({
  id: z.number(),
  owner_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  opening_hours: z.string().nullable(),
  is_active: z.boolean(),
  rating: z.number().nullable(),
  total_reviews: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Restaurant = z.infer<typeof restaurantSchema>;

export const createRestaurantInputSchema = z.object({
  owner_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  opening_hours: z.string().nullable(),
  is_active: z.boolean().optional()
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantInputSchema>;

export const updateRestaurantInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().nullable().optional(),
  opening_hours: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantInputSchema>;

// Menu category schemas
export const menuCategorySchema = z.object({
  id: z.number(),
  restaurant_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.coerce.date()
});

export type MenuCategory = z.infer<typeof menuCategorySchema>;

export const createMenuCategoryInputSchema = z.object({
  restaurant_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export type CreateMenuCategoryInput = z.infer<typeof createMenuCategoryInputSchema>;

// Menu item schemas
export const menuItemSchema = z.object({
  id: z.number(),
  restaurant_id: z.number(),
  category_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type MenuItem = z.infer<typeof menuItemSchema>;

export const createMenuItemInputSchema = z.object({
  restaurant_id: z.number(),
  category_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().positive(),
  image_url: z.string().nullable(),
  is_available: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemInputSchema>;

export const updateMenuItemInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  image_url: z.string().nullable().optional(),
  is_available: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

export type UpdateMenuItemInput = z.infer<typeof updateMenuItemInputSchema>;

// Menu item option schemas
export const menuItemOptionSchema = z.object({
  id: z.number(),
  menu_item_id: z.number(),
  name: z.string(),
  price_modifier: z.number(),
  is_required: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.coerce.date()
});

export type MenuItemOption = z.infer<typeof menuItemOptionSchema>;

export const createMenuItemOptionInputSchema = z.object({
  menu_item_id: z.number(),
  name: z.string(),
  price_modifier: z.number(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

export type CreateMenuItemOptionInput = z.infer<typeof createMenuItemOptionInputSchema>;

// Cart schemas
export const cartItemSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  menu_item_id: z.number(),
  quantity: z.number().int().positive(),
  selected_options: z.array(z.number()).nullable(),
  total_price: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const addToCartInputSchema = z.object({
  user_id: z.number(),
  menu_item_id: z.number(),
  quantity: z.number().int().positive(),
  selected_options: z.array(z.number()).optional()
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

export const updateCartItemInputSchema = z.object({
  id: z.number(),
  quantity: z.number().int().positive(),
  selected_options: z.array(z.number()).optional()
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;

// Order schemas
export const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  restaurant_id: z.number(),
  delivery_address_id: z.number(),
  status: orderStatusSchema,
  subtotal: z.number(),
  delivery_fee: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  payment_status: paymentStatusSchema,
  notes: z.string().nullable(),
  estimated_delivery_time: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

export const createOrderInputSchema = z.object({
  user_id: z.number(),
  restaurant_id: z.number(),
  delivery_address_id: z.number(),
  notes: z.string().nullable().optional()
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const updateOrderStatusInputSchema = z.object({
  id: z.number(),
  status: orderStatusSchema,
  estimated_delivery_time: z.coerce.date().optional()
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

// Order item schemas
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  menu_item_id: z.number(),
  quantity: z.number().int().positive(),
  unit_price: z.number(),
  selected_options: z.array(z.number()).nullable(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Review schemas
export const reviewSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  restaurant_id: z.number(),
  order_id: z.number().nullable(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  is_approved: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Review = z.infer<typeof reviewSchema>;

export const createReviewInputSchema = z.object({
  user_id: z.number(),
  restaurant_id: z.number(),
  order_id: z.number().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable().optional()
});

export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

export const moderateReviewInputSchema = z.object({
  id: z.number(),
  is_approved: z.boolean()
});

export type ModerateReviewInput = z.infer<typeof moderateReviewInputSchema>;

// Payment schemas
export const paymentSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  amount: z.number(),
  payment_method: z.string(),
  payment_status: paymentStatusSchema,
  transaction_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

export const createPaymentInputSchema = z.object({
  order_id: z.number(),
  amount: z.number().positive(),
  payment_method: z.string()
});

export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;