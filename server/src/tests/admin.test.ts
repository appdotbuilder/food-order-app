import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable, ordersTable } from '../db/schema';
import { 
  getAllUsers,
  getAllRestaurants,
  getAllOrders,
  deactivateRestaurant,
  activateRestaurant
} from '../handlers/admin';
import { eq } from 'drizzle-orm';

describe('Admin Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getAllUsers', () => {
    it('should fetch all users from database', async () => {
      // Create test users
      const hashedPassword = 'hashed_test_password';
      
      await db.insert(usersTable).values([
        {
          email: 'customer@test.com',
          password_hash: hashedPassword,
          name: 'Test Customer',
          phone: '+91-1234567890',
          role: 'customer'
        },
        {
          email: 'owner@test.com',
          password_hash: hashedPassword,
          name: 'Test Owner',
          phone: '+91-1234567891',
          role: 'restaurant_owner'
        },
        {
          email: 'admin@test.com',
          password_hash: hashedPassword,
          name: 'Test Admin',
          phone: '+91-1234567892',
          role: 'admin'
        }
      ]).execute();

      const result = await getAllUsers();

      expect(result).toHaveLength(3);
      expect(result[0].email).toBe('customer@test.com');
      expect(result[0].name).toBe('Test Customer');
      expect(result[0].role).toBe('customer');
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].updated_at).toBeInstanceOf(Date);
      
      expect(result[1].email).toBe('owner@test.com');
      expect(result[1].role).toBe('restaurant_owner');
      
      expect(result[2].email).toBe('admin@test.com');
      expect(result[2].role).toBe('admin');
    });

    it('should return empty array when no users exist', async () => {
      const result = await getAllUsers();
      expect(result).toHaveLength(0);
    });
  });

  describe('getAllRestaurants', () => {
    it('should fetch all restaurants from database', async () => {
      // Create test user first (restaurant owner)
      const hashedPassword = 'hashed_test_password';
      
      const userResult = await db.insert(usersTable).values({
        email: 'owner@test.com',
        password_hash: hashedPassword,
        name: 'Test Owner',
        phone: '+91-1234567890',
        role: 'restaurant_owner'
      }).returning().execute();

      const ownerId = userResult[0].id;

      // Create test restaurants
      await db.insert(restaurantsTable).values([
        {
          owner_id: ownerId,
          name: 'Active Restaurant',
          description: 'A great restaurant',
          address: '123 Main Street',
          phone: '+91-9876543210',
          image_url: 'http://example.com/image.jpg',
          is_active: true
        },
        {
          owner_id: ownerId,
          name: 'Inactive Restaurant',
          description: 'Currently closed',
          address: '456 Side Street',
          phone: '+91-9876543211',
          image_url: null,
          is_active: false
        }
      ]).execute();

      const result = await getAllRestaurants();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Active Restaurant');
      expect(result[0].is_active).toBe(true);
      expect(result[0].owner_id).toBe(ownerId);
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].updated_at).toBeInstanceOf(Date);
      
      expect(result[1].name).toBe('Inactive Restaurant');
      expect(result[1].is_active).toBe(false);
    });

    it('should return empty array when no restaurants exist', async () => {
      const result = await getAllRestaurants();
      expect(result).toHaveLength(0);
    });
  });

  describe('getAllOrders', () => {
    it('should fetch all orders from database with numeric conversion', async () => {
      // Create prerequisite data
      const hashedPassword = 'hashed_test_password';
      
      // Create user
      const userResult = await db.insert(usersTable).values({
        email: 'customer@test.com',
        password_hash: hashedPassword,
        name: 'Test Customer',
        phone: '+91-1234567890',
        role: 'customer'
      }).returning().execute();

      // Create restaurant owner
      const ownerResult = await db.insert(usersTable).values({
        email: 'owner@test.com',
        password_hash: hashedPassword,
        name: 'Test Owner',
        phone: '+91-1234567891',
        role: 'restaurant_owner'
      }).returning().execute();

      // Create restaurant
      const restaurantResult = await db.insert(restaurantsTable).values({
        owner_id: ownerResult[0].id,
        name: 'Test Restaurant',
        description: 'Test description',
        address: '123 Test Street',
        phone: '+91-9876543210',
        is_active: true
      }).returning().execute();

      // Create test orders
      await db.insert(ordersTable).values([
        {
          user_id: userResult[0].id,
          restaurant_id: restaurantResult[0].id,
          total_amount: '25.99',
          status: 'delivered',
          delivery_address: '123 Customer Street',
          phone: '+91-1234567890'
        },
        {
          user_id: userResult[0].id,
          restaurant_id: restaurantResult[0].id,
          total_amount: '42.50',
          status: 'pending',
          delivery_address: '456 Customer Avenue',
          phone: '+91-1234567890'
        }
      ]).execute();

      const result = await getAllOrders();

      expect(result).toHaveLength(2);
      expect(result[0].total_amount).toBe(25.99);
      expect(typeof result[0].total_amount).toBe('number');
      expect(result[0].status).toBe('delivered');
      expect(result[0].user_id).toBe(userResult[0].id);
      expect(result[0].restaurant_id).toBe(restaurantResult[0].id);
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].updated_at).toBeInstanceOf(Date);
      
      expect(result[1].total_amount).toBe(42.50);
      expect(typeof result[1].total_amount).toBe('number');
      expect(result[1].status).toBe('pending');
    });

    it('should return empty array when no orders exist', async () => {
      const result = await getAllOrders();
      expect(result).toHaveLength(0);
    });
  });

  describe('deactivateRestaurant', () => {
    it('should deactivate an existing restaurant', async () => {
      // Create test user first
      const hashedPassword = 'hashed_test_password';
      
      const userResult = await db.insert(usersTable).values({
        email: 'owner@test.com',
        password_hash: hashedPassword,
        name: 'Test Owner',
        phone: '+91-1234567890',
        role: 'restaurant_owner'
      }).returning().execute();

      // Create active restaurant
      const restaurantResult = await db.insert(restaurantsTable).values({
        owner_id: userResult[0].id,
        name: 'Active Restaurant',
        description: 'Currently active',
        address: '123 Main Street',
        phone: '+91-9876543210',
        is_active: true
      }).returning().execute();

      const restaurantId = restaurantResult[0].id;

      const result = await deactivateRestaurant(restaurantId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(restaurantId);
      expect(result!.is_active).toBe(false);
      expect(result!.name).toBe('Active Restaurant');
      expect(result!.updated_at).toBeInstanceOf(Date);

      // Verify in database
      const dbCheck = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, restaurantId))
        .execute();

      expect(dbCheck[0].is_active).toBe(false);
    });

    it('should return null for non-existent restaurant', async () => {
      const result = await deactivateRestaurant(999);
      expect(result).toBeNull();
    });
  });

  describe('activateRestaurant', () => {
    it('should activate an inactive restaurant', async () => {
      // Create test user first
      const hashedPassword = 'hashed_test_password';
      
      const userResult = await db.insert(usersTable).values({
        email: 'owner@test.com',
        password_hash: hashedPassword,
        name: 'Test Owner',
        phone: '+91-1234567890',
        role: 'restaurant_owner'
      }).returning().execute();

      // Create inactive restaurant
      const restaurantResult = await db.insert(restaurantsTable).values({
        owner_id: userResult[0].id,
        name: 'Inactive Restaurant',
        description: 'Currently inactive',
        address: '123 Main Street',
        phone: '+91-9876543210',
        is_active: false
      }).returning().execute();

      const restaurantId = restaurantResult[0].id;

      const result = await activateRestaurant(restaurantId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(restaurantId);
      expect(result!.is_active).toBe(true);
      expect(result!.name).toBe('Inactive Restaurant');
      expect(result!.updated_at).toBeInstanceOf(Date);

      // Verify in database
      const dbCheck = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, restaurantId))
        .execute();

      expect(dbCheck[0].is_active).toBe(true);
    });

    it('should return null for non-existent restaurant', async () => {
      const result = await activateRestaurant(999);
      expect(result).toBeNull();
    });

    it('should work on already active restaurant', async () => {
      // Create test user first
      const hashedPassword = 'hashed_test_password';
      
      const userResult = await db.insert(usersTable).values({
        email: 'owner@test.com',
        password_hash: hashedPassword,
        name: 'Test Owner',
        phone: '+91-1234567890',
        role: 'restaurant_owner'
      }).returning().execute();

      // Create already active restaurant
      const restaurantResult = await db.insert(restaurantsTable).values({
        owner_id: userResult[0].id,
        name: 'Already Active Restaurant',
        description: 'Already active',
        address: '123 Main Street',
        phone: '+91-9876543210',
        is_active: true
      }).returning().execute();

      const restaurantId = restaurantResult[0].id;

      const result = await activateRestaurant(restaurantId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(restaurantId);
      expect(result!.is_active).toBe(true);
    });
  });
});