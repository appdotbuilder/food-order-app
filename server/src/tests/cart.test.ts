import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable, menuCategoriesTable, menuItemsTable, menuItemOptionsTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput, type UpdateCartItemInput } from '../schema';
import { addToCart, getUserCart, updateCartItem, removeFromCart, clearUserCart } from '../handlers/cart';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'User',
  phone: '123-456-7890',
  role: 'customer' as const
};

const testOwner = {
  email: 'owner@example.com',
  password_hash: 'hashed_password',
  first_name: 'Restaurant',
  last_name: 'Owner',
  phone: '098-765-4321',
  role: 'restaurant_owner' as const
};

const testRestaurant = {
  name: 'Test Restaurant',
  description: 'A test restaurant',
  address: '123 Test St',
  phone: '555-0123',
  email: 'restaurant@test.com',
  opening_hours: '9:00-22:00',
  is_active: true
};

const testCategory = {
  name: 'Test Category',
  description: 'A test category',
  sort_order: 1,
  is_active: true
};

const testMenuItem = {
  name: 'Test Item',
  description: 'A test menu item',
  price: '12.99',
  image_url: null,
  is_available: true,
  sort_order: 1
};

const testOption1 = {
  name: 'Extra Cheese',
  price_modifier: '2.50',
  is_required: false,
  sort_order: 1
};

const testOption2 = {
  name: 'Large Size',
  price_modifier: '3.00',
  is_required: false,
  sort_order: 2
};

