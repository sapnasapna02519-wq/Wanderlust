const express = require("express");
const router = express.Router();
const listingController = require("../controllers/listings");
const reviewController = require("../controllers/reviews");
const bookingsController = require("../controllers/bookings");
const { upload } = require("../utils/cloudinary");
const {
  validateObjectId,
  isLoggedIn,
  isListingOwner,
  validateReviewInput,
  isReviewOwner,
} = require("../middleware");

const uploadListingImage = (req, res, next) => {
  upload.single("listing[imageFile]")(req, res, (error) => {
    if (!error) return next();
    const backUrl = req.headers.referer || "/listings";
    return res.redirect(
      `${backUrl}${backUrl.includes("?") ? "&" : "?"}error=Image upload failed. Use JPG, PNG, or WEBP under 5MB.`
    );
  });
};

router.get("/", listingController.listListings);

router.get("/new", isLoggedIn, listingController.renderNewForm);
router.post("/", isLoggedIn, uploadListingImage, listingController.createListing);

router.get("/:id", validateObjectId, listingController.renderShowPage);
router.get("/:id/availability", validateObjectId, listingController.getAvailability);
router.post("/:id/bookings", validateObjectId, isLoggedIn, bookingsController.createBooking);
router.post(
  "/:id/reviews",
  validateObjectId,
  isLoggedIn,
  validateReviewInput,
  reviewController.createReview
);
router.delete(
  "/:id/reviews/:reviewId",
  validateObjectId,
  isLoggedIn,
  isReviewOwner,
  reviewController.deleteReview
);

router.get("/:id/edit", validateObjectId, isLoggedIn, isListingOwner, listingController.renderEditForm);
router.put("/:id", validateObjectId, isLoggedIn, isListingOwner, uploadListingImage, listingController.updateListing);
router.delete("/:id", validateObjectId, isLoggedIn, isListingOwner, listingController.deleteListing);

module.exports = router;
