import { db } from '../db';
import { 
  ordersTable, 
  orderItemsTable, 
  cartItemsTable, 
  menuItemsTable,
  addressesTable,
  restaurantsTable,
  usersTable 
} from '../db/schema';
import { type CreateOrderInput, type UpdateOrderStatusInput, type Order, type OrderItem } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

const TAX_RATE = 0.08; // 8% tax rate
const DELIVERY_FEE = 3.99; // Fixed delivery fee

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  try {
    // Verify that the user, restaurant, and address exist
    const [user, restaurant, address] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, input.user_id)).execute(),
      db.select().from(restaurantsTable).where(eq(restaurantsTable.id, input.restaurant_id)).execute(),
      db.select().from(addressesTable).where(eq(addressesTable.id, input.delivery_address_id)).execute()
    ]);

    if (user.length === 0) {
      throw new Error('User not found');
    }
    if (restaurant.length === 0) {
      throw new Error('Restaurant not found');
    }
    if (address.length === 0) {
      throw new Error('Address not found');
    }

    // Get cart items for the user from the same restaurant
    const cartItems = await db.select({
      cart_item_id: cartItemsTable.id,
      menu_item_id: cartItemsTable.menu_item_id,
      quantity: cartItemsTable.quantity,
      selected_options: cartItemsTable.selected_options,
      menu_item_price: menuItemsTable.price,
      menu_item_name: menuItemsTable.name,
      menu_item_restaurant_id: menuItemsTable.restaurant_id
    })
    .from(cartItemsTable)
    .innerJoin(menuItemsTable, eq(cartItemsTable.menu_item_id, menuItemsTable.id))
    .where(and(
      eq(cartItemsTable.user_id, input.user_id),
      eq(menuItemsTable.restaurant_id, input.restaurant_id)
    ))
    .execute();

    if (cartItems.length === 0) {
      throw new Error('No cart items found for this restaurant');
    }

    // Calculate subtotal
    const subtotal = cartItems.reduce((total, item) => {
      const itemPrice = parseFloat(item.menu_item_price);
      return total + (itemPrice * item.quantity);
    }, 0);

    // Calculate tax and total
    const taxAmount = subtotal * TAX_RATE;
    const totalAmount = subtotal + DELIVERY_FEE + taxAmount;

    // Create the order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: input.user_id,
        restaurant_id: input.restaurant_id,
        delivery_address_id: input.delivery_address_id,
        status: 'created',
        subtotal: subtotal.toString(),
        delivery_fee: DELIVERY_FEE.toString(),
        tax_amount: taxAmount.toString(),
        total_amount: totalAmount.toString(),
        payment_status: 'pending',
        notes: input.notes || null
      })
      .returning()
      .execute();

    const order = orderResult[0];

    // Create order items from cart items
    const orderItemsData = cartItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.menu_item_price,
      selected_options: item.selected_options as number[] | null,
      total_price: (parseFloat(item.menu_item_price) * item.quantity).toString()
    }));

    await db.insert(orderItemsTable)
      .values(orderItemsData)
      .execute();

    // Clear cart items for this restaurant
    const cartItemIds = cartItems.map(item => item.cart_item_id);
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemIds[0]))
      .execute();

    // Delete remaining cart items one by one
    for (let i = 1; i < cartItemIds.length; i++) {
      await db.delete(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemIds[i]))
        .execute();
    }

    // Convert numeric fields back to numbers for response
    return {
      ...order,
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      tax_amount: parseFloat(order.tax_amount),
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
}

export async function getUserOrders(userId: number): Promise<Order[]> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.user_id, userId))
      .execute();

    return orders.map(order => ({
      ...order,
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      tax_amount: parseFloat(order.tax_amount),
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get user orders:', error);
    throw error;
  }
}

export async function getRestaurantOrders(restaurantId: number): Promise<Order[]> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.restaurant_id, restaurantId))
      .execute();

    return orders.map(order => ({
      ...order,
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      tax_amount: parseFloat(order.tax_amount),
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get restaurant orders:', error);
    throw error;
  }
}

export async function getOrderById(id: number): Promise<Order | null> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .execute();

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];
    return {
      ...order,
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      tax_amount: parseFloat(order.tax_amount),
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Failed to get order by ID:', error);
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
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price),
      selected_options: item.selected_options as number[] | null
    }));
  } catch (error) {
    console.error('Failed to get order items:', error);
    throw error;
  }
}

export async function updateOrderStatus(input: UpdateOrderStatusInput): Promise<Order> {
  try {
    const updateData: any = {
      status: input.status,
      updated_at: new Date()
    };

    if (input.estimated_delivery_time) {
      updateData.estimated_delivery_time = input.estimated_delivery_time;
    }

    const result = await db.update(ordersTable)
      .set(updateData)
      .where(eq(ordersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Order not found');
    }

    const order = result[0];
    return {
      ...order,
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      tax_amount: parseFloat(order.tax_amount),
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }
}

export async function cancelOrder(orderId: number): Promise<Order> {
  try {
    const result = await db.update(ordersTable)
      .set({ 
        status: 'canceled',
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, orderId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Order not found');
    }

    const order = result[0];
    return {
      ...order,
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      tax_amount: parseFloat(order.tax_amount),
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Failed to cancel order:', error);
    throw error;
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .execute();

    return orders.map(order => ({
      ...order,
      subtotal: parseFloat(order.subtotal),
      delivery_fee: parseFloat(order.delivery_fee),
      tax_amount: parseFloat(order.tax_amount),
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get all orders:', error);
    throw error;
  }
}