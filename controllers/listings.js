const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const { cloudinary } = require("../utils/cloudinary");

const CATEGORIES = [
  "Beach",
  "Mountain",
  "City",
  "Farm",
  "Lake",
  "Desert",
];

function toLocalDateString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sanitizeListingInput(input = {}, uploadedFile = null) {
  const imageUrl =
    input.image && typeof input.image.url === "string"
      ? input.image.url.trim()
      : "";

  const cleaned = {
    title: typeof input.title === "string" ? input.title.trim() : "",
    description:
      typeof input.description === "string" ? input.description.trim() : "",
    price:
      input.price === "" || input.price === undefined
        ? undefined
        : Number(input.price),
    location: typeof input.location === "string" ? input.location.trim() : "",
    country: typeof input.country === "string" ? input.country.trim() : "",
    category: typeof input.category === "string" ? input.category.trim() : "",
  };

  if (uploadedFile && uploadedFile.path) {
    cleaned.image = {
      url: uploadedFile.path,
      filename: uploadedFile.filename || "listingimage",
    };
  } else if (imageUrl) {
    cleaned.image = {
      url: imageUrl,
      filename: "listingimage",
    };
  }

  return cleaned;
}

function sanitizeQueryValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function mapMongooseErrors(error) {
  const fieldErrors = {};
  if (!error || !error.errors) return fieldErrors;

  for (const [key, value] of Object.entries(error.errors)) {
    if (key === "image.url") {
      fieldErrors.imageUrl = value.message;
    } else {
      fieldErrors[key] = value.message;
    }
  }

  return fieldErrors;
}

function buildFormDataFromListing(listing = {}) {
  return {
    title: listing.title || "",
    description: listing.description || "",
    image: {
      url: listing.image && listing.image.url ? listing.image.url : "",
    },
    price: listing.price ?? "",
    location: listing.location || "",
    country: listing.country || "",
    category: listing.category || "",
  };
}

function isCloudinaryImage(image = {}) {
  return (
    image &&
    typeof image.filename === "string" &&
    image.filename.trim() !== "" &&
    image.filename !== "listingimage"
  );
}

async function deleteCloudinaryImage(image = {}) {
  if (!isCloudinaryImage(image)) return;
  try {
    await cloudinary.uploader.destroy(image.filename);
  } catch (error) {
    // Ignore cleanup failures so user actions are not blocked.
  }
}

module.exports.listListings = async (req, res) => {
  const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const requestedLimit = parseInt(req.query.limit, 10) || 12;
  const limit = Math.min(Math.max(requestedLimit, 1), 60);

  const q = sanitizeQueryValue(req.query.q);
  const category = sanitizeQueryValue(req.query.category);
  const country = sanitizeQueryValue(req.query.country);
  const sort = sanitizeQueryValue(req.query.sort) || "newest";

  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);

  const filters = {};

  if (q) {
    filters.$or = [
      { title: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
      { country: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
    ];
  }

  if (category) filters.category = category;
  if (country) filters.country = { $regex: `^${country}$`, $options: "i" };

  if (!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)) {
    filters.price = {};
    if (!Number.isNaN(minPrice)) filters.price.$gte = minPrice;
    if (!Number.isNaN(maxPrice)) filters.price.$lte = maxPrice;
  }

  let sortOptions = { createdAt: -1 };
  if (sort === "price_asc") sortOptions = { price: 1 };
  if (sort === "price_desc") sortOptions = { price: -1 };
  if (sort === "oldest") sortOptions = { createdAt: 1 };

  const totalListings = await Listing.countDocuments(filters);
  const totalPages = Math.max(Math.ceil(totalListings / limit), 1);
  const page = Math.min(requestedPage, totalPages);

  if (requestedPage !== page) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (country) params.set("country", country);
    if (!Number.isNaN(minPrice)) params.set("minPrice", String(minPrice));
    if (!Number.isNaN(maxPrice)) params.set("maxPrice", String(maxPrice));
    if (sort) params.set("sort", sort);
    params.set("limit", String(limit));
    params.set("page", String(page));
    return res.redirect(`/listings?${params.toString()}`);
  }

  const skip = (page - 1) * limit;

  const [allListings, countries] = await Promise.all([
    Listing.find(filters).sort(sortOptions).skip(skip).limit(limit),
    Listing.distinct("country"),
  ]);

  res.render("listings/index.ejs", {
    allListings,
    categories: CATEGORIES,
    countries: countries.filter(Boolean).sort((a, b) => a.localeCompare(b)),
    filters: {
      q,
      category,
      country,
      minPrice: Number.isNaN(minPrice) ? "" : minPrice,
      maxPrice: Number.isNaN(maxPrice) ? "" : maxPrice,
      sort,
      limit,
    },
    pagination: {
      page,
      totalPages,
      totalListings,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
    },
  });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs", {
    formData: {},
    errors: {},
    categories: CATEGORIES,
  });
};

