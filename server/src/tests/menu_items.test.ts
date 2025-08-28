import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { menuItemsTable, restaurantsTable, usersTable } from '../db/schema';
import { type CreateMenuItemInput, type GetMenuItemsInput } from '../schema';
import { createMenuItem, getMenuItems, getMenuItemById, updateMenuItemAvailability } from '../handlers/menu_items';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'owner@test.com',
  password_hash: 'hashed_password',
  name: 'Restaurant Owner',
  phone: '1234567890',
  role: 'restaurant_owner' as const
};

const testRestaurant = {
  name: 'Test Restaurant',
  description: 'A great test restaurant',
  address: '123 Test Street',
  phone: '9876543210',
  image_url: null
};

const testMenuItemInput: CreateMenuItemInput = {
  restaurant_id: 1, // Will be set dynamically in tests
  name: 'Test Dish',
  description: 'A delicious test dish',
  price: 299.99,
  image_url: 'https://example.com/image.jpg',
  category: 'Main Course'
};

describe('Menu Items Handlers', () => {
  let restaurantId: number;
  let userId: number;

  beforeEach(async () => {
    await createDB();

    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create prerequisite restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        ...testRestaurant,
        owner_id: userId
      })
      .returning()
      .execute();
    restaurantId = restaurantResult[0].id;
  });

  afterEach(resetDB);

  describe('createMenuItem', () => {
    it('should create a menu item', async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId
      };

      const result = await createMenuItem(input);

      // Verify basic fields
      expect(result.name).toEqual('Test Dish');
      expect(result.description).toEqual(input.description);
      expect(result.price).toEqual(299.99);
      expect(typeof result.price).toEqual('number'); // Ensure numeric conversion
      expect(result.image_url).toEqual('https://example.com/image.jpg');
      expect(result.category).toEqual('Main Course');
      expect(result.restaurant_id).toEqual(restaurantId);
      expect(result.is_available).toEqual(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save menu item to database', async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId
      };

      const result = await createMenuItem(input);

      // Verify in database
      const menuItems = await db.select()
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, result.id))
        .execute();

      expect(menuItems).toHaveLength(1);
      expect(menuItems[0].name).toEqual('Test Dish');
      expect(parseFloat(menuItems[0].price)).toEqual(299.99);
      expect(menuItems[0].is_available).toEqual(true);
    });

    it('should create menu item with minimal data', async () => {
      const minimalInput: CreateMenuItemInput = {
        restaurant_id: restaurantId,
        name: 'Simple Dish',
        description: null,
        price: 199,
        image_url: null,
        category: null
      };

      const result = await createMenuItem(minimalInput);

      expect(result.name).toEqual('Simple Dish');
      expect(result.description).toBeNull();
      expect(result.price).toEqual(199);
      expect(result.image_url).toBeNull();
      expect(result.category).toBeNull();
      expect(result.is_available).toEqual(true);
    });

    it('should throw error when restaurant does not exist', async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: 99999 // Non-existent restaurant
      };

      await expect(createMenuItem(input)).rejects.toThrow(/Restaurant with id 99999 not found/i);
    });
  });

  describe('getMenuItems', () => {
    let menuItem1Id: number;
    let menuItem2Id: number;
    let menuItem3Id: number;

    beforeEach(async () => {
      // Create test menu items
      const item1 = await db.insert(menuItemsTable)
        .values({
          restaurant_id: restaurantId,
          name: 'Pasta',
          description: 'Italian pasta',
          price: '149.50',
          category: 'Main Course',
          is_available: true
        })
        .returning()
        .execute();
      menuItem1Id = item1[0].id;

      const item2 = await db.insert(menuItemsTable)
        .values({
          restaurant_id: restaurantId,
          name: 'Garlic Bread',
          description: 'Crispy bread with garlic',
          price: '79.00',
          category: 'Appetizer',
          is_available: true
        })
        .returning()
        .execute();
      menuItem2Id = item2[0].id;

      // Create unavailable item (should not be returned)
      const item3 = await db.insert(menuItemsTable)
        .values({
          restaurant_id: restaurantId,
          name: 'Out of Stock Item',
          description: 'Currently unavailable',
          price: '299.00',
          category: 'Main Course',
          is_available: false
        })
        .returning()
        .execute();
      menuItem3Id = item3[0].id;
    });

    it('should get all available menu items for restaurant', async () => {
      const input: GetMenuItemsInput = {
        restaurant_id: restaurantId
      };

      const results = await getMenuItems(input);

      expect(results).toHaveLength(2); // Only available items
      expect(results.map(item => item.name)).toContain('Pasta');
      expect(results.map(item => item.name)).toContain('Garlic Bread');
      expect(results.map(item => item.name)).not.toContain('Out of Stock Item');

      // Verify numeric conversion
      results.forEach(item => {
        expect(typeof item.price).toEqual('number');
        expect(item.is_available).toEqual(true);
      });
    });

    it('should filter menu items by category', async () => {
      const input: GetMenuItemsInput = {
        restaurant_id: restaurantId,
        category: 'Main Course'
      };

      const results = await getMenuItems(input);

      expect(results).toHaveLength(1);
      expect(results[0].name).toEqual('Pasta');
      expect(results[0].category).toEqual('Main Course');
      expect(results[0].price).toEqual(149.5);
    });

    it('should return empty array for non-existent restaurant', async () => {
      const input: GetMenuItemsInput = {
        restaurant_id: 99999
      };

      const results = await getMenuItems(input);

      expect(results).toHaveLength(0);
    });

    it('should return empty array for non-existent category', async () => {
      const input: GetMenuItemsInput = {
        restaurant_id: restaurantId,
        category: 'Non-Existent Category'
      };

      const results = await getMenuItems(input);

      expect(results).toHaveLength(0);
    });
  });

  describe('getMenuItemById', () => {
    let menuItemId: number;

    beforeEach(async () => {
      const result = await db.insert(menuItemsTable)
        .values({
          restaurant_id: restaurantId,
          name: 'Specific Item',
          description: 'A specific menu item',
          price: '199.99',
          category: 'Dessert',
          is_available: true
        })
        .returning()
        .execute();
      menuItemId = result[0].id;
    });

    it('should get menu item by id', async () => {
      const result = await getMenuItemById(menuItemId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(menuItemId);
      expect(result!.name).toEqual('Specific Item');
      expect(result!.description).toEqual('A specific menu item');
      expect(result!.price).toEqual(199.99);
      expect(typeof result!.price).toEqual('number');
      expect(result!.category).toEqual('Dessert');
      expect(result!.is_available).toEqual(true);
    });

    it('should return null for non-existent menu item', async () => {
      const result = await getMenuItemById(99999);

      expect(result).toBeNull();
    });

    it('should return menu item even if unavailable', async () => {
      // Update item to unavailable
      await db.update(menuItemsTable)
        .set({ is_available: false })
        .where(eq(menuItemsTable.id, menuItemId))
        .execute();

      const result = await getMenuItemById(menuItemId);

      expect(result).not.toBeNull();
      expect(result!.is_available).toEqual(false);
    });
  });

  describe('updateMenuItemAvailability', () => {
    let menuItemId: number;

    beforeEach(async () => {
      const result = await db.insert(menuItemsTable)
        .values({
          restaurant_id: restaurantId,
          name: 'Update Test Item',
          description: 'Item for update testing',
          price: '149.00',
          category: 'Test',
          is_available: true
        })
        .returning()
        .execute();
      menuItemId = result[0].id;
    });

    it('should update menu item availability to false', async () => {
      const result = await updateMenuItemAvailability(menuItemId, false);

      expect(result).not.toBeNull();
      expect(result!.is_available).toEqual(false);
      expect(result!.updated_at).toBeInstanceOf(Date);

      // Verify in database
      const dbResult = await db.select()
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, menuItemId))
        .execute();

      expect(dbResult[0].is_available).toEqual(false);
    });

    it('should update menu item availability to true', async () => {
      // First set to false
      await db.update(menuItemsTable)
        .set({ is_available: false })
        .where(eq(menuItemsTable.id, menuItemId))
        .execute();

      const result = await updateMenuItemAvailability(menuItemId, true);

      expect(result).not.toBeNull();
      expect(result!.is_available).toEqual(true);

      // Verify in database
      const dbResult = await db.select()
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, menuItemId))
        .execute();

      expect(dbResult[0].is_available).toEqual(true);
    });

    it('should return null for non-existent menu item', async () => {
      const result = await updateMenuItemAvailability(99999, false);

      expect(result).toBeNull();
    });

    it('should preserve all other fields when updating availability', async () => {
      const originalData = await getMenuItemById(menuItemId);
      
      const result = await updateMenuItemAvailability(menuItemId, false);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(originalData!.id);
      expect(result!.name).toEqual(originalData!.name);
      expect(result!.description).toEqual(originalData!.description);
      expect(result!.price).toEqual(originalData!.price);
      expect(result!.category).toEqual(originalData!.category);
      expect(result!.restaurant_id).toEqual(originalData!.restaurant_id);
      // Only availability and updated_at should change
      expect(result!.is_available).toEqual(false);
      expect(result!.updated_at.getTime()).toBeGreaterThan(originalData!.updated_at.getTime());
    });
  });
});