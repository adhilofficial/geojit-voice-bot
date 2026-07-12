const express = require("express");

const {
  startLiveCall,
  syncLiveCall,
} = require("../controllers/exotelCallController");

const router = express.Router();

router.post("/:leadId/start", startLiveCall);
router.post("/:leadId/sync", syncLiveCall);

module.exports = router;