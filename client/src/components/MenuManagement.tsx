import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, FolderPlus, UtensilsCrossed, AlertCircle, DollarSign, Image } from 'lucide-react';

import type { Restaurant, User, MenuCategory, MenuItem, MenuItemOption, CreateMenuCategoryInput, CreateMenuItemInput, CreateMenuItemOptionInput } from '../../../server/src/schema';

interface MenuManagementProps {
  restaurant: Restaurant;
  user: User;
}

interface MenuItemWithOptions extends MenuItem {
  options?: MenuItemOption[];
}

export function MenuManagement({ restaurant }: MenuManagementProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithOptions[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showOptionForm, setShowOptionForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItemWithOptions | null>(null);
  const [selectedItemForOptions, setSelectedItemForOptions] = useState<MenuItemWithOptions | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categoryForm, setCategoryForm] = useState<CreateMenuCategoryInput>({
    restaurant_id: restaurant.id,
    name: '',
    description: null,
    sort_order: 0,
    is_active: true
  });

  const [itemForm, setItemForm] = useState<CreateMenuItemInput>({
    restaurant_id: restaurant.id,
    category_id: 0,
    name: '',
    description: null,
    price: 0,
    image_url: null,
    is_available: true,
    sort_order: 0
  });

  const [optionForm, setOptionForm] = useState<CreateMenuItemOptionInput>({
    menu_item_id: 0,
    name: '',
    price_modifier: 0,
    is_required: false,
    sort_order: 0
  });

  const loadMenuData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [categoriesData, itemsData] = await Promise.all([
        trpc.menuCategories.getByRestaurant.query(restaurant.id),
        trpc.menuItems.getByRestaurant.query(restaurant.id)
      ]);
      
      setCategories(categoriesData);
      
      // Load options for each item
      const itemsWithOptions = await Promise.all(
        itemsData.map(async (item: MenuItem) => {
          try {
            const options = await trpc.menuItemOptions.getByMenuItem.query(item.id);
            return { ...item, options };
          } catch (error) {
            console.error('Failed to load options for item:', item.id);
            return { ...item, options: [] };
          }
        })
      );
      
      setMenuItems(itemsWithOptions);
      
      if (categoriesData.length > 0 && !selectedCategory) {
        setSelectedCategory(categoriesData[0]);
      }
    } catch (error) {
      console.error('Failed to load menu data:', error);
      setError('Failed to load menu data');
    } finally {
      setIsLoading(false);
    }
  }, [restaurant.id, selectedCategory]);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  const resetCategoryForm = () => {
    setCategoryForm({
      restaurant_id: restaurant.id,
      name: '',
      description: null,
      sort_order: categories.length,
      is_active: true
    });
  };

  const resetItemForm = () => {
    setItemForm({
      restaurant_id: restaurant.id,
      category_id: selectedCategory?.id || 0,
      name: '',
      description: null,
      price: 0,
      image_url: null,
      is_available: true,
      sort_order: 0
    });
  };

  const resetOptionForm = () => {
    setOptionForm({
      menu_item_id: selectedItemForOptions?.id || 0,
      name: '',
      price_modifier: 0,
      is_required: false,
      sort_order: 0
    });
  };

  // Category operations
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await trpc.menuCategories.create.mutate(categoryForm);
      setShowCategoryForm(false);
      resetCategoryForm();
      loadMenuData();
    } catch (error: any) {
      setError(error.message || 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm('Are you sure? This will also delete all items in this category.')) return;

    try {
      await trpc.menuCategories.delete.mutate(categoryId);
      loadMenuData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete category');
    }
  };

  // Menu item operations
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await trpc.menuItems.create.mutate(itemForm);
      setShowItemForm(false);
      resetItemForm();
      loadMenuData();
    } catch (error: any) {
      setError(error.message || 'Failed to create item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await trpc.menuItems.delete.mutate(itemId);
      loadMenuData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete item');
    }
  };

  const toggleItemAvailability = async (item: MenuItemWithOptions) => {
    try {
      await trpc.menuItems.update.mutate({
        id: item.id,
        is_available: !item.is_available
      });
      loadMenuData();
    } catch (error: any) {
      alert(error.message || 'Failed to update item availability');
    }
  };

  // Option operations
  const handleCreateOption = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await trpc.menuItemOptions.create.mutate(optionForm);
      setShowOptionForm(false);
      resetOptionForm();
      loadMenuData();
    } catch (error: any) {
      setError(error.message || 'Failed to create option');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    if (!confirm('Are you sure you want to delete this option?')) return;

    try {
      await trpc.menuItemOptions.delete.mutate(optionId);
      loadMenuData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete option');
    }
  };

  const filteredItems = selectedCategory
    ? menuItems.filter(item => item.category_id === selectedCategory.id)
    : menuItems;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
          <div className="lg:col-span-3 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Menu Management</h3>
          <p className="text-gray-600">Manage categories, items, and options for {restaurant.name}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetCategoryForm}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Menu Category</DialogTitle>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleCreateCategory} className="space-y-4">
                <Input
                  placeholder="Category Name"
                  value={categoryForm.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCategoryForm((prev: CreateMenuCategoryInput) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={categoryForm.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setCategoryForm((prev: CreateMenuCategoryInput) => ({ ...prev, description: e.target.value || null }))
                  }
                />
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={categoryForm.is_active || false}
                    onCheckedChange={(checked: boolean) =>
                      setCategoryForm((prev: CreateMenuCategoryInput) => ({ ...prev, is_active: checked }))
                    }
                  />
                  <label className="text-sm">Category is active</label>
                </div>
                <div className="flex space-x-3">
                  <Button type="button" variant="outline" onClick={() => setShowCategoryForm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showItemForm} onOpenChange={setShowItemForm}>
            <DialogTrigger asChild>
              <Button onClick={resetItemForm} disabled={categories.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Menu Item</DialogTitle>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleCreateItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Item Name"
                    value={itemForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setItemForm((prev: CreateMenuItemInput) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                  <Select
                    value={itemForm.category_id.toString()}
                    onValueChange={(value: string) =>
                      setItemForm((prev: CreateMenuItemInput) => ({ ...prev, category_id: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: MenuCategory) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price ($)"
                    value={itemForm.price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setItemForm((prev: CreateMenuItemInput) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))
                    }
                    required
                  />
                  <Input
                    placeholder="Image URL (optional)"
                    value={itemForm.image_url || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setItemForm((prev: CreateMenuItemInput) => ({ ...prev, image_url: e.target.value || null }))
                    }
                  />
                </div>

                <Textarea
                  placeholder="Description (optional)"
                  value={itemForm.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setItemForm((prev: CreateMenuItemInput) => ({ ...prev, description: e.target.value || null }))
                  }
                />

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={itemForm.is_available || false}
                    onCheckedChange={(checked: boolean) =>
                      setItemForm((prev: CreateMenuItemInput) => ({ ...prev, is_available: checked }))
                    }
                  />
                  <label className="text-sm">Item is available</label>
                </div>

                <div className="flex space-x-3">
                  <Button type="button" variant="outline" onClick={() => setShowItemForm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <UtensilsCrossed className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No menu categories</h4>
            <p className="text-gray-600 mb-4">Create your first category to start building your menu.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Categories Sidebar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Categories</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {categories.map((category: MenuCategory) => {
                  const itemCount = menuItems.filter(item => item.category_id === category.id).length;
                  return (
                    <div key={category.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                      <Button
                        variant={selectedCategory?.id === category.id ? "default" : "ghost"}
                        className="flex-1 justify-start"
                        onClick={() => setSelectedCategory(category)}
                      >
                        <span className="truncate">{category.name}</span>
                      </Button>
                      <div className="flex items-center space-x-1 ml-2">
                        <Badge variant="secondary" className="text-xs">
                          {itemCount}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Menu Items */}
          <div className="lg:col-span-3 space-y-4">
            {selectedCategory && (
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-semibold">{selectedCategory.name} Items</h4>
                <span className="text-gray-600">{filteredItems.length} items</span>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <UtensilsCrossed className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No items in this category</h4>
                  <p className="text-gray-600">Add your first menu item to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item: MenuItemWithOptions) => (
                  <Card key={item.id} className={`transition-all ${!item.is_available ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="font-semibold text-lg">{item.name}</h5>
                            <Badge variant={item.is_available ? "default" : "secondary"}>
                              {item.is_available ? "Available" : "Unavailable"}
                            </Badge>
                          </div>
                          
                          {item.description && (
                            <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                          )}
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              <span className="font-semibold text-green-600">${item.price.toFixed(2)}</span>
                            </div>
                            {item.image_url && (
                              <div className="flex items-center gap-1">
                                <Image className="h-4 w-4" />
                                <span>Has image</span>
                              </div>
                            )}
                            {item.options && item.options.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {item.options.length} options
                              </Badge>
                            )}
                          </div>

                          {item.options && item.options.length > 0 && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <h6 className="text-sm font-medium mb-2">Options:</h6>
                              <div className="space-y-1">
                                {item.options.map((option: MenuItemOption) => (
                                  <div key={option.id} className="flex justify-between items-center text-xs">
                                    <span>
                                      {option.name}
                                      {option.is_required && <span className="text-red-500 ml-1">*</span>}
                                    </span>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-gray-600">
                                        {option.price_modifier >= 0 ? '+' : ''}${option.price_modifier.toFixed(2)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteOption(option.id)}
                                        className="h-6 w-6 p-0 text-red-500"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end space-y-2 ml-4">
                          <Switch
                            checked={item.is_available}
                            onCheckedChange={() => toggleItemAvailability(item)}
                          />
                          
                          <div className="flex space-x-1">
                            <Dialog open={showOptionForm} onOpenChange={setShowOptionForm}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedItemForOptions(item);
                                    resetOptionForm();
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              
                              {selectedItemForOptions?.id === item.id && (
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Add Option to {selectedItemForOptions.name}</DialogTitle>
                                  </DialogHeader>
                                  {error && (
                                    <Alert variant="destructive">
                                      <AlertCircle className="h-4 w-4" />
                                      <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                  )}
                                  <form onSubmit={handleCreateOption} className="space-y-4">
                                    <Input
                                      placeholder="Option Name"
                                      value={optionForm.name}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setOptionForm((prev: CreateMenuItemOptionInput) => ({ ...prev, name: e.target.value }))
                                      }
                                      required
                                    />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="Price modifier (+ or -)"
                                      value={optionForm.price_modifier}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setOptionForm((prev: CreateMenuItemOptionInput) => ({ ...prev, price_modifier: parseFloat(e.target.value) || 0 }))
                                      }
                                    />
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={optionForm.is_required || false}
                                        onCheckedChange={(checked: boolean) =>
                                          setOptionForm((prev: CreateMenuItemOptionInput) => ({ ...prev, is_required: checked }))
                                        }
                                      />
                                      <label className="text-sm">Required option</label>
                                    </div>
                                    <div className="flex space-x-3">
                                      <Button type="button" variant="outline" onClick={() => setShowOptionForm(false)} className="flex-1">
                                        Cancel
                                      </Button>
                                      <Button type="submit" disabled={isSubmitting} className="flex-1">
                                        {isSubmitting ? 'Adding...' : 'Add Option'}
                                      </Button>
                                    </div>
                                  </form>
                                </DialogContent>
                              )}
                            </Dialog>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}