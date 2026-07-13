const ActivityLog = require("../models/ActivityLog");
const { logActivity } = require("../utils/activityLogger");

const allowedCategories = new Set([
  "auth",
  "customer",
  "call",
  "campaign",
  "callback",
  "export",
  "system",
]);
const allowedResults = new Set(["success", "failed"]);
const allowedAdminEvents = new Set([
  "campaign_started",
  "campaign_stopped",
  "campaign_completed",
]);

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeSpreadsheetValue(value) {
  const stringValue = String(value ?? "");

  if (/^[=+\-@]/.test(stringValue)) {
    return `'${stringValue}`;
  }

  return stringValue;
}

function escapeCsvValue(value) {
  const stringValue = sanitizeSpreadsheetValue(value).replace(/"/g, '""');
  return `"${stringValue}"`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function buildFilter(query = {}) {
  const filter = {};
  const category = cleanText(query.category).toLowerCase();
  const result = cleanText(query.result).toLowerCase();
  const adminEmail = cleanText(query.adminEmail).toLowerCase();
  const search = cleanText(query.search);

  if (category && allowedCategories.has(category)) {
    filter.category = category;
  }

  if (result && allowedResults.has(result)) {
    filter.result = result;
  }

  if (adminEmail) {
    filter.adminEmail = adminEmail;
  }

  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { adminEmail: { $regex: safeSearch, $options: "i" } },
      { action: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
      { targetName: { $regex: safeSearch, $options: "i" } },
    ];
  }

  return filter;
}

async function getActivityLogs(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const filter = buildFilter(req.query);
    const skip = (page - 1) * limit;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [logs, total, today, successful, failed, administrators] =
      await Promise.all([
        ActivityLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ActivityLog.countDocuments(filter),
        ActivityLog.countDocuments({
          ...filter,
          createdAt: { $gte: todayStart },
        }),
        ActivityLog.countDocuments({ ...filter, result: "success" }),
        ActivityLog.countDocuments({ ...filter, result: "failed" }),
        ActivityLog.distinct("adminEmail", filter),
      ]);

    return res.status(200).json({
      success: true,
      page,
      pages: Math.ceil(total / limit),
      total,
      summary: {
        total,
        today,
        successful,
        failed,
        administrators: administrators.length,
      },
      logs,
    });
  } catch (error) {
    console.error("Get activity logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve admin activity logs",
      error: error.message,
    });
  }
}

async function recordAdminEvent(req, res) {
  const action = cleanText(req.body?.action).toLowerCase();

  if (!allowedAdminEvents.has(action)) {
    return res.status(400).json({
      success: false,
      message: "Unsupported administrator activity event",
    });
  }

  const category = "campaign";
  const description = cleanText(
    req.body?.description,
    action.replaceAll("_", " ")
  );

  const activity = await logActivity(req, {
    action,
    category,
    result: req.body?.result === "failed" ? "failed" : "success",
    description,
    targetType: cleanText(req.body?.targetType, "campaign"),
    targetId: cleanText(req.body?.targetId),
    targetName: cleanText(req.body?.targetName),
    metadata: req.body?.metadata,
  });

  return res.status(201).json({
    success: true,
    message: "Activity recorded",
    activity,
  });
}

async function exportActivityLogs(req, res) {
  try {
    const logs = await ActivityLog.find(buildFilter(req.query))
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const headers = [
      "Date and Time",
      "Administrator",
      "Category",
      "Action",
      "Result",
      "Description",
      "Target Type",
      "Target Name",
      "Target ID",
      "IP Address",
    ];
    const rows = logs.map((log) => [
      formatDate(log.createdAt),
      log.adminEmail || "",
      log.category || "",
      log.action || "",
      log.result || "",
      log.description || "",
      log.targetType || "",
      log.targetName || "",
      log.targetId || "",
      log.ipAddress || "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");
    const date = new Date().toISOString().slice(0, 10);

    await logActivity(req, {
      action: "activity_log_exported",
      category: "export",
      description: `Exported ${logs.length} activity log entr${logs.length === 1 ? "y" : "ies"}`,
      metadata: { exportedCount: logs.length },
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="geojit-admin-activity-${date}.csv"`
    );

    return res.status(200).send(`\uFEFF${csvContent}`);
  } catch (error) {
    console.error("Export activity logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to export admin activity logs",
      error: error.message,
    });
  }
}

module.exports = {
  exportActivityLogs,
  getActivityLogs,
  recordAdminEvent,
};
