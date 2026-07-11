const express = require("express");

const {
  startMockCall,
  submitMockDigit,
  endMockCall,
} = require("../controllers/mockCallController");

const router = express.Router();

router.post("/:leadId/start", startMockCall);
router.post("/:leadId/digit", submitMockDigit);
router.post("/:leadId/end", endMockCall);

module.exports = router;