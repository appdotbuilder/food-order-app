import { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ShoppingCart, Star, Clock, MapPin } from 'lucide-react';

// Import types
import type { User, Restaurant, MenuItem, Order, CartItem, Review } from '../../server/src/schema';

// Import components
import { AuthComponent } from '@/components/AuthComponent';
import { CustomerDashboard } from '@/components/CustomerDashboard';
import { RestaurantOwnerDashboard } from '@/components/RestaurantOwnerDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user session
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      loadUser(parseInt(storedUserId));
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async (userId: number) => {
    try {
      const user = await trpc.auth.getCurrentUser.query(userId);
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('userId');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('userId', user.id.toString());
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('userId');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading FoodieExpress...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🍕 FoodieExpress</h1>
            <p className="text-lg text-gray-600">Delicious food delivered to your doorstep</p>
          </div>
          <AuthComponent onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-orange-600">🍕 FoodieExpress</h1>
              <Badge variant="secondary" className="capitalize">
                {currentUser.role.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {currentUser.first_name} {currentUser.last_name}
              </span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {currentUser.role === 'customer' && (
          <CustomerDashboard user={currentUser} />
        )}
        {currentUser.role === 'restaurant_owner' && (
          <RestaurantOwnerDashboard user={currentUser} />
        )}
        {currentUser.role === 'admin' && (
          <AdminDashboard user={currentUser} />
        )}
      </main>
    </div>
  );
}

export default App;