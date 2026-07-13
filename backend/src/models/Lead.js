const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    consent: {
      type: String,
      default: null,
    },
    service: {
      type: String,
      default: null,
    },
    existingCustomer: {
      type: String,
      default: null,
    },
    callback: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "Unknown Customer",
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      index: true,
      trim: true,
    },
    batchName: {
      type: String,
      trim: true,
      default: "Manual Entry",
    },
    source: {
      type: String,
      enum: ["manual", "csv"],
      default: "manual",
    },
    callStatus: {
      type: String,
      enum: [
        "pending",
        "calling",
        "answered",
        "completed",
        "no_answer",
        "busy",
        "failed",
        "opted_out",
      ],
      default: "pending",
      index: true,
    },
    callStep: {
      type: String,
      enum: [
        "not_started",
        "consent",
        "service",
        "existing_customer",
        "callback",
        "completed",
      ],
      default: "not_started",
    },
    selectedService: {
      type: String,
      enum: [
        "mutual_fund",
        "sip",
        "trading_account",
        "callback",
        "not_interested",
        null,
      ],
      default: null,
    },
    callbackRequested: {
      type: Boolean,
      default: false,
    },
    callbackFollowUpStatus: {
      type: String,
      enum: ["pending", "contacted", "completed", null],
      default: null,
      index: true,
    },
    callbackRequestedAt: {
      type: Date,
      default: null,
      index: true,
    },
    callbackContactedAt: {
      type: Date,
      default: null,
    },
    callbackCompletedAt: {
      type: Date,
      default: null,
    },
    optedOut: {
      type: Boolean,
      default: false,
    },
    answers: {
      type: answerSchema,
      default: () => ({}),
    },
    callAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    providerCallId: {
      type: String,
      default: null,
      index: true,
    },
    providerStatus: {
      type: String,
      default: null,
    },
    callDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    recordingUrl: {
      type: String,
      default: null,
    },
    lastCallError: {
      type: String,
      default: null,
    },
    lastCalledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Lead", leadSchema);
