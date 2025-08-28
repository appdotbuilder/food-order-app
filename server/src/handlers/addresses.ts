import { db } from '../db';
import { addressesTable, usersTable } from '../db/schema';
import { type CreateAddressInput, type Address } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createAddress(input: CreateAddressInput): Promise<Address> {
  try {
    // Verify that the user exists
    const userExists = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with ID ${input.user_id} does not exist`);
    }

    // If this is set as default, update other addresses to not be default
    if (input.is_default) {
      await db.update(addressesTable)
        .set({ is_default: false })
        .where(eq(addressesTable.user_id, input.user_id))
        .execute();
    }

    // Insert the new address
    const result = await db.insert(addressesTable)
      .values({
        user_id: input.user_id,
        street_address: input.street_address,
        city: input.city,
        state: input.state,
        postal_code: input.postal_code,
        country: input.country,
        is_default: input.is_default || false
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Address creation failed:', error);
    throw error;
  }
}

export async function getUserAddresses(userId: number): Promise<Address[]> {
  try {
    // Verify that the user exists
    const userExists = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with ID ${userId} does not exist`);
    }

    const addresses = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.user_id, userId))
      .execute();

    return addresses;
  } catch (error) {
    console.error('Failed to get user addresses:', error);
    throw error;
  }
}

export async function updateAddress(id: number, input: Partial<CreateAddressInput>): Promise<Address> {
  try {
    // Check if address exists
    const existingAddress = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.id, id))
      .execute();

    if (existingAddress.length === 0) {
      throw new Error(`Address with ID ${id} does not exist`);
    }

    const currentAddress = existingAddress[0];

    // If setting as default, update other addresses for this user
    if (input.is_default) {
      await db.update(addressesTable)
        .set({ is_default: false })
        .where(eq(addressesTable.user_id, currentAddress.user_id))
        .execute();
    }

    // Update the address with provided fields
    const updateData: Partial<typeof addressesTable.$inferInsert> = {};
    
    if (input.street_address !== undefined) updateData.street_address = input.street_address;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.postal_code !== undefined) updateData.postal_code = input.postal_code;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.is_default !== undefined) updateData.is_default = input.is_default;

    const result = await db.update(addressesTable)
      .set(updateData)
      .where(eq(addressesTable.id, id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Address update failed:', error);
    throw error;
  }
}

export async function deleteAddress(id: number): Promise<boolean> {
  try {
    // Check if address exists
    const existingAddress = await db.select()
      .from(addressesTable)
      .where(eq(addressesTable.id, id))
      .execute();

    if (existingAddress.length === 0) {
      throw new Error(`Address with ID ${id} does not exist`);
    }

    await db.delete(addressesTable)
      .where(eq(addressesTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Address deletion failed:', error);
    throw error;
  }
}