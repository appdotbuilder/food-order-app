import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable, menuCategoriesTable, menuItemsTable } from '../db/schema';
import { type CreateMenuItemInput, type UpdateMenuItemInput } from '../schema';
import {
  createMenuItem,
  getRestaurantMenuItems,
  getCategoryMenuItems,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem
} from '../handlers/menu_items';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'owner@test.com',
  password_hash: 'hashed_password',
  first_name: 'Restaurant',
  last_name: 'Owner',
  phone: '+1234567890',
  role: 'restaurant_owner' as const
};

const testRestaurant = {
  name: 'Test Restaurant',
  description: 'A test restaurant',
  address: '123 Test St',
  phone: '+1234567890',
  email: 'restaurant@test.com',
  opening_hours: '9AM-10PM',
  is_active: true
};

const testCategory = {
  name: 'Main Courses',
  description: 'Delicious main courses',
  sort_order: 1,
  is_active: true
};

const testMenuItemInput: CreateMenuItemInput = {
  restaurant_id: 0, // Will be set in tests
  category_id: 0, // Will be set in tests
  name: 'Margherita Pizza',
  description: 'Classic pizza with tomato, mozzarella, and basil',
  price: 15.99,
  image_url: 'https://example.com/pizza.jpg',
  is_available: true,
  sort_order: 1
};

