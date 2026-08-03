require("dotenv").config();

const app = require("./app");
const db = require("./config/db");
const initializeDatabase = require("./config/initDB");

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Test MySQL connection
        await db.query("SELECT 1");
        console.log("✅ MySQL connected!");

        // Automatically create missing tables
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Server could not start:", error.message);
        process.exit(1);
    }
}

startServer();