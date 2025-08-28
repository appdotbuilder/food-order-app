import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  paymentsTable, 
  ordersTable, 
  usersTable, 
  restaurantsTable, 
  addressesTable 
} from '../db/schema';
import { type CreatePaymentInput } from '../schema';
import { 
  createPayment, 
  processPayment, 
  getOrderPayments, 
  refundPayment, 
  getAllPayments 
} from '../handlers/payments';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'User',
  phone: '+1234567890',
  role: 'customer' as const
};

const testOwner = {
  email: 'owner@example.com',
  password_hash: 'hashed_password',
  first_name: 'Restaurant',
  last_name: 'Owner',
  phone: '+1234567890',
  role: 'restaurant_owner' as const
};

const testRestaurant = {
  name: 'Test Restaurant',
  description: 'A test restaurant',
  address: '123 Test St',
  phone: '+1234567890',
  email: 'restaurant@example.com',
  opening_hours: '9:00-22:00',
  is_active: true
};

const testAddress = {
  street_address: '456 Delivery St',
  city: 'Test City',
  state: 'Test State',
  postal_code: '12345',
  country: 'Test Country',
  is_default: true
};

const testOrder = {
  subtotal: '25.99',
  delivery_fee: '3.00',
  tax_amount: '2.32',
  total_amount: '31.31',
  payment_status: 'pending' as const,
  status: 'created' as const,
  notes: 'Test order'
};

const testPaymentInput: CreatePaymentInput = {
  order_id: 0, // Will be set after order creation
  amount: 31.31,
  payment_method: 'credit_card'
};

