import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable, menuCategoriesTable, menuItemsTable, menuItemOptionsTable } from '../db/schema';
import { type CreateMenuItemOptionInput } from '../schema';
import { createMenuItemOption, getMenuItemOptions, updateMenuItemOption, deleteMenuItemOption } from '../handlers/menu_item_options';
import { eq } from 'drizzle-orm';

describe('Menu Item Options Handlers', () => {
  let testUserId: number;
  let testRestaurantId: number;
  let testCategoryId: number;
  let testMenuItemId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user (restaurant owner)
    const userResult = await db.insert(usersTable)
      .values({
        email: 'owner@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Owner',
        phone: '+1234567890',
        role: 'restaurant_owner'
      })
      .returning({ id: usersTable.id })
      .execute();
    testUserId = userResult[0].id;

    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        owner_id: testUserId,
        name: 'Test Restaurant',
        description: 'A test restaurant',
        address: '123 Test St',
        phone: '+1234567890',
        email: 'restaurant@test.com',
        opening_hours: '9:00-21:00',
        is_active: true
      })
      .returning({ id: restaurantsTable.id })
      .execute();
    testRestaurantId = restaurantResult[0].id;

    // Create test menu category
    const categoryResult = await db.insert(menuCategoriesTable)
      .values({
        restaurant_id: testRestaurantId,
        name: 'Test Category',
        description: 'A test category',
        sort_order: 1,
        is_active: true
      })
      .returning({ id: menuCategoriesTable.id })
      .execute();
    testCategoryId = categoryResult[0].id;

    // Create test menu item
    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        restaurant_id: testRestaurantId,
        category_id: testCategoryId,
        name: 'Test Menu Item',
        description: 'A test menu item',
        price: '12.99',
        image_url: 'https://example.com/image.jpg',
        is_available: true,
        sort_order: 1
      })
      .returning({ id: menuItemsTable.id })
      .execute();
    testMenuItemId = menuItemResult[0].id;
  });

  afterEach(resetDB);

  describe('createMenuItemOption', () => {
    const testInput: CreateMenuItemOptionInput = {
      menu_item_id: 0, // Will be set in tests
      name: 'Large Size',
      price_modifier: 2.50,
      is_required: false,
      sort_order: 1
    };

    it('should create a menu item option', async () => {
      const input = { ...testInput, menu_item_id: testMenuItemId };
      const result = await createMenuItemOption(input);

      expect(result.name).toEqual('Large Size');
      expect(result.menu_item_id).toEqual(testMenuItemId);
      expect(result.price_modifier).toEqual(2.50);
      expect(typeof result.price_modifier).toEqual('number');
      expect(result.is_required).toEqual(false);
      expect(result.sort_order).toEqual(1);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save menu item option to database', async () => {
      const input = { ...testInput, menu_item_id: testMenuItemId };
      const result = await createMenuItemOption(input);

      const options = await db.select()
        .from(menuItemOptionsTable)
        .where(eq(menuItemOptionsTable.id, result.id))
        .execute();

      expect(options).toHaveLength(1);
      expect(options[0].name).toEqual('Large Size');
      expect(options[0].menu_item_id).toEqual(testMenuItemId);
      expect(parseFloat(options[0].price_modifier)).toEqual(2.50);
      expect(options[0].is_required).toEqual(false);
      expect(options[0].sort_order).toEqual(1);
      expect(options[0].created_at).toBeInstanceOf(Date);
    });

    it('should apply default values for optional fields', async () => {
      const minimalInput = {
        menu_item_id: testMenuItemId,
        name: 'Extra Cheese',
        price_modifier: 1.00
      };

      const result = await createMenuItemOption(minimalInput);

      expect(result.is_required).toEqual(false);
      expect(result.sort_order).toEqual(0);
    });

    it('should throw error for non-existent menu item', async () => {
      const input = { ...testInput, menu_item_id: 99999 };

      await expect(createMenuItemOption(input)).rejects.toThrow(/menu item not found/i);
    });
  });

  describe('getMenuItemOptions', () => {
    it('should return menu item options ordered by sort_order and name', async () => {
      // Create multiple options with different sort orders
      await createMenuItemOption({
        menu_item_id: testMenuItemId,
        name: 'Z Option',
        price_modifier: 1.00,
        sort_order: 2
      });

      await createMenuItemOption({
        menu_item_id: testMenuItemId,
        name: 'A Option',
        price_modifier: 2.00,
        sort_order: 1
      });

      await createMenuItemOption({
        menu_item_id: testMenuItemId,
        name: 'B Option',
        price_modifier: 0.50,
        sort_order: 1
      });

      const result = await getMenuItemOptions(testMenuItemId);

      expect(result).toHaveLength(3);
      // Should be ordered by sort_order first, then by name
      expect(result[0].name).toEqual('A Option');
      expect(result[0].sort_order).toEqual(1);
      expect(result[1].name).toEqual('B Option');
      expect(result[1].sort_order).toEqual(1);
      expect(result[2].name).toEqual('Z Option');
      expect(result[2].sort_order).toEqual(2);

      // Verify numeric conversion
      result.forEach(option => {
        expect(typeof option.price_modifier).toEqual('number');
      });
    });

    it('should return empty array for menu item with no options', async () => {
      const result = await getMenuItemOptions(testMenuItemId);
      expect(result).toHaveLength(0);
    });

    it('should return only options for the specified menu item', async () => {
      // Create another menu item
      const anotherMenuItemResult = await db.insert(menuItemsTable)
        .values({
          restaurant_id: testRestaurantId,
          category_id: testCategoryId,
          name: 'Another Item',
          description: 'Another test item',
          price: '8.99',
          is_available: true,
          sort_order: 2
        })
        .returning({ id: menuItemsTable.id })
        .execute();

      const anotherMenuItemId = anotherMenuItemResult[0].id;

      // Create options for both menu items
      await createMenuItemOption({
        menu_item_id: testMenuItemId,
        name: 'Option 1',
        price_modifier: 1.00
      });

      await createMenuItemOption({
        menu_item_id: anotherMenuItemId,
        name: 'Option 2',
        price_modifier: 2.00
      });

      const result = await getMenuItemOptions(testMenuItemId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Option 1');
      expect(result[0].menu_item_id).toEqual(testMenuItemId);
    });
  });

  describe('updateMenuItemOption', () => {
    let testOptionId: number;

    beforeEach(async () => {
      const option = await createMenuItemOption({
        menu_item_id: testMenuItemId,
        name: 'Original Option',
        price_modifier: 1.50,
        is_required: false,
        sort_order: 1
      });
      testOptionId = option.id;
    });

    it('should update menu item option fields', async () => {
      const updateInput = {
        name: 'Updated Option',
        price_modifier: 3.00,
        is_required: true,
        sort_order: 5
      };

      const result = await updateMenuItemOption(testOptionId, updateInput);

      expect(result.name).toEqual('Updated Option');
      expect(result.price_modifier).toEqual(3.00);
      expect(typeof result.price_modifier).toEqual('number');
      expect(result.is_required).toEqual(true);
      expect(result.sort_order).toEqual(5);
      expect(result.id).toEqual(testOptionId);
    });

    it('should update only specified fields', async () => {
      const updateInput = {
        name: 'Partially Updated Option'
      };

      const result = await updateMenuItemOption(testOptionId, updateInput);

      expect(result.name).toEqual('Partially Updated Option');
      expect(result.price_modifier).toEqual(1.50); // Should remain unchanged
      expect(result.is_required).toEqual(false); // Should remain unchanged
      expect(result.sort_order).toEqual(1); // Should remain unchanged
    });

    it('should persist changes in database', async () => {
      const updateInput = {
        name: 'Database Updated Option',
        price_modifier: 2.75
      };

      await updateMenuItemOption(testOptionId, updateInput);

      const options = await db.select()
        .from(menuItemOptionsTable)
        .where(eq(menuItemOptionsTable.id, testOptionId))
        .execute();

      expect(options).toHaveLength(1);
      expect(options[0].name).toEqual('Database Updated Option');
      expect(parseFloat(options[0].price_modifier)).toEqual(2.75);
    });

    it('should throw error for non-existent option', async () => {
      const updateInput = {
        name: 'Updated Option'
      };

      await expect(updateMenuItemOption(99999, updateInput)).rejects.toThrow(/menu item option not found/i);
    });
  });

  describe('deleteMenuItemOption', () => {
    let testOptionId: number;

    beforeEach(async () => {
      const option = await createMenuItemOption({
        menu_item_id: testMenuItemId,
        name: 'Option to Delete',
        price_modifier: 1.00
      });
      testOptionId = option.id;
    });

    it('should delete menu item option', async () => {
      const result = await deleteMenuItemOption(testOptionId);

      expect(result).toEqual(true);

      // Verify deletion in database
      const options = await db.select()
        .from(menuItemOptionsTable)
        .where(eq(menuItemOptionsTable.id, testOptionId))
        .execute();

      expect(options).toHaveLength(0);
    });

    it('should return false for non-existent option', async () => {
      const result = await deleteMenuItemOption(99999);

      expect(result).toEqual(false);
    });

    it('should not affect other options', async () => {
      // Create another option
      const anotherOption = await createMenuItemOption({
        menu_item_id: testMenuItemId,
        name: 'Another Option',
        price_modifier: 2.00
      });

      await deleteMenuItemOption(testOptionId);

      // Verify other option still exists
      const remainingOptions = await db.select()
        .from(menuItemOptionsTable)
        .where(eq(menuItemOptionsTable.id, anotherOption.id))
        .execute();

      expect(remainingOptions).toHaveLength(1);
      expect(remainingOptions[0].name).toEqual('Another Option');
    });
  });
});