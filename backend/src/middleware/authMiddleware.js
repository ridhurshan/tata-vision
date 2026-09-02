const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    if (!token) {
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    try {
        req.user = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
        return next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token."
        });
    }
};

const adminOnly = (req, res, next) => {
    if (
        !req.user
        || String(req.user.role).toLowerCase() !== "admin"
    ) {
        return res.status(403).json({
            message: "Admin access required."
        });
    }

    return next();
};

module.exports = {
    protect,
    adminOnly
};