module.exports.renderShowPage = async (req, res) => {
  const { id } = req.params;

  try {
    const listing = await Listing.findById(id)
      .populate("owner")
      .populate({
        path: "reviews",
        populate: { path: "author" },
      });
    if (!listing) {
      return res.redirect("/listings?error=Listing not found");
    }
    res.render("listings/show.ejs", { listing });
  } catch (error) {
    res.redirect("/listings?error=Invalid listing request");
  }
};

module.exports.getAvailability = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).select("_id");
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }

  const bookings = await Booking.find({
    listing: listing._id,
    status: "confirmed",
  })
    .select("checkIn checkOut")
    .sort({ checkIn: 1 })
    .lean();

  const blockedRanges = bookings.map((booking) => ({
    checkIn: booking.checkIn ? toLocalDateString(booking.checkIn) : null,
    checkOut: booking.checkOut ? toLocalDateString(booking.checkOut) : null,
  }));

  return res.json({ blockedRanges });
};

module.exports.createListing = async (req, res) => {
  const sanitizedListing = sanitizeListingInput(req.body.listing, req.file);

  if (!sanitizedListing.image || !sanitizedListing.image.url) {
    return res.status(400).render("listings/new.ejs", {
      formData: sanitizedListing,
      errors: {
        imageUrl: "Please provide an image URL or upload an image file.",
      },
      categories: CATEGORIES,
    });
  }

  if (req.currentUser) {
    sanitizedListing.owner = req.currentUser.id;
    sanitizedListing.hostName = req.currentUser.username;
  }
  const listing = new Listing(sanitizedListing);

  try {
    await listing.save();
    res.redirect("/listings?success=Listing created successfully");
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).render("listings/new.ejs", {
        formData: sanitizedListing,
        errors: mapMongooseErrors(error),
        categories: CATEGORIES,
      });
    }
    res.redirect("/listings/new?error=Something went wrong. Please try again.");
  }
};

module.exports.renderEditForm = async (req, res) => {
  const listing = req.listing;

  res.render("listings/edit.ejs", {
    listingId: listing._id,
    formData: buildFormDataFromListing(listing),
    errors: {},
    categories: CATEGORIES,
  });
};

module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const existingListing = req.listing;
  const sanitizedListing = sanitizeListingInput(req.body.listing, req.file);
  if (req.currentUser) {
    sanitizedListing.hostName = req.currentUser.username;
  }

  if (
    (!sanitizedListing.image || !sanitizedListing.image.url) &&
    existingListing &&
    existingListing.image &&
    existingListing.image.url
  ) {
    sanitizedListing.image = {
      url: existingListing.image.url,
      filename: existingListing.image.filename || "listingimage",
    };
  }

  try {
    const updatedListing = await Listing.findByIdAndUpdate(id, sanitizedListing, {
      runValidators: true,
      new: true,
    });

    if (!updatedListing) {
      return res.redirect("/listings?error=Listing not found");
    }

    // If a new file was uploaded, remove previous Cloudinary asset.
    if (req.file && existingListing && existingListing.image) {
      await deleteCloudinaryImage(existingListing.image);
    }

    res.redirect(`/listings/${id}?success=Listing updated successfully`);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).render("listings/edit.ejs", {
        listingId: id,
        formData: sanitizedListing,
        errors: mapMongooseErrors(error),
        categories: CATEGORIES,
      });
    }
    res.redirect(`/listings/${id}/edit?error=Please provide valid details`);
  }
};

module.exports.deleteListing = async (req, res) => {
  const { id } = req.params;
  console.log("[deleteListing] request received", {
    id,
    method: req.method,
    currentUser: req.currentUser ? req.currentUser.id : null,
  });
  const listingToDelete = await Listing.findById(id);
  if (!listingToDelete) {
    console.log("[deleteListing] listing not found", { id });
    return res.redirect("/listings?error=Listing not found");
  }

  console.log("[deleteListing] deleting listing", {
    id,
    owner: listingToDelete.owner ? String(listingToDelete.owner) : null,
  });

  if (Array.isArray(listingToDelete.reviews) && listingToDelete.reviews.length > 0) {
    await Review.deleteMany({ _id: { $in: listingToDelete.reviews } });
  }

  await Listing.deleteOne({ _id: id });
  await deleteCloudinaryImage(listingToDelete.image || {});

  console.log("[deleteListing] deleted successfully", { id });
  res.redirect("/listings?success=Listing deleted successfully");
};
