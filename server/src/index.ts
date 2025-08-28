import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import { z } from 'zod';
import {
  createUserInputSchema,
  loginUserInputSchema,
  createRestaurantInputSchema,
  getRestaurantsInputSchema,
  createMenuItemInputSchema,
  getMenuItemsInputSchema,
  addToCartInputSchema,
  createOrderInputSchema,
  updateOrderStatusInputSchema,
  getUserOrdersInputSchema,
  getRestaurantOrdersInputSchema,
  createPaymentInputSchema
} from './schema';

// Import handlers
import { registerUser, loginUser, getUserById } from './handlers/auth';
import { createRestaurant, getRestaurants, getRestaurantById, getRestaurantsByOwner } from './handlers/restaurants';
import { createMenuItem, getMenuItems, getMenuItemById, updateMenuItemAvailability } from './handlers/menu_items';
import { addToCart, getUserCart, getCartItems, removeFromCart, updateCartItemQuantity, clearCart } from './handlers/cart';
import { createOrder, getOrderById, getUserOrders, getRestaurantOrders, updateOrderStatus, getOrderItems } from './handlers/orders';
import { createPayment, processPayment, getPaymentByOrderId, refundPayment } from './handlers/payments';
import { getAllUsers, getAllRestaurants, getAllOrders, deactivateRestaurant, activateRestaurant } from './handlers/admin';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  registerUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => registerUser(input)),
  
  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .mutation(({ input }) => loginUser(input)),
  
  getUserById: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserById(input.userId)),

  // Restaurant routes
  createRestaurant: publicProcedure
    .input(createRestaurantInputSchema)
    .mutation(({ input }) => createRestaurant(input)),
  
  getRestaurants: publicProcedure
    .input(getRestaurantsInputSchema.optional())
    .query(({ input }) => getRestaurants(input)),
  
  getRestaurantById: publicProcedure
    .input(z.object({ restaurantId: z.number() }))
    .query(({ input }) => getRestaurantById(input.restaurantId)),
  
  getRestaurantsByOwner: publicProcedure
    .input(z.object({ ownerId: z.number() }))
    .query(({ input }) => getRestaurantsByOwner(input.ownerId)),

  // Menu item routes
  createMenuItem: publicProcedure
    .input(createMenuItemInputSchema)
    .mutation(({ input }) => createMenuItem(input)),
  
  getMenuItems: publicProcedure
    .input(getMenuItemsInputSchema)
    .query(({ input }) => getMenuItems(input)),
  
  getMenuItemById: publicProcedure
    .input(z.object({ menuItemId: z.number() }))
    .query(({ input }) => getMenuItemById(input.menuItemId)),
  
  updateMenuItemAvailability: publicProcedure
    .input(z.object({ menuItemId: z.number(), isAvailable: z.boolean() }))
    .mutation(({ input }) => updateMenuItemAvailability(input.menuItemId, input.isAvailable)),

  // Cart routes
  addToCart: publicProcedure
    .input(addToCartInputSchema)
    .mutation(({ input }) => addToCart(input)),
  
  getUserCart: publicProcedure
    .input(z.object({ userId: z.number(), restaurantId: z.number() }))
    .query(({ input }) => getUserCart(input.userId, input.restaurantId)),
  
  getCartItems: publicProcedure
    .input(z.object({ cartId: z.number() }))
    .query(({ input }) => getCartItems(input.cartId)),
  
  removeFromCart: publicProcedure
    .input(z.object({ cartItemId: z.number() }))
    .mutation(({ input }) => removeFromCart(input.cartItemId)),
  
  updateCartItemQuantity: publicProcedure
    .input(z.object({ cartItemId: z.number(), quantity: z.number().int().positive() }))
    .mutation(({ input }) => updateCartItemQuantity(input.cartItemId, input.quantity)),
  
  clearCart: publicProcedure
    .input(z.object({ cartId: z.number() }))
    .mutation(({ input }) => clearCart(input.cartId)),

  // Order routes
  createOrder: publicProcedure
    .input(createOrderInputSchema)
    .mutation(({ input }) => createOrder(input)),
  
  getOrderById: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(({ input }) => getOrderById(input.orderId)),
  
  getUserOrders: publicProcedure
    .input(getUserOrdersInputSchema)
    .query(({ input }) => getUserOrders(input)),
  
  getRestaurantOrders: publicProcedure
    .input(getRestaurantOrdersInputSchema)
    .query(({ input }) => getRestaurantOrders(input)),
  
  updateOrderStatus: publicProcedure
    .input(updateOrderStatusInputSchema)
    .mutation(({ input }) => updateOrderStatus(input)),
  
  getOrderItems: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(({ input }) => getOrderItems(input.orderId)),

  // Payment routes
  createPayment: publicProcedure
    .input(createPaymentInputSchema)
    .mutation(({ input }) => createPayment(input)),
  
  processPayment: publicProcedure
    .input(z.object({ paymentId: z.number() }))
    .mutation(({ input }) => processPayment(input.paymentId)),
  
  getPaymentByOrderId: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(({ input }) => getPaymentByOrderId(input.orderId)),
  
  refundPayment: publicProcedure
    .input(z.object({ paymentId: z.number() }))
    .mutation(({ input }) => refundPayment(input.paymentId)),

  // Admin routes
  getAllUsers: publicProcedure
    .query(() => getAllUsers()),
  
  getAllRestaurants: publicProcedure
    .query(() => getAllRestaurants()),
  
  getAllOrders: publicProcedure
    .query(() => getAllOrders()),
  
  deactivateRestaurant: publicProcedure
    .input(z.object({ restaurantId: z.number() }))
    .mutation(({ input }) => deactivateRestaurant(input.restaurantId)),
  
  activateRestaurant: publicProcedure
    .input(z.object({ restaurantId: z.number() }))
    .mutation(({ input }) => activateRestaurant(input.restaurantId)),
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