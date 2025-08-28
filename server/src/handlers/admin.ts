import { db } from '../db';
import { usersTable, restaurantsTable, ordersTable, reviewsTable } from '../db/schema';
import { type User } from '../schema';
import { eq, count } from 'drizzle-orm';

export async function getAllUsers(): Promise<User[]> {
  try {
    const results = await db.select()
      .from(usersTable)
      .orderBy(usersTable.created_at)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get all users:', error);
    throw error;
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  try {
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    return results[0] || null;
  } catch (error) {
    console.error('Failed to get user by ID:', error);
    throw error;
  }
}

export async function updateUserRole(userId: number, role: 'customer' | 'restaurant_owner' | 'admin'): Promise<User> {
  try {
    // First check if user exists
    const existingUser = await getUserById(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Update the user role
    const results = await db.update(usersTable)
      .set({ 
        role: role,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    if (results.length === 0) {
      throw new Error('Failed to update user role');
    }

    return results[0];
  } catch (error) {
    console.error('Failed to update user role:', error);
    throw error;
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  try {
    // Check if user exists first
    const existingUser = await getUserById(userId);
    if (!existingUser) {
      return false;
    }

    // Delete the user (cascade will handle related records)
    const results = await db.delete(usersTable)
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    return results.length > 0;
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}

export async function getSystemStats(): Promise<{
  totalUsers: number;
  totalRestaurants: number;
  totalOrders: number;
  totalReviews: number;
}> {
  try {
    // Get all counts in parallel for better performance
    const [usersCount, restaurantsCount, ordersCount, reviewsCount] = await Promise.all([
      db.select({ count: count() }).from(usersTable).execute(),
      db.select({ count: count() }).from(restaurantsTable).execute(),
      db.select({ count: count() }).from(ordersTable).execute(),
      db.select({ count: count() }).from(reviewsTable).execute()
    ]);

    return {
      totalUsers: usersCount[0].count,
      totalRestaurants: restaurantsCount[0].count,
      totalOrders: ordersCount[0].count,
      totalReviews: reviewsCount[0].count
    };
  } catch (error) {
    console.error('Failed to get system stats:', error);
    throw error;
  }
}