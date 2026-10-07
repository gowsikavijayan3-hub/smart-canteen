const jwt = require("jsonwebtoken");

const JWT_SECRET =
    process.env.JWT_SECRET || "smart_canteen_admin_secret_key";

function staffAuth(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                message: "Staff authentication required."
            });
        }

        const parts =
            authHeader.split(" ");

        if (
            parts.length !== 2 ||
            parts[0] !== "Bearer"
        ) {
            return res.status(401).json({
                message: "Invalid authorization format."
            });
        }

        const token = parts[1];

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );

        if (decoded.role !== "staff") {
            return res.status(403).json({
                message: "Staff access required."
            });
        }

        req.staff = decoded;

        next();

    } catch (error) {

        console.error(
            "Staff authentication error:",
            error.message
        );

        return res.status(401).json({
            message: "Invalid or expired staff token."
        });
    }
}

module.exports = staffAuth;