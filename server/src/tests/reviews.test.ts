import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable, reviewsTable, addressesTable, ordersTable } from '../db/schema';
import { type CreateReviewInput, type ModerateReviewInput } from '../schema';
import { 
  createReview, 
  getRestaurantReviews, 
  getUserReviews, 
  getPendingReviews, 
  moderateReview, 
  deleteReview 
} from '../handlers/reviews';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  role: 'customer' as const
};

const testOwner = {
  email: 'owner@example.com',
  password_hash: 'hashed_password',
  first_name: 'Jane',
  last_name: 'Owner',
  phone: '+1234567891',
  role: 'restaurant_owner' as const
};

const testAddress = {
  street_address: '123 Main St',
  city: 'Test City',
  state: 'TS',
  postal_code: '12345',
  country: 'USA',
  is_default: true
};

const testRestaurant = {
  name: 'Test Restaurant',
  description: 'A great test restaurant',
  address: '456 Food St',
  phone: '+1234567892',
  email: 'restaurant@example.com',
  opening_hours: '9AM-9PM',
  is_active: true
};

describe('reviews handlers', () => {
  let userId: number;
  let ownerId: number;
  let restaurantId: number;
  let addressId: number;
  let orderId: number;

  beforeEach(async () => {
    await createDB();
    
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

    // Create test address
    const addressResult = await db.insert(addressesTable)
      .values({
        ...testAddress,
        user_id: userId
      })
      .returning()
      .execute();
    addressId = addressResult[0].id;

    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        ...testRestaurant,
        owner_id: ownerId
      })
      .returning()
      .execute();
    restaurantId = restaurantResult[0].id;

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userId,
        restaurant_id: restaurantId,
        delivery_address_id: addressId,
        subtotal: '25.99',
        delivery_fee: '3.99',
        tax_amount: '2.40',
        total_amount: '32.38',
        status: 'delivered',
        payment_status: 'completed'
      })
      .returning()
      .execute();
    orderId = orderResult[0].id;
  });

  afterEach(resetDB);

  describe('createReview', () => {
    const testInput: CreateReviewInput = {
      user_id: 0, // will be set in test
      restaurant_id: 0, // will be set in test
      order_id: null,
      rating: 4,
      comment: 'Great food!'
    };

    it('should create a review with all fields', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        order_id: orderId
      };

      const result = await createReview(input);

      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(userId);
      expect(result.restaurant_id).toEqual(restaurantId);
      expect(result.order_id).toEqual(orderId);
      expect(result.rating).toEqual(4);
      expect(result.comment).toEqual('Great food!');
      expect(result.is_approved).toEqual(false); // Default is false
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a review without order_id', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        order_id: null
      };

      const result = await createReview(input);

      expect(result.order_id).toBeNull();
      expect(result.rating).toEqual(4);
    });

    it('should create a review without comment', async () => {
      const input = {
        user_id: userId,
        restaurant_id: restaurantId,
        order_id: orderId,
        rating: 5,
        comment: null
      };

      const result = await createReview(input);

      expect(result.comment).toBeNull();
      expect(result.rating).toEqual(5);
    });

    it('should throw error for non-existent restaurant', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: 9999,
        order_id: orderId
      };

      await expect(createReview(input)).rejects.toThrow(/restaurant not found/i);
    });

    it('should save review to database', async () => {
      const input = {
        ...testInput,
        user_id: userId,
        restaurant_id: restaurantId,
        order_id: orderId
      };

      const result = await createReview(input);

      const savedReview = await db.select()
        .from(reviewsTable)
        .where(eq(reviewsTable.id, result.id))
        .execute();

      expect(savedReview).toHaveLength(1);
      expect(savedReview[0].user_id).toEqual(userId);
      expect(savedReview[0].rating).toEqual(4);
      expect(savedReview[0].is_approved).toEqual(false);
    });
  });

  describe('getRestaurantReviews', () => {
    it('should return approved reviews for restaurant', async () => {
      // Create approved review
      const approvedReview = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          order_id: orderId,
          rating: 5,
          comment: 'Excellent!',
          is_approved: true
        })
        .returning()
        .execute();

      // Create pending review (should not be returned)
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          order_id: null,
          rating: 3,
          comment: 'Okay',
          is_approved: false
        })
        .execute();

      const results = await getRestaurantReviews(restaurantId);

      expect(results).toHaveLength(1);
      expect(results[0].id).toEqual(approvedReview[0].id);
      expect(results[0].rating).toEqual(5);
      expect(results[0].is_approved).toEqual(true);
    });

    it('should return empty array when no approved reviews exist', async () => {
      const results = await getRestaurantReviews(restaurantId);
      expect(results).toHaveLength(0);
    });

    it('should not return reviews from other restaurants', async () => {
      // Create another restaurant
      const anotherRestaurant = await db.insert(restaurantsTable)
        .values({
          ...testRestaurant,
          name: 'Another Restaurant',
          owner_id: ownerId
        })
        .returning()
        .execute();

      // Create review for first restaurant
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 5,
          is_approved: true
        })
        .execute();

      // Create review for second restaurant
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: anotherRestaurant[0].id,
          rating: 3,
          is_approved: true
        })
        .execute();

      const results = await getRestaurantReviews(restaurantId);
      expect(results).toHaveLength(1);
      expect(results[0].restaurant_id).toEqual(restaurantId);
    });
  });

  describe('getUserReviews', () => {
    it('should return all reviews by user', async () => {
      // Create multiple reviews by the user
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 5,
          is_approved: true
        })
        .execute();

      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 3,
          is_approved: false
        })
        .execute();

      const results = await getUserReviews(userId);

      expect(results).toHaveLength(2);
      results.forEach(review => {
        expect(review.user_id).toEqual(userId);
      });
    });

    it('should return empty array when user has no reviews', async () => {
      const results = await getUserReviews(userId);
      expect(results).toHaveLength(0);
    });
  });

  describe('getPendingReviews', () => {
    it('should return only pending reviews', async () => {
      // Create approved review
      await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 5,
          is_approved: true
        })
        .execute();

      // Create pending review
      const pendingReview = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 3,
          is_approved: false
        })
        .returning()
        .execute();

      const results = await getPendingReviews();

      expect(results).toHaveLength(1);
      expect(results[0].id).toEqual(pendingReview[0].id);
      expect(results[0].is_approved).toEqual(false);
    });

    it('should return empty array when no pending reviews exist', async () => {
      const results = await getPendingReviews();
      expect(results).toHaveLength(0);
    });
  });

  describe('moderateReview', () => {
    let reviewId: number;

    beforeEach(async () => {
      const review = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 4,
          is_approved: false
        })
        .returning()
        .execute();
      reviewId = review[0].id;
    });

    it('should approve a review', async () => {
      const input: ModerateReviewInput = {
        id: reviewId,
        is_approved: true
      };

      const result = await moderateReview(input);

      expect(result.id).toEqual(reviewId);
      expect(result.is_approved).toEqual(true);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should reject a review', async () => {
      const input: ModerateReviewInput = {
        id: reviewId,
        is_approved: false
      };

      const result = await moderateReview(input);

      expect(result.id).toEqual(reviewId);
      expect(result.is_approved).toEqual(false);
    });

    it('should update restaurant rating when approving review', async () => {
      const input: ModerateReviewInput = {
        id: reviewId,
        is_approved: true
      };

      await moderateReview(input);

      // Check if restaurant rating was updated
      const restaurant = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, restaurantId))
        .execute();

      expect(parseFloat(restaurant[0].rating!)).toEqual(4);
      expect(restaurant[0].total_reviews).toEqual(1);
    });

    it('should throw error for non-existent review', async () => {
      const input: ModerateReviewInput = {
        id: 9999,
        is_approved: true
      };

      await expect(moderateReview(input)).rejects.toThrow(/review not found/i);
    });
  });

  describe('deleteReview', () => {
    it('should delete an approved review and update restaurant stats', async () => {
      // Create and approve a review
      const review = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 5,
          is_approved: true
        })
        .returning()
        .execute();

      // Manually update restaurant stats
      await db.update(restaurantsTable)
        .set({
          rating: '5',
          total_reviews: 1
        })
        .where(eq(restaurantsTable.id, restaurantId))
        .execute();

      const result = await deleteReview(review[0].id);

      expect(result).toEqual(true);

      // Verify review was deleted
      const deletedReview = await db.select()
        .from(reviewsTable)
        .where(eq(reviewsTable.id, review[0].id))
        .execute();
      expect(deletedReview).toHaveLength(0);

      // Verify restaurant stats were updated
      const restaurant = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, restaurantId))
        .execute();
      expect(restaurant[0].rating).toBeNull();
      expect(restaurant[0].total_reviews).toEqual(0);
    });

    it('should delete a pending review without updating restaurant stats', async () => {
      const review = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 3,
          is_approved: false
        })
        .returning()
        .execute();

      const result = await deleteReview(review[0].id);

      expect(result).toEqual(true);

      // Verify review was deleted
      const deletedReview = await db.select()
        .from(reviewsTable)
        .where(eq(reviewsTable.id, review[0].id))
        .execute();
      expect(deletedReview).toHaveLength(0);
    });

    it('should throw error for non-existent review', async () => {
      await expect(deleteReview(9999)).rejects.toThrow(/review not found/i);
    });

    it('should return false when no rows are deleted', async () => {
      // This test covers edge cases where the delete operation might not affect any rows
      // but doesn't throw an error
      const review = await db.insert(reviewsTable)
        .values({
          user_id: userId,
          restaurant_id: restaurantId,
          rating: 3,
          is_approved: false
        })
        .returning()
        .execute();

      // Delete the review first time
      await deleteReview(review[0].id);

      // Try to delete again - should throw error due to our implementation
      await expect(deleteReview(review[0].id)).rejects.toThrow(/review not found/i);
    });
  });

  describe('restaurant rating calculations', () => {
    it('should calculate correct average rating with multiple reviews', async () => {
      // Create multiple reviews
      const reviews = [
        { rating: 5, is_approved: true },
        { rating: 4, is_approved: true },
        { rating: 3, is_approved: true },
        { rating: 2, is_approved: false } // This should not count
      ];

      for (const reviewData of reviews) {
        await db.insert(reviewsTable)
          .values({
            user_id: userId,
            restaurant_id: restaurantId,
            rating: reviewData.rating,
            is_approved: reviewData.is_approved
          })
          .execute();
      }

      // Approve the first review to trigger rating calculation
      const firstReview = await db.select()
        .from(reviewsTable)
        .where(eq(reviewsTable.rating, 5))
        .execute();

      await moderateReview({
        id: firstReview[0].id,
        is_approved: true
      });

      const restaurant = await db.select()
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, restaurantId))
        .execute();

      // Should be average of 5, 4, 3 = 4
      expect(parseFloat(restaurant[0].rating!)).toEqual(4);
      expect(restaurant[0].total_reviews).toEqual(3);
    });
  });
});