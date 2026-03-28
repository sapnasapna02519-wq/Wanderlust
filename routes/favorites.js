const express = require("express");
const router = express.Router();
const favoritesController = require("../controllers/favorites");
const { isLoggedIn } = require("../middleware");

router.get("/", isLoggedIn, favoritesController.listFavorites);
router.get("/:listingId", isLoggedIn, favoritesController.redirectFavoriteListing);
router.post("/:listingId", isLoggedIn, favoritesController.addFavorite);
router.delete("/:listingId", isLoggedIn, favoritesController.removeFavorite);

module.exports = router;
