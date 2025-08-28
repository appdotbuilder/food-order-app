import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Star, MapPin, Clock, Plus, Minus, ShoppingCart, ArrowLeft, CheckCircle } from 'lucide-react';

import type { Restaurant, User, MenuItem, MenuCategory, MenuItemOption, AddToCartInput } from '../../../server/src/schema';

interface RestaurantMenuProps {
  restaurant: Restaurant;
  user: User;
  onCartUpdate: () => void;
}

interface MenuItemWithOptions extends MenuItem {
  options?: MenuItemOption[];
}

export function RestaurantMenu({ restaurant, user, onCartUpdate }: RestaurantMenuProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithOptions[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItemWithOptions | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadMenuData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [categoriesData, menuItemsData] = await Promise.all([
        trpc.menuCategories.getByRestaurant.query(restaurant.id),
        trpc.menuItems.getByRestaurant.query(restaurant.id)
      ]);
      
      const activeCategories = categoriesData.filter(cat => cat.is_active);
      const availableItems = menuItemsData.filter(item => item.is_available);
      
      setCategories(activeCategories);
      setMenuItems(availableItems);
      
      if (activeCategories.length > 0 && !selectedCategory) {
        setSelectedCategory(activeCategories[0].id);
      }
    } catch (error) {
      console.error('Failed to load menu data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [restaurant.id, selectedCategory]);

  const loadItemOptions = useCallback(async (itemId: number) => {
    try {
      const options = await trpc.menuItemOptions.getByMenuItem.query(itemId);
      return options;
    } catch (error) {
      console.error('Failed to load item options:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  const handleItemClick = async (item: MenuItemWithOptions) => {
    const options = await loadItemOptions(item.id);
    setSelectedItem({ ...item, options });
    setSelectedOptions([]);
    setQuantity(1);
  };

  const handleAddToCart = async () => {
    if (!selectedItem) return;

    setIsAddingToCart(true);
    try {
      const cartItem: AddToCartInput = {
        user_id: user.id,
        menu_item_id: selectedItem.id,
        quantity,
        selected_options: selectedOptions.length > 0 ? selectedOptions : undefined
      };

      await trpc.cart.add.mutate(cartItem);
      setShowSuccess(true);
      onCartUpdate();
      
      // Reset form
      setSelectedItem(null);
      setSelectedOptions([]);
      setQuantity(1);
      
      // Hide success message after 2 seconds
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const calculateItemPrice = (item: MenuItemWithOptions) => {
    if (!item.options) return item.price;
    
    const optionsPrice = selectedOptions.reduce((total, optionId) => {
      const option = item.options!.find(opt => opt.id === optionId);
      return total + (option?.price_modifier || 0);
    }, 0);
    
    return item.price + optionsPrice;
  };

  const filteredItems = selectedCategory 
    ? menuItems.filter(item => item.category_id === selectedCategory)
    : menuItems;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
          <div className="lg:col-span-3 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {showSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Item added to cart successfully! 🛒
          </AlertDescription>
        </Alert>
      )}

      {/* Restaurant Header */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-gray-700 mb-3">{restaurant.description}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {restaurant.address}
                </div>
                {restaurant.opening_hours && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {restaurant.opening_hours}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  📞 {restaurant.phone}
                </div>
              </div>
            </div>
            {restaurant.rating && (
              <div className="flex items-center gap-1 bg-green-100 px-3 py-2 rounded-full">
                <Star className="h-4 w-4 fill-green-600 text-green-600" />
                <span className="font-medium text-green-700">
                  {restaurant.rating.toFixed(1)} ({restaurant.total_reviews} reviews)
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Menu Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <Card className="lg:sticky lg:top-6 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Menu Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {categories.map((category: MenuCategory) => {
                const categoryItemCount = menuItems.filter(item => item.category_id === category.id).length;
                return (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "ghost"}
                    className="w-full justify-between text-left"
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <span>{category.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {categoryItemCount}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <div className="lg:col-span-3 space-y-6">
          {selectedCategory && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {categories.find(cat => cat.id === selectedCategory)?.name}
              </h2>
              {categories.find(cat => cat.id === selectedCategory)?.description && (
                <p className="text-gray-600 mb-6">
                  {categories.find(cat => cat.id === selectedCategory)?.description}
                </p>
              )}
            </div>
          )}

          {filteredItems.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-4xl mb-4">🍽️</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No items available</h3>
                <p className="text-gray-600">
                  {selectedCategory 
                    ? 'No items in this category right now'
                    : 'No menu items available'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item: MenuItemWithOptions) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-gray-600 mb-3 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold text-orange-600">
                            ${item.price.toFixed(2)}
                          </span>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                onClick={() => handleItemClick(item)}
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add to Cart
                              </Button>
                            </DialogTrigger>
                            
                            {selectedItem && selectedItem.id === item.id && (
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>{selectedItem.name}</DialogTitle>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                  {selectedItem.description && (
                                    <p className="text-gray-600">{selectedItem.description}</p>
                                  )}
                                  
                                  <div className="text-2xl font-bold text-orange-600">
                                    ${selectedItem.price.toFixed(2)}
                                  </div>

                                  {selectedItem.options && selectedItem.options.length > 0 && (
                                    <div>
                                      <h4 className="font-semibold mb-3">Customize your order:</h4>
                                      <div className="space-y-2">
                                        {selectedItem.options.map((option: MenuItemOption) => (
                                          <div key={option.id} className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <input
                                                type="checkbox"
                                                id={`option-${option.id}`}
                                                checked={selectedOptions.includes(option.id)}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                  if (e.target.checked) {
                                                    setSelectedOptions((prev: number[]) => [...prev, option.id]);
                                                  } else {
                                                    setSelectedOptions((prev: number[]) => 
                                                      prev.filter(id => id !== option.id)
                                                    );
                                                  }
                                                }}
                                                className="rounded border-gray-300"
                                              />
                                              <label 
                                                htmlFor={`option-${option.id}`}
                                                className="text-sm"
                                              >
                                                {option.name}
                                                {option.is_required && (
                                                  <span className="text-red-500 ml-1">*</span>
                                                )}
                                              </label>
                                            </div>
                                            <span className="text-sm text-gray-600">
                                              {option.price_modifier >= 0 ? '+' : ''}
                                              ${option.price_modifier.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <Separator />

                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold">Quantity:</span>
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        disabled={quantity <= 1}
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                      <span className="w-8 text-center">{quantity}</span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setQuantity(quantity + 1)}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span className="text-orange-600">
                                      ${(calculateItemPrice(selectedItem) * quantity).toFixed(2)}
                                    </span>
                                  </div>

                                  <Button 
                                    onClick={handleAddToCart}
                                    disabled={isAddingToCart}
                                    className="w-full bg-orange-600 hover:bg-orange-700"
                                  >
                                    <ShoppingCart className="h-4 w-4 mr-2" />
                                    {isAddingToCart ? 'Adding...' : 'Add to Cart'}
                                  </Button>
                                </div>
                              </DialogContent>
                            )}
                          </Dialog>
                        </div>
                      </div>
                      {item.image_url && (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-24 h-24 object-cover rounded-lg ml-4"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}