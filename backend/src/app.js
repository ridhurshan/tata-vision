const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
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
// SERVE ORIGINAL UPLOADED IMAGES
// ======================================================

app.use(
  "/uploads/input",
  express.static(
    path.join(
      __dirname,
      "../uploads/input"
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
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/projects",
  projectRoutes
);


module.exports = app;