const mongoose = require("mongoose");
const Listing = require("./models/listing");
const Review = require("./models/review");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection.remoteAddress || "unknown";
}

module.exports.createRateLimiter = (options = {}) => {
  const windowMs = Number(options.windowMs || 15 * 60 * 1000);
  const maxRequests = Number(options.maxRequests || 10);
  const keyPrefix = options.keyPrefix || "default";
  const getMessage =
    typeof options.message === "function"
      ? options.message
      : (waitSeconds) =>
          `Too many requests. Please try again in ${waitSeconds} seconds.`;

  const hits = new Map();

  return (req, res, next) => {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const current = hits.get(key);

    if (!current || now > current.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      const waitSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      );
      return res
        .status(429)
        .redirect(
          `${req.path.includes("forgot-password") ? "/auth/forgot-password" : "/auth/login"}?error=${encodeURIComponent(
            getMessage(waitSeconds)
          )}`
        );
    }

    current.count += 1;
    hits.set(key, current);
    return next();
  };
};

module.exports.validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.redirect("/listings?error=Invalid listing id");
  }
  next();
};

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.currentUser) {
    const returnTo = encodeURIComponent(req.originalUrl);
    return res.redirect(`/auth/login?error=Please login to continue&returnTo=${returnTo}`);
  }
  next();
};

module.exports.isListingOwner = async (req, res, next) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    return res.redirect("/listings?error=Listing not found");
  }

  if (listing.owner && String(listing.owner) !== req.currentUser.id) {
    return res.redirect("/listings?error=You are not allowed to modify this listing");
  }

  req.listing = listing;
  next();
};

module.exports.validateReviewInput = (req, res, next) => {
  const review = req.body.review || {};
  const rating = Number(review.rating);
  const comment =
    typeof review.comment === "string" ? review.comment.trim() : "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.redirect(`/listings/${req.params.id}?error=Rating must be between 1 and 5`);
  }

  if (comment.length < 10) {
    return res.redirect(`/listings/${req.params.id}?error=Review must be at least 10 characters`);
  }

  next();
};

module.exports.isReviewOwner = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const [review, listing] = await Promise.all([
    Review.findById(reviewId),
    Listing.findById(id),
  ]);

  if (!review) {
    return res.redirect(`/listings/${id}?error=Review not found`);
  }

  if (!listing) {
    return res.redirect("/listings?error=Listing not found");
  }

  const isReviewAuthor = String(review.author) === req.currentUser.id;
  const isListingOwner =
    listing.owner && String(listing.owner) === req.currentUser.id;

  if (!isReviewAuthor && !isListingOwner) {
    return res.redirect(`/listings/${id}?error=You are not allowed to delete this review`);
  }

  req.review = review;
  next();
};
