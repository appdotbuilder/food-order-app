import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { addressesTable, usersTable } from '../db/schema';
import { type CreateAddressInput } from '../schema';
import { createAddress, getUserAddresses, updateAddress, deleteAddress } from '../handlers/addresses';
import { eq } from 'drizzle-orm';

// Test user and address data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'User',
  phone: '123-456-7890',
  role: 'customer' as const
};

const testAddressInput: CreateAddressInput = {
  user_id: 1,
  street_address: '123 Main St',
  city: 'New York',
  state: 'NY',
  postal_code: '10001',
  country: 'USA',
  is_default: true
};

const testAddressInput2: CreateAddressInput = {
  user_id: 1,
  street_address: '456 Oak Ave',
  city: 'Los Angeles',
  state: 'CA',
  postal_code: '90210',
  country: 'USA',
  is_default: false
};

describe('createAddress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an address successfully', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;
    const input = { ...testAddressInput, user_id: userId };

    const result = await createAddress(input);

    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userId);
    expect(result.street_address).toEqual('123 Main St');
    expect(result.city).toEqual('New York');
    expect(result.state).toEqual('NY');
    expect(result.postal_code).toEqual('10001');
    expect(result.country).toEqual('USA');
    expect(result.is_default).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save address to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;
    const input = { ...testAddressInput, user_id: userId };

    const result = await createAddress(input);

    const addresses = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.id, result.id))
      .execute();

    expect(addresses).toHaveLength(1);
    expect(addresses[0].street_address).toEqual('123 Main St');
    expect(addresses[0].city).toEqual('New York');
    expect(addresses[0].is_default).toBe(true);
  });

  it('should handle default address logic correctly', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create first default address
    const input1 = { ...testAddressInput, user_id: userId, is_default: true };
    const result1 = await createAddress(input1);

    // Create second default address
    const input2 = { ...testAddressInput2, user_id: userId, is_default: true };
    const result2 = await createAddress(input2);

    // Check that only the second address is default
    const addresses = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.user_id, userId))
      .execute();

    const firstAddress = addresses.find(addr => addr.id === result1.id);
    const secondAddress = addresses.find(addr => addr.id === result2.id);

    expect(firstAddress?.is_default).toBe(false);
    expect(secondAddress?.is_default).toBe(true);
  });

  it('should throw error for non-existent user', async () => {
    const input = { ...testAddressInput, user_id: 999 };

    expect(createAddress(input)).rejects.toThrow(/User with ID 999 does not exist/i);
  });

  it('should use default value for is_default when not provided', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;
    const input = { ...testAddressInput, user_id: userId };
    delete input.is_default; // Remove is_default to test default value

    const result = await createAddress(input);

    expect(result.is_default).toBe(false);
  });
});

describe('getUserAddresses', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all addresses for a user', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple addresses
    const input1 = { ...testAddressInput, user_id: userId };
    const input2 = { ...testAddressInput2, user_id: userId };

    await createAddress(input1);
    await createAddress(input2);

    const addresses = await getUserAddresses(userId);

    expect(addresses).toHaveLength(2);
    expect(addresses[0].user_id).toEqual(userId);
    expect(addresses[1].user_id).toEqual(userId);
  });

  it('should return empty array for user with no addresses', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    const addresses = await getUserAddresses(userId);

    expect(addresses).toHaveLength(0);
  });

  it('should throw error for non-existent user', async () => {
    expect(getUserAddresses(999)).rejects.toThrow(/User with ID 999 does not exist/i);
  });

  it('should only return addresses for the specified user', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'user2@example.com'
      })
      .returning()
      .execute();

    const userId1 = user1Result[0].id;
    const userId2 = user2Result[0].id;

    // Create addresses for both users
    await createAddress({ ...testAddressInput, user_id: userId1 });
    await createAddress({ ...testAddressInput2, user_id: userId2 });

    const user1Addresses = await getUserAddresses(userId1);
    const user2Addresses = await getUserAddresses(userId2);

    expect(user1Addresses).toHaveLength(1);
    expect(user2Addresses).toHaveLength(1);
    expect(user1Addresses[0].user_id).toEqual(userId1);
    expect(user2Addresses[0].user_id).toEqual(userId2);
  });
});

describe('updateAddress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update address fields successfully', async () => {
    // Create test user and address
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;
    const input = { ...testAddressInput, user_id: userId };
    const createdAddress = await createAddress(input);

    // Update the address
    const updateData = {
      street_address: '789 Updated St',
      city: 'Updated City',
      postal_code: '54321'
    };

    const result = await updateAddress(createdAddress.id, updateData);

    expect(result.id).toEqual(createdAddress.id);
    expect(result.street_address).toEqual('789 Updated St');
    expect(result.city).toEqual('Updated City');
    expect(result.postal_code).toEqual('54321');
    expect(result.state).toEqual('NY'); // Unchanged field
    expect(result.country).toEqual('USA'); // Unchanged field
  });

  it('should handle default address logic on update', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create two addresses
    const input1 = { ...testAddressInput, user_id: userId, is_default: true };
    const input2 = { ...testAddressInput2, user_id: userId, is_default: false };

    const address1 = await createAddress(input1);
    const address2 = await createAddress(input2);

    // Update second address to be default
    await updateAddress(address2.id, { is_default: true });

    // Check that only the second address is default
    const addresses = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.user_id, userId))
      .execute();

    const firstAddress = addresses.find(addr => addr.id === address1.id);
    const secondAddress = addresses.find(addr => addr.id === address2.id);

    expect(firstAddress?.is_default).toBe(false);
    expect(secondAddress?.is_default).toBe(true);
  });

  it('should throw error for non-existent address', async () => {
    const updateData = { city: 'New City' };

    expect(updateAddress(999, updateData)).rejects.toThrow(/Address with ID 999 does not exist/i);
  });

  it('should persist updated data in database', async () => {
    // Create test user and address
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;
    const input = { ...testAddressInput, user_id: userId };
    const createdAddress = await createAddress(input);

    const updateData = { city: 'Updated City' };
    await updateAddress(createdAddress.id, updateData);

    // Verify in database
    const addresses = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.id, createdAddress.id))
      .execute();

    expect(addresses[0].city).toEqual('Updated City');
  });
});

describe('deleteAddress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete address successfully', async () => {
    // Create test user and address
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;
    const input = { ...testAddressInput, user_id: userId };
    const createdAddress = await createAddress(input);

    const result = await deleteAddress(createdAddress.id);

    expect(result).toBe(true);

    // Verify address is deleted from database
    const addresses = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.id, createdAddress.id))
      .execute();

    expect(addresses).toHaveLength(0);
  });

  it('should throw error for non-existent address', async () => {
    expect(deleteAddress(999)).rejects.toThrow(/Address with ID 999 does not exist/i);
  });

  it('should not affect other addresses when deleting', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create two addresses
    const input1 = { ...testAddressInput, user_id: userId };
    const input2 = { ...testAddressInput2, user_id: userId };

    const address1 = await createAddress(input1);
    const address2 = await createAddress(input2);

    // Delete first address
    await deleteAddress(address1.id);

    // Verify second address still exists
    const remainingAddresses = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.user_id, userId))
      .execute();

    expect(remainingAddresses).toHaveLength(1);
    expect(remainingAddresses[0].id).toEqual(address2.id);
  });
});