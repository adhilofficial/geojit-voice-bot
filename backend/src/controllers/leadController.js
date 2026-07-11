const fs = require("fs");
const csv = require("csv-parser");

const Lead = require("../models/Lead");
const normalizePhone = require("../utils/normalizePhone");

function normalizeCsvRow(row) {
  const normalized = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] =
      typeof value === "string" ? value.trim() : value;
  }

  return normalized;
}

async function createLead(req, res) {
  try {
    const { name, phone, batchName } = req.body;

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid Indian phone number",
      });
    }

    const existingLead = await Lead.findOne({
      phone: normalizedPhone,
    });

    if (existingLead) {
      return res.status(409).json({
        success: false,
        message: "This phone number already exists",
        lead: existingLead,
      });
    }

    const lead = await Lead.create({
      name: name?.trim() || "Unknown Customer",
      phone: normalizedPhone,
      batchName: batchName?.trim() || "Manual Entry",
      source: "manual",
    });

    return res.status(201).json({
      success: true,
      message: "Lead added successfully",
      lead,
    });
  } catch (error) {
    console.error("Create lead error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add lead",
      error: error.message,
    });
  }
}

async function getLeads(req, res) {
  try {
    const {
      status,
      service,
      callbackRequested,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) {
      filter.callStatus = status;
    }

    if (service) {
      filter.selectedService = service;
    }

    if (callbackRequested === "true") {
      filter.callbackRequested = true;
    }

    if (callbackRequested === "false") {
      filter.callbackRequested = false;
    }

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip = (pageNumber - 1) * pageLimit;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit),

      Lead.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: pageNumber,
      pages: Math.ceil(total / pageLimit),
      leads,
    });
  } catch (error) {
    console.error("Get leads error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve leads",
      error: error.message,
    });
  }
}

async function uploadLeads(req, res) {
  let uploadedFilePath;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    uploadedFilePath = req.file.path;

    const rows = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(uploadedFilePath)
        .pipe(csv())
        .on("data", (row) => {
          rows.push(row);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The CSV file is empty",
      });
    }

    const validLeads = [];
    const invalidRows = [];

    rows.forEach((rawRow, index) => {
      const row = normalizeCsvRow(rawRow);

      const phone =
        row.phone ||
        row.mobile ||
        row.number ||
        row["phone number"] ||
        row["mobile number"];

      const name =
        row.name ||
        row.customer ||
        row["customer name"] ||
        "Unknown Customer";

      const batchName =
        row.batchname ||
        row.batch ||
        row["batch name"] ||
        req.body.batchName ||
        "CSV Upload";

      const normalizedPhone = normalizePhone(phone);

      if (!normalizedPhone) {
        invalidRows.push({
          row: index + 2,
          reason: "Invalid phone number",
          phone: phone || null,
        });

        return;
      }

      validLeads.push({
        name: String(name).trim() || "Unknown Customer",
        phone: normalizedPhone,
        batchName:
          String(batchName).trim() || "CSV Upload",
      });
    });

    // Remove duplicate phone numbers inside the CSV itself
    const uniqueLeadMap = new Map();

    for (const lead of validLeads) {
      if (!uniqueLeadMap.has(lead.phone)) {
        uniqueLeadMap.set(lead.phone, lead);
      }
    }

    const uniqueLeads = Array.from(uniqueLeadMap.values());

    if (uniqueLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid phone numbers were found",
        invalidRows,
      });
    }

    const operations = uniqueLeads.map((lead) => ({
      updateOne: {
        filter: {
          phone: lead.phone,
        },

        update: {
          $setOnInsert: {
            ...lead,
            source: "csv",
            callStatus: "pending",
          },
        },

        upsert: true,
      },
    }));

    const result = await Lead.bulkWrite(operations, {
      ordered: false,
    });

    const insertedCount = result.upsertedCount || 0;
    const existingCount = uniqueLeads.length - insertedCount;
    const duplicatesInsideFile =
      validLeads.length - uniqueLeads.length;

    return res.status(201).json({
      success: true,
      message: "CSV processed successfully",
      summary: {
        totalCsvRows: rows.length,
        validRows: validLeads.length,
        inserted: insertedCount,
        alreadyExisting: existingCount,
        duplicatesInsideFile,
        invalid: invalidRows.length,
      },
      invalidRows,
    });
  } catch (error) {
    console.error("CSV upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process CSV file",
      error: error.message,
    });
  } finally {
    if (
      uploadedFilePath &&
      fs.existsSync(uploadedFilePath)
    ) {
      fs.unlinkSync(uploadedFilePath);
    }
  }
}
const exportServiceLabels = {
  mutual_fund: "Mutual Fund",
  sip: "SIP",
  trading_account: "Trading Account",
  callback: "Callback Request",
  not_interested: "Not Interested",
};

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '""';
  }

  const stringValue = String(value).replace(/"/g, '""');

  return `"${stringValue}"`;
}

function formatExportDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
}

async function exportInterestedLeads(req, res) {
  try {
    const leads = await Lead.find({
      optedOut: {
        $ne: true,
      },

      $or: [
        {
          callbackRequested: true,
        },
        {
          selectedService: {
            $in: [
              "mutual_fund",
              "sip",
              "trading_account",
              "callback",
            ],
          },
        },
      ],
    })
      .sort({
        callbackRequested: -1,
        updatedAt: -1,
      })
      .lean();

    const headers = [
      "Customer Name",
      "Phone Number",
      "Campaign",
      "Selected Service",
      "Existing Customer",
      "Callback Requested",
      "Call Status",
      "Call Attempts",
      "Call Duration Seconds",
      "Last Called",
      "Added Date",
    ];

    const rows = leads.map((lead) => [
      lead.name || "Unknown Customer",
      lead.phone || "",
      lead.batchName || "",
      exportServiceLabels[lead.selectedService] || "",
      lead.answers?.existingCustomer || "",
      lead.callbackRequested ? "Yes" : "No",
      lead.callStatus || "",
      lead.callAttempts || 0,
      lead.callDuration || 0,
      formatExportDate(lead.lastCalledAt),
      formatExportDate(lead.createdAt),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map(escapeCsvValue).join(",")
      )
      .join("\r\n");

    const date = new Date()
      .toISOString()
      .slice(0, 10);

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="geojit-interested-customers-${date}.csv"`
    );

    // BOM helps Microsoft Excel display the file properly.
    return res.status(200).send(`\uFEFF${csvContent}`);
  } catch (error) {
    console.error("Export interested leads error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to export interested customers",
      error: error.message,
    });
  }
}

module.exports = {
  createLead,
  getLeads,
  uploadLeads,
  exportInterestedLeads,
};