const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/register", authController.register);
router.post("/verify-email", authController.verifyEmail);
router.post(
    "/resend-verification-code",
    authController.resendVerificationCode
);
router.post("/login", authController.login);
router.post(
    "/forgot-password",
    authController.forgotPassword
);

router.post(
    "/verify-reset-code",
    authController.verifyResetCode
);

router.post(
    "/reset-password",
    authController.resetPassword
);

module.exports = router;