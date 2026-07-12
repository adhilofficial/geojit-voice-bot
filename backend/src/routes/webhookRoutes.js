const express = require("express");

const {
  handleExotelStatus,
} = require("../controllers/exotelWebhookController");

const router = express.Router();

router.get("/exotel/status", handleExotelStatus);
router.post("/exotel/status", handleExotelStatus);

module.exports = router;
