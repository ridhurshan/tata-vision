const jwt = require("jsonwebtoken");

// Checks that a valid JWT was sent in the Authorization header.
// Expected header format: "Authorization: Bearer <token>"
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided. Please log in." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired or invalid token. Please log in again." });
  }
};

// Must run AFTER verifyToken. Blocks non-admin users from admin-only routes.
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  next();
};
