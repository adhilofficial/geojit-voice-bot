const express = require("express");

const {
  getCurrentAdmin,
  login,
  logout,
} = require("../controllers/authController");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.post("/login", login);
router.get("/me", requireAuth, getCurrentAdmin);
router.post("/logout", requireAuth, logout);

module.exports = router;
