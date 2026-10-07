const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();


// ======================================================
// STUDENT REGISTER
// ======================================================

router.post("/register", async (req, res) => {

    try {

        const {
            name,
            email,
            studentId,
            password
        } = req.body;


        if (!name || !email || !studentId || !password) {

            return res.status(400).json({
                message: "All fields are required"
            });

        }


        const checkSql = `
            SELECT id
            FROM users
            WHERE email = ?
            OR student_id = ?
        `;


        db.query(
            checkSql,
            [email, studentId],
            async (err, results) => {

                if (err) {

                    console.log(err);

                    return res.status(500).json({
                        message: "Database error"
                    });

                }


                if (results.length > 0) {

                    return res.status(409).json({
                        message:
                            "Email or Student ID already exists"
                    });

                }


                const hashedPassword =
                    await bcrypt.hash(password, 10);


                const insertSql = `
                    INSERT INTO users
                    (
                        name,
                        email,
                        student_id,
                        password,
                        role
                    )
                    VALUES (?, ?, ?, ?, 'student')
                `;


                db.query(
                    insertSql,
                    [
                        name,
                        email,
                        studentId,
                        hashedPassword
                    ],
                    (err, result) => {

                        if (err) {

                            console.log(err);

                            return res.status(500).json({
                                message:
                                    "Registration failed"
                            });

                        }


                        res.status(201).json({

                            message:
                                "Student registered successfully",

                            userId:
                                result.insertId

                        });

                    }
                );

            }
        );


    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});


// ======================================================
// STUDENT LOGIN
// ======================================================

router.post("/login", (req, res) => {

    const {
        email,
        password
    } = req.body;


    if (!email || !password) {

        return res.status(400).json({
            message:
                "Email and password are required"
        });

    }


    const sql = `
        SELECT *
        FROM users
        WHERE email = ?
        AND role = 'student'
    `;


    db.query(
        sql,
        [email],
        async (err, results) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    message: "Database error"
                });

            }


            if (results.length === 0) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });

            }


            const user = results[0];


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });

            }


            res.json({

                message: "Login successful",

                user: {

                    id: user.id,

                    name: user.name,

                    email: user.email,

                    studentId:
                        user.student_id,

                    role:
                        user.role

                }

            });

        }
    );

});


// ======================================================
// ADMIN LOGIN
// ======================================================

router.post("/admin-login", (req, res) => {

    const {
        email,
        password
    } = req.body;


    if (!email || !password) {

        return res.status(400).json({
            message:
                "Email and password are required."
        });

    }


    const sql = `
        SELECT *
        FROM users
        WHERE email = ?
        AND role = 'admin'
        LIMIT 1
    `;


    db.query(
        sql,
        [email],
        async (err, results) => {

            if (err) {

                console.log(
                    "Admin login database error:",
                    err
                );

                return res.status(500).json({
                    message:
                        "Database error during admin login."
                });

            }


            if (results.length === 0) {

                return res.status(401).json({
                    message:
                        "Invalid admin email or password."
                });

            }


            const admin = results[0];


            try {

                const passwordMatch =
                    await bcrypt.compare(
                        password,
                        admin.password
                    );


                if (!passwordMatch) {

                    return res.status(401).json({
                        message:
                            "Invalid admin email or password."
                    });

                }


                // Create Admin JWT

                const token =
                    jwt.sign(
                        {
                            id: admin.id,
                            email: admin.email,
                            role: admin.role
                        },
                        process.env.JWT_SECRET,
                        {
                            expiresIn: "2h"
                        }
                    );


                res.json({

                    message:
                        "Admin login successful",

                    token: token,

                    user: {

                        id:
                            admin.id,

                        name:
                            admin.name,

                        email:
                            admin.email,

                        role:
                            admin.role

                    }

                });


            } catch (error) {

                console.error(
                    "Admin password/token error:",
                    error
                );

                return res.status(500).json({

                    message:
                        "Admin login processing failed."

                });

            }

        }
    );

});


// ======================================================
// CREATE STAFF ACCOUNT
// ADMIN ONLY
// ======================================================

