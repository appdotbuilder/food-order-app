import { db } from '../db';
import { menuItemsTable, restaurantsTable } from '../db/schema';
import { type CreateMenuItemInput, type MenuItem, type GetMenuItemsInput } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export async function createMenuItem(input: CreateMenuItemInput): Promise<MenuItem> {
  try {
    // Verify restaurant exists before creating menu item
    const restaurant = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, input.restaurant_id))
      .execute();

    if (restaurant.length === 0) {
      throw new Error(`Restaurant with id ${input.restaurant_id} not found`);
    }

    // Insert menu item record
    const result = await db.insert(menuItemsTable)
      .values({
        restaurant_id: input.restaurant_id,
        name: input.name,
        description: input.description,
        price: input.price.toString(), // Convert number to string for numeric column
        image_url: input.image_url,
        category: input.category
        // is_available defaults to true
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const menuItem = result[0];
    return {
      ...menuItem,
      price: parseFloat(menuItem.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Menu item creation failed:', error);
    throw error;
  }
}

export async function getMenuItems(input: GetMenuItemsInput): Promise<MenuItem[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Filter by restaurant_id (required)
    conditions.push(eq(menuItemsTable.restaurant_id, input.restaurant_id));

    // Filter by category if provided
    if (input.category) {
      conditions.push(eq(menuItemsTable.category, input.category));
    }

    // Only return available items
    conditions.push(eq(menuItemsTable.is_available, true));

    // Build and execute query with all conditions
    const results = await db.select()
      .from(menuItemsTable)
      .where(and(...conditions))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(item => ({
      ...item,
      price: parseFloat(item.price)
    }));
  } catch (error) {
    console.error('Failed to fetch menu items:', error);
    throw error;
  }
}

export async function getMenuItemById(menuItemId: number): Promise<MenuItem | null> {
  try {
    const results = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, menuItemId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const menuItem = results[0];
    return {
      ...menuItem,
      price: parseFloat(menuItem.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Failed to fetch menu item by id:', error);
    throw error;
  }
}

export async function updateMenuItemAvailability(menuItemId: number, isAvailable: boolean): Promise<MenuItem | null> {
  try {
    const result = await db.update(menuItemsTable)
      .set({ 
        is_available: isAvailable,
        updated_at: new Date()
      })
      .where(eq(menuItemsTable.id, menuItemId))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    const menuItem = result[0];
    return {
      ...menuItem,
      price: parseFloat(menuItem.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Failed to update menu item availability:', error);
    throw error;
  }
}