import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  restaurantsTable, 
  menuItemsTable, 
  cartsTable, 
  cartItemsTable, 
  ordersTable, 
  orderItemsTable 
} from '../db/schema';
import { 
  type CreateOrderInput, 
  type UpdateOrderStatusInput,
  type GetUserOrdersInput,
  type GetRestaurantOrdersInput 
} from '../schema';
import { 
  createOrder, 
  getOrderById, 
  getUserOrders, 
  getRestaurantOrders, 
  updateOrderStatus, 
  getOrderItems 
} from '../handlers/orders';
import { eq } from 'drizzle-orm';

describe('Orders Handlers', () => {
  let userId: number;
  let restaurantId: number;
  let menuItemId1: number;
  let menuItemId2: number;
  let cartId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        password_hash: 'hashedpassword',
        name: 'Test Customer',
        phone: '+91-9876543210',
        role: 'customer'
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create restaurant owner
    const ownerResult = await db.insert(usersTable)
      .values({
        email: 'owner@test.com',
        password_hash: 'hashedpassword',
        name: 'Restaurant Owner',
        phone: '+91-9876543211',
        role: 'restaurant_owner'
      })
      .returning()
      .execute();

    // Create restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        owner_id: ownerResult[0].id,
        name: 'Test Restaurant',
        description: 'A test restaurant',
        address: '123 Restaurant Street',
        phone: '+91-9876543212'
      })
      .returning()
      .execute();
    restaurantId = restaurantResult[0].id;

    // Create menu items
    const menuItem1Result = await db.insert(menuItemsTable)
      .values({
        restaurant_id: restaurantId,
        name: 'Burger',
        description: 'Delicious burger',
        price: '12.99',
        category: 'Main Course'
      })
      .returning()
      .execute();
    menuItemId1 = menuItem1Result[0].id;

    const menuItem2Result = await db.insert(menuItemsTable)
      .values({
        restaurant_id: restaurantId,
        name: 'Fries',
        description: 'Crispy fries',
        price: '4.99',
        category: 'Sides'
      })
      .returning()
      .execute();
    menuItemId2 = menuItem2Result[0].id;

    // Create cart
    const cartResult = await db.insert(cartsTable)
      .values({
        user_id: userId,
        restaurant_id: restaurantId
      })
      .returning()
      .execute();
    cartId = cartResult[0].id;

    // Add items to cart
    await db.insert(cartItemsTable)
      .values([
        {
          cart_id: cartId,
          menu_item_id: menuItemId1,
          quantity: 2
        },
        {
          cart_id: cartId,
          menu_item_id: menuItemId2,
          quantity: 1
        }
      ])
      .execute();
  });

  afterEach(resetDB);

  describe('createOrder', () => {
    const testInput: CreateOrderInput = {
      user_id: 0, // Will be set in test
      restaurant_id: 0, // Will be set in test
      cart_id: 0, // Will be set in test
      delivery_address: '456 Customer Street',
      phone: '+91-9876543210'
    };

    it('should create an order from cart items', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId
      };

      const result = await createOrder(input);

      expect(result.user_id).toBe(userId);
      expect(result.restaurant_id).toBe(restaurantId);
      expect(result.delivery_address).toBe('456 Customer Street');
      expect(result.phone).toBe('+91-9876543210');
      expect(result.status).toBe('pending');
      expect(result.total_amount).toBe(30.97); // (12.99 * 2) + (4.99 * 1)
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(typeof result.total_amount).toBe('number');
    });

    it('should create order items from cart items', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId
      };

      const order = await createOrder(input);
      const orderItems = await getOrderItems(order.id);

      expect(orderItems).toHaveLength(2);
      
      const burgerItem = orderItems.find(item => item.menu_item_id === menuItemId1);
      const friesItem = orderItems.find(item => item.menu_item_id === menuItemId2);

      expect(burgerItem).toBeDefined();
      expect(burgerItem!.quantity).toBe(2);
      expect(burgerItem!.price_at_time).toBe(12.99);
      expect(typeof burgerItem!.price_at_time).toBe('number');

      expect(friesItem).toBeDefined();
      expect(friesItem!.quantity).toBe(1);
      expect(friesItem!.price_at_time).toBe(4.99);
    });

    it('should clear cart after order creation', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId
      };

      await createOrder(input);

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.cart_id, cartId))
        .execute();

      expect(cartItems).toHaveLength(0);
    });

    it('should save order to database', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId
      };

      const result = await createOrder(input);

      const orders = await db.select()
        .from(ordersTable)
        .where(eq(ordersTable.id, result.id))
        .execute();

      expect(orders).toHaveLength(1);
      expect(orders[0].user_id).toBe(userId);
      expect(parseFloat(orders[0].total_amount)).toBe(30.97);
    });

    it('should throw error when cart does not exist', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: 99999
      };

      expect(createOrder(input)).rejects.toThrow(/cart not found/i);
    });

    it('should throw error when cart is empty', async () => {
      // Clear cart items
      await db.delete(cartItemsTable)
        .where(eq(cartItemsTable.cart_id, cartId))
        .execute();

      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId
      };

      expect(createOrder(input)).rejects.toThrow(/cart is empty/i);
    });
  });

  describe('getOrderById', () => {
    it('should return order by ID', async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId,
        delivery_address: '456 Customer Street',
        phone: '+91-9876543210'
      };

      const createdOrder = await createOrder(input);
      const result = await getOrderById(createdOrder.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(createdOrder.id);
      expect(result!.user_id).toBe(userId);
      expect(result!.total_amount).toBe(30.97);
      expect(typeof result!.total_amount).toBe('number');
    });

    it('should return null for non-existent order', async () => {
      const result = await getOrderById(99999);
      expect(result).toBeNull();
    });
  });

  describe('getUserOrders', () => {
    it('should return orders for user', async () => {
      // Create multiple orders
      for (let i = 0; i < 3; i++) {
        // Add items back to cart for each order
        await db.insert(cartItemsTable)
          .values({
            cart_id: cartId,
            menu_item_id: menuItemId1,
            quantity: 1
          })
          .execute();

        await createOrder({
          user_id: userId,
          restaurant_id: restaurantId,
          cart_id: cartId,
          delivery_address: `Address ${i}`,
          phone: '+91-9876543210'
        });
      }

      const input: GetUserOrdersInput = {
        user_id: userId,
        limit: 10,
        offset: 0
      };

      const result = await getUserOrders(input);

      expect(result).toHaveLength(3);
      result.forEach(order => {
        expect(order.user_id).toBe(userId);
        expect(typeof order.total_amount).toBe('number');
      });

      // Should be ordered by creation date (newest first)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].created_at >= result[i + 1].created_at).toBe(true);
      }
    });

    it('should respect pagination limits', async () => {
      // Create 5 orders
      for (let i = 0; i < 5; i++) {
        await db.insert(cartItemsTable)
          .values({
            cart_id: cartId,
            menu_item_id: menuItemId1,
            quantity: 1
          })
          .execute();

        await createOrder({
          user_id: userId,
          restaurant_id: restaurantId,
          cart_id: cartId,
          delivery_address: `Address ${i}`,
          phone: '+91-9876543210'
        });
      }

      const input: GetUserOrdersInput = {
        user_id: userId,
        limit: 3,
        offset: 1
      };

      const result = await getUserOrders(input);

      expect(result).toHaveLength(3);
    });
  });

  describe('getRestaurantOrders', () => {
    it('should return orders for restaurant', async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId,
        delivery_address: '456 Customer Street',
        phone: '+91-9876543210'
      };

      const createdOrder = await createOrder(input);

      const restaurantInput: GetRestaurantOrdersInput = {
        restaurant_id: restaurantId,
        limit: 10,
        offset: 0
      };

      const result = await getRestaurantOrders(restaurantInput);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(createdOrder.id);
      expect(result[0].restaurant_id).toBe(restaurantId);
      expect(typeof result[0].total_amount).toBe('number');
    });

    it('should filter orders by status', async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId,
        delivery_address: '456 Customer Street',
        phone: '+91-9876543210'
      };

      const createdOrder = await createOrder(input);

      // Update order status
      await updateOrderStatus({
        order_id: createdOrder.id,
        status: 'accepted'
      });

      const restaurantInput: GetRestaurantOrdersInput = {
        restaurant_id: restaurantId,
        status: 'accepted',
        limit: 10,
        offset: 0
      };

      const result = await getRestaurantOrders(restaurantInput);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('accepted');
    });

    it('should return empty array when no orders match status filter', async () => {
      const restaurantInput: GetRestaurantOrdersInput = {
        restaurant_id: restaurantId,
        status: 'delivered',
        limit: 10,
        offset: 0
      };

      const result = await getRestaurantOrders(restaurantInput);

      expect(result).toHaveLength(0);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId,
        delivery_address: '456 Customer Street',
        phone: '+91-9876543210'
      };

      const createdOrder = await createOrder(input);

      const updateInput: UpdateOrderStatusInput = {
        order_id: createdOrder.id,
        status: 'accepted'
      };

      const result = await updateOrderStatus(updateInput);

      expect(result).not.toBeNull();
      expect(result!.status).toBe('accepted');
      expect(result!.updated_at).toBeInstanceOf(Date);
      expect(typeof result!.total_amount).toBe('number');
    });

    it('should save status update to database', async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId,
        delivery_address: '456 Customer Street',
        phone: '+91-9876543210'
      };

      const createdOrder = await createOrder(input);

      const updateInput: UpdateOrderStatusInput = {
        order_id: createdOrder.id,
        status: 'preparing'
      };

      await updateOrderStatus(updateInput);

      const orders = await db.select()
        .from(ordersTable)
        .where(eq(ordersTable.id, createdOrder.id))
        .execute();

      expect(orders[0].status).toBe('preparing');
    });

    it('should return null for non-existent order', async () => {
      const updateInput: UpdateOrderStatusInput = {
        order_id: 99999,
        status: 'accepted'
      };

      const result = await updateOrderStatus(updateInput);
      expect(result).toBeNull();
    });
  });

  describe('getOrderItems', () => {
    it('should return order items', async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        restaurant_id: restaurantId,
        cart_id: cartId,
        delivery_address: '456 Customer Street',
        phone: '+91-9876543210'
      };

      const createdOrder = await createOrder(input);
      const result = await getOrderItems(createdOrder.id);

      expect(result).toHaveLength(2);
      result.forEach(item => {
        expect(item.order_id).toBe(createdOrder.id);
        expect(typeof item.price_at_time).toBe('number');
        expect(item.quantity).toBeGreaterThan(0);
      });
    });

    it('should return empty array for order with no items', async () => {
      const result = await getOrderItems(99999);
      expect(result).toHaveLength(0);
    });
  });
});