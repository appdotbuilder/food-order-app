import { db } from '../db';
import { paymentsTable, ordersTable } from '../db/schema';
import { type CreatePaymentInput, type Payment } from '../schema';
import { eq } from 'drizzle-orm';

// Mock payment gateway simulation
const mockPaymentGateway = {
  async processPayment(paymentMethod: string, amount: number): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate different outcomes based on payment method
    if (paymentMethod === 'invalid_card') {
      return { success: false, error: 'Invalid card details' };
    }
    
    // 95% success rate for other payment methods
    const success = Math.random() > 0.05;
    
    if (success) {
      return {
        success: true,
        transactionId: 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      };
    } else {
      return { success: false, error: 'Payment gateway error' };
    }
  },

  async processRefund(transactionId: string, amount: number): Promise<{ success: boolean; refundId?: string; error?: string }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 98% success rate for refunds
    const success = Math.random() > 0.02;
    
    if (success) {
      return {
        success: true,
        refundId: 'REF_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      };
    } else {
      return { success: false, error: 'Refund processing failed' };
    }
  }
};

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  try {
    // First, get the order to determine the payment amount
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, input.order_id))
      .execute();

    if (orders.length === 0) {
      throw new Error('Order not found');
    }

    const order = orders[0];
    
    // Create payment record
    const result = await db.insert(paymentsTable)
      .values({
        order_id: input.order_id,
        amount: order.total_amount, // Use order's total amount
        status: 'pending',
        payment_method: input.payment_method,
        transaction_id: null
      })
      .returning()
      .execute();

    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount) // Convert numeric to number
    };
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
}

export async function processPayment(paymentId: number): Promise<Payment | null> {
  try {
    // Get the payment record
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    if (payments.length === 0) {
      return null;
    }

    const payment = payments[0];
    
    // Only process payments that are pending
    if (payment.status !== 'pending') {
      throw new Error(`Payment is already ${payment.status}`);
    }

    // Process with mock payment gateway
    const gatewayResult = await mockPaymentGateway.processPayment(
      payment.payment_method,
      parseFloat(payment.amount)
    );

    // Update payment based on gateway result
    const updateData = gatewayResult.success 
      ? {
          status: 'completed' as const,
          transaction_id: gatewayResult.transactionId || null,
          updated_at: new Date()
        }
      : {
          status: 'failed' as const,
          updated_at: new Date()
        };

    const updatedResult = await db.update(paymentsTable)
      .set(updateData)
      .where(eq(paymentsTable.id, paymentId))
      .returning()
      .execute();

    const updatedPayment = updatedResult[0];
    return {
      ...updatedPayment,
      amount: parseFloat(updatedPayment.amount) // Convert numeric to number
    };
  } catch (error) {
    console.error('Payment processing failed:', error);
    throw error;
  }
}

export async function getPaymentByOrderId(orderId: number): Promise<Payment | null> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.order_id, orderId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const payment = results[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount) // Convert numeric to number
    };
  } catch (error) {
    console.error('Payment retrieval failed:', error);
    throw error;
  }
}

export async function refundPayment(paymentId: number): Promise<Payment | null> {
  try {
    // Get the payment record
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    if (payments.length === 0) {
      return null;
    }

    const payment = payments[0];
    
    // Only refund completed payments
    if (payment.status !== 'completed') {
      throw new Error(`Cannot refund payment with status: ${payment.status}`);
    }

    // Process refund with mock payment gateway
    const refundResult = await mockPaymentGateway.processRefund(
      payment.transaction_id || '',
      parseFloat(payment.amount)
    );

    if (!refundResult.success) {
      throw new Error(`Refund failed: ${refundResult.error}`);
    }

    // Update payment status to refunded
    const updatedResult = await db.update(paymentsTable)
      .set({
        status: 'refunded',
        updated_at: new Date()
      })
      .where(eq(paymentsTable.id, paymentId))
      .returning()
      .execute();

    const updatedPayment = updatedResult[0];
    return {
      ...updatedPayment,
      amount: parseFloat(updatedPayment.amount) // Convert numeric to number
    };
  } catch (error) {
    console.error('Payment refund failed:', error);
    throw error;
  }
}