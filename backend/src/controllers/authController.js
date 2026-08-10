const bcrypt = require("bcrypt");
const User = require("../models/userModel");
const emailService =
    require("../services/emailService");
const authService = require("../services/authService");

function sendError(res, err, defaultStatus = 500) {
    console.error(err);

    res.status(err.statusCode || defaultStatus).json({
        message: err.message || "Something went wrong.",
        code: err.code || undefined
    });
}

exports.register = async (req, res) => {
    try {
        const result = await authService.register(req.body);

        res.status(201).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const result = await authService.verifyEmail(req.body);

        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

exports.resendVerificationCode = async (req, res) => {
    try {
        const result =
            await authService.resendVerificationCode(req.body);

        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

exports.login = async (req, res) => {
    try {
        const result = await authService.login(req.body);

        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

exports.forgotPassword = async (req, res) => {

    try {

        const { email } = req.body;


        if (!email) {

            return res.status(400).json({
                message:
                    "Email is required."
            });

        }


        const user =
            await User.findByEmail(email);


        // Security:
        // don't reveal whether account exists.
        if (!user) {

            return res.status(200).json({
                message:
                    "If the email is registered, a reset code has been sent."
            });

        }


        const resetCode =
            Math.floor(
                100000 +
                Math.random() * 900000
            ).toString();


        const expiresAt =
            new Date(
                Date.now() +
                10 * 60 * 1000
            );


        await User.saveResetCode(
            user.id,
            resetCode,
            expiresAt
        );


        // Replace this with the SAME email function
        // you already use for registration OTP.
        await emailService.sendPasswordResetCode(
            email,
            resetCode
        );


        return res.status(200).json({
            message:
                "If the email is registered, a reset code has been sent."
        });


    } catch (error) {

        console.error(
            "Forgot password error:",
            error
        );


        return res.status(500).json({
            message:
                "Could not process password reset request."
        });

    }

};

exports.verifyResetCode = async (
    req,
    res
) => {

    try {

        const {
            email,
            code
        } = req.body;


        if (!email || !code) {

            return res.status(400).json({
                message:
                    "Email and reset code are required."
            });

        }


        const user =
            await User.findByEmail(email);


        if (
            !user ||
            !user.reset_code
        ) {

            return res.status(400).json({
                message:
                    "Invalid or expired reset code."
            });

        }


        if (
            user.reset_attempts >= 5
        ) {

            return res.status(429).json({
                message:
                    "Too many incorrect attempts. Request a new code."
            });

        }


        const expired =
            !user.reset_code_expires_at ||
            new Date(
                user.reset_code_expires_at
            ) < new Date();


        if (expired) {

            return res.status(400).json({
                message:
                    "Reset code has expired."
            });

        }


        if (
            String(user.reset_code)
            !==
            String(code)
        ) {

            await User.incrementResetAttempts(
                user.id
            );


            return res.status(400).json({
                message:
                    "Incorrect reset code."
            });

        }


        return res.status(200).json({
            message:
                "Reset code verified."
        });


    } catch (error) {

        console.error(
            "Verify reset code error:",
            error
        );


        return res.status(500).json({
            message:
                "Could not verify reset code."
        });

    }

};

exports.resetPassword = async (
    req,
    res
) => {

    try {

        const {
            email,
            code,
            newPassword
        } = req.body;


        if (
            !email ||
            !code ||
            !newPassword
        ) {

            return res.status(400).json({
                message:
                    "Email, code and new password are required."
            });

        }


        if (newPassword.length < 8) {

            return res.status(400).json({
                message:
                    "Password must contain at least 8 characters."
            });

        }


        const user =
            await User.findByEmail(email);


        if (
            !user ||
            String(user.reset_code)
            !==
            String(code)
        ) {

            return res.status(400).json({
                message:
                    "Invalid reset request."
            });

        }


        const expired =
            !user.reset_code_expires_at ||
            new Date(
                user.reset_code_expires_at
            ) < new Date();


        if (expired) {

            return res.status(400).json({
                message:
                    "Reset code has expired."
            });

        }


        const hashedPassword =
            await bcrypt.hash(
                newPassword,
                10
            );


        await User.updatePassword(
            user.id,
            hashedPassword
        );


        return res.status(200).json({
            message:
                "Password reset successfully."
        });


    } catch (error) {

        console.error(
            "Reset password error:",
            error
        );


        return res.status(500).json({
            message:
                "Could not reset password."
        });

    }

};