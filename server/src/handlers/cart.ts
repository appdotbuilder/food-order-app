import { db } from '../db';
import { cartItemsTable, menuItemsTable, menuItemOptionsTable } from '../db/schema';
import { type AddToCartInput, type UpdateCartItemInput, type CartItem } from '../schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function addToCart(input: AddToCartInput): Promise<CartItem> {
  try {
    // Fetch menu item price
    const menuItem = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, input.menu_item_id))
      .execute();

    if (menuItem.length === 0) {
      throw new Error('Menu item not found');
    }

    const basePrice = parseFloat(menuItem[0].price);
    
    // Calculate total price including option modifiers
    let totalPrice = basePrice;
    
    if (input.selected_options && input.selected_options.length > 0) {
      const options = await db.select()
        .from(menuItemOptionsTable)
        .where(inArray(menuItemOptionsTable.id, input.selected_options))
        .execute();
      
      const optionModifiers = options.reduce((sum, option) => sum + parseFloat(option.price_modifier), 0);
      totalPrice += optionModifiers;
    }
    
    totalPrice *= input.quantity;

    // Insert cart item
    const result = await db.insert(cartItemsTable)
      .values({
        user_id: input.user_id,
        menu_item_id: input.menu_item_id,
        quantity: input.quantity,
        selected_options: input.selected_options || null,
        total_price: totalPrice.toString()
      })
      .returning()
      .execute();

    const cartItem = result[0];
    return {
      ...cartItem,
      total_price: parseFloat(cartItem.total_price),
      selected_options: cartItem.selected_options as number[] | null
    };
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
}

export async function getUserCart(userId: number): Promise<CartItem[]> {
  try {
    const results = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return results.map(item => ({
      ...item,
      total_price: parseFloat(item.total_price),
      selected_options: item.selected_options as number[] | null
    }));
  } catch (error) {
    console.error('Get user cart failed:', error);
    throw error;
  }
}

export async function updateCartItem(input: UpdateCartItemInput): Promise<CartItem> {
  try {
    // First get the cart item to check it exists and get menu item info
    const existingCartItem = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, input.id))
      .execute();

    if (existingCartItem.length === 0) {
      throw new Error('Cart item not found');
    }

    // Get menu item price
    const menuItem = await db.select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.id, existingCartItem[0].menu_item_id))
      .execute();

    if (menuItem.length === 0) {
      throw new Error('Menu item not found');
    }

    const basePrice = parseFloat(menuItem[0].price);
    
    // Calculate new total price
    let totalPrice = basePrice;
    
    const selectedOptions = input.selected_options !== undefined ? input.selected_options : (existingCartItem[0].selected_options as number[] | null);
    
    if (selectedOptions && selectedOptions.length > 0) {
      const options = await db.select()
        .from(menuItemOptionsTable)
        .where(inArray(menuItemOptionsTable.id, selectedOptions))
        .execute();
      
      const optionModifiers = options.reduce((sum, option) => sum + parseFloat(option.price_modifier), 0);
      totalPrice += optionModifiers;
    }
    
    totalPrice *= input.quantity;

    // Update cart item
    const result = await db.update(cartItemsTable)
      .set({
        quantity: input.quantity,
        selected_options: selectedOptions,
        total_price: totalPrice.toString(),
        updated_at: new Date()
      })
      .where(eq(cartItemsTable.id, input.id))
      .returning()
      .execute();

    const cartItem = result[0];
    return {
      ...cartItem,
      total_price: parseFloat(cartItem.total_price),
      selected_options: cartItem.selected_options as number[] | null
    };
  } catch (error) {
    console.error('Update cart item failed:', error);
    throw error;
  }
}

export async function removeFromCart(cartItemId: number): Promise<boolean> {
  try {
    const result = await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId))
      .execute();

    return true;
  } catch (error) {
    console.error('Remove from cart failed:', error);
    throw error;
  }
}

export async function clearUserCart(userId: number): Promise<boolean> {
  try {
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return true;
  } catch (error) {
    console.error('Clear user cart failed:', error);
    throw error;
  }
}