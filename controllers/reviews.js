const Listing = require("../models/listing");
const Review = require("../models/review");

function sanitizeReviewInput(input = {}) {
  return {
    rating: Number(input.rating),
    comment: typeof input.comment === "string" ? input.comment.trim() : "",
  };
}

module.exports.createReview = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    return res.redirect("/listings?error=Listing not found");
  }

  const sanitized = sanitizeReviewInput(req.body.review);
  const review = new Review({
    ...sanitized,
    author: req.currentUser.id,
    listing: listing._id,
  });

  try {
    await review.save();
    listing.reviews.push(review._id);
    await listing.save();
    res.redirect(`/listings/${id}?success=Review added successfully`);
  } catch (error) {
    res.redirect(`/listings/${id}?error=Unable to add review. Check your inputs.`);
  }
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;

  await Listing.findByIdAndUpdate(id, {
    $pull: { reviews: reviewId },
  });
  await Review.findByIdAndDelete(reviewId);

  res.redirect(`/listings/${id}?success=Review deleted successfully`);
};
