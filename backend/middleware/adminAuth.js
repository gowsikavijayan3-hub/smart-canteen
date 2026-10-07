const jwt = require("jsonwebtoken");

const JWT_SECRET =
    process.env.JWT_SECRET || "smart_canteen_admin_secret_key";


function adminAuth(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;


        // Check if token exists
        if (!authHeader) {

            return res.status(401).json({
                message: "Admin authentication required."
            });

        }


        // Expected format:
        // Authorization: Bearer TOKEN

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


        // Verify token
        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        // Make sure user is admin
        if (decoded.role !== "admin") {

            return res.status(403).json({
                message: "Admin access required."
            });

        }


        // Store admin details
        req.admin = decoded;


        // Continue to the requested API
        next();


    } catch (error) {

        console.error(
            "Admin authentication error:",
            error.message
        );


        return res.status(401).json({
            message: "Invalid or expired admin token."
        });

    }

}


module.exports = adminAuth;