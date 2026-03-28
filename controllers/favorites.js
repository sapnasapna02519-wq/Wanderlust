const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listing");

function getSafeReturnTo(returnTo) {
  if (typeof returnTo !== "string") return "/listings";
  return returnTo.startsWith("/") ? returnTo : "/listings";
}

module.exports.listFavorites = async (req, res) => {
  const user = await User.findById(req.currentUser.id).populate({
    path: "favoriteListings",
    options: { sort: { createdAt: -1 } },
  });

  const favoriteListings = user ? user.favoriteListings : [];
  res.render("favorites/index.ejs", { favoriteListings });
};

module.exports.addFavorite = async (req, res) => {
  const { listingId } = req.params;
  const returnTo = getSafeReturnTo(req.body.returnTo || req.query.returnTo);

  if (!mongoose.Types.ObjectId.isValid(listingId)) {
    return res.redirect(`${returnTo}?error=Invalid listing id`);
  }

  const listing = await Listing.findById(listingId);
  if (!listing) {
    return res.redirect(`${returnTo}?error=Listing not found`);
  }

  await User.updateOne(
    { _id: req.currentUser.id },
    { $addToSet: { favoriteListings: listing._id } }
  );

  return res.redirect(`${returnTo}?success=Added to wishlist`);
};

module.exports.removeFavorite = async (req, res) => {
  const { listingId } = req.params;
  const returnTo = getSafeReturnTo(req.body.returnTo || req.query.returnTo);

  if (!mongoose.Types.ObjectId.isValid(listingId)) {
    return res.redirect(`${returnTo}?error=Invalid listing id`);
  }

  await User.updateOne(
    { _id: req.currentUser.id },
    { $pull: { favoriteListings: listingId } }
  );

  return res.redirect(`${returnTo}?success=Removed from wishlist`);
};

module.exports.redirectFavoriteListing = async (req, res) => {
  const { listingId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(listingId)) {
    return res.redirect("/favorites?error=Invalid listing id");
  }
  const listing = await Listing.findById(listingId).select("_id");
  if (!listing) {
    return res.redirect("/favorites?error=Listing not found");
  }
  return res.redirect(`/listings/${listing._id}`);
};