describe('Cart handlers', () => {
  let userId: number;
  let ownerId: number;
  let restaurantId: number;
  let categoryId: number;
  let menuItemId: number;
  let option1Id: number;
  let option2Id: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test owner
    const ownerResult = await db.insert(usersTable)
      .values(testOwner)
      .returning()
      .execute();
    ownerId = ownerResult[0].id;

    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        ...testRestaurant,
        owner_id: ownerId
      })
      .returning()
      .execute();
    restaurantId = restaurantResult[0].id;

    // Create test category
    const categoryResult = await db.insert(menuCategoriesTable)
      .values({
        ...testCategory,
        restaurant_id: restaurantId
      })
      .returning()
      .execute();
    categoryId = categoryResult[0].id;

    // Create test menu item
    const menuItemResult = await db.insert(menuItemsTable)
      .values({
        ...testMenuItem,
        restaurant_id: restaurantId,
        category_id: categoryId
      })
      .returning()
      .execute();
    menuItemId = menuItemResult[0].id;

    // Create test options
    const option1Result = await db.insert(menuItemOptionsTable)
      .values({
        ...testOption1,
        menu_item_id: menuItemId
      })
      .returning()
      .execute();
    option1Id = option1Result[0].id;

    const option2Result = await db.insert(menuItemOptionsTable)
      .values({
        ...testOption2,
        menu_item_id: menuItemId
      })
      .returning()
      .execute();
    option2Id = option2Result[0].id;
  });

  afterEach(resetDB);

  describe('addToCart', () => {
    it('should add item to cart without options', async () => {
      const input: AddToCartInput = {
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 2
      };

      const result = await addToCart(input);

      expect(result.user_id).toEqual(userId);
      expect(result.menu_item_id).toEqual(menuItemId);
      expect(result.quantity).toEqual(2);
      expect(result.selected_options).toBeNull();
      expect(result.total_price).toEqual(25.98); // 12.99 * 2
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should add item to cart with options', async () => {
      const input: AddToCartInput = {
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 1,
        selected_options: [option1Id, option2Id]
      };

      const result = await addToCart(input);

      expect(result.user_id).toEqual(userId);
      expect(result.menu_item_id).toEqual(menuItemId);
      expect(result.quantity).toEqual(1);
      expect(result.selected_options).toEqual([option1Id, option2Id]);
      expect(result.total_price).toEqual(18.49); // 12.99 + 2.50 + 3.00
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should calculate correct total price with quantity and options', async () => {
      const input: AddToCartInput = {
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 3,
        selected_options: [option1Id]
      };

      const result = await addToCart(input);

      expect(result.total_price).toEqual(46.47); // (12.99 + 2.50) * 3
    });

    it('should throw error for non-existent menu item', async () => {
      const input: AddToCartInput = {
        user_id: userId,
        menu_item_id: 99999,
        quantity: 1
      };

      await expect(addToCart(input)).rejects.toThrow(/menu item not found/i);
    });

    it('should save cart item to database', async () => {
      const input: AddToCartInput = {
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 1
      };

      const result = await addToCart(input);

      const savedItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, result.id))
        .execute();

      expect(savedItems).toHaveLength(1);
      expect(savedItems[0].user_id).toEqual(userId);
      expect(savedItems[0].menu_item_id).toEqual(menuItemId);
      expect(parseFloat(savedItems[0].total_price)).toEqual(12.99);
    });
  });

  describe('getUserCart', () => {
    it('should return empty cart for user with no items', async () => {
      const result = await getUserCart(userId);
      expect(result).toEqual([]);
    });

    it('should return all cart items for user', async () => {
      // Add two items to cart
      await addToCart({
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 1
      });

      await addToCart({
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 2,
        selected_options: [option1Id]
      });

      const result = await getUserCart(userId);

      expect(result).toHaveLength(2);
      expect(result[0].user_id).toEqual(userId);
      expect(result[1].user_id).toEqual(userId);
      expect(typeof result[0].total_price).toBe('number');
      expect(typeof result[1].total_price).toBe('number');
    });

    it('should not return other users cart items', async () => {
      // Create another user
      const anotherUser = await db.insert(usersTable)
        .values({
          ...testUser,
          email: 'another@example.com'
        })
        .returning()
        .execute();

      // Add item to first user's cart
      await addToCart({
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 1
      });

      // Add item to second user's cart
      await addToCart({
        user_id: anotherUser[0].id,
        menu_item_id: menuItemId,
        quantity: 1
      });

      const firstUserCart = await getUserCart(userId);
      const secondUserCart = await getUserCart(anotherUser[0].id);

      expect(firstUserCart).toHaveLength(1);
      expect(secondUserCart).toHaveLength(1);
      expect(firstUserCart[0].user_id).toEqual(userId);
      expect(secondUserCart[0].user_id).toEqual(anotherUser[0].id);
    });
  });

  describe('updateCartItem', () => {
    let cartItemId: number;

    beforeEach(async () => {
      const cartItem = await addToCart({
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 1,
        selected_options: [option1Id]
      });
      cartItemId = cartItem.id;
    });

    it('should update cart item quantity', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 3
      };

      const result = await updateCartItem(input);

      expect(result.id).toEqual(cartItemId);
      expect(result.quantity).toEqual(3);
      expect(result.total_price).toEqual(46.47); // (12.99 + 2.50) * 3
      expect(result.selected_options).toEqual([option1Id]);
    });

    it('should update cart item options', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 1,
        selected_options: [option2Id]
      };

      const result = await updateCartItem(input);

      expect(result.id).toEqual(cartItemId);
      expect(result.quantity).toEqual(1);
      expect(result.total_price).toEqual(15.99); // 12.99 + 3.00
      expect(result.selected_options).toEqual([option2Id]);
    });

    it('should update cart item with both quantity and options', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 2,
        selected_options: [option1Id, option2Id]
      };

      const result = await updateCartItem(input);

      expect(result.quantity).toEqual(2);
      expect(result.total_price).toEqual(36.98); // (12.99 + 2.50 + 3.00) * 2
      expect(result.selected_options).toEqual([option1Id, option2Id]);
    });

    it('should update cart item to remove options', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 1,
        selected_options: []
      };

      const result = await updateCartItem(input);

      expect(result.total_price).toEqual(12.99); // Just base price
      expect(result.selected_options).toEqual([]);
    });

    it('should throw error for non-existent cart item', async () => {
      const input: UpdateCartItemInput = {
        id: 99999,
        quantity: 1
      };

      await expect(updateCartItem(input)).rejects.toThrow(/cart item not found/i);
    });

    it('should save updated cart item to database', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 5
      };

      await updateCartItem(input);

      const savedItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemId))
        .execute();

      expect(savedItems).toHaveLength(1);
      expect(savedItems[0].quantity).toEqual(5);
      expect(parseFloat(savedItems[0].total_price)).toEqual(77.45); // (12.99 + 2.50) * 5
    });
  });

  describe('removeFromCart', () => {
    let cartItemId: number;

    beforeEach(async () => {
      const cartItem = await addToCart({
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 1
      });
      cartItemId = cartItem.id;
    });

    it('should remove cart item successfully', async () => {
      const result = await removeFromCart(cartItemId);
      expect(result).toBe(true);

      const remainingItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemId))
        .execute();

      expect(remainingItems).toHaveLength(0);
    });

    it('should return true even for non-existent cart item', async () => {
      const result = await removeFromCart(99999);
      expect(result).toBe(true);
    });

    it('should only remove specified cart item', async () => {
      // Add another cart item
      const secondCartItem = await addToCart({
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 2
      });

      await removeFromCart(cartItemId);

      const remainingItems = await getUserCart(userId);
      expect(remainingItems).toHaveLength(1);
      expect(remainingItems[0].id).toEqual(secondCartItem.id);
    });
  });

  describe('clearUserCart', () => {
    beforeEach(async () => {
      // Add multiple items to cart
      await addToCart({
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 1
      });

      await addToCart({
        user_id: userId,
        menu_item_id: menuItemId,
        quantity: 2
      });
    });

    it('should clear all user cart items', async () => {
      const cartBefore = await getUserCart(userId);
      expect(cartBefore).toHaveLength(2);

      const result = await clearUserCart(userId);
      expect(result).toBe(true);

      const cartAfter = await getUserCart(userId);
      expect(cartAfter).toHaveLength(0);
    });

    it('should not affect other users carts', async () => {
      // Create another user with cart items
      const anotherUser = await db.insert(usersTable)
        .values({
          ...testUser,
          email: 'another@example.com'
        })
        .returning()
        .execute();

      await addToCart({
        user_id: anotherUser[0].id,
        menu_item_id: menuItemId,
        quantity: 1
      });

      await clearUserCart(userId);

      const firstUserCart = await getUserCart(userId);
      const secondUserCart = await getUserCart(anotherUser[0].id);

      expect(firstUserCart).toHaveLength(0);
      expect(secondUserCart).toHaveLength(1);
    });

    it('should return true even for user with no cart items', async () => {
      await clearUserCart(userId);
      const result = await clearUserCart(userId);
      expect(result).toBe(true);
    });
  });
});