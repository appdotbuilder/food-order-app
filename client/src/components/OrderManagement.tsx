import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, MapPin, Phone, DollarSign, Eye, CheckCircle, X, AlertCircle } from 'lucide-react';

import type { Restaurant, Order, OrderItem, UpdateOrderStatusInput } from '../../../server/src/schema';

interface OrderManagementProps {
  restaurant: Restaurant;
  orders: Order[];
  onOrderUpdate: () => void;
}

interface OrderWithDetails extends Order {
  orderItems?: OrderItem[];
}

export function OrderManagement({ restaurant, orders, onOrderUpdate }: OrderManagementProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadOrderDetails = useCallback(async (order: Order) => {
    try {
      const orderItems = await trpc.orders.getOrderItems.query(order.id);
      setSelectedOrder({
        ...order,
        orderItems
      });
    } catch (error) {
      console.error('Failed to load order details:', error);
    }
  }, []);

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    setIsUpdating(true);
    try {
      const updateData: UpdateOrderStatusInput = {
        id: orderId,
        status: newStatus as any
      };

      // Set estimated delivery time for out_for_delivery status
      if (newStatus === 'out_for_delivery') {
        const estimatedTime = new Date();
        estimatedTime.setMinutes(estimatedTime.getMinutes() + 30); // 30 minutes from now
        updateData.estimated_delivery_time = estimatedTime;
      }

      await trpc.orders.updateStatus.mutate(updateData);
      onOrderUpdate();
      
      // Update the selected order if it's the one being updated
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
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

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'created': return 'confirmed';
      case 'confirmed': return 'preparing';
      case 'preparing': return 'out_for_delivery';
      case 'out_for_delivery': return 'delivered';
      default: return null;
    }
  };

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case 'created': return 'Confirm Order';
      case 'confirmed': return 'Start Preparing';
      case 'preparing': return 'Out for Delivery';
      case 'out_for_delivery': return 'Mark Delivered';
      default: return null;
    }
  };

  const canAdvanceStatus = (status: string) => {
    return ['created', 'confirmed', 'preparing', 'out_for_delivery'].includes(status);
  };

  const canCancelOrder = (status: string) => {
    return ['created', 'confirmed'].includes(status);
  };

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    // Priority order: created, confirmed, preparing, out_for_delivery, then by date
    const statusPriority = { 
      'created': 1, 
      'confirmed': 2, 
      'preparing': 3, 
      'out_for_delivery': 4,
      'delivered': 5,
      'canceled': 6
    };
    
    const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 7;
    const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 7;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingOrders = orders.filter(order => 
    ['created', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Order Management</h3>
          <p className="text-gray-600">
            Manage incoming orders for {restaurant.name}
            {pendingOrders > 0 && (
              <span className="ml-2 font-medium text-orange-600">
                ({pendingOrders} pending)
              </span>
            )}
          </p>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="created">New Orders</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pendingOrders > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            🚨 You have {pendingOrders} orders that need attention. Keep customers happy by updating order status promptly!
          </AlertDescription>
        </Alert>
      )}

      {sortedOrders.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-4xl mb-4">📋</div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              {statusFilter === 'all' ? 'No orders yet' : `No ${statusFilter} orders`}
            </h4>
            <p className="text-gray-600">
              {statusFilter === 'all' 
                ? 'Orders from customers will appear here.'
                : `Orders with ${statusFilter} status will appear here.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedOrders.map((order: Order) => (
            <Card 
              key={order.id} 
              className={`hover:shadow-lg transition-all ${
                ['created', 'confirmed'].includes(order.status) 
                  ? 'ring-2 ring-orange-200 bg-orange-50' 
                  : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                  <Badge className={getStatusColor(order.status)}>
                    {getStatusIcon(order.status)} {order.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4" />
                    {order.created_at.toLocaleDateString()} at {order.created_at.toLocaleTimeString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    ${order.total_amount.toFixed(2)}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600 space-y-1">
                  <div>💳 Payment: {order.payment_status.replace('_', ' ')}</div>
                  <div>📦 Items: Customer #{order.user_id}</div>
                  {order.estimated_delivery_time && (
                    <div>🚚 ETA: {order.estimated_delivery_time.toLocaleTimeString()}</div>
                  )}
                </div>

                {order.notes && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Customer Notes:</strong> {order.notes}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {canAdvanceStatus(order.status) && (
                    <Button
                      onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                      disabled={isUpdating}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {getNextStatusLabel(order.status)}
                    </Button>
                  )}

                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => loadOrderDetails(order)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </DialogTrigger>
                      
                      {selectedOrder && selectedOrder.id === order.id && (
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Order #{selectedOrder.id} Details</DialogTitle>
                          </DialogHeader>
                          
                          <div className="space-y-6">
                            {/* Order Status */}
                            <div className="flex items-center justify-between">
                              <Badge className={`${getStatusColor(selectedOrder.status)} text-sm px-3 py-1`}>
                                {getStatusIcon(selectedOrder.status)} {selectedOrder.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                              <div className="text-sm text-gray-600">
                                Placed: {selectedOrder.created_at.toLocaleDateString()} at {selectedOrder.created_at.toLocaleTimeString()}
                              </div>
                            </div>

                            {/* Customer Info */}
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="font-semibold mb-2">Customer Information</h4>
                              <div className="text-sm text-gray-600 space-y-1">
                                <div>Customer ID: #{selectedOrder.user_id}</div>
                                <div>Delivery Address ID: #{selectedOrder.delivery_address_id}</div>
                              </div>
                            </div>

                            {/* Order Items */}
                            {selectedOrder.orderItems && selectedOrder.orderItems.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-3">Order Items</h4>
                                <div className="space-y-2">
                                  {selectedOrder.orderItems.map((item: OrderItem) => (
                                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                                      <div>
                                        <span className="font-medium">Qty {item.quantity}</span>
                                        <span className="text-gray-600 ml-2">× Menu Item #{item.menu_item_id}</span>
                                        <div className="text-xs text-gray-500 mt-1">
                                          ${item.unit_price.toFixed(2)} each
                                        </div>
                                      </div>
                                      <span className="font-medium">${item.total_price.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Order Summary */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-semibold mb-3">Order Summary</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>Subtotal</span>
                                  <span>${selectedOrder.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Delivery Fee</span>
                                  <span>${selectedOrder.delivery_fee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Tax</span>
                                  <span>${selectedOrder.tax_amount.toFixed(2)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold text-lg">
                                  <span>Total</span>
                                  <span className="text-green-600">${selectedOrder.total_amount.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Notes */}
                            {selectedOrder.notes && (
                              <div>
                                <h4 className="font-semibold mb-2">Customer Notes</h4>
                                <p className="text-gray-600 text-sm bg-blue-50 p-3 rounded-lg">
                                  {selectedOrder.notes}
                                </p>
                              </div>
                            )}

                            {/* Quick Actions */}
                            <div className="flex gap-3 pt-4 border-t">
                              {canAdvanceStatus(selectedOrder.status) && (
                                <Button
                                  onClick={() => updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status)!)}
                                  disabled={isUpdating}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  {getNextStatusLabel(selectedOrder.status)}
                                </Button>
                              )}
                              
                              {canCancelOrder(selectedOrder.status) && (
                                <Button
                                  variant="destructive"
                                  onClick={() => updateOrderStatus(selectedOrder.id, 'canceled')}
                                  disabled={isUpdating}
                                  className="flex-1"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel Order
                                </Button>
                              )}
                            </div>
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>

                    {canCancelOrder(order.status) && (
                      <Button
                        variant="destructive"
                        onClick={() => updateOrderStatus(order.id, 'canceled')}
                        disabled={isUpdating}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}