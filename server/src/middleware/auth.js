const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const normalizedAllowedRoles = allowedRoles.map((role) =>
      String(role || "").toLowerCase(),
    );
    const userRole = String(req.user?.role || "").toLowerCase();

    if (!req.user || !normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}

module.exports = {
  verifyToken,
  requireRole,
};
