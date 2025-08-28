import { db } from '../db';
import { 
  ordersTable, 
  orderItemsTable, 
  cartsTable, 
  cartItemsTable, 
  menuItemsTable 
} from '../db/schema';
import { 
  type CreateOrderInput, 
  type Order, 
  type OrderItem, 
  type UpdateOrderStatusInput,
  type GetUserOrdersInput,
  type GetRestaurantOrdersInput 
} from '../schema';
import { eq, desc, and, SQL } from 'drizzle-orm';

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  try {
    // First, verify the cart exists and belongs to the user
    const cart = await db.select()
      .from(cartsTable)
      .where(
        and(
          eq(cartsTable.id, input.cart_id),
          eq(cartsTable.user_id, input.user_id),
          eq(cartsTable.restaurant_id, input.restaurant_id)
        )
      )
      .execute();

    if (cart.length === 0) {
      throw new Error('Cart not found or does not belong to user');
    }

    // Get cart items with menu item details to calculate total and create order items
    const cartItems = await db.select()
      .from(cartItemsTable)
      .innerJoin(menuItemsTable, eq(cartItemsTable.menu_item_id, menuItemsTable.id))
      .where(eq(cartItemsTable.cart_id, input.cart_id))
      .execute();

    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // Calculate total amount
    let totalAmount = 0;
    for (const item of cartItems) {
      const price = parseFloat(item.menu_items.price);
      totalAmount += price * item.cart_items.quantity;
    }

    // Create the order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: input.user_id,
        restaurant_id: input.restaurant_id,
        total_amount: totalAmount.toString(),
        delivery_address: input.delivery_address,
        phone: input.phone,
        status: 'pending'
      })
      .returning()
      .execute();

    const order = orderResult[0];

    // Create order items from cart items
    const orderItemsData = cartItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.cart_items.menu_item_id,
      quantity: item.cart_items.quantity,
      price_at_time: item.menu_items.price // Keep as string for insertion
    }));

    await db.insert(orderItemsTable)
      .values(orderItemsData)
      .execute();

    // Clear the cart after successful order creation
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, input.cart_id))
      .execute();

    // Return the order with numeric conversion
    return {
      ...order,
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
}

export async function getOrderById(orderId: number): Promise<Order | null> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];
    return {
      ...order,
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Get order by ID failed:', error);
    throw error;
  }
}

export async function getUserOrders(input: GetUserOrdersInput): Promise<Order[]> {
  try {
    // Apply pagination with defaults
    const limit = input.limit ?? 10;
    const offset = input.offset ?? 0;
    
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.user_id, input.user_id))
      .orderBy(desc(ordersTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    return orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Get user orders failed:', error);
    throw error;
  }
}

export async function getRestaurantOrders(input: GetRestaurantOrdersInput): Promise<Order[]> {
  try {
    const conditions: SQL<unknown>[] = [];
    conditions.push(eq(ordersTable.restaurant_id, input.restaurant_id));

    if (input.status) {
      conditions.push(eq(ordersTable.status, input.status));
    }

    // Apply pagination with defaults
    const limit = input.limit ?? 10;
    const offset = input.offset ?? 0;

    const orders = await db.select()
      .from(ordersTable)
      .where(and(...conditions))
      .orderBy(desc(ordersTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    return orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Get restaurant orders failed:', error);
    throw error;
  }
}

export async function updateOrderStatus(input: UpdateOrderStatusInput): Promise<Order | null> {
  try {
    const result = await db.update(ordersTable)
      .set({
        status: input.status,
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, input.order_id))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    const order = result[0];
    return {
      ...order,
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Update order status failed:', error);
    throw error;
  }
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  try {
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    return orderItems.map(item => ({
      ...item,
      price_at_time: parseFloat(item.price_at_time)
    }));
  } catch (error) {
    console.error('Get order items failed:', error);
    throw error;
  }
}