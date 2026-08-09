const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");

const app = express();


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());

app.use(express.json());


// ======================================================
// SERVE GENERATED AI IMAGES
// ======================================================
//
// Example:
//
// backend/uploads/outputs/test/geometric.png
//
// becomes:
//
// http://localhost:5000/outputs/test/geometric.png
//

app.use(
    "/outputs",
    express.static(
        path.join(
            __dirname,
            "../uploads/outputs"
        )
    )
);


// ======================================================
// ROUTES
// ======================================================

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/projects",
    projectRoutes
);


module.exports = app;