import { db } from '../db';
import { restaurantsTable, usersTable } from '../db/schema';
import { type CreateRestaurantInput, type Restaurant, type GetRestaurantsInput } from '../schema';
import { eq, ilike, and, SQL } from 'drizzle-orm';

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
      throw new Error('User must have restaurant_owner or admin role to create a restaurant');
    }

    // Insert restaurant record
    const result = await db.insert(restaurantsTable)
      .values({
        owner_id: input.owner_id,
        name: input.name,
        description: input.description,
        address: input.address,
        phone: input.phone,
        image_url: input.image_url
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Restaurant creation failed:', error);
    throw error;
  }
}

export async function getRestaurants(input: GetRestaurantsInput = {}): Promise<Restaurant[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];
    
    // Only return active restaurants
    conditions.push(eq(restaurantsTable.is_active, true));

    // Add search filter if provided
    if (input.search) {
      conditions.push(
        ilike(restaurantsTable.name, `%${input.search}%`)
      );
    }

    // Build query step by step without reassigning
    const baseQuery = db.select()
      .from(restaurantsTable)
      .where(and(...conditions));

    // Apply pagination conditionally by building the final query
    let finalQuery;
    if (input.limit !== undefined && input.offset !== undefined) {
      finalQuery = baseQuery.limit(input.limit).offset(input.offset);
    } else if (input.limit !== undefined) {
      finalQuery = baseQuery.limit(input.limit);
    } else if (input.offset !== undefined) {
      finalQuery = baseQuery.offset(input.offset);
    } else {
      finalQuery = baseQuery;
    }

    const results = await finalQuery.execute();
    return results;
  } catch (error) {
    console.error('Get restaurants failed:', error);
    throw error;
  }
}

export async function getRestaurantById(restaurantId: number): Promise<Restaurant | null> {
  try {
    const results = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Get restaurant by ID failed:', error);
    throw error;
  }
}

export async function getRestaurantsByOwner(ownerId: number): Promise<Restaurant[]> {
  try {
    const results = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.owner_id, ownerId))
      .execute();

    return results;
  } catch (error) {
    console.error('Get restaurants by owner failed:', error);
    throw error;
  }
}