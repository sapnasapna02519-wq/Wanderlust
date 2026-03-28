const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const { sendBookingStatusEmail } = require("../utils/mailer");

const DAY_MS = 24 * 60 * 60 * 1000;

function toStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateInput(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return toStartOfDay(date);
}

function calculateNights(checkIn, checkOut) {
  return Math.ceil((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
}

async function getOwnedBooking(bookingId, userId) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) return { error: "invalid" };
  const booking = await Booking.findById(bookingId).populate("listing");
  if (!booking) return { error: "not_found" };
  if (String(booking.guest) !== userId) return { error: "forbidden" };
  return { booking };
}

module.exports.listMyBookings = async (req, res) => {
  const view = req.query.show === "cancelled" || req.query.show === "active" || req.query.show === "all"
    ? req.query.show
    : "active";
  const searchTerm = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const requestedPage = Number.parseInt(req.query.page, 10);
  const pageSize = 6;
  const showCancelled = view === "cancelled";
  const query = { guest: req.currentUser.id };
  if (view === "active") {
    query.status = "confirmed";
  } else if (view === "cancelled") {
    query.status = "cancelled";
  }

  const [bookings, activeCount, cancelledCount] = await Promise.all([
    Booking.find(query).populate("listing").sort({ createdAt: -1 }),
    Booking.countDocuments({ guest: req.currentUser.id, status: "confirmed" }),
    Booking.countDocuments({ guest: req.currentUser.id, status: "cancelled" }),
  ]);

  const filteredBookings = normalizedSearchTerm
    ? bookings.filter((booking) => {
        const listing = booking.listing || {};
        const haystack = [
          listing.title || "",
          listing.location || "",
          listing.country || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      })
    : bookings;

  const totalFiltered = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBookings = filteredBookings.slice(startIndex, startIndex + pageSize);

  res.render("bookings/index.ejs", {
    bookings: paginatedBookings,
    showCancelled,
    currentView: view,
    searchTerm,
    filteredCount: totalFiltered,
    pagination: {
      page: currentPage,
      totalPages,
      pageSize,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
    },
    counts: {
      active: activeCount,
      cancelled: cancelledCount,
      all: activeCount + cancelledCount,
    },
  });
};

module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.redirect("/listings?error=Invalid listing id");
  }

  const listing = await Listing.findById(id);
  if (!listing) {
    return res.redirect("/listings?error=Listing not found");
  }

  const checkIn = parseDateInput(req.body.booking && req.body.booking.checkIn);
  const checkOut = parseDateInput(req.body.booking && req.body.booking.checkOut);
  const guests = Number(req.body.booking && req.body.booking.guests);

  if (!checkIn || !checkOut) {
    return res.redirect(`/listings/${id}?error=Please select valid check-in and check-out dates`);
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > 16) {
    return res.redirect(`/listings/${id}?error=Guests must be between 1 and 16`);
  }

  const today = toStartOfDay(new Date());
  if (checkIn < today) {
    return res.redirect(`/listings/${id}?error=Check-in date cannot be in the past`);
  }
  if (checkOut <= checkIn) {
    return res.redirect(`/listings/${id}?error=Check-out must be after check-in`);
  }

  const hasOverlap = await Booking.exists({
    listing: listing._id,
    status: "confirmed",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  });

  if (hasOverlap) {
    return res.redirect(`/listings/${id}?error=These dates are already booked. Please select other dates.`);
  }

  const nights = calculateNights(checkIn, checkOut);
  const pricePerNight = Number(listing.price || 0);
  const totalPrice = nights * pricePerNight;

  if (totalPrice <= 0) {
    return res.redirect(`/listings/${id}?error=Unable to create booking for this listing`);
  }

  const createdBooking = await Booking.create({
    listing: listing._id,
    guest: req.currentUser.id,
    checkIn,
    checkOut,
    guests,
    nights,
    pricePerNight,
    totalPrice,
  });

  if (req.currentUser && req.currentUser.email) {
    sendBookingStatusEmail({
      to: req.currentUser.email,
      status: "confirmed",
      bookingId: String(createdBooking._id),
      listingTitle: listing.title,
      location: listing.location,
      country: listing.country,
      checkIn: createdBooking.checkIn,
      checkOut: createdBooking.checkOut,
      guests: createdBooking.guests,
      totalPrice: createdBooking.totalPrice,
    }).catch(() => {});
  }

  res.redirect("/bookings?success=Booking confirmed successfully");
};

module.exports.renderCheckout = async (req, res) => {
  const { bookingId } = req.params;
  const result = await getOwnedBooking(bookingId, req.currentUser.id);
  if (result.error === "invalid") {
    return res.redirect("/bookings?error=Invalid booking id");
  }
  if (result.error === "not_found") {
    return res.redirect("/bookings?error=Booking not found");
  }
  if (result.error === "forbidden") {
    return res.redirect("/bookings?error=You are not allowed to access this booking");
  }

  const { booking } = result;
  if (booking.status !== "confirmed") {
    return res.redirect("/bookings?error=Only confirmed bookings can be paid");
  }
  if (booking.paymentStatus === "paid") {
    return res.redirect("/bookings?success=Booking already paid");
  }

  return res.render("bookings/checkout.ejs", { booking });
};

module.exports.payForBooking = async (req, res) => {
  const { bookingId } = req.params;
  const result = await getOwnedBooking(bookingId, req.currentUser.id);
  if (result.error === "invalid") {
    return res.redirect("/bookings?error=Invalid booking id");
  }
  if (result.error === "not_found") {
    return res.redirect("/bookings?error=Booking not found");
  }
  if (result.error === "forbidden") {
    return res.redirect("/bookings?error=You are not allowed to pay for this booking");
  }

  const { booking } = result;
  if (booking.status !== "confirmed") {
    return res.redirect("/bookings?error=Only confirmed bookings can be paid");
  }
  if (booking.paymentStatus === "paid") {
    return res.redirect("/bookings?success=Booking already paid");
  }

  booking.paymentStatus = "paid";
  booking.paymentProvider = "mock";
  booking.paymentReference = `MOCK-${Date.now()}-${String(booking._id).slice(-6)}`;
  booking.paidAt = new Date();
  await booking.save();

  return res.redirect("/bookings?success=Payment successful");
};

module.exports.cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.redirect("/bookings?error=Invalid booking id");
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.redirect("/bookings?error=Booking not found");
  }

  if (String(booking.guest) !== req.currentUser.id) {
    return res.redirect("/bookings?error=You are not allowed to cancel this booking");
  }

  if (booking.status === "cancelled") {
    return res.redirect("/bookings?error=Booking is already cancelled");
  }

  booking.status = "cancelled";
  if (booking.paymentStatus === "paid") {
    booking.paymentStatus = "refunded";
  }
  await booking.save();

  if (req.currentUser && req.currentUser.email) {
    let listing = null;
    if (booking.listing && mongoose.Types.ObjectId.isValid(String(booking.listing))) {
      listing = await Listing.findById(booking.listing).select("title location country");
    }

    sendBookingStatusEmail({
      to: req.currentUser.email,
      status: "cancelled",
      bookingId: String(booking._id),
      listingTitle: listing ? listing.title : "Listing",
      location: listing ? listing.location : "",
      country: listing ? listing.country : "",
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
      totalPrice: booking.totalPrice,
    }).catch(() => {});
  }

  res.redirect("/bookings?success=Booking cancelled");
};