describe('Menu Items Handlers', () => {
  let userId: number;
  let restaurantId: number;
  let categoryId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        ...testRestaurant,
        owner_id: userId
      })
      .returning()
      .execute();
    restaurantId = restaurantResult[0].id;

    // Create test category
    const categoryResult = await db.insert(menuCategoriesTable)
      .values({
        ...testCategory,
        restaurant_id: restaurantId
      })
      .returning()
      .execute();
    categoryId = categoryResult[0].id;
  });

  afterEach(resetDB);

  describe('createMenuItem', () => {
    it('should create a menu item successfully', async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: categoryId
      };

      const result = await createMenuItem(input);

      expect(result.id).toBeDefined();
      expect(result.restaurant_id).toEqual(restaurantId);
      expect(result.category_id).toEqual(categoryId);
      expect(result.name).toEqual('Margherita Pizza');
      expect(result.description).toEqual(input.description);
      expect(result.price).toEqual(15.99);
      expect(typeof result.price).toBe('number');
      expect(result.image_url).toEqual(input.image_url);
      expect(result.is_available).toBe(true);
      expect(result.sort_order).toEqual(1);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create menu item with optional fields', async () => {
      const input: CreateMenuItemInput = {
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: 'Simple Item',
        description: null,
        price: 10.00,
        image_url: null
      };

      const result = await createMenuItem(input);

      expect(result.name).toEqual('Simple Item');
      expect(result.description).toBeNull();
      expect(result.price).toEqual(10.00);
      expect(result.image_url).toBeNull();
      expect(result.is_available).toBe(true); // Default value
      expect(result.sort_order).toEqual(0); // Default value
    });

    it('should save menu item to database', async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: categoryId
      };

      const result = await createMenuItem(input);

      const savedItems = await db.select()
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, result.id))
        .execute();

      expect(savedItems).toHaveLength(1);
      expect(savedItems[0].name).toEqual('Margherita Pizza');
      expect(parseFloat(savedItems[0].price)).toEqual(15.99);
      expect(savedItems[0].restaurant_id).toEqual(restaurantId);
      expect(savedItems[0].category_id).toEqual(categoryId);
    });

    it('should throw error for non-existent restaurant', async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: 99999,
        category_id: categoryId
      };

      await expect(createMenuItem(input)).rejects.toThrow(/restaurant not found/i);
    });

    it('should throw error for non-existent category', async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: 99999
      };

      await expect(createMenuItem(input)).rejects.toThrow(/category not found/i);
    });

    it('should throw error for category not belonging to restaurant', async () => {
      // Create another restaurant and category
      const anotherUserResult = await db.insert(usersTable)
        .values({
          ...testUser,
          email: 'another@test.com'
        })
        .returning()
        .execute();

      const anotherRestaurantResult = await db.insert(restaurantsTable)
        .values({
          ...testRestaurant,
          name: 'Another Restaurant',
          owner_id: anotherUserResult[0].id
        })
        .returning()
        .execute();

      const anotherCategoryResult = await db.insert(menuCategoriesTable)
        .values({
          ...testCategory,
          restaurant_id: anotherRestaurantResult[0].id
        })
        .returning()
        .execute();

      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: anotherCategoryResult[0].id
      };

      await expect(createMenuItem(input)).rejects.toThrow(/category not found or does not belong/i);
    });
  });

  describe('getRestaurantMenuItems', () => {
    it('should fetch all menu items for a restaurant', async () => {
      // Create multiple menu items
      const item1Input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: 'Pizza'
      };

      const item2Input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: 'Pasta',
        price: 12.50
      };

      await createMenuItem(item1Input);
      await createMenuItem(item2Input);

      const result = await getRestaurantMenuItems(restaurantId);

      expect(result).toHaveLength(2);
      expect(result[0].restaurant_id).toEqual(restaurantId);
      expect(result[1].restaurant_id).toEqual(restaurantId);
      expect(result.find(item => item.name === 'Pizza')).toBeDefined();
      expect(result.find(item => item.name === 'Pasta')).toBeDefined();
      
      // Verify numeric conversion
      result.forEach(item => {
        expect(typeof item.price).toBe('number');
      });
    });

    it('should return empty array for restaurant with no menu items', async () => {
      const result = await getRestaurantMenuItems(restaurantId);
      expect(result).toHaveLength(0);
    });

    it('should throw error for non-existent restaurant', async () => {
      await expect(getRestaurantMenuItems(99999)).rejects.toThrow(/restaurant not found/i);
    });
  });

  describe('getCategoryMenuItems', () => {
    it('should fetch all menu items in a category', async () => {
      // Create another category
      const category2Result = await db.insert(menuCategoriesTable)
        .values({
          ...testCategory,
          name: 'Desserts',
          restaurant_id: restaurantId
        })
        .returning()
        .execute();

      const category2Id = category2Result[0].id;

      // Create items in different categories
      await createMenuItem({
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: 'Main Course Item'
      });

      await createMenuItem({
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: category2Id,
        name: 'Dessert Item',
        price: 8.99
      });

      const result = await getCategoryMenuItems(categoryId);

      expect(result).toHaveLength(1);
      expect(result[0].category_id).toEqual(categoryId);
      expect(result[0].name).toEqual('Main Course Item');
      expect(typeof result[0].price).toBe('number');
    });

    it('should return empty array for category with no menu items', async () => {
      const result = await getCategoryMenuItems(categoryId);
      expect(result).toHaveLength(0);
    });

    it('should throw error for non-existent category', async () => {
      await expect(getCategoryMenuItems(99999)).rejects.toThrow(/category not found/i);
    });
  });

  describe('getMenuItemById', () => {
    it('should fetch menu item by ID', async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: categoryId
      };

      const created = await createMenuItem(input);
      const result = await getMenuItemById(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Margherita Pizza');
      expect(result!.price).toEqual(15.99);
      expect(typeof result!.price).toBe('number');
    });

    it('should return null for non-existent menu item', async () => {
      const result = await getMenuItemById(99999);
      expect(result).toBeNull();
    });
  });

  describe('updateMenuItem', () => {
    let menuItemId: number;

    beforeEach(async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: categoryId
      };

      const created = await createMenuItem(input);
      menuItemId = created.id;
    });

    it('should update menu item successfully', async () => {
      const updateInput: UpdateMenuItemInput = {
        id: menuItemId,
        name: 'Updated Pizza Name',
        price: 18.99,
        is_available: false
      };

      const result = await updateMenuItem(updateInput);

      expect(result.id).toEqual(menuItemId);
      expect(result.name).toEqual('Updated Pizza Name');
      expect(result.price).toEqual(18.99);
      expect(typeof result.price).toBe('number');
      expect(result.is_available).toBe(false);
      expect(result.description).toEqual(testMenuItemInput.description); // Unchanged
    });

    it('should update only provided fields', async () => {
      const updateInput: UpdateMenuItemInput = {
        id: menuItemId,
        price: 20.00
      };

      const result = await updateMenuItem(updateInput);

      expect(result.price).toEqual(20.00);
      expect(result.name).toEqual('Margherita Pizza'); // Unchanged
      expect(result.description).toEqual(testMenuItemInput.description); // Unchanged
    });

    it('should handle null values correctly', async () => {
      const updateInput: UpdateMenuItemInput = {
        id: menuItemId,
        description: null,
        image_url: null
      };

      const result = await updateMenuItem(updateInput);

      expect(result.description).toBeNull();
      expect(result.image_url).toBeNull();
    });

    it('should return unchanged item when no fields provided', async () => {
      const updateInput: UpdateMenuItemInput = {
        id: menuItemId
      };

      const result = await updateMenuItem(updateInput);

      expect(result.name).toEqual('Margherita Pizza');
      expect(result.price).toEqual(15.99);
      expect(typeof result.price).toBe('number');
    });

    it('should save updates to database', async () => {
      const updateInput: UpdateMenuItemInput = {
        id: menuItemId,
        name: 'Database Updated Name',
        price: 25.50
      };

      await updateMenuItem(updateInput);

      const saved = await db.select()
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, menuItemId))
        .execute();

      expect(saved[0].name).toEqual('Database Updated Name');
      expect(parseFloat(saved[0].price)).toEqual(25.50);
    });

    it('should throw error for non-existent menu item', async () => {
      const updateInput: UpdateMenuItemInput = {
        id: 99999,
        name: 'Non-existent'
      };

      await expect(updateMenuItem(updateInput)).rejects.toThrow(/menu item not found/i);
    });
  });

  describe('deleteMenuItem', () => {
    let menuItemId: number;

    beforeEach(async () => {
      const input = {
        ...testMenuItemInput,
        restaurant_id: restaurantId,
        category_id: categoryId
      };

      const created = await createMenuItem(input);
      menuItemId = created.id;
    });

    it('should delete menu item successfully', async () => {
      const result = await deleteMenuItem(menuItemId);
      expect(result).toBe(true);

      // Verify deletion from database
      const deleted = await db.select()
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, menuItemId))
        .execute();

      expect(deleted).toHaveLength(0);
    });

    it('should throw error for non-existent menu item', async () => {
      await expect(deleteMenuItem(99999)).rejects.toThrow(/menu item not found/i);
    });
  });
});