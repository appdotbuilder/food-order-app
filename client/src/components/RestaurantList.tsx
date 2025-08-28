import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Star, Clock, MapPin, Search } from 'lucide-react';

import type { Restaurant } from '../../../server/src/schema';

interface RestaurantListProps {
  onRestaurantSelect: (restaurant: Restaurant) => void;
}

export function RestaurantList({ onRestaurantSelect }: RestaurantListProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadRestaurants = useCallback(async () => {
    try {
      setIsLoading(true);
      const allRestaurants = await trpc.restaurants.getAll.query();
      const activeRestaurants = allRestaurants.filter(restaurant => restaurant.is_active);
      setRestaurants(activeRestaurants);
      setFilteredRestaurants(activeRestaurants);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = restaurants.filter(restaurant =>
        restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        restaurant.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        restaurant.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRestaurants(filtered);
    } else {
      setFilteredRestaurants(restaurants);
    }
  }, [searchQuery, restaurants]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Available Restaurants</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🏪 Available Restaurants</h2>
          <p className="text-gray-600 mt-1">
            Discover amazing restaurants near you ({filteredRestaurants.length} available)
          </p>
        </div>
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search restaurants, cuisine, location..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Restaurant Grid */}
      {filteredRestaurants.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No restaurants found' : 'No restaurants available'}
            </h3>
            <p className="text-gray-600">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Check back later for new restaurants'
              }
            </p>
            {searchQuery && (
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                Clear Search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((restaurant: Restaurant) => (
            <Card key={restaurant.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg group-hover:text-orange-600 transition-colors">
                    {restaurant.name}
                  </CardTitle>
                  {restaurant.rating && (
                    <div className="flex items-center gap-1 bg-green-100 px-2 py-1 rounded-full">
                      <Star className="h-3 w-3 fill-green-600 text-green-600" />
                      <span className="text-xs font-medium text-green-700">
                        {restaurant.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
                {restaurant.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {restaurant.description}
                  </p>
                )}
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="line-clamp-1">{restaurant.address}</span>
                  </div>
                  
                  {restaurant.opening_hours && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{restaurant.opening_hours}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    📞 {restaurant.phone}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      🍽️ {restaurant.total_reviews} reviews
                    </Badge>
                  </div>
                  
                  <Button 
                    onClick={() => onRestaurantSelect(restaurant)}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    View Menu
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}