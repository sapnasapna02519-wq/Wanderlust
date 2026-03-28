const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
  {
    listing: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },
    guest: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    checkIn: {
      type: Date,
      required: [true, "Check-in date is required."],
    },
    checkOut: {
      type: Date,
      required: [true, "Check-out date is required."],
    },
    guests: {
      type: Number,
      required: [true, "Guests count is required."],
      min: [1, "At least 1 guest is required."],
      max: [16, "Maximum 16 guests allowed."],
    },
    nights: {
      type: Number,
      required: true,
      min: 1,
    },
    pricePerNight: {
      type: Number,
      required: true,
      min: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },
    paymentProvider: {
      type: String,
      trim: true,
      default: "mock",
    },
    paymentReference: {
      type: String,
      trim: true,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ listing: 1, checkIn: 1, checkOut: 1, status: 1 });
bookingSchema.index({ guest: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
