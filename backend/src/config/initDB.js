const db = require("./db");

async function initializeDatabase() {
  try {
    // =====================================================
    // USERS TABLE
    // =====================================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,

        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,

        role ENUM('USER', 'ADMIN')
          NOT NULL DEFAULT 'USER',

        is_verified TINYINT(1)
          NOT NULL DEFAULT 0,

        verification_code VARCHAR(64) NULL,
        verification_expires_at DATETIME NULL,

        verification_attempts INT
          NOT NULL DEFAULT 0,

        last_code_sent_at DATETIME NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Users table is ready.");

    // =====================================================
    // PROJECTS TABLE
    // =====================================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,

        user_id INT NOT NULL,

        title VARCHAR(255) NOT NULL,

        description TEXT NULL,

        status VARCHAR(50)
          NOT NULL DEFAULT 'Waiting',

        input_image VARCHAR(500) NULL,
        geometric_image VARCHAR(500) NULL,
        curve_image VARCHAR(500) NULL,
        shading_image VARCHAR(500) NULL,
        colouring_image VARCHAR(500) NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_projects_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    console.log("✅ Projects table is ready.");

  } catch (error) {
    console.error(
      "❌ Database initialization failed:",
      error.message
    );

    throw error;
  }
}

module.exports = initializeDatabase;