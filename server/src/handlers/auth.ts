import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

// Simple password hashing using Bun's built-in crypto
const hashPassword = async (password: string): Promise<string> => {
  return await Bun.password.hash(password);
};

const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await Bun.password.verify(password, hashedPassword);
};

// Simple JWT token generation (in production, use a proper JWT library)
const generateToken = (userId: number): string => {
  const payload = { userId, exp: Date.now() + (24 * 60 * 60 * 1000) }; // 24 hours
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

export const registerUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .limit(1)
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash the password
    const passwordHash = await hashPassword(input.password);

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone,
        role: input.role
      })
      .returning()
      .execute();

    const user = result[0];
    
    // Return user without password hash
    return {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash, // Required by schema but shouldn't be exposed
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
};

export const loginUser = async (input: LoginInput): Promise<{ user: User; token: string }> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .limit(1)
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash, // Required by schema but shouldn't be exposed
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
};

export const getCurrentUser = async (userId: number): Promise<User> => {
  try {
    // Find user by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    
    return {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash, // Required by schema but shouldn't be exposed
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
};