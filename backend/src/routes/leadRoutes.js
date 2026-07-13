const express = require("express");

const {
  createLead,
  deleteLead,
  exportCallbackRequests,
  exportCampaignResults,
  exportInterestedLeads,
  getCallbackRequests,
  getLeads,
  updateCallbackStatus,
  uploadLeads,
} = require("../controllers/leadController");

const upload = require("../middleware/upload");

const router = express.Router();

// Callback follow-up queue and export
router.get("/callbacks", getCallbackRequests);
router.get("/export/callbacks", exportCallbackRequests);

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

// Update callback follow-up status
router.patch("/:leadId/callback-status", updateCallbackStatus);

// Delete one customer
router.delete("/:leadId", deleteLead);

module.exports = router;
