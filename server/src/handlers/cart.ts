import { db } from '../db';
import { cartsTable, cartItemsTable, usersTable, restaurantsTable, menuItemsTable } from '../db/schema';
import { type AddToCartInput, type Cart, type CartItem } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function addToCart(input: AddToCartInput): Promise<CartItem> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify restaurant exists
    const restaurant = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, input.restaurant_id))
      .execute();

    if (restaurant.length === 0) {
      throw new Error('Restaurant not found');
    }

    // Verify menu item exists and belongs to the restaurant
    const menuItem = await db.select()
      .from(menuItemsTable)
      .where(
        and(
          eq(menuItemsTable.id, input.menu_item_id),
          eq(menuItemsTable.restaurant_id, input.restaurant_id)
        )
      )
      .execute();

    if (menuItem.length === 0) {
      throw new Error('Menu item not found or does not belong to this restaurant');
    }

    // Find or create cart for this user and restaurant
    let cart = await db.select()
      .from(cartsTable)
      .where(
        and(
          eq(cartsTable.user_id, input.user_id),
          eq(cartsTable.restaurant_id, input.restaurant_id)
        )
      )
      .execute();

    if (cart.length === 0) {
      // Create new cart
      const newCart = await db.insert(cartsTable)
        .values({
          user_id: input.user_id,
          restaurant_id: input.restaurant_id
        })
        .returning()
        .execute();
      
      cart = newCart;
    }

    const cartId = cart[0].id;

    // Check if item already exists in cart
    const existingCartItem = await db.select()
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.cart_id, cartId),
          eq(cartItemsTable.menu_item_id, input.menu_item_id)
        )
      )
      .execute();

    if (existingCartItem.length > 0) {
      // Update existing cart item quantity
      const updatedCartItem = await db.update(cartItemsTable)
        .set({
          quantity: existingCartItem[0].quantity + input.quantity
        })
        .where(eq(cartItemsTable.id, existingCartItem[0].id))
        .returning()
        .execute();

      return updatedCartItem[0];
    } else {
      // Add new cart item
      const newCartItem = await db.insert(cartItemsTable)
        .values({
          cart_id: cartId,
          menu_item_id: input.menu_item_id,
          quantity: input.quantity
        })
        .returning()
        .execute();

      return newCartItem[0];
    }
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
}

export async function getUserCart(userId: number, restaurantId: number): Promise<Cart | null> {
  try {
    const cart = await db.select()
      .from(cartsTable)
      .where(
        and(
          eq(cartsTable.user_id, userId),
          eq(cartsTable.restaurant_id, restaurantId)
        )
      )
      .execute();

    return cart.length > 0 ? cart[0] : null;
  } catch (error) {
    console.error('Get user cart failed:', error);
    throw error;
  }
}

export async function getCartItems(cartId: number): Promise<CartItem[]> {
  try {
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cartId))
      .execute();

    return cartItems;
  } catch (error) {
    console.error('Get cart items failed:', error);
    throw error;
  }
}

export async function removeFromCart(cartItemId: number): Promise<boolean> {
  try {
    const result = await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Remove from cart failed:', error);
    throw error;
  }
}

export async function updateCartItemQuantity(cartItemId: number, quantity: number): Promise<CartItem | null> {
  try {
    if (quantity <= 0) {
      // If quantity is 0 or negative, remove the item
      const removed = await removeFromCart(cartItemId);
      return removed ? null : null;
    }

    const updatedCartItem = await db.update(cartItemsTable)
      .set({ quantity })
      .where(eq(cartItemsTable.id, cartItemId))
      .returning()
      .execute();

    return updatedCartItem.length > 0 ? updatedCartItem[0] : null;
  } catch (error) {
    console.error('Update cart item quantity failed:', error);
    throw error;
  }
}

export async function clearCart(cartId: number): Promise<boolean> {
  try {
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cartId))
      .execute();

    return true;
  } catch (error) {
    console.error('Clear cart failed:', error);
    throw error;
  }
}