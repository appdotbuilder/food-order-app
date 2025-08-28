import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  addressesTable, 
  restaurantsTable, 
  menuCategoriesTable,
  menuItemsTable,
  cartItemsTable,
  ordersTable,
  orderItemsTable
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  createOrder, 
  getUserOrders, 
  getRestaurantOrders, 
  getOrderById, 
  getOrderItems, 
  updateOrderStatus, 
  cancelOrder, 
  getAllOrders 
} from '../handlers/orders';
import { type CreateOrderInput, type UpdateOrderStatusInput } from '../schema';

describe('orders handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let testUser: any;
  let testRestaurantOwner: any;
  let testRestaurant: any;
  let testAddress: any;
  let testCategory: any;
  let testMenuItem1: any;
  let testMenuItem2: any;

  const setupTestData = async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'customer@test.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Doe',
          phone: '1234567890',
          role: 'customer'
        },
        {
          email: 'owner@test.com', 
          password_hash: 'hashed_password',
          first_name: 'Jane',
          last_name: 'Smith',
          phone: '0987654321',
          role: 'restaurant_owner'
        }
      ])
      .returning()
      .execute();

    testUser = users[0];
    testRestaurantOwner = users[1];

    // Create test address
    const addresses = await db.insert(addressesTable)
      .values({
        user_id: testUser.id,
        street_address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        postal_code: '12345',
        country: 'USA',
        is_default: true
      })
      .returning()
      .execute();

    testAddress = addresses[0];

    // Create test restaurant
    const restaurants = await db.insert(restaurantsTable)
      .values({
        owner_id: testRestaurantOwner.id,
        name: 'Test Restaurant',
        description: 'A test restaurant',
        address: '456 Restaurant Ave',
        phone: '555-0123',
        email: 'restaurant@test.com',
        is_active: true
      })
      .returning()
      .execute();

    testRestaurant = restaurants[0];

    // Create menu category
    const categories = await db.insert(menuCategoriesTable)
      .values({
        restaurant_id: testRestaurant.id,
        name: 'Main Dishes',
        description: 'Delicious main courses',
        sort_order: 1
      })
      .returning()
      .execute();

    testCategory = categories[0];

    // Create menu items
    const menuItems = await db.insert(menuItemsTable)
      .values([
        {
          restaurant_id: testRestaurant.id,
          category_id: testCategory.id,
          name: 'Burger',
          description: 'Juicy beef burger',
          price: '12.99',
          is_available: true,
          sort_order: 1
        },
        {
          restaurant_id: testRestaurant.id,
          category_id: testCategory.id,
          name: 'Pizza',
          description: 'Margherita pizza',
          price: '15.99',
          is_available: true,
          sort_order: 2
        }
      ])
      .returning()
      .execute();

    testMenuItem1 = menuItems[0];
    testMenuItem2 = menuItems[1];
  };

  const setupCartItems = async () => {
    await db.insert(cartItemsTable)
      .values([
        {
          user_id: testUser.id,
          menu_item_id: testMenuItem1.id,
          quantity: 2,
          selected_options: null,
          total_price: '25.98'
        },
        {
          user_id: testUser.id,
          menu_item_id: testMenuItem2.id,
          quantity: 1,
          selected_options: null,
          total_price: '15.99'
        }
      ])
      .execute();
  };

  describe('createOrder', () => {
    it('should create an order from cart items', async () => {
      await setupTestData();
      await setupCartItems();

      const input: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id,
        notes: 'Test order notes'
      };

      const result = await createOrder(input);

      expect(result.user_id).toEqual(testUser.id);
      expect(result.restaurant_id).toEqual(testRestaurant.id);
      expect(result.delivery_address_id).toEqual(testAddress.id);
      expect(result.status).toEqual('created');
      expect(result.payment_status).toEqual('pending');
      expect(result.notes).toEqual('Test order notes');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify calculations (2 * 12.99 + 1 * 15.99 = 41.97)
      expect(result.subtotal).toEqual(41.97);
      expect(result.delivery_fee).toEqual(3.99);
      expect(result.tax_amount).toBeCloseTo(41.97 * 0.08, 2); // 8% tax, 2 decimal precision
      expect(result.total_amount).toBeCloseTo(41.97 + 3.99 + (41.97 * 0.08), 2);

      // Verify order items were created
      const orderItems = await getOrderItems(result.id);
      expect(orderItems).toHaveLength(2);
      expect(orderItems[0].menu_item_id).toEqual(testMenuItem1.id);
      expect(orderItems[0].quantity).toEqual(2);
      expect(orderItems[1].menu_item_id).toEqual(testMenuItem2.id);
      expect(orderItems[1].quantity).toEqual(1);

      // Verify cart was cleared
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, testUser.id))
        .execute();
      expect(cartItems).toHaveLength(0);
    });

    it('should throw error when user not found', async () => {
      await setupTestData();

      const input: CreateOrderInput = {
        user_id: 999,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      await expect(createOrder(input)).rejects.toThrow(/User not found/i);
    });

    it('should throw error when restaurant not found', async () => {
      await setupTestData();

      const input: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: 999,
        delivery_address_id: testAddress.id
      };

      await expect(createOrder(input)).rejects.toThrow(/Restaurant not found/i);
    });

    it('should throw error when no cart items exist', async () => {
      await setupTestData();

      const input: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      await expect(createOrder(input)).rejects.toThrow(/No cart items found/i);
    });
  });

  describe('getUserOrders', () => {
    it('should return user orders', async () => {
      await setupTestData();
      await setupCartItems();

      // Create an order first
      const orderInput: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      await createOrder(orderInput);

      const result = await getUserOrders(testUser.id);

      expect(result).toHaveLength(1);
      expect(result[0].user_id).toEqual(testUser.id);
      expect(result[0].restaurant_id).toEqual(testRestaurant.id);
      expect(typeof result[0].subtotal).toEqual('number');
      expect(typeof result[0].total_amount).toEqual('number');
    });

    it('should return empty array for user with no orders', async () => {
      await setupTestData();

      const result = await getUserOrders(testUser.id);

      expect(result).toHaveLength(0);
    });
  });

  describe('getRestaurantOrders', () => {
    it('should return restaurant orders', async () => {
      await setupTestData();
      await setupCartItems();

      // Create an order first
      const orderInput: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      await createOrder(orderInput);

      const result = await getRestaurantOrders(testRestaurant.id);

      expect(result).toHaveLength(1);
      expect(result[0].restaurant_id).toEqual(testRestaurant.id);
      expect(result[0].user_id).toEqual(testUser.id);
      expect(typeof result[0].subtotal).toEqual('number');
    });

    it('should return empty array for restaurant with no orders', async () => {
      await setupTestData();

      const result = await getRestaurantOrders(testRestaurant.id);

      expect(result).toHaveLength(0);
    });
  });

  describe('getOrderById', () => {
    it('should return specific order', async () => {
      await setupTestData();
      await setupCartItems();

      const orderInput: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      const createdOrder = await createOrder(orderInput);
      const result = await getOrderById(createdOrder.id);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdOrder.id);
      expect(result!.user_id).toEqual(testUser.id);
      expect(typeof result!.subtotal).toEqual('number');
    });

    it('should return null for non-existent order', async () => {
      const result = await getOrderById(999);

      expect(result).toBeNull();
    });
  });

  describe('getOrderItems', () => {
    it('should return order items', async () => {
      await setupTestData();
      await setupCartItems();

      const orderInput: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      const order = await createOrder(orderInput);
      const result = await getOrderItems(order.id);

      expect(result).toHaveLength(2);
      expect(result[0].order_id).toEqual(order.id);
      expect(result[0].quantity).toBeDefined();
      expect(typeof result[0].unit_price).toEqual('number');
      expect(typeof result[0].total_price).toEqual('number');
    });

    it('should return empty array for order with no items', async () => {
      const result = await getOrderItems(999);

      expect(result).toHaveLength(0);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      await setupTestData();
      await setupCartItems();

      const orderInput: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      const order = await createOrder(orderInput);

      const updateInput: UpdateOrderStatusInput = {
        id: order.id,
        status: 'confirmed',
        estimated_delivery_time: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      };

      const result = await updateOrderStatus(updateInput);

      expect(result.id).toEqual(order.id);
      expect(result.status).toEqual('confirmed');
      expect(result.estimated_delivery_time).toBeInstanceOf(Date);
      expect(typeof result.subtotal).toEqual('number');
    });

    it('should throw error for non-existent order', async () => {
      const updateInput: UpdateOrderStatusInput = {
        id: 999,
        status: 'confirmed'
      };

      await expect(updateOrderStatus(updateInput)).rejects.toThrow(/Order not found/i);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order', async () => {
      await setupTestData();
      await setupCartItems();

      const orderInput: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      const order = await createOrder(orderInput);
      const result = await cancelOrder(order.id);

      expect(result.id).toEqual(order.id);
      expect(result.status).toEqual('canceled');
      expect(typeof result.subtotal).toEqual('number');
    });

    it('should throw error for non-existent order', async () => {
      await expect(cancelOrder(999)).rejects.toThrow(/Order not found/i);
    });
  });

  describe('getAllOrders', () => {
    it('should return all orders', async () => {
      await setupTestData();
      await setupCartItems();

      // Create multiple orders
      const orderInput: CreateOrderInput = {
        user_id: testUser.id,
        restaurant_id: testRestaurant.id,
        delivery_address_id: testAddress.id
      };

      await createOrder(orderInput);
      await setupCartItems(); // Add cart items again
      await createOrder(orderInput);

      const result = await getAllOrders();

      expect(result).toHaveLength(2);
      expect(result.every(order => typeof order.subtotal === 'number')).toBe(true);
      expect(result.every(order => typeof order.total_amount === 'number')).toBe(true);
    });

    it('should return empty array when no orders exist', async () => {
      const result = await getAllOrders();

      expect(result).toHaveLength(0);
    });
  });
});