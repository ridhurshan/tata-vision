const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../config/db");
const emailService = require("./emailService");

const VERIFICATION_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFICATION_ATTEMPTS = 5;

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
    return (
        typeof password === "string" &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /\d/.test(password)
    );
}

function generateVerificationCode() {
    return crypto.randomInt(100000, 1000000).toString();
}

function hashVerificationCode(code) {
    return crypto
        .createHash("sha256")
        .update(code)
        .digest("hex");
}

function createExpiryDate() {
    return new Date(
        Date.now() + VERIFICATION_EXPIRY_MINUTES * 60 * 1000
    );
}

exports.register = async (user) => {
    const fullName = String(user.fullName || "").trim();
    const email = normalizeEmail(user.email);
    const password = user.password;

    if (!fullName || !email || !password) {
        const error = new Error(
            "Full name, email and password are required."
        );
        error.statusCode = 400;
        throw error;
    }

    if (!isValidEmail(email)) {
        const error = new Error("Please enter a valid email address.");
        error.statusCode = 400;
        throw error;
    }

    if (!isStrongPassword(password)) {
        const error = new Error(
            "Password must be at least 8 characters and contain an uppercase letter and a number."
        );
        error.statusCode = 400;
        throw error;
    }

    const [existingRows] = await db.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
    );

    const verificationCode = generateVerificationCode();
    const hashedCode = hashVerificationCode(verificationCode);
    const expiresAt = createExpiryDate();

    if (existingRows.length > 0) {
        const existingUser = existingRows[0];

        if (existingUser.is_verified) {
            const error = new Error(
                "An account already exists with this email."
            );
            error.statusCode = 409;
            throw error;
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.query(
            `
            UPDATE users
            SET
                full_name = ?,
                password = ?,
                verification_code = ?,
                verification_expires_at = ?,
                verification_attempts = 0,
                last_code_sent_at = NOW()
            WHERE email = ?
            `,
            [
                fullName,
                hashedPassword,
                hashedCode,
                expiresAt,
                email
            ]
        );

        await emailService.sendVerificationCode(
            email,
            verificationCode
        );

        return {
            message:
                "A new verification code was sent to your email.",
            email
        };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.query(
        `
        INSERT INTO users (
            full_name,
            email,
            password,
            role,
            is_verified,
            verification_code,
            verification_expires_at,
            verification_attempts,
            last_code_sent_at
        )
        VALUES (?, ?, ?, 'user', FALSE, ?, ?, 0, NOW())
        `,
        [
            fullName,
            email,
            hashedPassword,
            hashedCode,
            expiresAt
        ]
    );

    try {
        await emailService.sendVerificationCode(
            email,
            verificationCode
        );
    } catch (emailError) {
        console.error("Verification email failed:", emailError.message);

        await db.query(
            "DELETE FROM users WHERE id = ? AND is_verified = FALSE",
            [result.insertId]
        );

        const error = new Error(
            "Registration failed because the verification email could not be sent."
        );
        error.statusCode = 500;
        throw error;
    }

    return {
        message:
            "Registration successful. Check your email for the verification code.",
        userId: result.insertId,
        email
    };
};

exports.verifyEmail = async ({ email, code }) => {
    const normalizedEmail = normalizeEmail(email);
    const enteredCode = String(code || "").trim();

    if (!normalizedEmail || !enteredCode) {
        const error = new Error(
            "Email and verification code are required."
        );
        error.statusCode = 400;
        throw error;
    }

    if (!/^\d{6}$/.test(enteredCode)) {
        const error = new Error(
            "Verification code must contain exactly 6 digits."
        );
        error.statusCode = 400;
        throw error;
    }

    const [rows] = await db.query(
        "SELECT * FROM users WHERE email = ?",
        [normalizedEmail]
    );

    if (rows.length === 0) {
        const error = new Error("Invalid email or verification code.");
        error.statusCode = 400;
        throw error;
    }

    const user = rows[0];

    if (user.is_verified) {
        return {
            message: "Email is already verified."
        };
    }

    if (
        user.verification_attempts >=
        MAX_VERIFICATION_ATTEMPTS
    ) {
        const error = new Error(
            "Too many incorrect attempts. Request a new verification code."
        );
        error.statusCode = 429;
        throw error;
    }

    if (
        !user.verification_expires_at ||
        new Date(user.verification_expires_at) < new Date()
    ) {
        const error = new Error(
            "Verification code has expired. Request a new code."
        );
        error.statusCode = 400;
        throw error;
    }

    const enteredCodeHash = hashVerificationCode(enteredCode);

    if (enteredCodeHash !== user.verification_code) {
        await db.query(
            `
            UPDATE users
            SET verification_attempts = verification_attempts + 1
            WHERE id = ?
            `,
            [user.id]
        );

        const remainingAttempts =
            MAX_VERIFICATION_ATTEMPTS -
            (user.verification_attempts + 1);

        const error = new Error(
            remainingAttempts > 0
                ? `Invalid verification code. ${remainingAttempts} attempts remaining.`
                : "Invalid verification code. Request a new code."
        );

        error.statusCode = 400;
        throw error;
    }

    await db.query(
        `
        UPDATE users
        SET
            is_verified = TRUE,
            verification_code = NULL,
            verification_expires_at = NULL,
            verification_attempts = 0
        WHERE id = ?
        `,
        [user.id]
    );

    return {
        message:
            "Email verified successfully. You can now log in."
    };
};

exports.resendVerificationCode = async ({ email }) => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        const error = new Error("Email is required.");
        error.statusCode = 400;
        throw error;
    }

    const [rows] = await db.query(
        "SELECT * FROM users WHERE email = ?",
        [normalizedEmail]
    );

    if (rows.length === 0) {
        const error = new Error(
            "No unverified account was found for this email."
        );
        error.statusCode = 404;
        throw error;
    }

    const user = rows[0];

    if (user.is_verified) {
        const error = new Error("This email is already verified.");
        error.statusCode = 400;
        throw error;
    }

    if (user.last_code_sent_at) {
        const lastSentTime = new Date(
            user.last_code_sent_at
        ).getTime();

        const elapsedSeconds =
            (Date.now() - lastSentTime) / 1000;

        if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
            const waitSeconds = Math.ceil(
                RESEND_COOLDOWN_SECONDS - elapsedSeconds
            );

            const error = new Error(
                `Please wait ${waitSeconds} seconds before requesting another code.`
            );

            error.statusCode = 429;
            throw error;
        }
    }

    const verificationCode = generateVerificationCode();
    const hashedCode = hashVerificationCode(verificationCode);
    const expiresAt = createExpiryDate();

    await db.query(
        `
        UPDATE users
        SET
            verification_code = ?,
            verification_expires_at = ?,
            verification_attempts = 0,
            last_code_sent_at = NOW()
        WHERE id = ?
        `,
        [hashedCode, expiresAt, user.id]
    );

    await emailService.sendVerificationCode(
        normalizedEmail,
        verificationCode
    );

    return {
        message: "A new verification code was sent."
    };
};

exports.login = async (user) => {
    const email = normalizeEmail(user.email);
    const password = user.password;

    if (!email || !password) {
        const error = new Error(
            "Email and password are required."
        );
        error.statusCode = 400;
        throw error;
    }

    const [result] = await db.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
    );

    if (result.length === 0) {
        const error = new Error("Invalid email or password.");
        error.statusCode = 401;
        throw error;
    }

    const savedUser = result[0];

    const isMatch = await bcrypt.compare(
        password,
        savedUser.password
    );

    if (!isMatch) {
        const error = new Error("Invalid email or password.");
        error.statusCode = 401;
        throw error;
    }

    if (!savedUser.is_verified) {
        const error = new Error(
            "Please verify your email before logging in."
        );

        error.statusCode = 403;
        error.code = "EMAIL_NOT_VERIFIED";
        throw error;
    }

    const token = jwt.sign(
        {
            id: savedUser.id,
            email: savedUser.email,
            role: savedUser.role
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    return {
        token,
        user: {
            id: savedUser.id,
            name: savedUser.full_name,
            email: savedUser.email,
            role: savedUser.role
        }
    };
};