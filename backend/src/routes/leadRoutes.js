const express = require("express");

const {
  createLead,
  exportCampaignResults,
  exportInterestedLeads,
  getLeads,
  uploadLeads,
} = require("../controllers/leadController");

const upload = require("../middleware/upload");

const router = express.Router();

// Export the customers attempted in the latest campaign
router.post("/export/campaign", exportCampaignResults);

// Export interested customers
router.get("/export/interested", exportInterestedLeads);

// Retrieve customers
router.get("/", getLeads);

// Add one customer manually
router.post("/", createLead);

// Upload customers using CSV
router.post("/upload", upload.single("file"), uploadLeads);

module.exports = router;
