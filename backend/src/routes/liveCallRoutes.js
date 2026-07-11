const express = require("express");

const {
  startLiveCall,
} = require("../controllers/exotelCallController");

const router = express.Router();

router.post("/:leadId/start", startLiveCall);

module.exports = router;