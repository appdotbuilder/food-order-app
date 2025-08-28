import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, MapPin, Phone, CheckCircle } from 'lucide-react';

import type { Order } from '../../../server/src/schema';

interface OrderTrackingProps {
  orders: Order[];
}

export function OrderTracking({ orders }: OrderTrackingProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getStatusStep = (status: string) => {
    const steps = ['created', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
    return steps.indexOf(status) + 1;
  };

  const getProgressPercentage = (status: string) => {
    const step = getStatusStep(status);
    return (step / 5) * 100;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-blue-100 text-blue-700';
      case 'confirmed': return 'bg-yellow-100 text-yellow-700';
      case 'preparing': return 'bg-orange-100 text-orange-700';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-700';
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'canceled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'created': return '📝';
      case 'confirmed': return '✅';
      case 'preparing': return '🍳';
      case 'out_for_delivery': return '🚚';
      case 'delivered': return '📦';
      case 'canceled': return '❌';
      default: return '⏳';
    }
  };

  const getEstimatedDeliveryText = (order: Order) => {
    if (order.estimated_delivery_time) {
      const estimatedTime = order.estimated_delivery_time;
      const now = currentTime;
      const diffInMinutes = Math.ceil((estimatedTime.getTime() - now.getTime()) / (1000 * 60));
      
      if (diffInMinutes > 0) {
        if (diffInMinutes < 60) {
          return `${diffInMinutes} minutes`;
        } else {
          const hours = Math.floor(diffInMinutes / 60);
          const minutes = diffInMinutes % 60;
          return `${hours}h ${minutes}m`;
        }
      } else {
        return 'Any moment now!';
      }
    }
    
    // Default estimates based on status
    switch (order.status) {
      case 'created': return '45-60 minutes';
      case 'confirmed': return '40-50 minutes';
      case 'preparing': return '25-35 minutes';
      case 'out_for_delivery': return '10-15 minutes';
      case 'delivered': return 'Delivered';
      default: return 'Estimating...';
    }
  };

  const getStatusSteps = () => [
    { key: 'created', label: 'Order Placed', icon: '📝', description: 'Your order has been placed successfully' },
    { key: 'confirmed', label: 'Confirmed', icon: '✅', description: 'Restaurant has confirmed your order' },
    { key: 'preparing', label: 'Preparing', icon: '🍳', description: 'Your delicious food is being prepared' },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🚚', description: 'Your order is on the way!' },
    { key: 'delivered', label: 'Delivered', icon: '📦', description: 'Enjoy your meal!' }
  ];

  if (orders.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="text-4xl mb-4">🚚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No active orders</h2>
          <p className="text-gray-600">
            When you place an order, you'll be able to track it here in real-time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">🚚 Order Tracking</h2>
        <p className="text-gray-600">{orders.length} active order{orders.length > 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-6">
        {orders.map((order: Order) => (
          <Card key={order.id} className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">Order #{order.id}</CardTitle>
                  <p className="text-gray-600 mt-1">
                    Placed {order.created_at.toLocaleDateString()} at {order.created_at.toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={`${getStatusColor(order.status)} text-sm px-3 py-1 mb-2`}>
                    {getStatusIcon(order.status)} {order.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      ETA: {getEstimatedDeliveryText(order)}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Order Progress */}
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(getProgressPercentage(order.status))}% Complete</span>
                </div>
                <Progress value={getProgressPercentage(order.status)} className="h-2" />
              </div>

              {/* Status Steps */}
              <div className="space-y-3">
                {getStatusSteps().map((step, index) => {
                  const isCompleted = getStatusStep(order.status) > index + 1;
                  const isCurrent = getStatusStep(order.status) === index + 1;
                  const isUpcoming = getStatusStep(order.status) < index + 1;

                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        isCompleted 
                          ? 'bg-green-500 text-white' 
                          : isCurrent 
                            ? 'bg-orange-500 text-white animate-pulse' 
                            : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <span className="text-xs">{step.icon}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium ${
                          isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {step.label}
                          {isCurrent && <span className="ml-2 text-orange-600 text-sm">(Current)</span>}
                        </div>
                        <div className={`text-sm ${
                          isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {step.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Amount</span>
                    <div className="font-semibold text-lg text-orange-600">
                      ${order.total_amount.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Payment Status</span>
                    <div className="font-medium capitalize">
                      {order.payment_status.replace('_', ' ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Delivery Fee</span>
                    <div className="font-medium">
                      ${order.delivery_fee.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Order ID</span>
                    <div className="font-medium">#{order.id}</div>
                  </div>
                </div>

                {order.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-gray-600 text-sm">Special Instructions:</span>
                    <div className="text-sm mt-1">{order.notes}</div>
                  </div>
                )}
              </div>

              {/* Live Updates Indicator */}
              {!['delivered', 'canceled'].includes(order.status) && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  Live updates will appear here automatically
                </div>
              )}

              {/* Contact Information */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Need Help?</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>Contact restaurant: (555) 123-4567</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Support: help@foodieexpress.com</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}