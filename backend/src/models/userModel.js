const db = require("../config/db");

const User = {

    // ======================================================
    // ADMIN - GET ALL USERS
    // ======================================================
    async findAll() {

        const [rows] = await db.query(
            `
            SELECT
                id,
                full_name,
                email,
                role,
                status,
                created_at
            FROM users
            ORDER BY created_at DESC
            `
        );

        return rows;
    },


    // ======================================================
    // GET USER BY ID
    // ======================================================
    async findById(id) {

        const [rows] = await db.query(
            `
            SELECT
                id,
                full_name,
                email,
                role,
                status,
                created_at
            FROM users
            WHERE id = ?
            `,
            [id]
        );

        return rows[0];
    },


    // ======================================================
    // FIND USER BY EMAIL
    // Used by login, registration and forgot password
    // ======================================================
    async findByEmail(email) {

        const [rows] = await db.query(
            `
            SELECT *
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );

        return rows[0];
    },


    // ======================================================
    // ADMIN - ACTIVATE / DEACTIVATE USER
    // ======================================================
    async updateStatus(id, status) {

        const [result] = await db.query(
            `
            UPDATE users
            SET status = ?
            WHERE id = ?
            `,
            [
                status,
                id
            ]
        );

        return result;
    },


    // ======================================================
    // ADMIN - COUNT ALL USERS
    // ======================================================
    async countAll() {

        const [rows] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM users
            `
        );

        return rows[0].total;
    },


    // ======================================================
    // ADMIN - COUNT USERS BY STATUS
    // ======================================================
    async countByStatus(status) {

        const [rows] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM users
            WHERE status = ?
            `,
            [status]
        );

        return rows[0].total;
    },


    // ======================================================
    // FORGOT PASSWORD - SAVE RESET CODE
    // ======================================================
    async saveResetCode(
        userId,
        resetCode,
        expiresAt
    ) {

        await db.query(
            `
            UPDATE users
            SET
                reset_code = ?,
                reset_code_expires_at = ?,
                reset_attempts = 0
            WHERE id = ?
            `,
            [
                resetCode,
                expiresAt,
                userId
            ]
        );
    },


    // ======================================================
    // FORGOT PASSWORD - INCREMENT FAILED ATTEMPTS
    // ======================================================
    async incrementResetAttempts(
        userId
    ) {

        await db.query(
            `
            UPDATE users
            SET reset_attempts =
                reset_attempts + 1
            WHERE id = ?
            `,
            [userId]
        );
    },


    // ======================================================
    // FORGOT PASSWORD - UPDATE PASSWORD
    // ======================================================
    async updatePassword(
        userId,
        hashedPassword
    ) {

        await db.query(
            `
            UPDATE users
            SET
                password = ?,
                reset_code = NULL,
                reset_code_expires_at = NULL,
                reset_attempts = 0
            WHERE id = ?
            `,
            [
                hashedPassword,
                userId
            ]
        );
    }

};


module.exports = User;