import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Trash2, Check } from 'lucide-react';

import type { User, Address, CreateAddressInput } from '../../../server/src/schema';

interface AddressManagerProps {
  user: User;
  addresses: Address[];
  onAddressUpdate: () => void;
  selectedAddress: Address | null;
  onAddressSelect: (address: Address) => void;
}

export function AddressManager({ user, addresses, onAddressUpdate, selectedAddress, onAddressSelect }: AddressManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateAddressInput>({
    user_id: user.id,
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    is_default: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await trpc.addresses.create.mutate(formData);
      setShowAddForm(false);
      setFormData({
        user_id: user.id,
        street_address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'United States',
        is_default: false
      });
      onAddressUpdate();
    } catch (error) {
      console.error('Failed to add address:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAddress = async (addressId: number) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      await trpc.addresses.delete.mutate(addressId);
      onAddressUpdate();
    } catch (error) {
      console.error('Failed to delete address:', error);
    }
  };

  return (
    <div className="space-y-4">
      {addresses.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Select Address:</h4>
          {addresses.map((address: Address) => (
            <Card 
              key={address.id} 
              className={`cursor-pointer transition-all ${
                selectedAddress?.id === address.id 
                  ? 'ring-2 ring-orange-500 bg-orange-50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => onAddressSelect(address)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      {address.is_default && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                      {selectedAddress?.id === address.id && (
                        <Badge className="text-xs bg-orange-600">Selected</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">{address.street_address}</p>
                    <p className="text-xs text-gray-600">
                      {address.city}, {address.state} {address.postal_code}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedAddress?.id === address.id && (
                      <Check className="h-4 w-4 text-orange-600" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        deleteAddress(address.id);
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
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

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add New Address
          </Button>
        </DialogTrigger>
        
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Delivery Address</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Street Address"
              value={formData.street_address}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev: CreateAddressInput) => ({ ...prev, street_address: e.target.value }))
              }
              required
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="City"
                value={formData.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateAddressInput) => ({ ...prev, city: e.target.value }))
                }
                required
              />
              <Select 
                value={formData.state} 
                onValueChange={(value: string) =>
                  setFormData((prev: CreateAddressInput) => ({ ...prev, state: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                  <SelectItem value="FL">Florida</SelectItem>
                  <SelectItem value="IL">Illinois</SelectItem>
                  <SelectItem value="PA">Pennsylvania</SelectItem>
                  <SelectItem value="OH">Ohio</SelectItem>
                  <SelectItem value="GA">Georgia</SelectItem>
                  <SelectItem value="NC">North Carolina</SelectItem>
                  <SelectItem value="MI">Michigan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="ZIP Code"
                value={formData.postal_code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateAddressInput) => ({ ...prev, postal_code: e.target.value }))
                }
                required
              />
              <Select 
                value={formData.country} 
                onValueChange={(value: string) =>
                  setFormData((prev: CreateAddressInput) => ({ ...prev, country: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="Mexico">Mexico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default || false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateAddressInput) => ({ ...prev, is_default: e.target.checked }))
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="is_default" className="text-sm">
                Set as default address
              </label>
            </div>
            
            <div className="flex space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
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
                {isSubmitting ? 'Adding...' : 'Add Address'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}