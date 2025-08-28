import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Clock, MapPin, ShoppingCart, Eye } from 'lucide-react';

import type { User, Restaurant, Order, CartItem } from '../../../server/src/schema';
import { RestaurantList } from '@/components/RestaurantList';
import { RestaurantMenu } from '@/components/RestaurantMenu';
import { CartComponent } from '@/components/CartComponent';
import { OrderHistory } from '@/components/OrderHistory';
import { OrderTracking } from '@/components/OrderTracking';

interface CustomerDashboardProps {
  user: User;
}

export function CustomerDashboard({ user }: CustomerDashboardProps) {
  const [activeTab, setActiveTab] = useState('restaurants');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const loadCart = useCallback(async () => {
    try {
      const cart = await trpc.cart.getUserCart.query(user.id);
      setCartItems(cart);
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  }, [user.id]);

  const loadOrders = useCallback(async () => {
    try {
      const userOrders = await trpc.orders.getUserOrders.query(user.id);
      setOrders(userOrders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  }, [user.id]);

  useEffect(() => {
    loadCart();
    loadOrders();
  }, [loadCart, loadOrders]);

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setActiveTab('menu');
  };

  const handleCartUpdate = () => {
    loadCart();
  };

  const handleOrderPlaced = () => {
    loadOrders();
    loadCart(); // Clear cart after order
    setActiveTab('orders');
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const activeOrders = orders.filter(order => 
    !['delivered', 'canceled'].includes(order.status)
  );

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-r from-orange-100 to-red-100 border-orange-200">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Hello, {user.first_name}! 👋
          </h2>
          <p className="text-gray-700">
            Ready to order some delicious food? Browse restaurants and discover amazing meals.
          </p>
          {activeOrders.length > 0 && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-orange-700">
                📦 You have {activeOrders.length} active order{activeOrders.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="restaurants">🏪 Restaurants</TabsTrigger>
          <TabsTrigger value="menu" disabled={!selectedRestaurant}>
            🍽️ Menu
          </TabsTrigger>
          <TabsTrigger value="cart" className="relative">
            🛒 Cart
            {cartItemCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs"
              >
                {cartItemCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders">📋 Orders</TabsTrigger>
          <TabsTrigger value="tracking" disabled={activeOrders.length === 0}>
            🚚 Track
          </TabsTrigger>
        </TabsList>

        <TabsContent value="restaurants" className="mt-6">
          <RestaurantList onRestaurantSelect={handleRestaurantSelect} />
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          {selectedRestaurant && (
            <RestaurantMenu 
              restaurant={selectedRestaurant} 
              user={user}
              onCartUpdate={handleCartUpdate}
            />
          )}
        </TabsContent>

        <TabsContent value="cart" className="mt-6">
          <CartComponent 
            user={user}
            cartItems={cartItems}
            onCartUpdate={handleCartUpdate}
            onOrderPlaced={handleOrderPlaced}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <OrderHistory 
            orders={orders}
            user={user}
            onOrderUpdate={loadOrders}
          />
        </TabsContent>

        <TabsContent value="tracking" className="mt-6">
          <OrderTracking orders={activeOrders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}