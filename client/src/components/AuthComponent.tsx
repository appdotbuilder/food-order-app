import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, UserPlus, LogIn } from 'lucide-react';

import type { User, LoginInput, CreateUserInput } from '../../../server/src/schema';

interface AuthComponentProps {
  onLogin: (user: User) => void;
}

export function AuthComponent({ onLogin }: AuthComponentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [loginData, setLoginData] = useState<LoginInput>({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState<CreateUserInput>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: null,
    role: 'customer'
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await trpc.auth.login.mutate(loginData);
      // Extract user from the response object
      const user = 'user' in response ? response.user : response;
      onLogin(user);
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const user = await trpc.auth.register.mutate(registerData);
      onLogin(user);
    } catch (error: any) {
      setError(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login" className="flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            Login
          </TabsTrigger>
          <TabsTrigger value="register" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Register
          </TabsTrigger>
        </TabsList>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Welcome Back</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={loginData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLoginData((prev: LoginInput) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={loginData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLoginData((prev: LoginInput) => ({ ...prev, password: e.target.value }))
                  }
                  required
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="First Name"
                    value={registerData.first_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: CreateUserInput) => ({ ...prev, first_name: e.target.value }))
                    }
                    required
                  />
                  <Input
                    placeholder="Last Name"
                    value={registerData.last_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: CreateUserInput) => ({ ...prev, last_name: e.target.value }))
                    }
                    required
                  />
                </div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={registerData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRegisterData((prev: CreateUserInput) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
                <Input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={registerData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRegisterData((prev: CreateUserInput) => ({ ...prev, password: e.target.value }))
                  }
                  required
                />
                <Input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={registerData.phone || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRegisterData((prev: CreateUserInput) => ({ ...prev, phone: e.target.value || null }))
                  }
                />
                <Select 
                  value={registerData.role} 
                  onValueChange={(value: 'customer' | 'restaurant_owner' | 'admin') =>
                    setRegisterData((prev: CreateUserInput) => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">🍽️ Customer</SelectItem>
                    <SelectItem value="restaurant_owner">🏪 Restaurant Owner</SelectItem>
                    <SelectItem value="admin">⚙️ Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Demo credentials */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-blue-700">Demo Credentials</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-blue-600">
          <p><strong>Customer:</strong> customer@demo.com / password123</p>
          <p><strong>Owner:</strong> owner@demo.com / password123</p>
          <p><strong>Admin:</strong> admin@demo.com / password123</p>
        </CardContent>
      </Card>
    </div>
  );
}