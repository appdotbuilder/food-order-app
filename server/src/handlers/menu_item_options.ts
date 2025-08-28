import { db } from '../db';
import { menuItemOptionsTable, menuItemsTable } from '../db/schema';
import { type CreateMenuItemOptionInput, type MenuItemOption } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createMenuItemOption(input: CreateMenuItemOptionInput): Promise<MenuItemOption> {
  try {
    // Verify menu item exists
    const menuItem = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, input.menu_item_id))
      .execute();

    if (menuItem.length === 0) {
      throw new Error('Menu item not found');
    }

    // Insert menu item option record
    const result = await db.insert(menuItemOptionsTable)
      .values({
        menu_item_id: input.menu_item_id,
        name: input.name,
        price_modifier: input.price_modifier.toString(),
        is_required: input.is_required || false,
        sort_order: input.sort_order || 0
      })
      .returning()
      .execute();

    // Convert numeric field back to number before returning
    const option = result[0];
    return {
      ...option,
      price_modifier: parseFloat(option.price_modifier)
    };
  } catch (error) {
    console.error('Menu item option creation failed:', error);
    throw error;
  }
}

export async function getMenuItemOptions(menuItemId: number): Promise<MenuItemOption[]> {
  try {
    const results = await db.select()
      .from(menuItemOptionsTable)
      .where(eq(menuItemOptionsTable.menu_item_id, menuItemId))
      .orderBy(menuItemOptionsTable.sort_order, menuItemOptionsTable.name)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(option => ({
      ...option,
      price_modifier: parseFloat(option.price_modifier)
    }));
  } catch (error) {
    console.error('Failed to fetch menu item options:', error);
    throw error;
  }
}

export async function updateMenuItemOption(id: number, input: Partial<CreateMenuItemOptionInput>): Promise<MenuItemOption> {
  try {
    // Check if option exists
    const existingOptions = await db.select()
      .from(menuItemOptionsTable)
      .where(eq(menuItemOptionsTable.id, id))
      .execute();

    if (existingOptions.length === 0) {
      throw new Error('Menu item option not found');
    }

    // Build update values, converting numbers to strings for numeric columns
    const updateValues: any = {};
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.price_modifier !== undefined) updateValues.price_modifier = input.price_modifier.toString();
    if (input.is_required !== undefined) updateValues.is_required = input.is_required;
    if (input.sort_order !== undefined) updateValues.sort_order = input.sort_order;

    // Update the option
    const result = await db.update(menuItemOptionsTable)
      .set(updateValues)
      .where(eq(menuItemOptionsTable.id, id))
      .returning()
      .execute();

    // Convert numeric field back to number before returning
    const option = result[0];
    return {
      ...option,
      price_modifier: parseFloat(option.price_modifier)
    };
  } catch (error) {
    console.error('Menu item option update failed:', error);
    throw error;
  }
}

export async function deleteMenuItemOption(id: number): Promise<boolean> {
  try {
    const result = await db.delete(menuItemOptionsTable)
      .where(eq(menuItemOptionsTable.id, id))
      .returning({ id: menuItemOptionsTable.id })
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Menu item option deletion failed:', error);
    throw error;
  }
}