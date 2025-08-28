import { db } from '../db';
import { restaurantsTable, usersTable } from '../db/schema';
import { type CreateRestaurantInput, type UpdateRestaurantInput, type Restaurant } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createRestaurant(input: CreateRestaurantInput): Promise<Restaurant> {
  try {
    // Verify that the owner exists and has the correct role
    const owner = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.owner_id))
      .execute();

    if (owner.length === 0) {
      throw new Error('Owner not found');
    }

    if (owner[0].role !== 'restaurant_owner' && owner[0].role !== 'admin') {
      throw new Error('User must be a restaurant owner or admin to create restaurants');
    }

    // Insert restaurant record
    const result = await db.insert(restaurantsTable)
      .values({
        owner_id: input.owner_id,
        name: input.name,
        description: input.description,
        address: input.address,
        phone: input.phone,
        email: input.email,
        opening_hours: input.opening_hours,
        is_active: input.is_active ?? true // Use nullish coalescing for proper default handling
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const restaurant = result[0];
    return {
      ...restaurant,
      rating: restaurant.rating ? parseFloat(restaurant.rating) : null
    };
  } catch (error) {
    console.error('Restaurant creation failed:', error);
    throw error;
  }
}

export async function getAllRestaurants(): Promise<Restaurant[]> {
  try {
    const results = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.is_active, true))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(restaurant => ({
      ...restaurant,
      rating: restaurant.rating ? parseFloat(restaurant.rating) : null
    }));
  } catch (error) {
    console.error('Failed to fetch all restaurants:', error);
    throw error;
  }
}

export async function getRestaurantById(id: number): Promise<Restaurant | null> {
  try {
    const results = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const restaurant = results[0];
    return {
      ...restaurant,
      rating: restaurant.rating ? parseFloat(restaurant.rating) : null
    };
  } catch (error) {
    console.error('Failed to fetch restaurant by ID:', error);
    throw error;
  }
}

export async function getRestaurantsByOwner(ownerId: number): Promise<Restaurant[]> {
  try {
    // Verify that the owner exists
    const owner = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, ownerId))
      .execute();

    if (owner.length === 0) {
      throw new Error('Owner not found');
    }

    const results = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.owner_id, ownerId))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(restaurant => ({
      ...restaurant,
      rating: restaurant.rating ? parseFloat(restaurant.rating) : null
    }));
  } catch (error) {
    console.error('Failed to fetch restaurants by owner:', error);
    throw error;
  }
}

export async function updateRestaurant(input: UpdateRestaurantInput): Promise<Restaurant> {
  try {
    // First, verify the restaurant exists
    const existingRestaurant = await getRestaurantById(input.id);
    if (!existingRestaurant) {
      throw new Error('Restaurant not found');
    }

    // Build update object with only provided fields
    const updateData: any = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.opening_hours !== undefined) updateData.opening_hours = input.opening_hours;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    if (Object.keys(updateData).length === 1) {
      // Only updated_at was set, nothing to update
      return existingRestaurant;
    }

    // Perform the update
    const result = await db.update(restaurantsTable)
      .set(updateData)
      .where(eq(restaurantsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const restaurant = result[0];
    return {
      ...restaurant,
      rating: restaurant.rating ? parseFloat(restaurant.rating) : null
    };
  } catch (error) {
    console.error('Restaurant update failed:', error);
    throw error;
  }
}

export async function deleteRestaurant(id: number): Promise<boolean> {
  try {
    // Check if restaurant exists
    const existingRestaurant = await getRestaurantById(id);
    if (!existingRestaurant) {
      throw new Error('Restaurant not found');
    }

    // Delete the restaurant (cascade will handle related records)
    await db.delete(restaurantsTable)
      .where(eq(restaurantsTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Restaurant deletion failed:', error);
    throw error;
  }
}