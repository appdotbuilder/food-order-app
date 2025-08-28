import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  createAddressInputSchema,
  createRestaurantInputSchema,
  updateRestaurantInputSchema,
  createMenuCategoryInputSchema,
  createMenuItemInputSchema,
  updateMenuItemInputSchema,
  createMenuItemOptionInputSchema,
  addToCartInputSchema,
  updateCartItemInputSchema,
  createOrderInputSchema,
  updateOrderStatusInputSchema,
  createReviewInputSchema,
  moderateReviewInputSchema,
  createPaymentInputSchema
} from './schema';

// Import handlers
import { registerUser, loginUser, getCurrentUser } from './handlers/auth';
import { createAddress, getUserAddresses, updateAddress, deleteAddress } from './handlers/addresses';
import { 
  createRestaurant, 
  getAllRestaurants, 
  getRestaurantById, 
  getRestaurantsByOwner, 
  updateRestaurant, 
  deleteRestaurant 
} from './handlers/restaurants';
import { 
  createMenuCategory, 
  getRestaurantCategories, 
  updateMenuCategory, 
  deleteMenuCategory 
} from './handlers/menu_categories';
import { 
  createMenuItem, 
  getRestaurantMenuItems, 
  getCategoryMenuItems, 
  getMenuItemById, 
  updateMenuItem, 
  deleteMenuItem 
} from './handlers/menu_items';
import { 
  createMenuItemOption, 
  getMenuItemOptions, 
  updateMenuItemOption, 
  deleteMenuItemOption 
} from './handlers/menu_item_options';
import { 
  addToCart, 
  getUserCart, 
  updateCartItem, 
  removeFromCart, 
  clearUserCart 
} from './handlers/cart';
import { 
  createOrder, 
  getUserOrders, 
  getRestaurantOrders, 
  getOrderById, 
  getOrderItems, 
  updateOrderStatus, 
  cancelOrder, 
  getAllOrders 
} from './handlers/orders';
import { 
  createReview, 
  getRestaurantReviews, 
  getUserReviews, 
  getPendingReviews, 
  moderateReview, 
  deleteReview 
} from './handlers/reviews';
import { 
  createPayment, 
  processPayment, 
  getOrderPayments, 
  refundPayment, 
  getAllPayments 
} from './handlers/payments';
import { 
  getAllUsers, 
  getUserById, 
  updateUserRole, 
  deleteUser, 
  getSystemStats 
} from './handlers/admin';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    register: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => registerUser(input)),
    
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => loginUser(input)),
    
    getCurrentUser: publicProcedure
      .input(z.number())
      .query(({ input }) => getCurrentUser(input)),
  }),

  // Address management routes
  addresses: router({
    create: publicProcedure
      .input(createAddressInputSchema)
      .mutation(({ input }) => createAddress(input)),
    
    getUserAddresses: publicProcedure
      .input(z.number())
      .query(({ input }) => getUserAddresses(input)),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: createAddressInputSchema.partial()
      }))
      .mutation(({ input }) => updateAddress(input.id, input.data)),
    
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteAddress(input)),
  }),

  // Restaurant management routes
  restaurants: router({
    create: publicProcedure
      .input(createRestaurantInputSchema)
      .mutation(({ input }) => createRestaurant(input)),
    
    getAll: publicProcedure
      .query(() => getAllRestaurants()),
    
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getRestaurantById(input)),
    
    getByOwner: publicProcedure
      .input(z.number())
      .query(({ input }) => getRestaurantsByOwner(input)),
    
    update: publicProcedure
      .input(updateRestaurantInputSchema)
      .mutation(({ input }) => updateRestaurant(input)),
    
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteRestaurant(input)),
  }),

  // Menu category routes
  menuCategories: router({
    create: publicProcedure
      .input(createMenuCategoryInputSchema)
      .mutation(({ input }) => createMenuCategory(input)),
    
    getByRestaurant: publicProcedure
      .input(z.number())
      .query(({ input }) => getRestaurantCategories(input)),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: createMenuCategoryInputSchema.partial()
      }))
      .mutation(({ input }) => updateMenuCategory(input.id, input.data)),
    
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteMenuCategory(input)),
  }),

  // Menu item routes
  menuItems: router({
    create: publicProcedure
      .input(createMenuItemInputSchema)
      .mutation(({ input }) => createMenuItem(input)),
    
    getByRestaurant: publicProcedure
      .input(z.number())
      .query(({ input }) => getRestaurantMenuItems(input)),
    
    getByCategory: publicProcedure
      .input(z.number())
      .query(({ input }) => getCategoryMenuItems(input)),
    
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getMenuItemById(input)),
    
    update: publicProcedure
      .input(updateMenuItemInputSchema)
      .mutation(({ input }) => updateMenuItem(input)),
    
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteMenuItem(input)),
  }),

  // Menu item options routes
  menuItemOptions: router({
    create: publicProcedure
      .input(createMenuItemOptionInputSchema)
      .mutation(({ input }) => createMenuItemOption(input)),
    
    getByMenuItem: publicProcedure
      .input(z.number())
      .query(({ input }) => getMenuItemOptions(input)),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: createMenuItemOptionInputSchema.partial()
      }))
      .mutation(({ input }) => updateMenuItemOption(input.id, input.data)),
    
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteMenuItemOption(input)),
  }),

  // Cart management routes
  cart: router({
    add: publicProcedure
      .input(addToCartInputSchema)
      .mutation(({ input }) => addToCart(input)),
    
    getUserCart: publicProcedure
      .input(z.number())
      .query(({ input }) => getUserCart(input)),
    
    updateItem: publicProcedure
      .input(updateCartItemInputSchema)
      .mutation(({ input }) => updateCartItem(input)),
    
    removeItem: publicProcedure
      .input(z.number())
      .mutation(({ input }) => removeFromCart(input)),
    
    clear: publicProcedure
      .input(z.number())
      .mutation(({ input }) => clearUserCart(input)),
  }),

  // Order management routes
  orders: router({
    create: publicProcedure
      .input(createOrderInputSchema)
      .mutation(({ input }) => createOrder(input)),
    
    getUserOrders: publicProcedure
      .input(z.number())
      .query(({ input }) => getUserOrders(input)),
    
    getRestaurantOrders: publicProcedure
      .input(z.number())
      .query(({ input }) => getRestaurantOrders(input)),
    
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getOrderById(input)),
    
    getOrderItems: publicProcedure
      .input(z.number())
      .query(({ input }) => getOrderItems(input)),
    
    updateStatus: publicProcedure
      .input(updateOrderStatusInputSchema)
      .mutation(({ input }) => updateOrderStatus(input)),
    
    cancel: publicProcedure
      .input(z.number())
      .mutation(({ input }) => cancelOrder(input)),
    
    getAll: publicProcedure
      .query(() => getAllOrders()),
  }),

  // Review management routes
  reviews: router({
    create: publicProcedure
      .input(createReviewInputSchema)
      .mutation(({ input }) => createReview(input)),
    
    getByRestaurant: publicProcedure
      .input(z.number())
      .query(({ input }) => getRestaurantReviews(input)),
    
    getByUser: publicProcedure
      .input(z.number())
      .query(({ input }) => getUserReviews(input)),
    
    getPending: publicProcedure
      .query(() => getPendingReviews()),
    
    moderate: publicProcedure
      .input(moderateReviewInputSchema)
      .mutation(({ input }) => moderateReview(input)),
    
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteReview(input)),
  }),

  // Payment management routes
  payments: router({
    create: publicProcedure
      .input(createPaymentInputSchema)
      .mutation(({ input }) => createPayment(input)),
    
    process: publicProcedure
      .input(z.number())
      .mutation(({ input }) => processPayment(input)),
    
    getByOrder: publicProcedure
      .input(z.number())
      .query(({ input }) => getOrderPayments(input)),
    
    refund: publicProcedure
      .input(z.number())
      .mutation(({ input }) => refundPayment(input)),
    
    getAll: publicProcedure
      .query(() => getAllPayments()),
  }),

  // Admin management routes
  admin: router({
    getAllUsers: publicProcedure
      .query(() => getAllUsers()),
    
    getUserById: publicProcedure
      .input(z.number())
      .query(({ input }) => getUserById(input)),
    
    updateUserRole: publicProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['customer', 'restaurant_owner', 'admin'])
      }))
      .mutation(({ input }) => updateUserRole(input.userId, input.role)),
    
    deleteUser: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteUser(input)),
    
    getSystemStats: publicProcedure
      .query(() => getSystemStats()),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();