import { db } from '../db';
import { menuItemsTable, restaurantsTable, menuCategoriesTable } from '../db/schema';
import { type CreateMenuItemInput, type UpdateMenuItemInput, type MenuItem } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createMenuItem(input: CreateMenuItemInput): Promise<MenuItem> {
  try {
    // Verify restaurant exists
    const restaurant = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, input.restaurant_id))
      .execute();

    if (restaurant.length === 0) {
      throw new Error('Restaurant not found');
    }

    // Verify category exists and belongs to the restaurant
    const category = await db.select()
      .from(menuCategoriesTable)
      .where(
        and(
          eq(menuCategoriesTable.id, input.category_id),
          eq(menuCategoriesTable.restaurant_id, input.restaurant_id)
        )
      )
      .execute();

    if (category.length === 0) {
      throw new Error('Category not found or does not belong to the restaurant');
    }

    // Insert menu item
    const result = await db.insert(menuItemsTable)
      .values({
        restaurant_id: input.restaurant_id,
        category_id: input.category_id,
        name: input.name,
        description: input.description,
        price: input.price.toString(),
        image_url: input.image_url,
        is_available: input.is_available ?? true,
        sort_order: input.sort_order ?? 0
      })
      .returning()
      .execute();

    const menuItem = result[0];
    return {
      ...menuItem,
      price: parseFloat(menuItem.price)
    };
  } catch (error) {
    console.error('Menu item creation failed:', error);
    throw error;
  }
}

export async function getRestaurantMenuItems(restaurantId: number): Promise<MenuItem[]> {
  try {
    // Verify restaurant exists
    const restaurant = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId))
      .execute();

    if (restaurant.length === 0) {
      throw new Error('Restaurant not found');
    }

    const result = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.restaurant_id, restaurantId))
      .execute();

    return result.map(item => ({
      ...item,
      price: parseFloat(item.price)
    }));
  } catch (error) {
    console.error('Failed to fetch restaurant menu items:', error);
    throw error;
  }
}

export async function getCategoryMenuItems(categoryId: number): Promise<MenuItem[]> {
  try {
    // Verify category exists
    const category = await db.select()
      .from(menuCategoriesTable)
      .where(eq(menuCategoriesTable.id, categoryId))
      .execute();

    if (category.length === 0) {
      throw new Error('Category not found');
    }

    const result = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.category_id, categoryId))
      .execute();

    return result.map(item => ({
      ...item,
      price: parseFloat(item.price)
    }));
  } catch (error) {
    console.error('Failed to fetch category menu items:', error);
    throw error;
  }
}

export async function getMenuItemById(id: number): Promise<MenuItem | null> {
  try {
    const result = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, id))
      .execute();

    if (result.length === 0) {
      return null;
    }

    const menuItem = result[0];
    return {
      ...menuItem,
      price: parseFloat(menuItem.price)
    };
  } catch (error) {
    console.error('Failed to fetch menu item by ID:', error);
    throw error;
  }
}

export async function updateMenuItem(input: UpdateMenuItemInput): Promise<MenuItem> {
  try {
    // Verify menu item exists
    const existingItem = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, input.id))
      .execute();

    if (existingItem.length === 0) {
      throw new Error('Menu item not found');
    }

    // Build update data
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.is_available !== undefined) updateData.is_available = input.is_available;
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;

    if (Object.keys(updateData).length === 0) {
      // No fields to update, return existing item
      return {
        ...existingItem[0],
        price: parseFloat(existingItem[0].price)
      };
    }

    const result = await db.update(menuItemsTable)
      .set(updateData)
      .where(eq(menuItemsTable.id, input.id))
      .returning()
      .execute();

    const menuItem = result[0];
    return {
      ...menuItem,
      price: parseFloat(menuItem.price)
    };
  } catch (error) {
    console.error('Menu item update failed:', error);
    throw error;
  }
}

export async function deleteMenuItem(id: number): Promise<boolean> {
  try {
    // Verify menu item exists
    const existingItem = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, id))
      .execute();

    if (existingItem.length === 0) {
      throw new Error('Menu item not found');
    }

    await db.delete(menuItemsTable)
      .where(eq(menuItemsTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Menu item deletion failed:', error);
    throw error;
  }
}