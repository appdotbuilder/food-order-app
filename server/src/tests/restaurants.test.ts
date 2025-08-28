import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { restaurantsTable, usersTable } from '../db/schema';
import { type CreateRestaurantInput, type UpdateRestaurantInput } from '../schema';
import {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getRestaurantsByOwner,
  updateRestaurant,
  deleteRestaurant
} from '../handlers/restaurants';
import { eq } from 'drizzle-orm';

// Test data
const testRestaurantOwner = {
  email: 'owner@restaurant.com',
  password_hash: 'hashedpassword',
  first_name: 'Restaurant',
  last_name: 'Owner',
  phone: '555-0123',
  role: 'restaurant_owner' as const
};

const testCustomer = {
  email: 'customer@test.com',
  password_hash: 'hashedpassword',
  first_name: 'John',
  last_name: 'Customer',
  phone: '555-0124',
  role: 'customer' as const
};

const testRestaurantInput: CreateRestaurantInput = {
  owner_id: 0, // Will be set after creating owner
  name: 'Test Restaurant',
  description: 'A great place to eat',
  address: '123 Main St, City, State 12345',
  phone: '555-0100',
  email: 'contact@testrestaurant.com',
  opening_hours: 'Mon-Sun: 9AM-11PM',
  is_active: true
};

