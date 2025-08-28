import { db } from '../db';
import { usersTable, restaurantsTable, ordersTable } from '../db/schema';
import { type User, type Restaurant, type Order } from '../schema';
import { eq } from 'drizzle-orm';

export async function getAllUsers(): Promise<User[]> {
  try {
    const results = await db.select()
      .from(usersTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch all users:', error);
    throw error;
  }
}

export async function getAllRestaurants(): Promise<Restaurant[]> {
  try {
    const results = await db.select()
      .from(restaurantsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch all restaurants:', error);
    throw error;
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    const results = await db.select()
      .from(ordersTable)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch all orders:', error);
    throw error;
  }
}

export async function deactivateRestaurant(restaurantId: number): Promise<Restaurant | null> {
  try {
    const result = await db.update(restaurantsTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(restaurantsTable.id, restaurantId))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.error('Failed to deactivate restaurant:', error);
    throw error;
  }
}

export async function activateRestaurant(restaurantId: number): Promise<Restaurant | null> {
  try {
    const result = await db.update(restaurantsTable)
      .set({ 
        is_active: true,
        updated_at: new Date()
      })
      .where(eq(restaurantsTable.id, restaurantId))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.error('Failed to activate restaurant:', error);
    throw error;
  }
}