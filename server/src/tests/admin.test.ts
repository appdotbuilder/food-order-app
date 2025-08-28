import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable, ordersTable, reviewsTable, addressesTable } from '../db/schema';
import { type User } from '../schema';
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getSystemStats
} from '../handlers/admin';
import { eq } from 'drizzle-orm';

// Test user data
const testUser1 = {
  email: 'user1@example.com',
  password_hash: 'hashedpassword1',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  role: 'customer' as const
};

const testUser2 = {
  email: 'user2@example.com',
  password_hash: 'hashedpassword2',
  first_name: 'Jane',
  last_name: 'Smith',
  phone: '+0987654321',
  role: 'restaurant_owner' as const
};

const testUser3 = {
  email: 'admin@example.com',
  password_hash: 'hashedpassword3',
  first_name: 'Admin',
  last_name: 'User',
  phone: null,
  role: 'admin' as const
};

describe('Admin handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getAllUsers', () => {
    it('should return empty array when no users exist', async () => {
      const result = await getAllUsers();
      expect(result).toEqual([]);
    });

    it('should return all users ordered by creation date', async () => {
      // Create test users
      const user1Result = await db.insert(usersTable).values(testUser1).returning().execute();
      const user2Result = await db.insert(usersTable).values(testUser2).returning().execute();
      const user3Result = await db.insert(usersTable).values(testUser3).returning().execute();

      const result = await getAllUsers();

      expect(result).toHaveLength(3);
      expect(result[0].email).toBe('user1@example.com');
      expect(result[1].email).toBe('user2@example.com');
      expect(result[2].email).toBe('admin@example.com');
      
      // Verify all fields are present
      result.forEach(user => {
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.first_name).toBeDefined();
        expect(user.last_name).toBeDefined();
        expect(user.role).toBeDefined();
        expect(user.created_at).toBeInstanceOf(Date);
        expect(user.updated_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('getUserById', () => {
    it('should return null when user does not exist', async () => {
      const result = await getUserById(999);
      expect(result).toBeNull();
    });

    it('should return user when found', async () => {
      // Create a test user
      const userResult = await db.insert(usersTable).values(testUser1).returning().execute();
      const createdUser = userResult[0];

      const result = await getUserById(createdUser.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(createdUser.id);
      expect(result!.email).toBe('user1@example.com');
      expect(result!.first_name).toBe('John');
      expect(result!.last_name).toBe('Doe');
      expect(result!.phone).toBe('+1234567890');
      expect(result!.role).toBe('customer');
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateUserRole', () => {
    it('should throw error when user does not exist', async () => {
      await expect(updateUserRole(999, 'admin')).rejects.toThrow(/User not found/i);
    });

    it('should update user role successfully', async () => {
      // Create a test user
      const userResult = await db.insert(usersTable).values(testUser1).returning().execute();
      const createdUser = userResult[0];

      const result = await updateUserRole(createdUser.id, 'admin');

      expect(result.id).toBe(createdUser.id);
      expect(result.role).toBe('admin');
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.updated_at > createdUser.updated_at).toBe(true);

      // Verify the change was persisted
      const updatedUser = await getUserById(createdUser.id);
      expect(updatedUser!.role).toBe('admin');
    });

    it('should update role from customer to restaurant_owner', async () => {
      // Create a test user
      const userResult = await db.insert(usersTable).values(testUser1).returning().execute();
      const createdUser = userResult[0];

      const result = await updateUserRole(createdUser.id, 'restaurant_owner');

      expect(result.role).toBe('restaurant_owner');

      // Verify in database
      const updatedUser = await getUserById(createdUser.id);
      expect(updatedUser!.role).toBe('restaurant_owner');
    });
  });

  describe('deleteUser', () => {
    it('should return false when user does not exist', async () => {
      const result = await deleteUser(999);
      expect(result).toBe(false);
    });

    it('should delete user successfully', async () => {
      // Create a test user
      const userResult = await db.insert(usersTable).values(testUser1).returning().execute();
      const createdUser = userResult[0];

      const result = await deleteUser(createdUser.id);

      expect(result).toBe(true);

      // Verify user is deleted
      const deletedUser = await getUserById(createdUser.id);
      expect(deletedUser).toBeNull();
    });

    it('should cascade delete related records', async () => {
      // Create a test user
      const userResult = await db.insert(usersTable).values(testUser1).returning().execute();
      const createdUser = userResult[0];

      // Create related address
      const addressResult = await db.insert(addressesTable).values({
        user_id: createdUser.id,
        street_address: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        postal_code: '12345',
        country: 'Test Country',
        is_default: true
      }).returning().execute();

      // Create restaurant owned by user
      const restaurantResult = await db.insert(restaurantsTable).values({
        owner_id: createdUser.id,
        name: 'Test Restaurant',
        address: '456 Restaurant St',
        phone: '+1234567890'
      }).returning().execute();

      // Delete the user
      const result = await deleteUser(createdUser.id);
      expect(result).toBe(true);

      // Verify cascade deletions
      const addresses = await db.select()
        .from(addressesTable)
        .where(eq(addressesTable.user_id, createdUser.id))
        .execute();
      expect(addresses).toHaveLength(0);

      const restaurants = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.owner_id, createdUser.id))
        .execute();
      expect(restaurants).toHaveLength(0);
    });
  });

  describe('getSystemStats', () => {
    it('should return zero counts when no data exists', async () => {
      const result = await getSystemStats();

      expect(result.totalUsers).toBe(0);
      expect(result.totalRestaurants).toBe(0);
      expect(result.totalOrders).toBe(0);
      expect(result.totalReviews).toBe(0);
    });

    it('should return correct counts when data exists', async () => {
      // Create test users
      const user1Result = await db.insert(usersTable).values(testUser1).returning().execute();
      const user2Result = await db.insert(usersTable).values(testUser2).returning().execute();

      // Create addresses for orders
      const address1Result = await db.insert(addressesTable).values({
        user_id: user1Result[0].id,
        street_address: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        postal_code: '12345',
        country: 'Test Country',
        is_default: true
      }).returning().execute();

      // Create restaurants
      const restaurant1Result = await db.insert(restaurantsTable).values({
        owner_id: user2Result[0].id,
        name: 'Test Restaurant 1',
        address: '456 Restaurant St',
        phone: '+1234567890'
      }).returning().execute();

      const restaurant2Result = await db.insert(restaurantsTable).values({
        owner_id: user2Result[0].id,
        name: 'Test Restaurant 2',
        address: '789 Restaurant Ave',
        phone: '+0987654321'
      }).returning().execute();

      // Create orders
      await db.insert(ordersTable).values({
        user_id: user1Result[0].id,
        restaurant_id: restaurant1Result[0].id,
        delivery_address_id: address1Result[0].id,
        subtotal: '25.99',
        total_amount: '30.99'
      }).execute();

      await db.insert(ordersTable).values({
        user_id: user1Result[0].id,
        restaurant_id: restaurant2Result[0].id,
        delivery_address_id: address1Result[0].id,
        subtotal: '18.50',
        total_amount: '22.00'
      }).execute();

      // Create reviews
      await db.insert(reviewsTable).values({
        user_id: user1Result[0].id,
        restaurant_id: restaurant1Result[0].id,
        rating: 5,
        comment: 'Great food!',
        is_approved: true
      }).execute();

      await db.insert(reviewsTable).values({
        user_id: user1Result[0].id,
        restaurant_id: restaurant2Result[0].id,
        rating: 4,
        comment: 'Good service',
        is_approved: false
      }).execute();

      await db.insert(reviewsTable).values({
        user_id: user1Result[0].id,
        restaurant_id: restaurant1Result[0].id,
        rating: 3,
        comment: 'Average experience',
        is_approved: true
      }).execute();

      const result = await getSystemStats();

      expect(result.totalUsers).toBe(2);
      expect(result.totalRestaurants).toBe(2);
      expect(result.totalOrders).toBe(2);
      expect(result.totalReviews).toBe(3);
    });

    it('should return correct partial counts when some tables are empty', async () => {
      // Create only users and restaurants, no orders or reviews
      await db.insert(usersTable).values(testUser1).execute();
      await db.insert(usersTable).values(testUser2).execute();

      const restaurant1Result = await db.insert(restaurantsTable).values({
        owner_id: 1, // Assuming first user gets ID 1
        name: 'Test Restaurant',
        address: '456 Restaurant St',
        phone: '+1234567890'
      }).returning().execute();

      const result = await getSystemStats();

      expect(result.totalUsers).toBe(2);
      expect(result.totalRestaurants).toBe(1);
      expect(result.totalOrders).toBe(0);
      expect(result.totalReviews).toBe(0);
    });
  });
});