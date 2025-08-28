import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable } from '../db/schema';
import { type CreateRestaurantInput, type GetRestaurantsInput } from '../schema';
import { createRestaurant, getRestaurants, getRestaurantById, getRestaurantsByOwner } from '../handlers/restaurants';
import { eq } from 'drizzle-orm';

describe('Restaurant handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test user
  const createTestUser = async (role: 'customer' | 'restaurant_owner' | 'admin' = 'restaurant_owner') => {
    const result = await db.insert(usersTable)
      .values({
        email: `test-${Date.now()}@example.com`,
        password_hash: 'hashed_password',
        name: 'Test User',
        phone: '+91-9876543210',
        role
      })
      .returning()
      .execute();

    return result[0];
  };

  // Test input for creating restaurants
  const testRestaurantInput: CreateRestaurantInput = {
    owner_id: 1,
    name: 'Test Restaurant',
    description: 'A great place to eat',
    address: '123 Main St',
    phone: '+91-9876543210',
    image_url: 'https://example.com/restaurant.jpg'
  };

  describe('createRestaurant', () => {
    it('should create a restaurant with valid owner', async () => {
      // Create a restaurant owner first
      const owner = await createTestUser('restaurant_owner');
      
      const input = {
        ...testRestaurantInput,
        owner_id: owner.id
      };

      const result = await createRestaurant(input);

      // Verify restaurant properties
      expect(result.name).toEqual('Test Restaurant');
      expect(result.description).toEqual('A great place to eat');
      expect(result.address).toEqual('123 Main St');
      expect(result.phone).toEqual('+91-9876543210');
      expect(result.image_url).toEqual('https://example.com/restaurant.jpg');
      expect(result.owner_id).toEqual(owner.id);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should allow admin to create restaurant', async () => {
      const admin = await createTestUser('admin');
      
      const input = {
        ...testRestaurantInput,
        owner_id: admin.id
      };

      const result = await createRestaurant(input);
      expect(result.owner_id).toEqual(admin.id);
      expect(result.name).toEqual('Test Restaurant');
    });

    it('should save restaurant to database', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      const input = {
        ...testRestaurantInput,
        owner_id: owner.id
      };

      const result = await createRestaurant(input);

      // Verify it was saved to database
      const restaurants = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, result.id))
        .execute();

      expect(restaurants).toHaveLength(1);
      expect(restaurants[0].name).toEqual('Test Restaurant');
      expect(restaurants[0].owner_id).toEqual(owner.id);
      expect(restaurants[0].is_active).toBe(true);
    });

    it('should handle nullable fields correctly', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      const input = {
        owner_id: owner.id,
        name: 'Minimal Restaurant',
        description: null,
        address: '456 Simple St',
        phone: '+91-9876543210',
        image_url: null
      };

      const result = await createRestaurant(input);
      expect(result.description).toBeNull();
      expect(result.image_url).toBeNull();
      expect(result.name).toEqual('Minimal Restaurant');
    });

    it('should throw error for non-existent owner', async () => {
      const input = {
        ...testRestaurantInput,
        owner_id: 999999 // Non-existent user ID
      };

      await expect(createRestaurant(input)).rejects.toThrow(/Owner not found/i);
    });

    it('should throw error for customer role owner', async () => {
      const customer = await createTestUser('customer');
      
      const input = {
        ...testRestaurantInput,
        owner_id: customer.id
      };

      await expect(createRestaurant(input)).rejects.toThrow(/must have restaurant_owner or admin role/i);
    });
  });

  describe('getRestaurants', () => {
    it('should return empty array when no restaurants exist', async () => {
      const result = await getRestaurants();
      expect(result).toHaveLength(0);
    });

    it('should return all active restaurants', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      // Create two restaurants
      await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: 'Restaurant 1' });
      await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: 'Restaurant 2' });

      const result = await getRestaurants();
      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Restaurant 1');
      expect(result[1].name).toEqual('Restaurant 2');
    });

    it('should filter restaurants by search term', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      // Create restaurants with different names
      await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: 'Pizza Palace' });
      await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: 'Burger Joint' });

      const searchInput: GetRestaurantsInput = { search: 'pizza' };
      const result = await getRestaurants(searchInput);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Pizza Palace');
    });

    it('should handle case-insensitive search', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: 'PIZZA Palace' });

      const searchInput: GetRestaurantsInput = { search: 'pizza' };
      const result = await getRestaurants(searchInput);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('PIZZA Palace');
    });

    it('should apply pagination with limit', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      // Create 3 restaurants
      for (let i = 1; i <= 3; i++) {
        await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: `Restaurant ${i}` });
      }

      const input: GetRestaurantsInput = { limit: 2 };
      const result = await getRestaurants(input);
      
      expect(result).toHaveLength(2);
    });

    it('should apply pagination with offset', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      // Create 3 restaurants
      for (let i = 1; i <= 3; i++) {
        await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: `Restaurant ${i}` });
      }

      const input: GetRestaurantsInput = { limit: 2, offset: 1 };
      const result = await getRestaurants(input);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Restaurant 2');
      expect(result[1].name).toEqual('Restaurant 3');
    });

    it('should only return active restaurants', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      // Create active restaurant
      const activeRestaurant = await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: 'Active Restaurant' });
      
      // Manually create inactive restaurant
      await db.insert(restaurantsTable)
        .values({
          owner_id: owner.id,
          name: 'Inactive Restaurant',
          description: 'This should not appear',
          address: '789 Hidden St',
          phone: '+91-9876543210',
          is_active: false
        })
        .execute();

      const result = await getRestaurants();
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Active Restaurant');
      expect(result[0].is_active).toBe(true);
    });
  });

  describe('getRestaurantById', () => {
    it('should return restaurant when it exists', async () => {
      const owner = await createTestUser('restaurant_owner');
      const restaurant = await createRestaurant({ ...testRestaurantInput, owner_id: owner.id });

      const result = await getRestaurantById(restaurant.id);
      
      expect(result).not.toBeNull();
      expect(result!.id).toEqual(restaurant.id);
      expect(result!.name).toEqual('Test Restaurant');
      expect(result!.owner_id).toEqual(owner.id);
    });

    it('should return null when restaurant does not exist', async () => {
      const result = await getRestaurantById(999999);
      expect(result).toBeNull();
    });

    it('should return inactive restaurants', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      // Manually create inactive restaurant
      const inactiveResult = await db.insert(restaurantsTable)
        .values({
          owner_id: owner.id,
          name: 'Inactive Restaurant',
          description: 'This is inactive',
          address: '789 Hidden St',
          phone: '+91-9876543210',
          is_active: false
        })
        .returning()
        .execute();

      const result = await getRestaurantById(inactiveResult[0].id);
      
      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Inactive Restaurant');
      expect(result!.is_active).toBe(false);
    });
  });

  describe('getRestaurantsByOwner', () => {
    it('should return empty array when owner has no restaurants', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      const result = await getRestaurantsByOwner(owner.id);
      expect(result).toHaveLength(0);
    });

    it('should return all restaurants owned by user', async () => {
      const owner1 = await createTestUser('restaurant_owner');
      const owner2 = await createTestUser('restaurant_owner');
      
      // Create restaurants for owner1
      await createRestaurant({ ...testRestaurantInput, owner_id: owner1.id, name: 'Owner1 Restaurant 1' });
      await createRestaurant({ ...testRestaurantInput, owner_id: owner1.id, name: 'Owner1 Restaurant 2' });
      
      // Create restaurant for owner2
      await createRestaurant({ ...testRestaurantInput, owner_id: owner2.id, name: 'Owner2 Restaurant' });

      const result = await getRestaurantsByOwner(owner1.id);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Owner1 Restaurant 1');
      expect(result[1].name).toEqual('Owner1 Restaurant 2');
      expect(result.every(r => r.owner_id === owner1.id)).toBe(true);
    });

    it('should return both active and inactive restaurants for owner', async () => {
      const owner = await createTestUser('restaurant_owner');
      
      // Create active restaurant
      await createRestaurant({ ...testRestaurantInput, owner_id: owner.id, name: 'Active Restaurant' });
      
      // Create inactive restaurant
      await db.insert(restaurantsTable)
        .values({
          owner_id: owner.id,
          name: 'Inactive Restaurant',
          description: 'This is inactive',
          address: '789 Hidden St',
          phone: '+91-9876543210',
          is_active: false
        })
        .execute();

      const result = await getRestaurantsByOwner(owner.id);
      
      expect(result).toHaveLength(2);
      expect(result.some(r => r.name === 'Active Restaurant' && r.is_active === true)).toBe(true);
      expect(result.some(r => r.name === 'Inactive Restaurant' && r.is_active === false)).toBe(true);
    });

    it('should return empty array for non-existent owner', async () => {
      const result = await getRestaurantsByOwner(999999);
      expect(result).toHaveLength(0);
    });
  });
});