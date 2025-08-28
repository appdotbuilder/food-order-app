import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { menuCategoriesTable, restaurantsTable, usersTable } from '../db/schema';
import { type CreateMenuCategoryInput } from '../schema';
import { createMenuCategory, getRestaurantCategories, updateMenuCategory, deleteMenuCategory } from '../handlers/menu_categories';
import { eq } from 'drizzle-orm';

describe('Menu Categories Handlers', () => {
  let testUserId: number;
  let testRestaurantId: number;

  beforeEach(async () => {
    await createDB();

    // Create a test user (restaurant owner)
    const userResult = await db.insert(usersTable)
      .values({
        email: 'owner@test.com',
        password_hash: 'hashedpassword',
        first_name: 'Restaurant',
        last_name: 'Owner',
        phone: '1234567890',
        role: 'restaurant_owner'
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;

    // Create a test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        owner_id: testUserId,
        name: 'Test Restaurant',
        description: 'A test restaurant',
        address: '123 Test St',
        phone: '1234567890',
        email: 'restaurant@test.com',
        opening_hours: '9:00 AM - 10:00 PM',
        is_active: true,
        rating: '4.50',
        total_reviews: 10
      })
      .returning()
      .execute();
    
    testRestaurantId = restaurantResult[0].id;
  });

  afterEach(resetDB);

  describe('createMenuCategory', () => {
    const testInput: CreateMenuCategoryInput = {
      restaurant_id: 0, // Will be set in tests
      name: 'Appetizers',
      description: 'Delicious starters',
      sort_order: 1,
      is_active: true
    };

    it('should create a menu category', async () => {
      const input = { ...testInput, restaurant_id: testRestaurantId };
      
      const result = await createMenuCategory(input);

      expect(result.name).toEqual('Appetizers');
      expect(result.description).toEqual('Delicious starters');
      expect(result.restaurant_id).toEqual(testRestaurantId);
      expect(result.sort_order).toEqual(1);
      expect(result.is_active).toEqual(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save menu category to database', async () => {
      const input = { ...testInput, restaurant_id: testRestaurantId };
      
      const result = await createMenuCategory(input);

      const categories = await db.select()
        .from(menuCategoriesTable)
        .where(eq(menuCategoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Appetizers');
      expect(categories[0].description).toEqual('Delicious starters');
      expect(categories[0].restaurant_id).toEqual(testRestaurantId);
      expect(categories[0].sort_order).toEqual(1);
      expect(categories[0].is_active).toEqual(true);
    });

    it('should use default values for optional fields', async () => {
      const minimalInput = {
        restaurant_id: testRestaurantId,
        name: 'Main Courses',
        description: null
      };
      
      const result = await createMenuCategory(minimalInput);

      expect(result.name).toEqual('Main Courses');
      expect(result.description).toBeNull();
      expect(result.sort_order).toEqual(0); // Default value
      expect(result.is_active).toEqual(true); // Default value
    });

    it('should throw error for non-existent restaurant', async () => {
      const input = { ...testInput, restaurant_id: 99999 };
      
      await expect(createMenuCategory(input)).rejects.toThrow(/restaurant not found/i);
    });
  });

  describe('getRestaurantCategories', () => {
    it('should return empty array for restaurant with no categories', async () => {
      const result = await getRestaurantCategories(testRestaurantId);
      
      expect(result).toHaveLength(0);
    });

    it('should return active categories for restaurant', async () => {
      // Create test categories
      await db.insert(menuCategoriesTable)
        .values([
          {
            restaurant_id: testRestaurantId,
            name: 'Appetizers',
            description: 'Starters',
            sort_order: 2,
            is_active: true
          },
          {
            restaurant_id: testRestaurantId,
            name: 'Main Courses',
            description: 'Entrees',
            sort_order: 1,
            is_active: true
          },
          {
            restaurant_id: testRestaurantId,
            name: 'Inactive Category',
            description: 'Should not appear',
            sort_order: 0,
            is_active: false
          }
        ])
        .execute();

      const result = await getRestaurantCategories(testRestaurantId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Appetizers'); // Higher sort_order comes first
      expect(result[1].name).toEqual('Main Courses');
      
      // Verify all returned categories are active
      result.forEach(category => {
        expect(category.is_active).toEqual(true);
        expect(category.restaurant_id).toEqual(testRestaurantId);
      });
    });

    it('should order categories by sort_order descending', async () => {
      await db.insert(menuCategoriesTable)
        .values([
          {
            restaurant_id: testRestaurantId,
            name: 'Category A',
            sort_order: 1,
            is_active: true
          },
          {
            restaurant_id: testRestaurantId,
            name: 'Category B',
            sort_order: 3,
            is_active: true
          },
          {
            restaurant_id: testRestaurantId,
            name: 'Category C',
            sort_order: 2,
            is_active: true
          }
        ])
        .execute();

      const result = await getRestaurantCategories(testRestaurantId);

      expect(result).toHaveLength(3);
      expect(result[0].name).toEqual('Category B'); // sort_order: 3
      expect(result[1].name).toEqual('Category C'); // sort_order: 2
      expect(result[2].name).toEqual('Category A'); // sort_order: 1
    });
  });

  describe('updateMenuCategory', () => {
    let categoryId: number;

    beforeEach(async () => {
      const categoryResult = await db.insert(menuCategoriesTable)
        .values({
          restaurant_id: testRestaurantId,
          name: 'Original Name',
          description: 'Original description',
          sort_order: 1,
          is_active: true
        })
        .returning()
        .execute();
      
      categoryId = categoryResult[0].id;
    });

    it('should update category name', async () => {
      const result = await updateMenuCategory(categoryId, { name: 'Updated Name' });

      expect(result.name).toEqual('Updated Name');
      expect(result.description).toEqual('Original description'); // Unchanged
      expect(result.id).toEqual(categoryId);
    });

    it('should update multiple fields', async () => {
      const updateData = {
        name: 'New Name',
        description: 'New description',
        sort_order: 5,
        is_active: false
      };
      
      const result = await updateMenuCategory(categoryId, updateData);

      expect(result.name).toEqual('New Name');
      expect(result.description).toEqual('New description');
      expect(result.sort_order).toEqual(5);
      expect(result.is_active).toEqual(false);
    });

    it('should update only provided fields', async () => {
      const result = await updateMenuCategory(categoryId, { sort_order: 10 });

      expect(result.sort_order).toEqual(10);
      expect(result.name).toEqual('Original Name'); // Unchanged
      expect(result.description).toEqual('Original description'); // Unchanged
    });

    it('should save updates to database', async () => {
      await updateMenuCategory(categoryId, { name: 'Database Test' });

      const categories = await db.select()
        .from(menuCategoriesTable)
        .where(eq(menuCategoriesTable.id, categoryId))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Database Test');
    });

    it('should throw error for non-existent category', async () => {
      await expect(updateMenuCategory(99999, { name: 'Test' }))
        .rejects.toThrow(/menu category not found/i);
    });
  });

  describe('deleteMenuCategory', () => {
    let categoryId: number;

    beforeEach(async () => {
      const categoryResult = await db.insert(menuCategoriesTable)
        .values({
          restaurant_id: testRestaurantId,
          name: 'To Delete',
          description: 'This will be deleted',
          sort_order: 1,
          is_active: true
        })
        .returning()
        .execute();
      
      categoryId = categoryResult[0].id;
    });

    it('should delete category successfully', async () => {
      const result = await deleteMenuCategory(categoryId);

      expect(result).toEqual(true);
    });

    it('should remove category from database', async () => {
      await deleteMenuCategory(categoryId);

      const categories = await db.select()
        .from(menuCategoriesTable)
        .where(eq(menuCategoriesTable.id, categoryId))
        .execute();

      expect(categories).toHaveLength(0);
    });

    it('should throw error for non-existent category', async () => {
      await expect(deleteMenuCategory(99999))
        .rejects.toThrow(/menu category not found/i);
    });

    it('should return false when no rows affected', async () => {
      // Delete the category first
      await deleteMenuCategory(categoryId);
      
      // Try to delete again - should throw error
      await expect(deleteMenuCategory(categoryId))
        .rejects.toThrow(/menu category not found/i);
    });
  });
});