import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Clock, MapPin, Star, Eye, MessageSquare, X } from 'lucide-react';

import type { User, Order, OrderItem, Restaurant, CreateReviewInput } from '../../../server/src/schema';

interface OrderHistoryProps {
  orders: Order[];
  user: User;
  onOrderUpdate: () => void;
}

interface OrderWithDetails extends Order {
  restaurant?: Restaurant;
  orderItems?: OrderItem[];
}

export function OrderHistory({ orders, user, onOrderUpdate }: OrderHistoryProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewData, setReviewData] = useState<CreateReviewInput>({
    user_id: user.id,
    restaurant_id: 0,
    order_id: null,
    rating: 5,
    comment: null
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const loadOrderDetails = useCallback(async (order: Order) => {
    try {
      const [restaurant, orderItems] = await Promise.all([
        trpc.restaurants.getById.query(order.restaurant_id),
        trpc.orders.getOrderItems.query(order.id)
      ]);
      
      setSelectedOrder({
        ...order,
        restaurant: restaurant || undefined,
        orderItems
      });
    } catch (error) {
      console.error('Failed to load order details:', error);
    }
  }, []);

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

  const cancelOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
      await trpc.orders.cancel.mutate(orderId);
      onOrderUpdate();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReview(true);

    try {
      await trpc.reviews.create.mutate(reviewData);
      setShowReviewForm(false);
      setReviewData({
        user_id: user.id,
        restaurant_id: 0,
        order_id: null,
        rating: 5,
        comment: null
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const openReviewForm = (order: Order, restaurantId: number) => {
    setReviewData({
      user_id: user.id,
      restaurant_id: restaurantId,
      order_id: order.id,
      rating: 5,
      comment: null
    });
    setShowReviewForm(true);
  };

  if (orders.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No orders yet</h2>
          <p className="text-gray-600">
            Once you place an order, you'll be able to track it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedOrders = [...orders].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">📋 Order History</h2>
        <p className="text-gray-600">{orders.length} total orders</p>
      </div>

      <div className="space-y-4">
        {sortedOrders.map((order: Order) => (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-lg font-semibold">Order #{order.id}</span>
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusIcon(order.status)} {order.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div>
                      <Clock className="h-4 w-4 inline mr-1" />
                      {order.created_at.toLocaleDateString()}
                    </div>
                    <div>
                      💰 ${order.total_amount.toFixed(2)}
                    </div>
                    <div>
                      💳 {order.payment_status.replace('_', ' ')}
                    </div>
                    <div>
                      📦 {order.status === 'delivered' ? 'Delivered' : 'In Progress'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => loadOrderDetails(order)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </DialogTrigger>
                    
                    {selectedOrder && selectedOrder.id === order.id && (
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Order #{selectedOrder.id} Details</DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                          {/* Restaurant Info */}
                          {selectedOrder.restaurant && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h3 className="font-semibold text-lg">{selectedOrder.restaurant.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                <MapPin className="h-4 w-4" />
                                {selectedOrder.restaurant.address}
                              </div>
                            </div>
                          )}

                          {/* Order Status */}
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge className={`${getStatusColor(selectedOrder.status)} text-sm px-3 py-1`}>
                                {getStatusIcon(selectedOrder.status)} {selectedOrder.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600">
                              Placed: {selectedOrder.created_at.toLocaleDateString()} at {selectedOrder.created_at.toLocaleTimeString()}
                            </div>
                          </div>

                          {/* Order Items */}
                          {selectedOrder.orderItems && selectedOrder.orderItems.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-3">Items Ordered</h4>
                              <div className="space-y-2">
                                {selectedOrder.orderItems.map((item: OrderItem) => (
                                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                                    <div>
                                      <span className="font-medium">Qty {item.quantity}</span>
                                      <span className="text-gray-600"> × Item #{item.menu_item_id}</span>
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
                                <span className="text-orange-600">${selectedOrder.total_amount.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          {selectedOrder.notes && (
                            <div>
                              <h4 className="font-semibold mb-2">Order Notes</h4>
                              <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-lg">
                                {selectedOrder.notes}
                              </p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-3">
                            {selectedOrder.status === 'delivered' && selectedOrder.restaurant && (
                              <Button 
                                onClick={() => openReviewForm(selectedOrder, selectedOrder.restaurant!.id)}
                                className="flex-1"
                              >
                                <Star className="h-4 w-4 mr-2" />
                                Leave Review
                              </Button>
                            )}
                            {['created', 'confirmed'].includes(selectedOrder.status) && (
                              <Button 
                                variant="destructive" 
                                onClick={() => cancelOrder(selectedOrder.id)}
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

                  {order.status === 'delivered' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openReviewForm(order, order.restaurant_id)}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                  )}

                  {['created', 'confirmed'].includes(order.status) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => cancelOrder(order.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review Dialog */}
      <Dialog open={showReviewForm} onOpenChange={setShowReviewForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={submitReview} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewData((prev: CreateReviewInput) => ({ ...prev, rating: star }))}
                    className={`text-2xl transition-colors ${
                      star <= reviewData.rating ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Comment (optional)</label>
              <Textarea
                placeholder="Share your experience..."
                value={reviewData.comment || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setReviewData((prev: CreateReviewInput) => ({ ...prev, comment: e.target.value || null }))
                }
                rows={4}
              />
            </div>
            
            <div className="flex space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowReviewForm(false)}
                disabled={isSubmittingReview}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmittingReview}
                className="flex-1"
              >
                {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}