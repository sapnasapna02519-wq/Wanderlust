const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      id: { type: String, required: true },
      username: { type: String, required: true },
      email: { type: String, required: true },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
