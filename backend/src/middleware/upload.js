const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadDirectory);
  },

  filename(req, file, callback) {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}.csv`;
    callback(null, uniqueName);
  },
});

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const acceptedMimeTypes = new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ]);

  const isCsv =
    extension === ".csv" &&
    (acceptedMimeTypes.has(file.mimetype) || !file.mimetype);

  if (!isCsv) {
    callback(new Error("Only CSV files are allowed"));
    return;
  }

  callback(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

module.exports = upload;
