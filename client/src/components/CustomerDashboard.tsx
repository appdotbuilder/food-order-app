import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { User, Restaurant, MenuItem, Order, CartItem, Cart } from '../../../server/src/schema';

interface CustomerDashboardProps {
  user: User;
}

export function CustomerDashboard({ user }: CustomerDashboardProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartMenuItems, setCartMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('restaurants');

  // Checkout form state
  const [checkoutData, setCheckoutData] = useState({
    delivery_address: '',
    phone: user.phone || ''
  });

  const loadRestaurants = useCallback(async () => {
    try {
      const result = await trpc.getRestaurants.query({
        search: searchTerm || undefined,
        limit: 20
      });
      setRestaurants(result);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    }
  }, [searchTerm]);

  const loadOrders = useCallback(async () => {
    try {
      const result = await trpc.getUserOrders.query({
        user_id: user.id,
        limit: 10
      });
      setOrders(result);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  }, [user.id]);

  const loadCart = useCallback(async () => {
    if (!selectedRestaurant) return;
    
    try {
      const cartResult = await trpc.getUserCart.query({
        userId: user.id,
        restaurantId: selectedRestaurant.id
      });
      setCart(cartResult);

      if (cartResult) {
        const itemsResult = await trpc.getCartItems.query({
          cartId: cartResult.id
        });
        setCartItems(itemsResult);

        // Load menu item details for cart items
        const menuItemPromises = itemsResult.map((item: CartItem) =>
          trpc.getMenuItemById.query({ menuItemId: item.menu_item_id })
        );
        const menuItemResults = await Promise.all(menuItemPromises);
        setCartMenuItems(menuItemResults.filter(item => item !== null) as MenuItem[]);
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  }, [user.id, selectedRestaurant]);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const handleRestaurantSelect = async (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setIsLoading(true);
    try {
      const result = await trpc.getMenuItems.query({
        restaurant_id: restaurant.id
      });
      setMenuItems(result);
    } catch (error) {
      console.error('Failed to load menu items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async (menuItem: MenuItem) => {
    if (!selectedRestaurant) return;

    try {
      await trpc.addToCart.mutate({
        user_id: user.id,
        restaurant_id: selectedRestaurant.id,
        menu_item_id: menuItem.id,
        quantity: 1
      });
      
      // Reload cart after adding item
      await loadCart();
    } catch (error) {
      console.error('Failed to add to cart:', error);
      alert('Failed to add item to cart');
    }
  };

  const handleUpdateQuantity = async (cartItemId: number, quantity: number) => {
    if (quantity <= 0) {
      await trpc.removeFromCart.mutate({ cartItemId });
    } else {
      await trpc.updateCartItemQuantity.mutate({ cartItemId, quantity });
    }
    await loadCart();
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || cartItems.length === 0) return;

    setIsLoading(true);
    try {
      const order = await trpc.createOrder.mutate({
        user_id: user.id,
        restaurant_id: cart.restaurant_id,
        cart_id: cart.id,
        delivery_address: checkoutData.delivery_address,
        phone: checkoutData.phone
      });

      // Clear cart after successful order
      await trpc.clearCart.mutate({ cartId: cart.id });
      setCart(null);
      setCartItems([]);
      setCartMenuItems([]);
      
      // Reload orders
      await loadOrders();
      
      // Show success message and switch to orders tab
      alert('Order placed successfully! 🎉');
      setActiveTab('orders');
      
      // Reset checkout form
      setCheckoutData({
        delivery_address: '',
        phone: user.phone || ''
      });
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to place order');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce((total: number, item: CartItem) => {
      const menuItem = cartMenuItems.find(mi => mi.id === item.menu_item_id);
      return total + (menuItem ? menuItem.price * item.quantity : 0);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">
          Welcome, {user.name}! 🍽️
        </h2>
        {cartItems.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700">
                🛒 Cart ({cartItems.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Your Cart</DialogTitle>
                <DialogDescription>
                  {selectedRestaurant?.name}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-80">
                <div className="space-y-4">
                  {cartItems.map((item: CartItem) => {
                    const menuItem = cartMenuItems.find(mi => mi.id === item.menu_item_id);
                    if (!menuItem) return null;
                    
                    return (
                      <div key={item.id} className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium">{menuItem.name}</p>
                          <p className="text-sm text-gray-600">₹{menuItem.price}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <Separator />
              <div className="space-y-4">
                <div className="flex justify-between font-bold">
                  <span>Total: ₹{getCartTotal()}</span>
                </div>
                <form onSubmit={handleCheckout} className="space-y-3">
                  <Input
                    placeholder="Delivery Address"
                    value={checkoutData.delivery_address}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCheckoutData(prev => ({ ...prev, delivery_address: e.target.value }))
                    }
                    required
                  />
                  <Input
                    placeholder="Phone Number"
                    value={checkoutData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCheckoutData(prev => ({ ...prev, phone: e.target.value }))
                    }
                    required
                  />
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isLoading ? 'Placing Order...' : '🚀 Place Order'}
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="restaurants">🏪 Browse Restaurants</TabsTrigger>
          <TabsTrigger value="orders">📋 My Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="restaurants" className="space-y-6">
          <div className="flex gap-4">
            <Input
              placeholder="Search restaurants..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Button onClick={loadRestaurants} variant="outline">
              🔍 Search
            </Button>
          </div>

          {!selectedRestaurant ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((restaurant: Restaurant) => (
                <Card
                  key={restaurant.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleRestaurantSelect(restaurant)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🏪 {restaurant.name}
                    </CardTitle>
                    <CardDescription>{restaurant.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        📍 {restaurant.address}
                      </p>
                      <p className="flex items-center gap-2">
                        📞 {restaurant.phone}
                      </p>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRestaurant(null);
                    setMenuItems([]);
                  }}
                >
                  ← Back to Restaurants
                </Button>
                <h3 className="text-2xl font-bold">🏪 {selectedRestaurant.name}</h3>
              </div>

              {isLoading ? (
                <div className="text-center py-8">Loading menu...</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {menuItems.map((item: MenuItem) => (
                    <Card key={item.id}>
                      <CardHeader>
                        <CardTitle className="flex justify-between items-start">
                          <span>{item.name}</span>
                          <span className="text-lg font-bold text-green-600">₹{item.price}</span>
                        </CardTitle>
                        <CardDescription>{item.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          {item.category && (
                            <Badge variant="secondary">{item.category}</Badge>
                          )}
                          <Button
                            onClick={() => handleAddToCart(item)}
                            disabled={!item.is_available}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            {item.is_available ? '🛒 Add to Cart' : 'Unavailable'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">No orders yet. Start browsing restaurants! 🍽️</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {orders.map((order: Order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Order #{order.id}</CardTitle>
                        <CardDescription>
                          {order.created_at.toLocaleDateString()} at {order.created_at.toLocaleTimeString()}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Amount:</span>
                        <span className="font-bold">₹{order.total_amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Address:</span>
                        <span>{order.delivery_address}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Phone:</span>
                        <span>{order.phone}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}