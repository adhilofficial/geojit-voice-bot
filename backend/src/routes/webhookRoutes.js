const express = require("express");

const {
  handleExotelDigit,
  handleExotelStatus,
} = require("../controllers/exotelWebhookController");

const router = express.Router();

router.get("/exotel/status", handleExotelStatus);
router.post("/exotel/status", handleExotelStatus);

router.get("/exotel/digit", handleExotelDigit);
router.post("/exotel/digit", handleExotelDigit);

module.exports = router;
