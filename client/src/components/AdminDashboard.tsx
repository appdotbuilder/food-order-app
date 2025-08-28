import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { User, Restaurant, Order } from '../../../server/src/schema';

interface AdminDashboardProps {
  user: User;
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const result = await trpc.getAllUsers.query();
      setUsers(result);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  const loadRestaurants = useCallback(async () => {
    try {
      const result = await trpc.getAllRestaurants.query();
      setRestaurants(result);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const result = await trpc.getAllOrders.query();
      setOrders(result);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadRestaurants();
    loadOrders();
  }, [loadUsers, loadRestaurants, loadOrders]);

  const handleToggleRestaurantStatus = async (restaurantId: number, isActive: boolean) => {
    setIsLoading(true);
    try {
      if (isActive) {
        await trpc.activateRestaurant.mutate({ restaurantId });
      } else {
        await trpc.deactivateRestaurant.mutate({ restaurantId });
      }
      
      setRestaurants(prev => 
        prev.map(restaurant => 
          restaurant.id === restaurantId 
            ? { ...restaurant, is_active: isActive }
            : restaurant
        )
      );
    } catch (error) {
      console.error('Failed to update restaurant status:', error);
      alert('Failed to update restaurant status');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'customer': return 'bg-blue-100 text-blue-800';
      case 'restaurant_owner': return 'bg-green-100 text-green-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const totalRevenue = orders
    .filter(order => order.status === 'delivered')
    .reduce((sum, order) => sum + order.total_amount, 0);

  const customerCount = users.filter(u => u.role === 'customer').length;
  const restaurantOwnerCount = users.filter(u => u.role === 'restaurant_owner').length;
  const activeRestaurantCount = restaurants.filter(r => r.is_active).length;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">
        Admin Dashboard 👑
      </h2>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <span className="text-2xl">👥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              {customerCount} customers, {restaurantOwnerCount} owners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Restaurants</CardTitle>
            <span className="text-2xl">🏪</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRestaurantCount}</div>
            <p className="text-xs text-muted-foreground">
              out of {restaurants.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <span className="text-2xl">📋</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">
              {orders.filter(o => o.status === 'delivered').length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue}</div>
            <p className="text-xs text-muted-foreground">
              from completed orders
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">👥 Users</TabsTrigger>
          <TabsTrigger value="restaurants">🏪 Restaurants</TabsTrigger>
          <TabsTrigger value="orders">📋 Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage all registered users on the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.created_at.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Management</CardTitle>
              <CardDescription>
                Manage restaurant registrations and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurants.map((restaurant: Restaurant) => {
                    const owner = users.find(u => u.id === restaurant.owner_id);
                    return (
                      <TableRow key={restaurant.id}>
                        <TableCell>{restaurant.id}</TableCell>
                        <TableCell className="font-medium">{restaurant.name}</TableCell>
                        <TableCell>{owner?.name || 'Unknown'}</TableCell>
                        <TableCell>{restaurant.address}</TableCell>
                        <TableCell>{restaurant.phone}</TableCell>
                        <TableCell>
                          <Badge variant={restaurant.is_active ? 'default' : 'secondary'}>
                            {restaurant.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`restaurant-${restaurant.id}`} className="text-xs">
                              Active
                            </Label>
                            <Switch
                              id={`restaurant-${restaurant.id}`}
                              checked={restaurant.is_active}
                              onCheckedChange={(checked) => 
                                handleToggleRestaurantStatus(restaurant.id, checked)
                              }
                              disabled={isLoading}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Management</CardTitle>
              <CardDescription>
                Monitor all orders across the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: Order) => {
                    const customer = users.find(u => u.id === order.user_id);
                    const restaurant = restaurants.find(r => r.id === order.restaurant_id);
                    
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>{customer?.name || 'Unknown'}</TableCell>
                        <TableCell>{restaurant?.name || 'Unknown'}</TableCell>
                        <TableCell className="font-medium">₹{order.total_amount}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.created_at.toLocaleDateString()}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {order.delivery_address}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}