describe('Payment Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let ownerId: number;
  let restaurantId: number;
  let addressId: number;
  let orderId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test owner
    const ownerResult = await db.insert(usersTable)
      .values(testOwner)
      .returning()
      .execute();
    ownerId = ownerResult[0].id;

    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({ ...testRestaurant, owner_id: ownerId })
      .returning()
      .execute();
    restaurantId = restaurantResult[0].id;

    // Create test address
    const addressResult = await db.insert(addressesTable)
      .values({ ...testAddress, user_id: userId })
      .returning()
      .execute();
    addressId = addressResult[0].id;

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: userId,
        restaurant_id: restaurantId,
        delivery_address_id: addressId
      })
      .returning()
      .execute();
    orderId = orderResult[0].id;
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const input = { ...testPaymentInput, order_id: orderId };
      
      const result = await createPayment(input);

      expect(result.order_id).toEqual(orderId);
      expect(result.amount).toEqual(31.31);
      expect(result.payment_method).toEqual('credit_card');
      expect(result.payment_status).toEqual('pending');
      expect(result.transaction_id).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save payment to database', async () => {
      const input = { ...testPaymentInput, order_id: orderId };
      
      const result = await createPayment(input);

      const payments = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, result.id))
        .execute();

      expect(payments).toHaveLength(1);
      expect(payments[0].order_id).toEqual(orderId);
      expect(parseFloat(payments[0].amount)).toEqual(31.31);
      expect(payments[0].payment_method).toEqual('credit_card');
      expect(payments[0].payment_status).toEqual('pending');
    });

    it('should throw error for non-existent order', async () => {
      const input = { ...testPaymentInput, order_id: 999 };

      expect(createPayment(input)).rejects.toThrow(/Order with ID 999 not found/i);
    });
  });

  describe('processPayment', () => {
    it('should process a pending payment successfully', async () => {
      // Create a payment first
      const input = { ...testPaymentInput, order_id: orderId };
      const payment = await createPayment(input);

      const result = await processPayment(payment.id);

      expect(result.id).toEqual(payment.id);
      expect(result.payment_status).toEqual('completed');
      expect(result.transaction_id).toMatch(/^mock-txn-\d+-\d+$/);
      expect(result.amount).toEqual(31.31);
    });

    it('should update payment in database', async () => {
      // Create a payment first
      const input = { ...testPaymentInput, order_id: orderId };
      const payment = await createPayment(input);

      const result = await processPayment(payment.id);

      const payments = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, result.id))
        .execute();

      expect(payments).toHaveLength(1);
      expect(payments[0].payment_status).toEqual('completed');
      expect(payments[0].transaction_id).toMatch(/^mock-txn-\d+-\d+$/);
    });

    it('should throw error for non-existent payment', async () => {
      expect(processPayment(999)).rejects.toThrow(/Payment with ID 999 not found/i);
    });

    it('should throw error for non-pending payment', async () => {
      // Create a payment and process it
      const input = { ...testPaymentInput, order_id: orderId };
      const payment = await createPayment(input);
      await processPayment(payment.id);

      // Try to process again
      expect(processPayment(payment.id)).rejects.toThrow(/Payment \d+ is not in pending status/i);
    });
  });

  describe('getOrderPayments', () => {
    it('should fetch all payments for an order', async () => {
      // Create multiple payments for the same order
      const input1 = { ...testPaymentInput, order_id: orderId, amount: 15.00 };
      const input2 = { ...testPaymentInput, order_id: orderId, amount: 25.00 };
      
      const payment1 = await createPayment(input1);
      const payment2 = await createPayment(input2);

      const result = await getOrderPayments(orderId);

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toContain(payment1.id);
      expect(result.map(p => p.id)).toContain(payment2.id);
      expect(result.find(p => p.id === payment1.id)?.amount).toEqual(15.00);
      expect(result.find(p => p.id === payment2.id)?.amount).toEqual(25.00);
    });

    it('should return empty array for order with no payments', async () => {
      const result = await getOrderPayments(orderId);

      expect(result).toHaveLength(0);
    });

    it('should throw error for non-existent order', async () => {
      expect(getOrderPayments(999)).rejects.toThrow(/Order with ID 999 not found/i);
    });
  });

  describe('refundPayment', () => {
    it('should refund a completed payment successfully', async () => {
      // Create and process a payment first
      const input = { ...testPaymentInput, order_id: orderId };
      const payment = await createPayment(input);
      await processPayment(payment.id);

      const result = await refundPayment(payment.id);

      expect(result.id).toEqual(payment.id);
      expect(result.payment_status).toEqual('refunded');
      expect(result.transaction_id).toMatch(/^mock-refund-\d+-\d+$/);
      expect(result.amount).toEqual(31.31);
    });

    it('should update payment status in database', async () => {
      // Create and process a payment first
      const input = { ...testPaymentInput, order_id: orderId };
      const payment = await createPayment(input);
      await processPayment(payment.id);

      const result = await refundPayment(payment.id);

      const payments = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, result.id))
        .execute();

      expect(payments).toHaveLength(1);
      expect(payments[0].payment_status).toEqual('refunded');
      expect(payments[0].transaction_id).toMatch(/^mock-refund-\d+-\d+$/);
    });

    it('should throw error for non-existent payment', async () => {
      expect(refundPayment(999)).rejects.toThrow(/Payment with ID 999 not found/i);
    });

    it('should throw error for non-completed payment', async () => {
      // Create a pending payment
      const input = { ...testPaymentInput, order_id: orderId };
      const payment = await createPayment(input);

      expect(refundPayment(payment.id)).rejects.toThrow(/Payment \d+ cannot be refunded - status is pending/i);
    });
  });

  describe('getAllPayments', () => {
    it('should fetch all payments in the system', async () => {
      // Create payments for different orders
      const input1 = { ...testPaymentInput, order_id: orderId, amount: 20.00 };
      const payment1 = await createPayment(input1);

      // Create another order for variety
      const orderResult2 = await db.insert(ordersTable)
        .values({
          ...testOrder,
          user_id: userId,
          restaurant_id: restaurantId,
          delivery_address_id: addressId,
          total_amount: '45.99'
        })
        .returning()
        .execute();
      const orderId2 = orderResult2[0].id;

      const input2 = { ...testPaymentInput, order_id: orderId2, amount: 45.99 };
      const payment2 = await createPayment(input2);

      const result = await getAllPayments();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toContain(payment1.id);
      expect(result.map(p => p.id)).toContain(payment2.id);
      expect(result.find(p => p.id === payment1.id)?.amount).toEqual(20.00);
      expect(result.find(p => p.id === payment2.id)?.amount).toEqual(45.99);
    });

    it('should return empty array when no payments exist', async () => {
      const result = await getAllPayments();

      expect(result).toHaveLength(0);
    });

    it('should include payments with all statuses', async () => {
      // Create payments with different statuses
      const input = { ...testPaymentInput, order_id: orderId };
      const payment1 = await createPayment(input);
      const payment2 = await createPayment(input);
      
      // Process one payment
      await processPayment(payment2.id);

      const result = await getAllPayments();

      expect(result).toHaveLength(2);
      expect(result.find(p => p.id === payment1.id)?.payment_status).toEqual('pending');
      expect(result.find(p => p.id === payment2.id)?.payment_status).toEqual('completed');
    });
  });
});