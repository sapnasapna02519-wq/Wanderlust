const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required."],
      minlength: [3, "Username must be at least 3 characters."],
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      lowercase: true,
      trim: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address."],
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: null,
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    passwordSalt: {
      type: String,
      required: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    resetTokenHash: {
      type: String,
      default: null,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
    },
    favoriteListings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing",
      },
    ],
  },
  { timestamps: true }
);

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, 310000, 32, "sha256")
    .toString("hex");
}

userSchema.statics.register = async function register({ username, email, password }) {
  const normalizedUsername = (username || "").trim();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  const user = new this({
    username: normalizedUsername,
    email: normalizedEmail,
    passwordSalt: salt,
    passwordHash,
  });

  return user.save();
};

userSchema.methods.verifyPassword = function verifyPassword(password) {
  const expectedHash = hashPassword(password, this.passwordSalt);
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(this.passwordHash, "hex")
  );
};

userSchema.methods.setPassword = function setPassword(newPassword) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(newPassword, salt);
  this.passwordSalt = salt;
  this.passwordHash = hash;
};

module.exports = mongoose.model("User", userSchema);
