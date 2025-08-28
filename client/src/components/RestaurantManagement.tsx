import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Store, MapPin, Phone, Mail, Clock, Star, AlertCircle } from 'lucide-react';

import type { User, Restaurant, CreateRestaurantInput, UpdateRestaurantInput } from '../../../server/src/schema';

interface RestaurantManagementProps {
  user: User;
  restaurants: Restaurant[];
  onRestaurantUpdate: () => void;
}

export function RestaurantManagement({ user, restaurants, onRestaurantUpdate }: RestaurantManagementProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createData, setCreateData] = useState<CreateRestaurantInput>({
    owner_id: user.id,
    name: '',
    description: null,
    address: '',
    phone: '',
    email: null,
    opening_hours: null,
    is_active: true
  });

  const [updateData, setUpdateData] = useState<UpdateRestaurantInput>({
    id: 0,
    name: '',
    description: null,
    address: '',
    phone: '',
    email: null,
    opening_hours: null,
    is_active: true
  });

  const resetCreateForm = useCallback(() => {
    setCreateData({
      owner_id: user.id,
      name: '',
      description: null,
      address: '',
      phone: '',
      email: null,
      opening_hours: null,
      is_active: true
    });
    setError(null);
  }, [user.id]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await trpc.restaurants.create.mutate(createData);
      setShowCreateForm(false);
      resetCreateForm();
      onRestaurantUpdate();
    } catch (error: any) {
      setError(error.message || 'Failed to create restaurant');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRestaurant) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await trpc.restaurants.update.mutate(updateData);
      setEditingRestaurant(null);
      onRestaurantUpdate();
    } catch (error: any) {
      setError(error.message || 'Failed to update restaurant');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (restaurant: Restaurant) => {
    setUpdateData({
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      opening_hours: restaurant.opening_hours,
      is_active: restaurant.is_active
    });
    setEditingRestaurant(restaurant);
    setError(null);
  };

  const handleDelete = async (restaurantId: number) => {
    if (!confirm('Are you sure you want to delete this restaurant? This action cannot be undone.')) {
      return;
    }

    try {
      await trpc.restaurants.delete.mutate(restaurantId);
      onRestaurantUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to delete restaurant');
    }
  };

  const toggleRestaurantStatus = async (restaurant: Restaurant) => {
    try {
      await trpc.restaurants.update.mutate({
        id: restaurant.id,
        is_active: !restaurant.is_active
      });
      onRestaurantUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to update restaurant status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Restaurant Management</h3>
          <p className="text-gray-600">Manage your restaurant information and settings</p>
        </div>
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogTrigger asChild>
            <Button onClick={resetCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Restaurant
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Restaurant</DialogTitle>
            </DialogHeader>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Restaurant Name"
                  value={createData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateData((prev: CreateRestaurantInput) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
                <Input
                  type="tel"
                  placeholder="Phone Number"
                  value={createData.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateData((prev: CreateRestaurantInput) => ({ ...prev, phone: e.target.value }))
                  }
                  required
                />
              </div>

              <Input
                placeholder="Full Address"
                value={createData.address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCreateData((prev: CreateRestaurantInput) => ({ ...prev, address: e.target.value }))
                }
                required
              />

              <Input
                type="email"
                placeholder="Email (optional)"
                value={createData.email || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCreateData((prev: CreateRestaurantInput) => ({ ...prev, email: e.target.value || null }))
                }
              />

              <Textarea
                placeholder="Restaurant Description (optional)"
                value={createData.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setCreateData((prev: CreateRestaurantInput) => ({ ...prev, description: e.target.value || null }))
                }
                rows={3}
              />

              <Input
                placeholder="Opening Hours (e.g., Mon-Sun 9AM-10PM) (optional)"
                value={createData.opening_hours || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCreateData((prev: CreateRestaurantInput) => ({ ...prev, opening_hours: e.target.value || null }))
                }
              />

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={createData.is_active || false}
                  onCheckedChange={(checked: boolean) =>
                    setCreateData((prev: CreateRestaurantInput) => ({ ...prev, is_active: checked }))
                  }
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  Restaurant is active and accepting orders
                </label>
              </div>

              <div className="flex space-x-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateForm(false)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create Restaurant'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {restaurants.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No restaurants yet</h4>
            <p className="text-gray-600 mb-4">
              Create your first restaurant to start accepting orders and managing your business.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {restaurants.map((restaurant: Restaurant) => (
            <Card key={restaurant.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      {restaurant.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={restaurant.is_active ? "default" : "secondary"}
                        className={restaurant.is_active ? "bg-green-600" : ""}
                      >
                        {restaurant.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {restaurant.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">
                            {restaurant.rating.toFixed(1)} ({restaurant.total_reviews})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Switch
                      checked={restaurant.is_active}
                      onCheckedChange={() => toggleRestaurantStatus(restaurant)}
                    />
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {restaurant.description && (
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {restaurant.description}
                  </p>
                )}

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="line-clamp-1">{restaurant.address}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{restaurant.phone}</span>
                  </div>
                  
                  {restaurant.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="line-clamp-1">{restaurant.email}</span>
                    </div>
                  )}
                  
                  {restaurant.opening_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span>{restaurant.opening_hours}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-xs text-gray-500">
                    Created: {restaurant.created_at.toLocaleDateString()}
                  </span>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(restaurant)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(restaurant.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingRestaurant} onOpenChange={(open) => !open && setEditingRestaurant(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Restaurant</DialogTitle>
          </DialogHeader>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleUpdateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Restaurant Name"
                value={updateData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUpdateData((prev: UpdateRestaurantInput) => ({ ...prev, name: e.target.value }))
                }
                required
              />
              <Input
                type="tel"
                placeholder="Phone Number"
                value={updateData.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUpdateData((prev: UpdateRestaurantInput) => ({ ...prev, phone: e.target.value }))
                }
                required
              />
            </div>

            <Input
              placeholder="Full Address"
              value={updateData.address}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUpdateData((prev: UpdateRestaurantInput) => ({ ...prev, address: e.target.value }))
              }
              required
            />

            <Input
              type="email"
              placeholder="Email (optional)"
              value={updateData.email || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUpdateData((prev: UpdateRestaurantInput) => ({ ...prev, email: e.target.value || null }))
              }
            />

            <Textarea
              placeholder="Restaurant Description (optional)"
              value={updateData.description || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setUpdateData((prev: UpdateRestaurantInput) => ({ ...prev, description: e.target.value || null }))
              }
              rows={3}
            />

            <Input
              placeholder="Opening Hours (e.g., Mon-Sun 9AM-10PM) (optional)"
              value={updateData.opening_hours || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUpdateData((prev: UpdateRestaurantInput) => ({ ...prev, opening_hours: e.target.value || null }))
              }
            />

            <div className="flex items-center space-x-2">
              <Switch
                id="edit_is_active"
                checked={updateData.is_active || false}
                onCheckedChange={(checked: boolean) =>
                  setUpdateData((prev: UpdateRestaurantInput) => ({ ...prev, is_active: checked }))
                }
              />
              <label htmlFor="edit_is_active" className="text-sm font-medium">
                Restaurant is active and accepting orders
              </label>
            </div>

            <div className="flex space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingRestaurant(null)}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Updating...' : 'Update Restaurant'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}