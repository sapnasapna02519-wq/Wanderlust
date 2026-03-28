const express = require("express");
const router = express.Router();
const hostController = require("../controllers/host");
const { isLoggedIn } = require("../middleware");

router.get("/dashboard", isLoggedIn, hostController.renderDashboard);

module.exports = router;