router.post(
    "/create-staff",
    adminAuth,
    async (req, res) => {

        try {

            const {
                name,
                staffId,
                password,
                counter
            } = req.body;


            if (
                !name ||
                !staffId ||
                !password ||
                !counter
            ) {

                return res.status(400).json({

                    message:
                        "All staff details are required"

                });

            }


            if (
                counter !== "Counter 1" &&
                counter !== "Counter 2"
            ) {

                return res.status(400).json({

                    message:
                        "Invalid counter"

                });

            }


            const checkSql = `
                SELECT id
                FROM users
                WHERE staff_id = ?
            `;


            db.query(
                checkSql,
                [staffId],
                async (err, results) => {

                    if (err) {

                        console.log(err);

                        return res.status(500).json({

                            message:
                                "Database error"

                        });

                    }


                    if (results.length > 0) {

                        return res.status(409).json({

                            message:
                                "Staff ID already exists"

                        });

                    }


                    const hashedPassword =
                        await bcrypt.hash(
                            password,
                            10
                        );


                    const insertSql = `
                        INSERT INTO users
                        (
                            name,
                            staff_id,
                            password,
                            role,
                            counter
                        )
                        VALUES (?, ?, ?, 'staff', ?)
                    `;


                    db.query(
                        insertSql,
                        [
                            name,
                            staffId,
                            hashedPassword,
                            counter
                        ],
                        (err, result) => {

                            if (err) {

                                console.log(err);

                                return res.status(500).json({

                                    message:
                                        "Failed to create staff"

                                });

                            }


                            res.status(201).json({

                                message:
                                    "Staff account created successfully",

                                staffId:
                                    staffId,

                                counter:
                                    counter

                            });

                        }
                    );

                }
            );


        } catch (error) {

            console.log(error);

            res.status(500).json({

                message:
                    "Server error"

            });

        }

    }
);


// ======================================================
// STAFF LOGIN
// ======================================================

router.post("/staff-login", (req, res) => {

    const {
        staffId,
        password
    } = req.body;


    if (!staffId || !password) {

        return res.status(400).json({

            message:
                "Staff ID and password are required"

        });

    }


    const sql = `
        SELECT *
        FROM users
        WHERE staff_id = ?
        AND role = 'staff'
        LIMIT 1
    `;


    db.query(
        sql,
        [staffId],
        async (err, results) => {

            if (err) {

                console.log(err);

                return res.status(500).json({

                    message:
                        "Database error"

                });

            }


            if (results.length === 0) {

                return res.status(401).json({

                    message:
                        "Invalid Staff ID or password"

                });

            }


            const staff = results[0];


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    staff.password
                );


            if (!passwordMatch) {

                return res.status(401).json({

                    message:
                        "Invalid Staff ID or password"

                });

            }


            // Create Staff JWT

            const token =
                jwt.sign(
                    {
                        id: staff.id,
                        name: staff.name,
                        staffId: staff.staff_id,
                        role: staff.role,
                        counter: staff.counter
                    },
                    process.env.JWT_SECRET,
                    {
                        expiresIn: "2h"
                    }
                );


            res.json({

                message:
                    "Staff login successful",

                token: token,

                user: {

                    id:
                        staff.id,

                    name:
                        staff.name,

                    staffId:
                        staff.staff_id,

                    role:
                        staff.role,

                    counter:
                        staff.counter

                }

            });

        }
    );

});


// ======================================================
// GET ALL STAFF
// ADMIN ONLY
// ======================================================

router.get(
    "/staff",
    adminAuth,
    async (req, res) => {

        const sql = `
            SELECT
                id,
                name,
                staff_id,
                counter
            FROM users
            WHERE role = 'staff'
            ORDER BY id DESC
        `;


        db.query(
            sql,
            (err, results) => {

                if (err) {

                    console.log(
                        "Get staff error:",
                        err.message
                    );

                    return res.status(500).json({

                        message:
                            "Database error"

                    });

                }


                res.json(results);

            }
        );

    }
);


// ======================================================
// DELETE STAFF
// ADMIN ONLY
// ======================================================

router.delete(
    "/staff/:id",
    adminAuth,
    async (req, res) => {

        const id = req.params.id;


        const sql = `
            DELETE FROM users
            WHERE id = ?
            AND role = 'staff'
        `;


        db.query(
            sql,
            [id],
            (err, result) => {

                if (err) {

                    console.log(
                        "Delete staff error:",
                        err.message
                    );

                    return res.status(500).json({

                        message:
                            "Database error"

                    });

                }


                if (result.affectedRows === 0) {

                    return res.status(404).json({

                        message:
                            "Staff account not found"

                    });

                }


                res.json({

                    message:
                        "Staff account removed successfully"

                });

            }
        );

    }
);


module.exports = router;