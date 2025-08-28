import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, Store, ShoppingBag, Star, TrendingUp, 
  Shield, Eye, Edit2, Trash2, CheckCircle, X, AlertTriangle 
} from 'lucide-react';

import type { User, Restaurant, Order, Review } from '../../../server/src/schema';

interface AdminDashboardProps {
  user: User;
}

interface SystemStats {
  totalUsers: number;
  totalRestaurants: number;
  totalOrders: number;
  totalReviews: number;
  totalRevenue?: number;
  pendingReviews?: number;
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalRestaurants: 0,
    totalOrders: 0,
    totalReviews: 0,
    totalRevenue: 0,
    pendingReviews: 0
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadAdminData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [
        systemStats,
        allUsers, 
        allRestaurants, 
        allOrders, 
        pendingReviews
      ] = await Promise.all([
        trpc.admin.getSystemStats.query(),
        trpc.admin.getAllUsers.query(),
        trpc.restaurants.getAll.query(),
        trpc.orders.getAll.query(),
        trpc.reviews.getPending.query()
      ]);

      // Calculate additional stats not provided by backend
      const totalRevenue = allOrders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + order.total_amount, 0);

      const enhancedStats: SystemStats = {
        ...systemStats,
        totalRevenue,
        pendingReviews: pendingReviews.length
      };

      setStats(enhancedStats);
      setUsers(allUsers);
      setRestaurants(allRestaurants);
      setOrders(allOrders);
      setReviews(pendingReviews);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const updateUserRole = async (userId: number, newRole: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

    setIsUpdating(true);
    try {
      await trpc.admin.updateUserRole.mutate({ userId, role: newRole as any });
      loadAdminData();
    } catch (error: any) {
      alert(error.message || 'Failed to update user role');
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    setIsUpdating(true);
    try {
      await trpc.admin.deleteUser.mutate(userId);
      loadAdminData();
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete user');
    } finally {
      setIsUpdating(false);
    }
  };

  const moderateReview = async (reviewId: number, approved: boolean) => {
    setIsUpdating(true);
    try {
      await trpc.reviews.moderate.mutate({ id: reviewId, is_approved: approved });
      loadAdminData();
    } catch (error: any) {
      alert(error.message || 'Failed to moderate review');
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteReview = async (reviewId: number) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    setIsUpdating(true);
    try {
      await trpc.reviews.delete.mutate(reviewId);
      loadAdminData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete review');
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700';
      case 'restaurant_owner': return 'bg-blue-100 text-blue-700';
      case 'customer': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return '⚙️';
      case 'restaurant_owner': return '🏪';
      case 'customer': return '🍽️';
      default: return '👤';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'canceled': return 'bg-red-100 text-red-700';
      case 'out_for_delivery': return 'bg-blue-100 text-blue-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-r from-purple-100 to-indigo-100 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Shield className="h-8 w-8 text-purple-600" />
                Admin Dashboard
              </h2>
              <p className="text-gray-700">
                Welcome, {user.first_name}! Monitor and manage the entire FoodieExpress platform.
              </p>
            </div>
            {(stats.pendingReviews || 0) > 0 && (
              <Alert className="max-w-sm">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {stats.pendingReviews || 0} reviews need moderation
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.totalUsers}
                </div>
                <p className="text-gray-600">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Store className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.totalRestaurants}
                </div>
                <p className="text-gray-600">Restaurants</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <ShoppingBag className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.totalOrders}
                </div>
                <p className="text-gray-600">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  ${(stats.totalRevenue || 0).toFixed(0)}
                </div>
                <p className="text-gray-600">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Star className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.pendingReviews || 0}
                </div>
                <p className="text-gray-600">Pending Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">👥 Users</TabsTrigger>
          <TabsTrigger value="restaurants">🏪 Restaurants</TabsTrigger>
          <TabsTrigger value="orders">📋 Orders</TabsTrigger>
          <TabsTrigger value="reviews" className="relative">
            ⭐ Reviews
            {(stats.pendingReviews || 0) > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs"
              >
                {stats.pendingReviews || 0}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-gray-600">No users found.</p>
              ) : (
                <div className="space-y-4">
                  {users.map((userItem: User) => (
                    <div key={userItem.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Badge className={getRoleColor(userItem.role)}>
                            {getRoleIcon(userItem.role)} {userItem.role.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div>
                          <h4 className="font-semibold">
                            {userItem.first_name} {userItem.last_name}
                          </h4>
                          <p className="text-sm text-gray-600">{userItem.email}</p>
                          <p className="text-xs text-gray-500">
                            Joined: {userItem.created_at.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUser(userItem)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          
                          {selectedUser?.id === userItem.id && (
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>User Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <strong>Name:</strong> {selectedUser.first_name} {selectedUser.last_name}
                                  </div>
                                  <div>
                                    <strong>Email:</strong> {selectedUser.email}
                                  </div>
                                  <div>
                                    <strong>Phone:</strong> {selectedUser.phone || 'Not provided'}
                                  </div>
                                  <div>
                                    <strong>Role:</strong> 
                                    <Badge className={`ml-2 ${getRoleColor(selectedUser.role)}`}>
                                      {selectedUser.role.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div>
                                    <strong>Joined:</strong> {selectedUser.created_at.toLocaleDateString()}
                                  </div>
                                  <div>
                                    <strong>Last Updated:</strong> {selectedUser.updated_at.toLocaleDateString()}
                                  </div>
                                </div>
                                
                                <div className="pt-4 border-t">
                                  <h4 className="font-medium mb-3">Change Role</h4>
                                  <div className="flex gap-2">
                                    {['customer', 'restaurant_owner', 'admin'].map((role) => (
                                      <Button
                                        key={role}
                                        variant={selectedUser.role === role ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => updateUserRole(selectedUser.id, role)}
                                        disabled={isUpdating || selectedUser.role === role}
                                      >
                                        {getRoleIcon(role)} {role.replace('_', ' ')}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          )}
                        </Dialog>

                        <Select 
                          value={userItem.role} 
                          onValueChange={(newRole: string) => updateUserRole(userItem.id, newRole)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="restaurant_owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteUser(userItem.id)}
                          disabled={isUpdating || userItem.id === user.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurants">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Management</CardTitle>
            </CardHeader>
            <CardContent>
              {restaurants.length === 0 ? (
                <p className="text-gray-600">No restaurants found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {restaurants.map((restaurant: Restaurant) => (
                    <Card key={restaurant.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold">{restaurant.name}</h4>
                            <Badge variant={restaurant.is_active ? "default" : "secondary"}>
                              {restaurant.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          
                          {restaurant.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {restaurant.description}
                            </p>
                          )}
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>📍 {restaurant.address}</div>
                            <div>📞 {restaurant.phone}</div>
                            <div>👤 Owner ID: {restaurant.owner_id}</div>
                            {restaurant.rating && (
                              <div>⭐ {restaurant.rating.toFixed(1)} ({restaurant.total_reviews} reviews)</div>
                            )}
                          </div>
                          
                          <div className="text-xs text-gray-500">
                            Created: {restaurant.created_at.toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-gray-600">No orders found.</p>
              ) : (
                <div className="space-y-4">
                  {orders.slice(0, 20).map((order: Order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="font-semibold">Order #{order.id}</h4>
                          <p className="text-sm text-gray-600">
                            Customer #{order.user_id} • Restaurant #{order.restaurant_id}
                          </p>
                          <p className="text-xs text-gray-500">
                            {order.created_at.toLocaleDateString()} at {order.created_at.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-semibold">${order.total_amount.toFixed(2)}</div>
                          <div className="text-sm text-gray-600">
                            {order.payment_status.replace('_', ' ')}
                          </div>
                        </div>
                        <Badge className={getOrderStatusColor(order.status)}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {orders.length > 20 && (
                    <p className="text-center text-gray-600 text-sm">
                      Showing first 20 orders of {orders.length} total
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Review Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-gray-600">No pending reviews.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review: Review) => (
                    <div key={review.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= review.rating 
                                    ? 'text-yellow-500 fill-current' 
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-600">
                            Restaurant #{review.restaurant_id}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {review.created_at.toLocaleDateString()}
                        </span>
                      </div>
                      
                      {review.comment && (
                        <p className="text-gray-700 mb-3">{review.comment}</p>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          Customer #{review.user_id}
                          {review.order_id && ` • Order #${review.order_id}`}
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => moderateReview(review.id, true)}
                            disabled={isUpdating}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteReview(review.id)}
                            disabled={isUpdating}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}