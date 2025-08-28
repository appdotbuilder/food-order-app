import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
// Using type-only imports for better TypeScript compliance
import type { User, UserRole } from '../../server/src/schema';

// Import components
import { CustomerDashboard } from '@/components/CustomerDashboard';
import { RestaurantOwnerDashboard } from '@/components/RestaurantOwnerDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Register form state
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'customer' as UserRole
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await trpc.loginUser.mutate(loginData);
      if (result) {
        setUser(result);
        // Reset form
        setLoginData({ email: '', password: '' });
      } else {
        alert('Invalid credentials');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await trpc.registerUser.mutate({
        ...registerData,
        phone: registerData.phone || null // Convert empty string to null
      });
      setUser(result);
      // Reset form
      setRegisterData({
        email: '',
        password: '',
        name: '',
        phone: '',
        role: 'customer'
      });
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAuthMode('login');
  };

  // If user is not logged in, show authentication
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-orange-600">🍽️ FoodDelivery</CardTitle>
            <CardDescription>
              Welcome to your favorite food delivery app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as 'login' | 'register')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={loginData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoginData(prev => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoginData(prev => ({ ...prev, password: e.target.value }))
                    }
                    required
                  />
                  <Button type="submit" disabled={isLoading} className="w-full bg-orange-600 hover:bg-orange-700">
                    {isLoading ? 'Logging in...' : 'Login'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <Input
                    placeholder="Full Name"
                    value={registerData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData(prev => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={registerData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData(prev => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password (min 6 chars)"
                    value={registerData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData(prev => ({ ...prev, password: e.target.value }))
                    }
                    minLength={6}
                    required
                  />
                  <Input
                    type="tel"
                    placeholder="Phone Number (optional)"
                    value={registerData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData(prev => ({ ...prev, phone: e.target.value }))
                    }
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={registerData.role === 'customer' ? 'default' : 'outline'}
                        onClick={() => setRegisterData(prev => ({ ...prev, role: 'customer' }))}
                        className="h-auto p-3"
                      >
                        🛒 Customer
                      </Button>
                      <Button
                        type="button"
                        variant={registerData.role === 'restaurant_owner' ? 'default' : 'outline'}
                        onClick={() => setRegisterData(prev => ({ ...prev, role: 'restaurant_owner' }))}
                        className="h-auto p-3"
                      >
                        🏪 Restaurant Owner
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full bg-orange-600 hover:bg-orange-700">
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in, show role-based dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-orange-600">🍽️ FoodDelivery</h1>
              <Badge variant="secondary" className="capitalize">
                {user.role.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user.name}!</span>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.role === 'customer' && <CustomerDashboard user={user} />}
        {user.role === 'restaurant_owner' && <RestaurantOwnerDashboard user={user} />}
        {user.role === 'admin' && <AdminDashboard user={user} />}
      </main>
    </div>
  );
}

export default App;