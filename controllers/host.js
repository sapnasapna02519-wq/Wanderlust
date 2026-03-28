const Listing = require("../models/listing");
const Booking = require("../models/booking");

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildLastSixMonthBuckets() {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d),
      label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      bookings: 0,
      revenue: 0,
    });
  }
  return buckets;
}

module.exports.renderDashboard = async (req, res) => {
  const ownerId = req.currentUser.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ownedListings = await Listing.find({ owner: ownerId })
    .select("_id title location country price image")
    .sort({ createdAt: -1 });

  const listingIds = ownedListings.map((listing) => listing._id);

  if (listingIds.length === 0) {
    return res.render("host/dashboard.ejs", {
      metrics: {
        totalListings: 0,
        totalBookings: 0,
        upcomingStays: 0,
        grossRevenue: 0,
        pendingPayments: 0,
      },
      listingPerformance: [],
      recentBookings: [],
      monthBuckets: buildLastSixMonthBuckets(),
      maxRevenue: 1,
      maxBookings: 1,
      ownedListings,
    });
  }

  const bookings = await Booking.find({ listing: { $in: listingIds } })
    .populate("listing", "title")
    .populate("guest", "username email")
    .sort({ createdAt: -1 });

  const totalBookings = bookings.length;
  const upcomingStays = bookings.filter(
    (booking) => booking.status === "confirmed" && booking.checkIn >= today
  ).length;
  const paidBookings = bookings.filter(
    (booking) => booking.paymentStatus === "paid"
  );
  const grossRevenue = paidBookings.reduce(
    (sum, booking) => sum + Number(booking.totalPrice || 0),
    0
  );
  const pendingPayments = bookings.filter(
    (booking) =>
      booking.status === "confirmed" &&
      (booking.paymentStatus === "pending" || !booking.paymentStatus)
  ).length;

  const bookingCountByListing = new Map();
  for (const booking of bookings) {
    const id = booking.listing?._id ? String(booking.listing._id) : null;
    if (!id) continue;
    bookingCountByListing.set(id, (bookingCountByListing.get(id) || 0) + 1);
  }

  const listingPerformance = ownedListings
    .map((listing) => ({
      listingId: listing._id,
      title: listing.title,
      location: `${listing.location || ""}${listing.country ? `, ${listing.country}` : ""}`,
      bookingCount: bookingCountByListing.get(String(listing._id)) || 0,
      price: listing.price || 0,
    }))
    .sort((a, b) => b.bookingCount - a.bookingCount);

  const monthBuckets = buildLastSixMonthBuckets();
  const bucketMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));
  for (const booking of bookings) {
    const bookingMonth = monthKey(new Date(booking.createdAt));
    const bookingBucket = bucketMap.get(bookingMonth);
    if (bookingBucket) {
      bookingBucket.bookings += 1;
    }

    if (booking.paymentStatus === "paid") {
      const paidDate = booking.paidAt ? new Date(booking.paidAt) : new Date(booking.createdAt);
      const revenueMonth = monthKey(paidDate);
      const revenueBucket = bucketMap.get(revenueMonth);
      if (revenueBucket) {
        revenueBucket.revenue += Number(booking.totalPrice || 0);
      }
    }
  }

  const maxRevenue = Math.max(...monthBuckets.map((bucket) => bucket.revenue), 1);
  const maxBookings = Math.max(...monthBuckets.map((bucket) => bucket.bookings), 1);

  return res.render("host/dashboard.ejs", {
    metrics: {
      totalListings: ownedListings.length,
      totalBookings,
      upcomingStays,
      grossRevenue,
      pendingPayments,
    },
    listingPerformance,
    recentBookings: bookings.slice(0, 10),
    monthBuckets,
    maxRevenue,
    maxBookings,
    ownedListings,
  });
};
