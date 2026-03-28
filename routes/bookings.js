const express = require("express");
const router = express.Router();
const bookingsController = require("../controllers/bookings");
const { isLoggedIn } = require("../middleware");

router.get("/", isLoggedIn, bookingsController.listMyBookings);
router.get("/:bookingId/checkout", isLoggedIn, bookingsController.renderCheckout);
router.post("/:bookingId/pay", isLoggedIn, bookingsController.payForBooking);
router.delete("/:bookingId", isLoggedIn, bookingsController.cancelBooking);

module.exports = router;
