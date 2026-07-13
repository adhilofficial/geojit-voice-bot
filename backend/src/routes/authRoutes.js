const express = require("express");

const {
  getCurrentAdmin,
  login,
} = require("../controllers/authController");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.post("/login", login);
router.get("/me", requireAuth, getCurrentAdmin);

module.exports = router;
