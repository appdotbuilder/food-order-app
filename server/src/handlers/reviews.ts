import { db } from '../db';
import { reviewsTable, restaurantsTable } from '../db/schema';
import { type CreateReviewInput, type ModerateReviewInput, type Review } from '../schema';
import { eq, and, avg, count, SQL } from 'drizzle-orm';

export async function createReview(input: CreateReviewInput): Promise<Review> {
  try {
    // Verify restaurant exists
    const restaurant = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, input.restaurant_id))
      .execute();

    if (restaurant.length === 0) {
      throw new Error('Restaurant not found');
    }

    // Insert the review
    const result = await db.insert(reviewsTable)
      .values({
        user_id: input.user_id,
        restaurant_id: input.restaurant_id,
        order_id: input.order_id || null,
        rating: input.rating,
        comment: input.comment || null,
        is_approved: false // Reviews need admin approval by default
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Review creation failed:', error);
    throw error;
  }
}

export async function getRestaurantReviews(restaurantId: number): Promise<Review[]> {
  try {
    // Only return approved reviews
    const results = await db.select()
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.restaurant_id, restaurantId),
          eq(reviewsTable.is_approved, true)
        )
      )
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch restaurant reviews:', error);
    throw error;
  }
}

export async function getUserReviews(userId: number): Promise<Review[]> {
  try {
    const results = await db.select()
      .from(reviewsTable)
      .where(eq(reviewsTable.user_id, userId))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch user reviews:', error);
    throw error;
  }
}

export async function getPendingReviews(): Promise<Review[]> {
  try {
    const results = await db.select()
      .from(reviewsTable)
      .where(eq(reviewsTable.is_approved, false))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch pending reviews:', error);
    throw error;
  }
}

export async function moderateReview(input: ModerateReviewInput): Promise<Review> {
  try {
    // Update review approval status
    const result = await db.update(reviewsTable)
      .set({
        is_approved: input.is_approved,
        updated_at: new Date()
      })
      .where(eq(reviewsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Review not found');
    }

    const updatedReview = result[0];

    // If approved, update restaurant rating statistics
    if (input.is_approved) {
      await updateRestaurantRating(updatedReview.restaurant_id);
    }

    return updatedReview;
  } catch (error) {
    console.error('Review moderation failed:', error);
    throw error;
  }
}

export async function deleteReview(reviewId: number): Promise<boolean> {
  try {
    // Get review details before deletion to update restaurant stats
    const reviewToDelete = await db.select()
      .from(reviewsTable)
      .where(eq(reviewsTable.id, reviewId))
      .execute();

    if (reviewToDelete.length === 0) {
      throw new Error('Review not found');
    }

    const review = reviewToDelete[0];

    // Delete the review
    const result = await db.delete(reviewsTable)
      .where(eq(reviewsTable.id, reviewId))
      .execute();

    // If the deleted review was approved, update restaurant rating
    if (review.is_approved) {
      await updateRestaurantRating(review.restaurant_id);
    }

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Review deletion failed:', error);
    throw error;
  }
}

// Helper function to recalculate restaurant rating
async function updateRestaurantRating(restaurantId: number): Promise<void> {
  try {
    // Calculate average rating and total count for approved reviews
    const stats = await db.select({
      avgRating: avg(reviewsTable.rating),
      totalReviews: count(reviewsTable.id)
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.restaurant_id, restaurantId),
        eq(reviewsTable.is_approved, true)
      )
    )
    .execute();

    const avgRating = stats[0].avgRating ? parseFloat(stats[0].avgRating) : null;
    const totalReviews = stats[0].totalReviews || 0;

    // Update restaurant with new stats
    await db.update(restaurantsTable)
      .set({
        rating: avgRating?.toString() || null, // Convert to string for numeric column
        total_reviews: totalReviews,
        updated_at: new Date()
      })
      .where(eq(restaurantsTable.id, restaurantId))
      .execute();
  } catch (error) {
    console.error('Failed to update restaurant rating:', error);
    throw error;
  }
}