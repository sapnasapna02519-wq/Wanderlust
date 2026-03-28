const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      required: [true, "Rating is required."],
      min: [1, "Rating must be between 1 and 5."],
      max: [5, "Rating must be between 1 and 5."],
    },
    comment: {
      type: String,
      required: [true, "Review comment is required."],
      minlength: [10, "Comment must be at least 10 characters."],
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);
