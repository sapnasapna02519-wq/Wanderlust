const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review");

const VALID_CATEGORIES = [
  "Beach",
  "Mountain",
  "City",
  "Farm",
  "Lake",
  "Desert",
];

const listingSchema = new Schema({
  title: {
    type: String,
    required: [true, "Title is required."],
    minlength: [5, "Title must be at least 5 characters long."],
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Description is required."],
    minlength: [20, "Description must be at least 20 characters long."],
    trim: true,
  },
  image: {
    filename: {
      type: String,
      default: "listingimage",
    },
    url: {
      type: String,
      required: [true, "Image URL is required."],
      trim: true,
      validate: {
        validator: (value) => /^https?:\/\/.+/i.test(value),
        message: "Image URL must be a valid URL starting with http or https.",
      },
    },
  },
  price: {
    type: Number,
    required: [true, "Price is required."],
    min: [1, "Price must be greater than 0."],
  },
  location: {
    type: String,
    required: [true, "Location is required."],
    trim: true,
  },
  country: {
    type: String,
    required: [true, "Country is required."],
    trim: true,
  },
  category: {
    type: String,
    required: [true, "Category is required."],
    enum: {
      values: VALID_CATEGORIES,
      message: "Category must be one of Beach, Mountain, City, Farm, Lake, Desert.",
    },
    trim: true,
  },
  hostName: {
    type: String,
    trim: true,
    default: "Wanderlust Host",
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
}, {
  timestamps: true,
});

listingSchema.pre("findOneAndDelete", async function deleteListingReviews() {
  const doc = await this.model.findOne(this.getQuery());
  if (doc && doc.reviews.length > 0) {
    await Review.deleteMany({ _id: { $in: doc.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
