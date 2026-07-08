const db = require("../config/db");

const User = {
  // Get every registered user (used by Admin Dashboard user list)
  async findAll() {
    const [rows] = await db.query(
      `SELECT id, full_name, email, role, status, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    return rows;
  },

  // Get one user by id (used when admin opens a user's details)
  async findById(id) {
    const [rows] = await db.query(
      `SELECT id, full_name, email, role, status, created_at
       FROM users WHERE id = ?`,
      [id]
    );
    return rows[0];
  },

  // Used internally by login/register (kept here so all user queries live in one place)
  async findByEmail(email) {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    return rows[0];
  },

  // Activate / Deactivate a user account (Admin only)
  async updateStatus(id, status) {
    const [result] = await db.query(
      "UPDATE users SET status = ? WHERE id = ?",
      [status, id]
    );
    return result;
  },

  // Simple counts for the dashboard stat cards
  async countAll() {
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM users");
    return rows[0].total;
  },

  async countByStatus(status) {
    const [rows] = await db.query(
      "SELECT COUNT(*) AS total FROM users WHERE status = ?",
      [status]
    );
    return rows[0].total;
  },
};

module.exports = User;
