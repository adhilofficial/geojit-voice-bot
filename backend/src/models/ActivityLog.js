const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    adminEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "auth",
        "customer",
        "call",
        "campaign",
        "callback",
        "export",
        "system",
      ],
      required: true,
      index: true,
    },
    result: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    targetType: {
      type: String,
      trim: true,
      default: null,
    },
    targetId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    targetName: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ adminEmail: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
