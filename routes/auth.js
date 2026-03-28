const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const { isLoggedIn, createRateLimiter } = require("../middleware");

const loginRateLimiter = createRateLimiter({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  maxRequests: Number(process.env.LOGIN_RATE_LIMIT_MAX || 8),
  keyPrefix: "login",
  message: (waitSeconds) =>
    `Too many login attempts. Try again in ${waitSeconds} seconds.`,
});

const forgotRateLimiter = createRateLimiter({
  windowMs: Number(process.env.FORGOT_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  maxRequests: Number(process.env.FORGOT_RATE_LIMIT_MAX || 5),
  keyPrefix: "forgot-password",
  message: (waitSeconds) =>
    `Too many password reset requests. Try again in ${waitSeconds} seconds.`,
});

const resetRateLimiter = createRateLimiter({
  windowMs: Number(process.env.RESET_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  maxRequests: Number(process.env.RESET_RATE_LIMIT_MAX || 6),
  keyPrefix: "reset-password",
  message: (waitSeconds) =>
    `Too many reset attempts. Try again in ${waitSeconds} seconds.`,
});

router.get("/signup", authController.renderSignup);
router.post("/signup", authController.signup);
router.get("/login", authController.renderLogin);
router.post("/login", loginRateLimiter, authController.login);
router.get("/google", authController.googleAuth);
router.get("/google/callback", authController.googleCallback);
router.post("/logout", isLoggedIn, authController.logout);

router.get("/profile", isLoggedIn, authController.renderProfile);
router.post("/profile", isLoggedIn, authController.updateProfile);
router.get("/change-password", isLoggedIn, authController.renderChangePassword);
router.post("/change-password", isLoggedIn, authController.changePassword);

router.get("/forgot-password", authController.renderForgotPassword);
router.post("/forgot-password", forgotRateLimiter, authController.sendResetLink);
router.get("/reset-password/:token", authController.renderResetPassword);
router.post("/reset-password/:token", resetRateLimiter, authController.resetPassword);

module.exports = router;
