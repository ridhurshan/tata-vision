const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// All routes below require: logged in AND role === 'Admin'
router.get("/stats", verifyToken, isAdmin, adminController.getStats);
router.get("/users", verifyToken, isAdmin, adminController.getUsers);
router.get("/users/:id", verifyToken, isAdmin, adminController.getUser);
router.patch("/users/:id/status", verifyToken, isAdmin, adminController.updateUserStatus);

module.exports = router;
