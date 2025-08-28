import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export async function registerUser(input: CreateUserInput): Promise<User> {
  try {
    // Hash the password using Bun's built-in hashing
    const passwordHash = await Bun.password.hash(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        name: input.name,
        phone: input.phone,
        role: input.role
      })
      .returning()
      .execute();

    const user = result[0];
    return user;
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}

export async function loginUser(input: LoginUserInput): Promise<User | null> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // Verify password using Bun's built-in verification
    const isPasswordValid = await Bun.password.verify(input.password, user.password_hash);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    return users[0];
  } catch (error) {
    console.error('Get user by ID failed:', error);
    throw error;
  }
}