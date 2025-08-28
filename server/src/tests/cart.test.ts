import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable, menuItemsTable, cartsTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput } from '../schema';
import { 
  addToCart, 
  getUserCart, 
  getCartItems, 
  removeFromCart, 
  updateCartItemQuantity, 
  clearCart 
} from '../handlers/cart';
import { eq } from 'drizzle-orm';

describe('Cart Handlers', () => {
  let testUserId: number;
  let testRestaurantId: number;
  let testMenuItemId: number;
  let testMenuItemId2: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User',
        phone: '+1234567890',
        role: 'customer'
      })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create test restaurant owner
    const owner = await db.insert(usersTable)
      .values({
        email: 'owner@example.com',
        password_hash: 'hashed_password',
        name: 'Restaurant Owner',
        phone: '+1234567891',
        role: 'restaurant_owner'
      })
      .returning()
      .execute();

    // Create test restaurant
    const restaurant = await db.insert(restaurantsTable)
      .values({
        owner_id: owner[0].id,
        name: 'Test Restaurant',
        description: 'A test restaurant',
        address: '123 Test Street',
        phone: '+1234567892',
        image_url: 'https://example.com/image.jpg'
      })
      .returning()
      .execute();
    testRestaurantId = restaurant[0].id;

    // Create test menu items
    const menuItem1 = await db.insert(menuItemsTable)
      .values({
        restaurant_id: testRestaurantId,
        name: 'Test Pizza',
        description: 'Delicious test pizza',
        price: '19.99',
        category: 'Main Course'
      })
      .returning()
      .execute();
    testMenuItemId = menuItem1[0].id;

    const menuItem2 = await db.insert(menuItemsTable)
      .values({
        restaurant_id: testRestaurantId,
        name: 'Test Burger',
        description: 'Tasty test burger',
        price: '15.99',
        category: 'Main Course'
      })
      .returning()
      .execute();
    testMenuItemId2 = menuItem2[0].id;
  });

  afterEach(resetDB);

  describe('addToCart', () => {
    const testInput: AddToCartInput = {
      user_id: 0, // Will be set in tests
      restaurant_id: 0, // Will be set in tests
      menu_item_id: 0, // Will be set in tests
      quantity: 2
    };

    it('should add item to new cart', async () => {
      const input = {
        ...testInput,
        user_id: testUserId,
        restaurant_id: testRestaurantId,
        menu_item_id: testMenuItemId
      };

      const result = await addToCart(input);

      expect(result.menu_item_id).toEqual(testMenuItemId);
      expect(result.quantity).toEqual(2);
      expect(result.id).toBeDefined();
      expect(result.cart_id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify cart was created
      const cart = await db.select()
        .from(cartsTable)
        .where(eq(cartsTable.id, result.cart_id))
        .execute();

      expect(cart).toHaveLength(1);
      expect(cart[0].user_id).toEqual(testUserId);
      expect(cart[0].restaurant_id).toEqual(testRestaurantId);
    });

    it('should add item to existing cart', async () => {
      // First, create a cart
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      const input = {
        ...testInput,
        user_id: testUserId,
        restaurant_id: testRestaurantId,
        menu_item_id: testMenuItemId
      };

      const result = await addToCart(input);

      expect(result.cart_id).toEqual(cart[0].id);
      expect(result.menu_item_id).toEqual(testMenuItemId);
      expect(result.quantity).toEqual(2);
    });

    it('should update quantity if item already exists in cart', async () => {
      const input = {
        ...testInput,
        user_id: testUserId,
        restaurant_id: testRestaurantId,
        menu_item_id: testMenuItemId,
        quantity: 3
      };

      // Add item first time
      await addToCart(input);

      // Add same item again
      const secondInput = { ...input, quantity: 2 };
      const result = await addToCart(secondInput);

      expect(result.quantity).toEqual(5); // 3 + 2
      expect(result.menu_item_id).toEqual(testMenuItemId);

      // Verify only one cart item exists
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.menu_item_id, testMenuItemId))
        .execute();

      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].quantity).toEqual(5);
    });

    it('should throw error for non-existent user', async () => {
      const input = {
        ...testInput,
        user_id: 99999,
        restaurant_id: testRestaurantId,
        menu_item_id: testMenuItemId
      };

      await expect(addToCart(input)).rejects.toThrow(/User not found/i);
    });

    it('should throw error for non-existent restaurant', async () => {
      const input = {
        ...testInput,
        user_id: testUserId,
        restaurant_id: 99999,
        menu_item_id: testMenuItemId
      };

      await expect(addToCart(input)).rejects.toThrow(/Restaurant not found/i);
    });

    it('should throw error for non-existent menu item', async () => {
      const input = {
        ...testInput,
        user_id: testUserId,
        restaurant_id: testRestaurantId,
        menu_item_id: 99999
      };

      await expect(addToCart(input)).rejects.toThrow(/Menu item not found/i);
    });

    it('should throw error if menu item does not belong to restaurant', async () => {
      // Create another restaurant
      const owner2 = await db.insert(usersTable)
        .values({
          email: 'owner2@example.com',
          password_hash: 'hashed_password',
          name: 'Restaurant Owner 2',
          phone: '+1234567893',
          role: 'restaurant_owner'
        })
        .returning()
        .execute();

      const restaurant2 = await db.insert(restaurantsTable)
        .values({
          owner_id: owner2[0].id,
          name: 'Test Restaurant 2',
          description: 'Another test restaurant',
          address: '456 Test Avenue',
          phone: '+1234567894'
        })
        .returning()
        .execute();

      const input = {
        ...testInput,
        user_id: testUserId,
        restaurant_id: restaurant2[0].id,
        menu_item_id: testMenuItemId // This belongs to testRestaurantId, not restaurant2
      };

      await expect(addToCart(input)).rejects.toThrow(/Menu item not found or does not belong to this restaurant/i);
    });
  });

  describe('getUserCart', () => {
    it('should return user cart for restaurant', async () => {
      // Create a cart
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      const result = await getUserCart(testUserId, testRestaurantId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(cart[0].id);
      expect(result!.user_id).toEqual(testUserId);
      expect(result!.restaurant_id).toEqual(testRestaurantId);
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });

    it('should return null if no cart exists', async () => {
      const result = await getUserCart(testUserId, testRestaurantId);
      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const result = await getUserCart(99999, testRestaurantId);
      expect(result).toBeNull();
    });
  });

  describe('getCartItems', () => {
    it('should return all items in cart', async () => {
      // Create a cart
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      // Add cart items
      await db.insert(cartItemsTable)
        .values([
          {
            cart_id: cart[0].id,
            menu_item_id: testMenuItemId,
            quantity: 2
          },
          {
            cart_id: cart[0].id,
            menu_item_id: testMenuItemId2,
            quantity: 1
          }
        ])
        .execute();

      const result = await getCartItems(cart[0].id);

      expect(result).toHaveLength(2);
      expect(result[0].cart_id).toEqual(cart[0].id);
      expect(result[0].menu_item_id).toEqual(testMenuItemId);
      expect(result[0].quantity).toEqual(2);
      expect(result[1].menu_item_id).toEqual(testMenuItemId2);
      expect(result[1].quantity).toEqual(1);
    });

    it('should return empty array for cart with no items', async () => {
      // Create empty cart
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      const result = await getCartItems(cart[0].id);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for non-existent cart', async () => {
      const result = await getCartItems(99999);
      expect(result).toHaveLength(0);
    });
  });

  describe('removeFromCart', () => {
    it('should remove cart item successfully', async () => {
      // Create cart and cart item
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      const cartItem = await db.insert(cartItemsTable)
        .values({
          cart_id: cart[0].id,
          menu_item_id: testMenuItemId,
          quantity: 2
        })
        .returning()
        .execute();

      const result = await removeFromCart(cartItem[0].id);

      expect(result).toBe(true);

      // Verify item was removed
      const remainingItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItem[0].id))
        .execute();

      expect(remainingItems).toHaveLength(0);
    });

    it('should return false for non-existent cart item', async () => {
      const result = await removeFromCart(99999);
      expect(result).toBe(false);
    });
  });

  describe('updateCartItemQuantity', () => {
    it('should update cart item quantity', async () => {
      // Create cart and cart item
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      const cartItem = await db.insert(cartItemsTable)
        .values({
          cart_id: cart[0].id,
          menu_item_id: testMenuItemId,
          quantity: 2
        })
        .returning()
        .execute();

      const result = await updateCartItemQuantity(cartItem[0].id, 5);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(cartItem[0].id);
      expect(result!.quantity).toEqual(5);

      // Verify in database
      const updatedItem = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItem[0].id))
        .execute();

      expect(updatedItem[0].quantity).toEqual(5);
    });

    it('should remove item when quantity is zero', async () => {
      // Create cart and cart item
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      const cartItem = await db.insert(cartItemsTable)
        .values({
          cart_id: cart[0].id,
          menu_item_id: testMenuItemId,
          quantity: 2
        })
        .returning()
        .execute();

      const result = await updateCartItemQuantity(cartItem[0].id, 0);

      expect(result).toBeNull();

      // Verify item was removed
      const remainingItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItem[0].id))
        .execute();

      expect(remainingItems).toHaveLength(0);
    });

    it('should remove item when quantity is negative', async () => {
      // Create cart and cart item
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      const cartItem = await db.insert(cartItemsTable)
        .values({
          cart_id: cart[0].id,
          menu_item_id: testMenuItemId,
          quantity: 2
        })
        .returning()
        .execute();

      const result = await updateCartItemQuantity(cartItem[0].id, -1);

      expect(result).toBeNull();

      // Verify item was removed
      const remainingItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItem[0].id))
        .execute();

      expect(remainingItems).toHaveLength(0);
    });

    it('should return null for non-existent cart item', async () => {
      const result = await updateCartItemQuantity(99999, 5);
      expect(result).toBeNull();
    });
  });

  describe('clearCart', () => {
    it('should remove all items from cart', async () => {
      // Create cart with multiple items
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      await db.insert(cartItemsTable)
        .values([
          {
            cart_id: cart[0].id,
            menu_item_id: testMenuItemId,
            quantity: 2
          },
          {
            cart_id: cart[0].id,
            menu_item_id: testMenuItemId2,
            quantity: 1
          }
        ])
        .execute();

      const result = await clearCart(cart[0].id);

      expect(result).toBe(true);

      // Verify all items were removed
      const remainingItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.cart_id, cart[0].id))
        .execute();

      expect(remainingItems).toHaveLength(0);
    });

    it('should return true even for empty cart', async () => {
      // Create empty cart
      const cart = await db.insert(cartsTable)
        .values({
          user_id: testUserId,
          restaurant_id: testRestaurantId
        })
        .returning()
        .execute();

      const result = await clearCart(cart[0].id);
      expect(result).toBe(true);
    });

    it('should return true even for non-existent cart', async () => {
      const result = await clearCart(99999);
      expect(result).toBe(true);
    });
  });
});