describe('Restaurant Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createRestaurant', () => {
    it('should create a restaurant with restaurant owner', async () => {
      // Create restaurant owner first
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const result = await createRestaurant(input);

      // Verify restaurant fields
      expect(result.owner_id).toEqual(ownerResult[0].id);
      expect(result.name).toEqual('Test Restaurant');
      expect(result.description).toEqual('A great place to eat');
      expect(result.address).toEqual('123 Main St, City, State 12345');
      expect(result.phone).toEqual('555-0100');
      expect(result.email).toEqual('contact@testrestaurant.com');
      expect(result.opening_hours).toEqual('Mon-Sun: 9AM-11PM');
      expect(result.is_active).toEqual(true);
      expect(result.rating).toBeNull();
      expect(result.total_reviews).toEqual(0);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a restaurant with admin user', async () => {
      // Create admin user
      const adminUser = {
        ...testRestaurantOwner,
        email: 'admin@test.com',
        role: 'admin' as const
      };
      
      const ownerResult = await db.insert(usersTable)
        .values(adminUser)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const result = await createRestaurant(input);

      expect(result.owner_id).toEqual(ownerResult[0].id);
      expect(result.name).toEqual('Test Restaurant');
    });

    it('should use default is_active value when not provided', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();

      const inputWithoutActive = {
        owner_id: ownerResult[0].id,
        name: 'Test Restaurant',
        description: null,
        address: '123 Main St',
        phone: '555-0100',
        email: null,
        opening_hours: null
      };

      const result = await createRestaurant(inputWithoutActive);
      expect(result.is_active).toEqual(true);
    });

    it('should save restaurant to database', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const result = await createRestaurant(input);

      // Verify in database
      const restaurants = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, result.id))
        .execute();

      expect(restaurants).toHaveLength(1);
      expect(restaurants[0].name).toEqual('Test Restaurant');
      expect(restaurants[0].owner_id).toEqual(ownerResult[0].id);
      expect(restaurants[0].is_active).toEqual(true);
    });

    it('should throw error when owner does not exist', async () => {
      const input = { ...testRestaurantInput, owner_id: 999 };
      
      await expect(createRestaurant(input)).rejects.toThrow(/owner not found/i);
    });

    it('should throw error when user is not restaurant owner or admin', async () => {
      const customerResult = await db.insert(usersTable)
        .values(testCustomer)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: customerResult[0].id };
      
      await expect(createRestaurant(input)).rejects.toThrow(/must be a restaurant owner/i);
    });
  });

  describe('getAllRestaurants', () => {
    it('should return all active restaurants', async () => {
      // Create owner
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();

      // Create active restaurant
      const activeInput = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      await createRestaurant(activeInput);

      // Create inactive restaurant
      const inactiveInput = {
        ...testRestaurantInput,
        owner_id: ownerResult[0].id,
        name: 'Inactive Restaurant',
        is_active: false
      };
      await createRestaurant(inactiveInput);

      const results = await getAllRestaurants();

      // Should only return active restaurant
      expect(results).toHaveLength(1);
      expect(results[0].name).toEqual('Test Restaurant');
      expect(results[0].is_active).toEqual(true);
      expect(typeof results[0].rating).toEqual('object'); // null or number
    });

    it('should return empty array when no active restaurants exist', async () => {
      const results = await getAllRestaurants();
      expect(results).toHaveLength(0);
    });

    it('should handle numeric rating conversion correctly', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();

      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      await createRestaurant(input);

      // Manually update rating to test conversion
      await db.update(restaurantsTable)
        .set({ rating: '4.50' })
        .where(eq(restaurantsTable.owner_id, ownerResult[0].id))
        .execute();

      const results = await getAllRestaurants();
      expect(results).toHaveLength(1);
      expect(results[0].rating).toEqual(4.5);
      expect(typeof results[0].rating).toEqual('number');
    });
  });

  describe('getRestaurantById', () => {
    it('should return restaurant by ID', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const created = await createRestaurant(input);

      const result = await getRestaurantById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Test Restaurant');
      expect(result!.owner_id).toEqual(ownerResult[0].id);
    });

    it('should return null when restaurant not found', async () => {
      const result = await getRestaurantById(999);
      expect(result).toBeNull();
    });

    it('should return inactive restaurant by ID', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = {
        ...testRestaurantInput,
        owner_id: ownerResult[0].id,
        is_active: false
      };
      const created = await createRestaurant(input);

      const result = await getRestaurantById(created.id);

      expect(result).not.toBeNull();
      expect(result!.is_active).toEqual(false);
    });
  });

  describe('getRestaurantsByOwner', () => {
    it('should return restaurants for specific owner', async () => {
      // Create two owners
      const owner1Result = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();

      const owner2Result = await db.insert(usersTable)
        .values({
          ...testRestaurantOwner,
          email: 'owner2@restaurant.com'
        })
        .returning()
        .execute();

      // Create restaurants for each owner
      const input1 = { ...testRestaurantInput, owner_id: owner1Result[0].id };
      const input2 = {
        ...testRestaurantInput,
        owner_id: owner1Result[0].id,
        name: 'Second Restaurant'
      };
      const input3 = {
        ...testRestaurantInput,
        owner_id: owner2Result[0].id,
        name: 'Other Owner Restaurant'
      };

      await createRestaurant(input1);
      await createRestaurant(input2);
      await createRestaurant(input3);

      const results = await getRestaurantsByOwner(owner1Result[0].id);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('Test Restaurant');
      expect(results.map(r => r.name)).toContain('Second Restaurant');
      expect(results.every(r => r.owner_id === owner1Result[0].id)).toBe(true);
    });

    it('should return empty array for owner with no restaurants', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();

      const results = await getRestaurantsByOwner(ownerResult[0].id);
      expect(results).toHaveLength(0);
    });

    it('should throw error when owner does not exist', async () => {
      await expect(getRestaurantsByOwner(999)).rejects.toThrow(/owner not found/i);
    });

    it('should include both active and inactive restaurants', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();

      const activeInput = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const inactiveInput = {
        ...testRestaurantInput,
        owner_id: ownerResult[0].id,
        name: 'Inactive Restaurant',
        is_active: false
      };

      await createRestaurant(activeInput);
      await createRestaurant(inactiveInput);

      const results = await getRestaurantsByOwner(ownerResult[0].id);
      expect(results).toHaveLength(2);
      expect(results.some(r => r.is_active === true)).toBe(true);
      expect(results.some(r => r.is_active === false)).toBe(true);
    });
  });

  describe('updateRestaurant', () => {
    it('should update restaurant fields', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const created = await createRestaurant(input);

      const updateInput: UpdateRestaurantInput = {
        id: created.id,
        name: 'Updated Restaurant Name',
        description: 'Updated description',
        phone: '555-9999',
        is_active: false
      };

      const result = await updateRestaurant(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Updated Restaurant Name');
      expect(result.description).toEqual('Updated description');
      expect(result.phone).toEqual('555-9999');
      expect(result.is_active).toEqual(false);
      expect(result.address).toEqual(created.address); // Unchanged
      expect(result.updated_at).not.toEqual(created.updated_at);
    });

    it('should update only provided fields', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const created = await createRestaurant(input);

      const updateInput: UpdateRestaurantInput = {
        id: created.id,
        name: 'New Name Only'
      };

      const result = await updateRestaurant(updateInput);

      expect(result.name).toEqual('New Name Only');
      expect(result.description).toEqual(created.description); // Unchanged
      expect(result.phone).toEqual(created.phone); // Unchanged
      expect(result.is_active).toEqual(created.is_active); // Unchanged
    });

    it('should handle null fields correctly', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const created = await createRestaurant(input);

      const updateInput: UpdateRestaurantInput = {
        id: created.id,
        description: null,
        email: null,
        opening_hours: null
      };

      const result = await updateRestaurant(updateInput);

      expect(result.description).toBeNull();
      expect(result.email).toBeNull();
      expect(result.opening_hours).toBeNull();
    });

    it('should save updates to database', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const created = await createRestaurant(input);

      const updateInput: UpdateRestaurantInput = {
        id: created.id,
        name: 'Database Updated Name'
      };

      await updateRestaurant(updateInput);

      // Verify in database
      const restaurants = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, created.id))
        .execute();

      expect(restaurants).toHaveLength(1);
      expect(restaurants[0].name).toEqual('Database Updated Name');
    });

    it('should throw error when restaurant not found', async () => {
      const updateInput: UpdateRestaurantInput = {
        id: 999,
        name: 'Non-existent Restaurant'
      };

      await expect(updateRestaurant(updateInput)).rejects.toThrow(/restaurant not found/i);
    });

    it('should return existing restaurant when no fields to update', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const created = await createRestaurant(input);

      const updateInput: UpdateRestaurantInput = {
        id: created.id
        // No fields to update
      };

      const result = await updateRestaurant(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual(created.name);
      expect(result.updated_at).toEqual(created.updated_at); // Should be same
    });
  });

  describe('deleteRestaurant', () => {
    it('should delete restaurant successfully', async () => {
      const ownerResult = await db.insert(usersTable)
        .values(testRestaurantOwner)
        .returning()
        .execute();
      
      const input = { ...testRestaurantInput, owner_id: ownerResult[0].id };
      const created = await createRestaurant(input);

      const result = await deleteRestaurant(created.id);

      expect(result).toBe(true);

      // Verify restaurant is deleted
      const restaurants = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, created.id))
        .execute();

      expect(restaurants).toHaveLength(0);
    });

    it('should throw error when restaurant not found', async () => {
      await expect(deleteRestaurant(999)).rejects.toThrow(/restaurant not found/i);
    });

    it('should verify restaurant exists before deletion', async () => {
      // This test ensures we check existence before attempting deletion
      const nonExistentId = 999;
      
      await expect(deleteRestaurant(nonExistentId)).rejects.toThrow(/restaurant not found/i);
      
      // Verify no deletion occurred (no restaurants should exist)
      const restaurants = await db.select()
        .from(restaurantsTable)
        .execute();

      expect(restaurants).toHaveLength(0);
    });
  });
});