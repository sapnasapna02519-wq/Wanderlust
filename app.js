const express = require("express");
require("dotenv").config();
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const Session = require("./models/session.js");
const User = require("./models/user.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const crypto = require("crypto");
const listingsRouter = require("./routes/listings");
const authRouter = require("./routes/auth");
const authController = require("./controllers/auth");
const bookingsRouter = require("./routes/bookings");
const favoritesRouter = require("./routes/favorites");
const hostRouter = require("./routes/host");

const PORT = Number(process.env.PORT || 8080);
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const SESSION_COOKIE = "wanderlust_sid";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const index = pair.indexOf("=");
      if (index === -1) return acc;
      const key = decodeURIComponent(pair.slice(0, index));
      const value = decodeURIComponent(pair.slice(index + 1));
      acc[key] = value;
      return acc;
    }, {});
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});
app.use(async (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies[SESSION_COOKIE];
  req.currentUser = null;
  req.sessionId = null;
  req.favoriteListingIds = [];

  if (sessionId) {
    const session = await Session.findOne({
      sid: sessionId,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      res.clearCookie(SESSION_COOKIE);
    } else {
      session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await session.save();
      req.currentUser = session.user;
      req.sessionId = sessionId;
    }
  }

  if (req.currentUser) {
    try {
      const currentDbUser = await User.findById(req.currentUser.id).select("favoriteListings");
      req.favoriteListingIds = (currentDbUser?.favoriteListings || []).map((id) => String(id));
    } catch (error) {
      req.favoriteListingIds = [];
    }
  }

  req.createSession = async (user) => {
    const newSessionId = crypto.randomBytes(24).toString("hex");
    const sessionUser = {
      id: String(user._id),
      username: user.username,
      email: user.email,
    };

    await Session.create({
      sid: newSessionId,
      user: sessionUser,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    req.currentUser = sessionUser;
    req.sessionId = newSessionId;
    res.cookie(SESSION_COOKIE, newSessionId, {
      httpOnly: true,
      maxAge: SESSION_TTL_MS,
      sameSite: "lax",
      secure: IS_PRODUCTION,
    });
  };

  req.refreshSessionUser = async (user) => {
    if (!req.sessionId) return;
    const sessionUser = {
      user: {
        id: String(user._id || user.id),
        username: user.username,
        email: user.email,
      },
    };
    await Session.updateOne({ sid: req.sessionId }, { $set: sessionUser });
    req.currentUser = sessionUser.user;
  };

  req.destroySession = async () => {
    if (req.sessionId) {
      await Session.deleteOne({ sid: req.sessionId });
    }
    req.currentUser = null;
    req.sessionId = null;
    res.clearCookie(SESSION_COOKIE);
  };

  res.locals.currentUser = req.currentUser;
  res.locals.favoriteListingIds = req.favoriteListingIds;
  res.locals.successMsg = req.query.success || null;
  res.locals.errorMsg = req.query.error || null;
  res.locals.smtpConfigured = Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      !String(process.env.SMTP_USER).includes("your-email@example.com") &&
      !String(process.env.SMTP_PASS).includes("your-app-password")
  );
  next();
});

app.get("/", async (req, res) => {
  try {
    const featuredListings = await Listing.find({}).limit(6);
    const totalListings = await Listing.countDocuments();
    const countries = await Listing.distinct("country");
    res.render("home.ejs", {
      featuredListings,
      totalListings,
      totalCountries: countries.length,
    });
  } catch (error) {
    res.redirect("/listings?error=Unable to load homepage right now");
  }
});

app.get("/privacy", (req, res) => {
  res.send("Privacy policy page coming soon.");
});

app.get("/terms", (req, res) => {
  res.send("Terms page coming soon.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/favorites/:listingId", async (req, res) => {
  const { listingId } = req.params;
  if (!req.currentUser) {
    const returnTo = encodeURIComponent(req.originalUrl);
    return res.redirect(`/auth/login?error=Please login to continue&returnTo=${returnTo}`);
  }
  if (!mongoose.Types.ObjectId.isValid(listingId)) {
    return res.redirect("/favorites?error=Invalid listing id");
  }
  const listing = await Listing.findById(listingId).select("_id");
  if (!listing) {
    return res.redirect("/favorites?error=Listing not found");
  }
  return res.redirect(`/listings/${listing._id}`);
});

app.get("/favorite/:listingId", async (req, res) => {
  const { listingId } = req.params;
  return res.redirect(`/favorites/${listingId}`);
});

// Direct mounts to ensure Google OAuth endpoints are always reachable.
app.get("/auth/google", authController.googleAuth);
app.get("/auth/google/callback", authController.googleCallback);

app.use("/auth", authRouter);
app.use("/listings", listingsRouter);
app.use("/bookings", bookingsRouter);
app.use("/favorites", favoritesRouter);
app.use("/wishlist", favoritesRouter);
app.use("/watchlist", favoritesRouter);
app.use("/host", hostRouter);

app.all("/{*any}", (req, res) => {
  res.status(404).render("notfound.ejs");
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong.";
  res.status(statusCode).render("error.ejs", { message, statusCode });
});

// app.get("/testListing", async (req, res) => {
//   let sampleListing = new Listing({
//     title: "My New Villa",
//     description: "By the beach",
//     price: 1200,
//     location: "Calangute, Goa",
//     country: "India",
//   });

//   await sampleListing.save();
//   console.log("sample was saved");
//   res.send("successful testing");
// });

app.listen(PORT, () => {
  console.log(`server is listening to port ${PORT}`);
});
