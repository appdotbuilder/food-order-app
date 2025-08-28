import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { registerUser, loginUser, getCurrentUser } from '../handlers/auth';
import { eq } from 'drizzle-orm';

const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'securepassword123',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  role: 'customer'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'securepassword123'
};

describe('Auth handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('registerUser', () => {
    it('should create a new user successfully', async () => {
      const result = await registerUser(testUserInput);

      // Verify returned user data
      expect(result.email).toEqual('test@example.com');
      expect(result.first_name).toEqual('John');
      expect(result.last_name).toEqual('Doe');
      expect(result.phone).toEqual('+1234567890');
      expect(result.role).toEqual('customer');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.password_hash).toBeDefined(); // Hash should exist but not be exposed in real app
    });

    it('should save user to database with hashed password', async () => {
      const result = await registerUser(testUserInput);

      // Query database directly
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      const dbUser = users[0];
      expect(dbUser.email).toEqual('test@example.com');
      expect(dbUser.first_name).toEqual('John');
      expect(dbUser.last_name).toEqual('Doe');
      expect(dbUser.phone).toEqual('+1234567890');
      expect(dbUser.role).toEqual('customer');
      expect(dbUser.password_hash).not.toEqual('securepassword123'); // Should be hashed
      expect(dbUser.password_hash.length).toBeGreaterThan(20); // Hashed password should be longer
    });

    it('should create user without phone number', async () => {
      const inputWithoutPhone: CreateUserInput = {
        ...testUserInput,
        phone: null
      };

      const result = await registerUser(inputWithoutPhone);

      expect(result.phone).toBeNull();
      expect(result.email).toEqual('test@example.com');
      expect(result.first_name).toEqual('John');
    });

    it('should create restaurant owner', async () => {
      const ownerInput: CreateUserInput = {
        ...testUserInput,
        email: 'owner@restaurant.com',
        role: 'restaurant_owner'
      };

      const result = await registerUser(ownerInput);

      expect(result.role).toEqual('restaurant_owner');
      expect(result.email).toEqual('owner@restaurant.com');
    });

    it('should create admin user', async () => {
      const adminInput: CreateUserInput = {
        ...testUserInput,
        email: 'admin@system.com',
        role: 'admin'
      };

      const result = await registerUser(adminInput);

      expect(result.role).toEqual('admin');
      expect(result.email).toEqual('admin@system.com');
    });

    it('should throw error for duplicate email', async () => {
      // Create first user
      await registerUser(testUserInput);

      // Try to create second user with same email
      const duplicateInput: CreateUserInput = {
        ...testUserInput,
        first_name: 'Jane'
      };

      await expect(registerUser(duplicateInput)).rejects.toThrow(/already exists/i);
    });
  });

  describe('loginUser', () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await registerUser(testUserInput);
    });

    it('should login user with correct credentials', async () => {
      const result = await loginUser(testLoginInput);

      // Verify user data
      expect(result.user.email).toEqual('test@example.com');
      expect(result.user.first_name).toEqual('John');
      expect(result.user.last_name).toEqual('Doe');
      expect(result.user.role).toEqual('customer');
      expect(result.user.id).toBeDefined();

      // Verify token
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('should generate valid token structure', async () => {
      const result = await loginUser(testLoginInput);

      // Decode token to verify structure (simple base64 decoding for this implementation)
      const decoded = JSON.parse(Buffer.from(result.token, 'base64').toString());
      
      expect(decoded.userId).toEqual(result.user.id);
      expect(decoded.exp).toBeGreaterThan(Date.now());
    });

    it('should throw error for non-existent email', async () => {
      const invalidInput: LoginInput = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await expect(loginUser(invalidInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for wrong password', async () => {
      const wrongPasswordInput: LoginInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(loginUser(wrongPasswordInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should login different user roles', async () => {
      // Create restaurant owner
      const ownerInput: CreateUserInput = {
        email: 'owner@restaurant.com',
        password: 'ownerpass123',
        first_name: 'Restaurant',
        last_name: 'Owner',
        phone: null,
        role: 'restaurant_owner'
      };
      await registerUser(ownerInput);

      const ownerLogin: LoginInput = {
        email: 'owner@restaurant.com',
        password: 'ownerpass123'
      };

      const result = await loginUser(ownerLogin);
      expect(result.user.role).toEqual('restaurant_owner');
      expect(result.user.email).toEqual('owner@restaurant.com');
      expect(result.token).toBeDefined();
    });
  });

  describe('getCurrentUser', () => {
    let testUserId: number;

    beforeEach(async () => {
      // Create a test user and store the ID
      const user = await registerUser(testUserInput);
      testUserId = user.id;
    });

    it('should return user by ID', async () => {
      const result = await getCurrentUser(testUserId);

      expect(result.id).toEqual(testUserId);
      expect(result.email).toEqual('test@example.com');
      expect(result.first_name).toEqual('John');
      expect(result.last_name).toEqual('Doe');
      expect(result.phone).toEqual('+1234567890');
      expect(result.role).toEqual('customer');
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should return user with null phone', async () => {
      // Create user without phone
      const userInput: CreateUserInput = {
        ...testUserInput,
        email: 'nophone@example.com',
        phone: null
      };
      const user = await registerUser(userInput);

      const result = await getCurrentUser(user.id);

      expect(result.phone).toBeNull();
      expect(result.email).toEqual('nophone@example.com');
    });

    it('should throw error for non-existent user ID', async () => {
      const nonExistentId = 99999;

      await expect(getCurrentUser(nonExistentId)).rejects.toThrow(/user not found/i);
    });

    it('should handle different user roles correctly', async () => {
      // Create admin user
      const adminInput: CreateUserInput = {
        email: 'admin@system.com',
        password: 'adminpass123',
        first_name: 'System',
        last_name: 'Admin',
        phone: null,
        role: 'admin'
      };
      const adminUser = await registerUser(adminInput);

      const result = await getCurrentUser(adminUser.id);

      expect(result.role).toEqual('admin');
      expect(result.first_name).toEqual('System');
      expect(result.last_name).toEqual('Admin');
    });
  });

  describe('password security', () => {
    it('should not store plain text passwords', async () => {
      const user = await registerUser(testUserInput);

      // Check database directly
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .execute();

      const dbUser = dbUsers[0];
      expect(dbUser.password_hash).not.toEqual('securepassword123');
      expect(dbUser.password_hash).not.toContain('securepassword123');
    });

    it('should verify correct password during login', async () => {
      await registerUser(testUserInput);

      // This should work (correct password)
      const result = await loginUser(testLoginInput);
      expect(result.user.email).toEqual('test@example.com');

      // This should fail (wrong password)
      const wrongInput: LoginInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };
      
      await expect(loginUser(wrongInput)).rejects.toThrow(/invalid email or password/i);
    });
  });
});