import { db } from '../db';
import { paymentsTable, ordersTable } from '../db/schema';
import { type CreatePaymentInput, type Payment } from '../schema';
import { eq } from 'drizzle-orm';

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  try {
    // Verify the order exists before creating payment
    const orderExists = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, input.order_id))
      .execute();

    if (orderExists.length === 0) {
      throw new Error(`Order with ID ${input.order_id} not found`);
    }

    // Insert payment record
    const result = await db.insert(paymentsTable)
      .values({
        order_id: input.order_id,
        amount: input.amount.toString(),
        payment_method: input.payment_method,
        payment_status: 'pending',
        transaction_id: null
      })
      .returning()
      .execute();

    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount)
    };
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
}

export async function processPayment(paymentId: number): Promise<Payment> {
  try {
    // Verify payment exists and is in pending status
    const existingPayment = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    if (existingPayment.length === 0) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    if (existingPayment[0].payment_status !== 'pending') {
      throw new Error(`Payment ${paymentId} is not in pending status`);
    }

    // Simulate payment processing - generate mock transaction ID
    const transactionId = `mock-txn-${Date.now()}-${paymentId}`;

    // Update payment status to completed
    const result = await db.update(paymentsTable)
      .set({
        payment_status: 'completed',
        transaction_id: transactionId,
        updated_at: new Date()
      })
      .where(eq(paymentsTable.id, paymentId))
      .returning()
      .execute();

    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount)
    };
  } catch (error) {
    console.error('Payment processing failed:', error);
    throw error;
  }
}

export async function getOrderPayments(orderId: number): Promise<Payment[]> {
  try {
    // Verify order exists
    const orderExists = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();

    if (orderExists.length === 0) {
      throw new Error(`Order with ID ${orderId} not found`);
    }

    // Fetch all payments for the order
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.order_id, orderId))
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount)
    }));
  } catch (error) {
    console.error('Failed to fetch order payments:', error);
    throw error;
  }
}

export async function refundPayment(paymentId: number): Promise<Payment> {
  try {
    // Verify payment exists and can be refunded
    const existingPayment = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    if (existingPayment.length === 0) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    if (existingPayment[0].payment_status !== 'completed') {
      throw new Error(`Payment ${paymentId} cannot be refunded - status is ${existingPayment[0].payment_status}`);
    }

    // Generate mock refund transaction ID
    const refundTransactionId = `mock-refund-${Date.now()}-${paymentId}`;

    // Update payment status to refunded
    const result = await db.update(paymentsTable)
      .set({
        payment_status: 'refunded',
        transaction_id: refundTransactionId,
        updated_at: new Date()
      })
      .where(eq(paymentsTable.id, paymentId))
      .returning()
      .execute();

    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount)
    };
  } catch (error) {
    console.error('Payment refund failed:', error);
    throw error;
  }
}

export async function getAllPayments(): Promise<Payment[]> {
  try {
    // Fetch all payments in the system
    const results = await db.select()
      .from(paymentsTable)
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount)
    }));
  } catch (error) {
    console.error('Failed to fetch all payments:', error);
    throw error;
  }
}