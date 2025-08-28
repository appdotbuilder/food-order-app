import { db } from '../db';
import { menuCategoriesTable, restaurantsTable } from '../db/schema';
import { type CreateMenuCategoryInput, type MenuCategory } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export async function createMenuCategory(input: CreateMenuCategoryInput): Promise<MenuCategory> {
  try {
    // Verify restaurant exists
    const restaurant = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, input.restaurant_id))
      .execute();

    if (restaurant.length === 0) {
      throw new Error('Restaurant not found');
    }

    // Insert menu category record
    const result = await db.insert(menuCategoriesTable)
      .values({
        restaurant_id: input.restaurant_id,
        name: input.name,
        description: input.description,
        sort_order: input.sort_order || 0,
        is_active: input.is_active !== undefined ? input.is_active : true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Menu category creation failed:', error);
    throw error;
  }
}

export async function getRestaurantCategories(restaurantId: number): Promise<MenuCategory[]> {
  try {
    const results = await db.select()
      .from(menuCategoriesTable)
      .where(
        and(
          eq(menuCategoriesTable.restaurant_id, restaurantId),
          eq(menuCategoriesTable.is_active, true)
        )
      )
      .orderBy(desc(menuCategoriesTable.sort_order), desc(menuCategoriesTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch restaurant categories:', error);
    throw error;
  }
}

export async function updateMenuCategory(id: number, input: Partial<CreateMenuCategoryInput>): Promise<MenuCategory> {
  try {
    // Check if category exists
    const existing = await db.select()
      .from(menuCategoriesTable)
      .where(eq(menuCategoriesTable.id, id))
      .execute();

    if (existing.length === 0) {
      throw new Error('Menu category not found');
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Update the category
    const result = await db.update(menuCategoriesTable)
      .set(updateData)
      .where(eq(menuCategoriesTable.id, id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Menu category update failed:', error);
    throw error;
  }
}

export async function deleteMenuCategory(id: number): Promise<boolean> {
  try {
    // Check if category exists
    const existing = await db.select()
      .from(menuCategoriesTable)
      .where(eq(menuCategoriesTable.id, id))
      .execute();

    if (existing.length === 0) {
      throw new Error('Menu category not found');
    }

    // Delete the category
    const result = await db.delete(menuCategoriesTable)
      .where(eq(menuCategoriesTable.id, id))
      .execute();

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Menu category deletion failed:', error);
    throw error;
  }
}