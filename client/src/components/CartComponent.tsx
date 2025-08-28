import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, MapPin } from 'lucide-react';

import type { User, CartItem, MenuItem, Address, CreateOrderInput, CreateAddressInput } from '../../../server/src/schema';
import { AddressManager } from '@/components/AddressManager';

interface CartComponentProps {
  user: User;
  cartItems: CartItem[];
  onCartUpdate: () => void;
  onOrderPlaced: () => void;
}

interface CartItemWithDetails extends CartItem {
  menuItem?: MenuItem | null;
}

export function CartComponent({ user, cartItems, onCartUpdate, onOrderPlaced }: CartComponentProps) {
  const [cartWithDetails, setCartWithDetails] = useState<CartItemWithDetails[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadCartDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const itemsWithDetails = await Promise.all(
        cartItems.map(async (item: CartItem): Promise<CartItemWithDetails> => {
          try {
            const menuItem = await trpc.menuItems.getById.query(item.menu_item_id);
            return { ...item, menuItem: menuItem || null };
          } catch (error) {
            console.error('Failed to load menu item:', error);
            return { ...item, menuItem: null };
          }
        })
      );
      setCartWithDetails(itemsWithDetails);
    } catch (error) {
      console.error('Failed to load cart details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [cartItems]);

  const loadAddresses = useCallback(async () => {
    try {
      const userAddresses = await trpc.addresses.getUserAddresses.query(user.id);
      setAddresses(userAddresses);
      const defaultAddress = userAddresses.find(addr => addr.is_default);
      if (defaultAddress) {
        setSelectedAddress(defaultAddress);
      } else if (userAddresses.length > 0) {
        setSelectedAddress(userAddresses[0]);
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
    }
  }, [user.id]);

  useEffect(() => {
    loadCartDetails();
    loadAddresses();
  }, [loadCartDetails, loadAddresses]);

  const updateQuantity = async (itemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeItem(itemId);
      return;
    }

    try {
      await trpc.cart.updateItem.mutate({
        id: itemId,
        quantity: newQuantity
      });
      onCartUpdate();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      await trpc.cart.removeItem.mutate(itemId);
      onCartUpdate();
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const clearCart = async () => {
    try {
      await trpc.cart.clear.mutate(user.id);
      onCartUpdate();
    } catch (error) {
      console.error('Failed to clear cart:', error);
    }
  };

  const processCheckout = async () => {
    if (!selectedAddress) {
      alert('Please select a delivery address');
      return;
    }

    if (cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }

    // Check if all items are from the same restaurant
    const restaurantIds = [...new Set(cartWithDetails.map(item => item.menuItem?.restaurant_id).filter(Boolean))];
    if (restaurantIds.length > 1) {
      alert('You can only order from one restaurant at a time');
      return;
    }

    setIsProcessing(true);
    try {
      const orderData: CreateOrderInput = {
        user_id: user.id,
        restaurant_id: restaurantIds[0]!,
        delivery_address_id: selectedAddress.id,
        notes: null
      };

      await trpc.orders.create.mutate(orderData);
      
      // Clear cart after successful order
      await clearCart();
      setShowCheckout(false);
      onOrderPlaced();
    } catch (error) {
      console.error('Failed to process checkout:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const subtotal = cartWithDetails.reduce((sum, item) => sum + item.total_price, 0);
  const deliveryFee = 5.99;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + tax;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="text-4xl mb-4">🛒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-600 mb-6">
            Browse restaurants and add some delicious items to your cart!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">🛒 Your Cart</h2>
        <Button 
          variant="outline" 
          onClick={clearCart}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Cart
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartWithDetails.map((item: CartItemWithDetails) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {item.menuItem?.name || 'Unknown Item'}
                    </h3>
                    {item.menuItem?.description && (
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                        {item.menuItem.description}
                      </p>
                    )}
                    <div className="flex items-center mt-3 space-x-3">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold text-orange-600">
                      ${item.total_price.toFixed(2)}
                    </div>
                    {item.menuItem && (
                      <div className="text-sm text-gray-500">
                        ${item.menuItem.price.toFixed(2)} each
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span>${deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-orange-600">${total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedAddress ? (
                <div className="space-y-2">
                  <p className="font-medium">{selectedAddress.street_address}</p>
                  <p className="text-sm text-gray-600">
                    {selectedAddress.city}, {selectedAddress.state} {selectedAddress.postal_code}
                  </p>
                  <AddressManager 
                    user={user} 
                    addresses={addresses}
                    onAddressUpdate={loadAddresses}
                    selectedAddress={selectedAddress}
                    onAddressSelect={setSelectedAddress}
                  />
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 mb-3">No delivery address selected</p>
                  <AddressManager 
                    user={user} 
                    addresses={addresses}
                    onAddressUpdate={loadAddresses}
                    selectedAddress={null}
                    onAddressSelect={setSelectedAddress}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checkout Button */}
          <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
            <DialogTrigger asChild>
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 text-lg py-6"
                disabled={!selectedAddress}
              >
                <CreditCard className="h-5 w-5 mr-2" />
                Proceed to Checkout
              </Button>
            </DialogTrigger>
            
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Your Order</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    🔒 This is a demo payment gateway. No real payment will be processed.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <h4 className="font-semibold">Order Summary</h4>
                  <div className="text-sm space-y-1">
                    {cartWithDetails.map((item: CartItemWithDetails) => (
                      <div key={item.id} className="flex justify-between">
                        <span>{item.quantity}x {item.menuItem?.name}</span>
                        <span>${item.total_price.toFixed(2)}</span>
                      </div>
                    ))}
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {selectedAddress && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Delivery Address</h4>
                    <div className="text-sm text-gray-600">
                      <p>{selectedAddress.street_address}</p>
                      <p>{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postal_code}</p>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCheckout(false)}
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={processCheckout}
                    disabled={isProcessing}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {isProcessing ? 'Processing...' : 'Place Order'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}