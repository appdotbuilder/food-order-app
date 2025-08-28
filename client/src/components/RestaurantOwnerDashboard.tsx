import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Store, ShoppingBag, Star, Plus } from 'lucide-react';

import type { User, Restaurant, Order, Review } from '../../../server/src/schema';
import { RestaurantManagement } from '@/components/RestaurantManagement';
import { MenuManagement } from '@/components/MenuManagement';
import { OrderManagement } from '@/components/OrderManagement';

interface RestaurantOwnerDashboardProps {
  user: User;
}

interface DashboardStats {
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
}

export function RestaurantOwnerDashboard({ user }: RestaurantOwnerDashboardProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    todayOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    averageRating: 0,
    totalReviews: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadOwnerData = useCallback(async () => {
    try {
      setIsLoading(true);
      const ownerRestaurants = await trpc.restaurants.getByOwner.query(user.id);
      setRestaurants(ownerRestaurants);
      
      if (ownerRestaurants.length > 0 && !selectedRestaurant) {
        setSelectedRestaurant(ownerRestaurants[0]);
      }
    } catch (error) {
      console.error('Failed to load restaurant data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user.id, selectedRestaurant]);

  const loadRestaurantData = useCallback(async (restaurantId: number) => {
    try {
      const [restaurantOrders, restaurantReviews] = await Promise.all([
        trpc.orders.getRestaurantOrders.query(restaurantId),
        trpc.reviews.getByRestaurant.query(restaurantId)
      ]);

      setOrders(restaurantOrders);
      setReviews(restaurantReviews);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayOrders = restaurantOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      });

      const pendingOrders = restaurantOrders.filter(order => 
        ['created', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status)
      );

      const totalRevenue = restaurantOrders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + order.total_amount, 0);

      const approvedReviews = restaurantReviews.filter(review => review.is_approved);
      const averageRating = approvedReviews.length > 0
        ? approvedReviews.reduce((sum, review) => sum + review.rating, 0) / approvedReviews.length
        : 0;

      setStats({
        totalOrders: restaurantOrders.length,
        todayOrders: todayOrders.length,
        pendingOrders: pendingOrders.length,
        totalRevenue,
        averageRating,
        totalReviews: approvedReviews.length
      });
    } catch (error) {
      console.error('Failed to load restaurant data:', error);
    }
  }, []);

  useEffect(() => {
    loadOwnerData();
  }, [loadOwnerData]);

  useEffect(() => {
    if (selectedRestaurant) {
      loadRestaurantData(selectedRestaurant.id);
    }
  }, [selectedRestaurant, loadRestaurantData]);

  const handleRestaurantUpdate = () => {
    loadOwnerData();
  };

  const handleOrderUpdate = () => {
    if (selectedRestaurant) {
      loadRestaurantData(selectedRestaurant.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-r from-green-100 to-blue-100 border-green-200">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Restaurant Owner Dashboard 🏪
          </h2>
          <p className="text-gray-700">
            Welcome back, {user.first_name}! Manage your restaurants, orders, and menu items.
          </p>
          {restaurants.length === 0 && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-700">
                🎯 Get started by creating your first restaurant!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {restaurants.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-4xl mb-4">🏪</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No restaurants yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first restaurant to start receiving orders and managing your menu.
            </p>
            <RestaurantManagement 
              user={user}
              restaurants={restaurants}
              onRestaurantUpdate={handleRestaurantUpdate}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Restaurant Selection */}
          {restaurants.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Restaurant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {restaurants.map((restaurant: Restaurant) => (
                    <Button
                      key={restaurant.id}
                      variant={selectedRestaurant?.id === restaurant.id ? "default" : "outline"}
                      onClick={() => setSelectedRestaurant(restaurant)}
                    >
                      {restaurant.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedRestaurant && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <ShoppingBag className="h-8 w-8 text-blue-600" />
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
                      <TrendingUp className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {stats.todayOrders}
                        </div>
                        <p className="text-gray-600">Today's Orders</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                        $
                      </div>
                      <div className="ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          ${stats.totalRevenue.toFixed(0)}
                        </div>
                        <p className="text-gray-600">Total Revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Star className="h-8 w-8 text-yellow-600 fill-current" />
                      <div className="ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {stats.averageRating.toFixed(1)}
                        </div>
                        <p className="text-gray-600">{stats.totalReviews} Reviews</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pending Orders Alert */}
              {stats.pendingOrders > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 bg-orange-500 rounded-full animate-pulse"></div>
                        <span className="font-medium text-orange-800">
                          🚨 You have {stats.pendingOrders} pending orders that need attention
                        </span>
                      </div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        Action Required
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Management Tabs */}
              <Tabs defaultValue="orders" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="orders" className="relative">
                    📋 Orders
                    {stats.pendingOrders > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs"
                      >
                        {stats.pendingOrders}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="menu">🍽️ Menu</TabsTrigger>
                  <TabsTrigger value="restaurant">🏪 Restaurant</TabsTrigger>
                  <TabsTrigger value="reviews">⭐ Reviews</TabsTrigger>
                </TabsList>

                <TabsContent value="orders">
                  <OrderManagement 
                    restaurant={selectedRestaurant}
                    orders={orders}
                    onOrderUpdate={handleOrderUpdate}
                  />
                </TabsContent>

                <TabsContent value="menu">
                  <MenuManagement 
                    restaurant={selectedRestaurant}
                    user={user}
                  />
                </TabsContent>

                <TabsContent value="restaurant">
                  <RestaurantManagement 
                    user={user}
                    restaurants={restaurants}
                    onRestaurantUpdate={handleRestaurantUpdate}
                  />
                </TabsContent>

                <TabsContent value="reviews">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold">Customer Reviews</h3>
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500 fill-current" />
                        <span className="font-semibold">
                          {stats.averageRating.toFixed(1)} ({stats.totalReviews} reviews)
                        </span>
                      </div>
                    </div>

                    {reviews.length === 0 ? (
                      <Card className="text-center py-12">
                        <CardContent>
                          <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">No reviews yet</h4>
                          <p className="text-gray-600">
                            Reviews from customers will appear here once they're submitted.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {reviews
                          .filter(review => review.is_approved)
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((review: Review) => (
                            <Card key={review.id}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-1">
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
                                  <span className="text-sm text-gray-500">
                                    {review.created_at.toLocaleDateString()}
                                  </span>
                                </div>
                                {review.comment && (
                                  <p className="text-gray-700 mb-3">{review.comment}</p>
                                )}
                                <div className="text-sm text-gray-500">
                                  Customer #{review.user_id}
                                  {review.order_id && ` • Order #${review.order_id}`}
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}
    </div>
  );
}