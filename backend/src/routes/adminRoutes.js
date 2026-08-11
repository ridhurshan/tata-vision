const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");

const {
    protect,
    adminOnly
} = require("../middleware/authMiddleware");


// ======================================================
// ADMIN STATISTICS
// ======================================================

router.get(
    "/stats",
    protect,
    adminOnly,
    adminController.getStats
);


// ======================================================
// GET ALL USERS
// ======================================================

router.get(
    "/users",
    protect,
    adminOnly,
    adminController.getUsers
);


// ======================================================
// ACTIVATE / DEACTIVATE USER
// ======================================================

router.put(
    "/users/:id/status",
    protect,
    adminOnly,
    adminController.updateUserStatus
);


module.exports = router;