import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginUserInput } from '../schema';
import { registerUser, loginUser, getUserById } from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Test input for user registration
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  phone: '+1234567890',
  role: 'customer'
};

// Test input for user login
const testLoginInput: LoginUserInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('auth handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('registerUser', () => {
    it('should register a new user', async () => {
      const result = await registerUser(testUserInput);

      // Basic field validation
      expect(result.email).toEqual('test@example.com');
      expect(result.name).toEqual('Test User');
      expect(result.phone).toEqual('+1234567890');
      expect(result.role).toEqual('customer');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Password should be hashed, not plain text
      expect(result.password_hash).toBeDefined();
      expect(result.password_hash).not.toEqual('password123');
    });

    it('should save user to database', async () => {
      const result = await registerUser(testUserInput);

      // Verify user exists in database
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].name).toEqual('Test User');
      expect(users[0].role).toEqual('customer');
      expect(users[0].password_hash).toBeDefined();
      expect(users[0].created_at).toBeInstanceOf(Date);
    });

    it('should hash the password', async () => {
      const result = await registerUser(testUserInput);

      // Password hash should be different from plain text
      expect(result.password_hash).not.toEqual('password123');
      expect(result.password_hash.length).toBeGreaterThan(20);

      // Verify password can be verified with Bun's password verification
      const isValid = await Bun.password.verify('password123', result.password_hash);
      expect(isValid).toBe(true);

      const isInvalid = await Bun.password.verify('wrongpassword', result.password_hash);
      expect(isInvalid).toBe(false);
    });

    it('should handle nullable phone field', async () => {
      const inputWithoutPhone: CreateUserInput = {
        ...testUserInput,
        phone: null
      };

      const result = await registerUser(inputWithoutPhone);

      expect(result.phone).toBeNull();
      expect(result.email).toEqual('test@example.com');
    });

    it('should handle different user roles', async () => {
      const restaurantOwnerInput: CreateUserInput = {
        ...testUserInput,
        email: 'owner@restaurant.com',
        role: 'restaurant_owner'
      };

      const result = await registerUser(restaurantOwnerInput);

      expect(result.role).toEqual('restaurant_owner');
      expect(result.email).toEqual('owner@restaurant.com');
    });

    it('should throw error for duplicate email', async () => {
      // Register first user
      await registerUser(testUserInput);

      // Try to register with same email
      const duplicateInput: CreateUserInput = {
        ...testUserInput,
        name: 'Different Name'
      };

      await expect(registerUser(duplicateInput)).rejects.toThrow();
    });
  });

  describe('loginUser', () => {
    it('should login with valid credentials', async () => {
      // First register a user
      const registeredUser = await registerUser(testUserInput);

      // Then try to login
      const result = await loginUser(testLoginInput);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(registeredUser.id);
      expect(result!.email).toEqual('test@example.com');
      expect(result!.name).toEqual('Test User');
      expect(result!.role).toEqual('customer');
    });

    it('should return null for invalid email', async () => {
      const invalidEmailInput: LoginUserInput = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const result = await loginUser(invalidEmailInput);

      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      // Register a user first
      await registerUser(testUserInput);

      const invalidPasswordInput: LoginUserInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const result = await loginUser(invalidPasswordInput);

      expect(result).toBeNull();
    });

    it('should return null when no users exist', async () => {
      const result = await loginUser(testLoginInput);

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user by valid ID', async () => {
      // Register a user first
      const registeredUser = await registerUser(testUserInput);

      const result = await getUserById(registeredUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(registeredUser.id);
      expect(result!.email).toEqual('test@example.com');
      expect(result!.name).toEqual('Test User');
      expect(result!.role).toEqual('customer');
    });

    it('should return null for invalid ID', async () => {
      const result = await getUserById(99999);

      expect(result).toBeNull();
    });

    it('should return null when no users exist', async () => {
      const result = await getUserById(1);

      expect(result).toBeNull();
    });

    it('should return correct user when multiple users exist', async () => {
      // Register multiple users
      const user1 = await registerUser(testUserInput);
      const user2 = await registerUser({
        ...testUserInput,
        email: 'user2@example.com',
        name: 'User Two'
      });

      // Get each user by ID
      const result1 = await getUserById(user1.id);
      const result2 = await getUserById(user2.id);

      expect(result1!.email).toEqual('test@example.com');
      expect(result1!.name).toEqual('Test User');
      
      expect(result2!.email).toEqual('user2@example.com');
      expect(result2!.name).toEqual('User Two');
    });
  });
});