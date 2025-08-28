import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { trpc } from '@/utils/trpc';
import type { User, Restaurant, MenuItem, Order, OrderStatus } from '../../../server/src/schema';

interface RestaurantOwnerDashboardProps {
  user: User;
}

export function RestaurantOwnerDashboard({ user }: RestaurantOwnerDashboardProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // New restaurant form
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    image_url: ''
  });

  // New menu item form
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    description: '',
    price: 0,
    category: '',
    image_url: ''
  });

  const loadRestaurants = useCallback(async () => {
    try {
      const result = await trpc.getRestaurantsByOwner.query({
        ownerId: user.id
      });
      setRestaurants(result);
      
      // Auto-select first restaurant if available
      if (result.length > 0 && !selectedRestaurant) {
        setSelectedRestaurant(result[0]);
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    }
  }, [user.id, selectedRestaurant]);

  const loadMenuItems = useCallback(async () => {
    if (!selectedRestaurant) return;
    
    try {
      const result = await trpc.getMenuItems.query({
        restaurant_id: selectedRestaurant.id
      });
      setMenuItems(result);
    } catch (error) {
      console.error('Failed to load menu items:', error);
    }
  }, [selectedRestaurant]);

  const loadOrders = useCallback(async () => {
    if (!selectedRestaurant) return;
    
    try {
      const result = await trpc.getRestaurantOrders.query({
        restaurant_id: selectedRestaurant.id,
        limit: 20
      });
      setOrders(result);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  }, [selectedRestaurant]);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    loadMenuItems();
    loadOrders();
  }, [loadMenuItems, loadOrders]);

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const restaurant = await trpc.createRestaurant.mutate({
        owner_id: user.id,
        name: newRestaurant.name,
        description: newRestaurant.description || null,
        address: newRestaurant.address,
        phone: newRestaurant.phone,
        image_url: newRestaurant.image_url || null
      });
      
      setRestaurants(prev => [...prev, restaurant]);
      setSelectedRestaurant(restaurant);
      
      // Reset form
      setNewRestaurant({
        name: '',
        description: '',
        address: '',
        phone: '',
        image_url: ''
      });
    } catch (error) {
      console.error('Failed to create restaurant:', error);
      alert('Failed to create restaurant');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant) return;
    
    setIsLoading(true);
    try {
      const menuItem = await trpc.createMenuItem.mutate({
        restaurant_id: selectedRestaurant.id,
        name: newMenuItem.name,
        description: newMenuItem.description || null,
        price: newMenuItem.price,
        category: newMenuItem.category || null,
        image_url: newMenuItem.image_url || null
      });
      
      setMenuItems(prev => [...prev, menuItem]);
      
      // Reset form
      setNewMenuItem({
        name: '',
        description: '',
        price: 0,
        category: '',
        image_url: ''
      });
    } catch (error) {
      console.error('Failed to create menu item:', error);
      alert('Failed to create menu item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAvailability = async (menuItemId: number, isAvailable: boolean) => {
    try {
      await trpc.updateMenuItemAvailability.mutate({
        menuItemId,
        isAvailable
      });
      
      setMenuItems(prev => 
        prev.map(item => 
          item.id === menuItemId 
            ? { ...item, is_available: isAvailable }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to update menu item:', error);
      alert('Failed to update menu item');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: OrderStatus) => {
    try {
      await trpc.updateOrderStatus.mutate({
        order_id: orderId,
        status
      });
      
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, status, updated_at: new Date() }
            : order
        )
      );
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
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

  if (restaurants.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">Restaurant Owner Dashboard 🏪</h2>
        
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Create Your First Restaurant</CardTitle>
            <CardDescription>
              Get started by creating your restaurant profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRestaurant} className="space-y-4">
              <Input
                placeholder="Restaurant Name"
                value={newRestaurant.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewRestaurant(prev => ({ ...prev, name: e.target.value }))
                }
                required
              />
              <Textarea
                placeholder="Restaurant Description (optional)"
                value={newRestaurant.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setNewRestaurant(prev => ({ ...prev, description: e.target.value }))
                }
              />
              <Input
                placeholder="Address"
                value={newRestaurant.address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewRestaurant(prev => ({ ...prev, address: e.target.value }))
                }
                required
              />
              <Input
                placeholder="Phone Number"
                value={newRestaurant.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewRestaurant(prev => ({ ...prev, phone: e.target.value }))
                }
                required
              />
              <Input
                placeholder="Image URL (optional)"
                value={newRestaurant.image_url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewRestaurant(prev => ({ ...prev, image_url: e.target.value }))
                }
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Creating...' : '🏪 Create Restaurant'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">
          Restaurant Dashboard 🏪
        </h2>
        {restaurants.length > 1 && (
          <Select
            value={selectedRestaurant?.id.toString() || ''}
            onValueChange={(value) => {
              const restaurant = restaurants.find(r => r.id === parseInt(value));
              setSelectedRestaurant(restaurant || null);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select Restaurant" />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((restaurant: Restaurant) => (
                <SelectItem key={restaurant.id} value={restaurant.id.toString()}>
                  {restaurant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedRestaurant && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏪 {selectedRestaurant.name}
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {selectedRestaurant.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </CardTitle>
            <CardDescription>{selectedRestaurant.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <p><strong>Address:</strong> {selectedRestaurant.address}</p>
              <p><strong>Phone:</strong> {selectedRestaurant.phone}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="menu" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="menu">🍽️ Menu Management</TabsTrigger>
          <TabsTrigger value="orders">📋 Orders</TabsTrigger>
          <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Menu Items</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700">
                  ➕ Add Menu Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Menu Item</DialogTitle>
                  <DialogDescription>
                    Create a new item for your menu
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateMenuItem} className="space-y-4">
                  <Input
                    placeholder="Item Name"
                    value={newMenuItem.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewMenuItem(prev => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={newMenuItem.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewMenuItem(prev => ({ ...prev, description: e.target.value }))
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Price (₹)"
                    value={newMenuItem.price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewMenuItem(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))
                    }
                    step="0.01"
                    min="0"
                    required
                  />
                  <Input
                    placeholder="Category (optional)"
                    value={newMenuItem.category}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewMenuItem(prev => ({ ...prev, category: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Image URL (optional)"
                    value={newMenuItem.image_url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewMenuItem(prev => ({ ...prev, image_url: e.target.value }))
                    }
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create Item'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

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
                    <div className="flex items-center gap-2">
                      {item.category && (
                        <Badge variant="secondary">{item.category}</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`available-${item.id}`}>Available</Label>
                      <Switch
                        id={`available-${item.id}`}
                        checked={item.is_available}
                        onCheckedChange={(checked) => 
                          handleToggleAvailability(item.id, checked)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <h3 className="text-xl font-semibold">Incoming Orders</h3>
          
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">No orders yet. Customers will see your menu once you add items! 📋</p>
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
                    <div className="space-y-4">
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
                      
                      {order.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleUpdateOrderStatus(order.id, 'accepted')}
                          >
                            ✅ Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          >
                            ❌ Decline
                          </Button>
                        </div>
                      )}
                      
                      {order.status === 'accepted' && (
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700"
                          onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                        >
                          👨‍🍳 Start Preparing
                        </Button>
                      )}
                      
                      {order.status === 'preparing' && (
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                          onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                        >
                          ✅ Mark Ready
                        </Button>
                      )}
                      
                      {order.status === 'ready' && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                        >
                          🚚 Mark Delivered
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <h3 className="text-xl font-semibold">Analytics Overview</h3>
          
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{orders.length}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Menu Items</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{menuItems.length}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-600">
                  ₹{orders.filter(o => o.status === 'delivered').reduce((sum, order) => sum + order.total_amount, 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}