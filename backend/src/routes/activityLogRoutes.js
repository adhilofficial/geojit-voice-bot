const express = require("express");

const {
  exportActivityLogs,
  getActivityLogs,
  recordAdminEvent,
} = require("../controllers/activityLogController");

const router = express.Router();

router.get("/export", exportActivityLogs);
router.get("/", getActivityLogs);
router.post("/events", recordAdminEvent);

module.exports = router;
