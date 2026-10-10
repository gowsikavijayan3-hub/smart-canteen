const express = require("express");
const crypto = require("crypto");
const db = require("../config/db");
const staffAuth = require("../middleware/staffAuth");

const router = express.Router();


// =====================================================
// CREATE ORDER
// PRICE INTEGRITY + DATABASE TRANSACTION
// =====================================================

router.post("/", (req, res) => {

    const {
        user_id,
        pickup_date,
        pickup_time,
        counter,
        items
    } = req.body;


    // ==========================================
    // BASIC VALIDATION
    // ==========================================

    if (
        !user_id ||
        !pickup_date ||
        !pickup_time ||
        !counter ||
        !items
    ) {
        return res.status(400).json({
            message: "Missing order details"
        });
    }


    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {
        return res.status(400).json({
            message: "No food items selected"
        });
    }


    // ==========================================
    // VALIDATE PICKUP DATE
    // PICKUP DATE MUST BE TODAY OR FUTURE
    // ==========================================

    // Expected format: YYYY-MM-DD
    const dateFormat =
        /^\d{4}-\d{2}-\d{2}$/;

    if (!dateFormat.test(pickup_date)) {

        return res.status(400).json({
            message: "Invalid pickup date."
        });

    }


    // ==========================================
    // CHECK WHETHER DATE IS A REAL DATE
    // ==========================================

    const [year, month, day] =
        pickup_date
            .split("-")
            .map(Number);


    const selectedDate =
        new Date(
            year,
            month - 1,
            day
        );


    // Make sure JavaScript did not
    // automatically change an invalid date.

    if (
        selectedDate.getFullYear() !== year ||
        selectedDate.getMonth() !== month - 1 ||
        selectedDate.getDate() !== day
    ) {

        return res.status(400).json({
            message: "Invalid pickup date."
        });

    }


    // ==========================================
    // GET TODAY'S DATE
    // USING SERVER LOCAL DATE
    // ==========================================

    const now =
        new Date();


    const today =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );


    // ==========================================
    // REJECT PAST DATE
    // ==========================================

    if (selectedDate < today) {

        return res.status(400).json({
            message:
                "Pickup date cannot be a past date."
        });

    }


    // ==========================================
    // VALIDATE FOOD ID AND QUANTITY
    // ==========================================

    for (const item of items) {

        const foodId =
            item.food_id || item.id;

        const quantity =
            Number(item.quantity);


        if (!foodId) {

            return res.status(400).json({
                message: "Invalid food item"
            });

        }


        if (
            !Number.isInteger(quantity) ||
            quantity <= 0
        ) {

            return res.status(400).json({
                message:
                    "Invalid quantity for food item"
            });

        }

    }


    // ==========================================
    // GET ACTUAL PRICES FROM DATABASE
    // ==========================================

    const foodIds = items.map(
        item => item.food_id || item.id
    );


    const placeholders =
        foodIds.map(() => "?").join(",");


    const priceSql = `
        SELECT
            id,
            price
        FROM food_items
        WHERE id IN (${placeholders})
    `;


    db.query(
        priceSql,
        foodIds,
        (priceErr, foodRows) => {

            if (priceErr) {

                console.log(
                    "Get food prices error:",
                    priceErr.message
                );

                return res.status(500).json({
                    message:
                        "Failed to get food prices"
                });

            }


            // ==========================================
            // CREATE PRICE MAP
            // ==========================================

            const priceMap = {};


            foodRows.forEach(food => {

                priceMap[food.id] =
                    Number(food.price);

            });


            // ==========================================
            // CHECK FOOD ITEMS EXIST
            // ==========================================

            for (const item of items) {

                const foodId =
                    item.food_id || item.id;


                if (
                    priceMap[foodId] === undefined
                ) {

                    return res.status(400).json({
                        message:
                            `Food item ${foodId} not found`
                    });

                }

            }


            // ==========================================
            // CALCULATE TOTAL
            // USING DATABASE PRICE
            // ==========================================

            let calculatedTotal = 0;


            const orderItems =
                items.map(item => {

                    const foodId =
                        item.food_id || item.id;

                    const quantity =
                        Number(item.quantity);

                    const actualPrice =
                        priceMap[foodId];

                    const itemTotal =
                        actualPrice * quantity;


                    calculatedTotal +=
                        itemTotal;


                    return {
                        food_id: foodId,
                        quantity: quantity,
                        price: actualPrice
                    };

                });


            // ==========================================
            // CREATE QR TOKEN
            // ==========================================

            const qrToken =
                crypto
                    .randomBytes(16)
                    .toString("hex");


            // ==========================================
            // START DATABASE TRANSACTION
            // ==========================================

          db.getConnection((connectionErr, connection) => {
    if (connectionErr) {
        console.error("Get connection error:", connectionErr.message);
        return res.status(500).json({
            message: "Failed to connect to database"
        });
    }

    connection.beginTransaction((transactionErr) => {
        if (transactionErr) {
            connection.release();
            console.error("Transaction start error:", transactionErr.message);
            return res.status(500).json({
                message: "Failed to start order transaction"
            });
        }

        const orderSql = `
            INSERT INTO orders
            (user_id, total_amount, pickup_date, pickup_time, counter, status, qr_token)
            VALUES (?, ?, ?, ?, ?, 'PLACED', ?)
        `;

        connection.query(
            orderSql,
            [user_id, calculatedTotal, pickup_date, pickup_time, counter, qrToken],
            (orderErr, result) => {
                if (orderErr) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Create order error:", orderErr.message);
                        res.status(500).json({
                            message: "Failed to create order"
                        });
                    });
                }

                const orderId = result.insertId;
                const itemSql = `
                    INSERT INTO order_items (order_id, food_id, quantity, price)
                    VALUES ?
                `;

                const values = orderItems.map(item => [
                    orderId, item.food_id, item.quantity, item.price
                ]);

                connection.query(itemSql, [values], (itemErr) => {
                    if (itemErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Order item error:", itemErr.message);
                            res.status(500).json({
                                message: "Failed to save order items. Order creation rolled back."
                            });
                        });
                    }

                    connection.commit((commitErr) => {
                        if (commitErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error("Transaction commit error:", commitErr.message);
                                res.status(500).json({
                                    message: "Failed to complete order transaction"
                                });
                            });
                        }

                        connection.release();
                        return res.json({
                            message: "Order created successfully",
                            orderId,
                            qr_token: qrToken,
                            total_amount: calculatedTotal
                        });
                    });
                });
            }
        );
    });
});
        }
    );

});


// =====================================================
// GET ALL ORDERS WITH FOOD ITEMS
// =====================================================

router.get("/", (req, res) => {

    const orderSql = `
        SELECT
            o.id,
            o.user_id,
            o.total_amount,
            o.pickup_date,
            o.pickup_time,
            o.counter,
            o.status,
            o.qr_token,

            u.name AS student_name,
            u.student_id

        FROM orders o

        LEFT JOIN users u
            ON o.user_id = u.id

        ORDER BY o.id DESC
    `;


    db.query(orderSql, (err, orders) => {

        if (err) {

            console.log(
                "Get orders error:",
                err.message
            );

            return res.status(500).json({
                message: "Database error"
            });

        }


        if (orders.length === 0) {
            return res.json([]);
        }


        let completed = 0;


        orders.forEach(order => {

            const itemSql = `
                SELECT
                    oi.food_id,
                    oi.quantity,
                    oi.price,
                    f.name AS food_name

                FROM order_items oi

                LEFT JOIN food_items f
                    ON oi.food_id = f.id

                WHERE oi.order_id = ?
            `;


            db.query(
                itemSql,
                [order.id],
                (itemErr, items) => {

                    if (itemErr) {

                        console.log(
                            "Get order items error:",
                            itemErr.message
                        );

                        order.items = [];

                    } else {

                        order.items = items;

                    }


                    completed++;


                    if (
                        completed ===
                        orders.length
                    ) {

                        res.json(orders);

                    }

                }
            );

        });

    });

});


// =====================================================
// GET ORDERS OF ONE USER
// =====================================================

router.get("/user/:userId", (req, res) => {

    const userId = req.params.userId;


    const sql = `
        SELECT *
        FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
    `;


    db.query(
        sql,
        [userId],
        (err, results) => {

            if (err) {

                console.log(
                    "Get user orders error:",
                    err.message
                );

                return res.status(500).json({
                    message: "Database error"
                });

            }


            res.json(results);

        }
    );

});


// =====================================================
// GET SINGLE ORDER
// =====================================================

router.get("/:id", (req, res) => {

    const orderId = req.params.id;


    const sql = `
        SELECT
            o.*,
            u.name AS student_name,
            u.student_id

        FROM orders o

        LEFT JOIN users u
            ON o.user_id = u.id

        WHERE o.id = ?
    `;


    db.query(
        sql,
        [orderId],
        (err, orders) => {

            if (err) {

                return res.status(500).json({
                    message: "Database error"
                });

            }


            if (orders.length === 0) {

                return res.status(404).json({
                    message: "Order not found"
                });

            }


            const order = orders[0];


            const itemSql = `
                SELECT
                    oi.food_id,
                    oi.quantity,
                    oi.price,
                    f.name AS food_name

                FROM order_items oi

                LEFT JOIN food_items f
                    ON oi.food_id = f.id

                WHERE oi.order_id = ?
            `;


            db.query(
                itemSql,
                [orderId],
                (itemErr, items) => {

                    if (itemErr) {

                        return res.status(500).json({
                            message:
                                "Failed to load order items"
                        });

                    }


                    order.items = items;


                    res.json(order);

                }
            );

        }
    );

});


// =====================================================
// GET ORDER USING QR TOKEN
// IMPORTANT: KEEP THIS BEFORE /:id
// =====================================================

router.get("/qr/:qrToken", (req, res) => {

    const qrToken = req.params.qrToken;


    const orderSql = `
        SELECT
            o.*,
            u.name AS student_name,
            u.student_id

        FROM orders o

        LEFT JOIN users u
            ON o.user_id = u.id

        WHERE o.qr_token = ?
    `;


    db.query(
        orderSql,
        [qrToken],
        (err, orders) => {

            if (err) {

                console.log(
                    "QR order error:",
                    err.message
                );

                return res.status(500).json({
                    message: "Database error"
                });

            }


            if (orders.length === 0) {

                return res.status(404).json({
                    message:
                        "Invalid QR code"
                });

            }


            const order = orders[0];


            const itemSql = `
                SELECT
                    oi.food_id,
                    oi.quantity,
                    oi.price,
                    f.name AS food_name

                FROM order_items oi

                LEFT JOIN food_items f
                    ON oi.food_id = f.id

                WHERE oi.order_id = ?
            `;


            db.query(
                itemSql,
                [order.id],
                (itemErr, items) => {

                    if (itemErr) {

                        return res.status(500).json({
                            message:
                                "Failed to load food items"
                        });

                    }


                    order.items = items;


                    res.json(order);

                }
            );

        }
    );

});


// =====================================================
// UPDATE ORDER STATUS
// =====================================================

router.put("/:id/status", (req, res) => {

    const orderId = req.params.id;
    const { status } = req.body;


    const allowedStatuses = [
        "PLACED",
        "PREPARING",
        "READY",
        "COLLECTED",
        "CANCELLED"
    ];


    // ==========================================
    // CHECK VALID STATUS
    // ==========================================

    if (
        !allowedStatuses.includes(status)
    ) {

        return res.status(400).json({
            message:
                "Invalid order status"
        });

    }


    const getSql = `
        SELECT status
        FROM orders
        WHERE id = ?
    `;


    db.query(
        getSql,
        [orderId],
        (err, results) => {

            if (err) {

                return res.status(500).json({
                    message:
                        "Database error"
                });

            }


            if (results.length === 0) {

                return res.status(404).json({
                    message:
                        "Order not found"
                });

            }


            const currentStatus =
                results[0].status;


            // ==========================================
            // ALLOWED STATUS TRANSITIONS
            // ==========================================

            const validTransitions = {

                "PLACED": [
                    "PREPARING",
                    "CANCELLED"
                ],

                "PREPARING": [
                    "READY"
                ],

                "READY": [
                    "COLLECTED"
                ],

                "COLLECTED": [],

                "CANCELLED": []

            };


            // ==========================================
            // CHECK STATUS TRANSITION
            // ==========================================

            if (
                !validTransitions[currentStatus] ||
                !validTransitions[currentStatus].includes(status)
            ) {

                return res.status(400).json({

                    message:
                        `Invalid status change: ${currentStatus} → ${status}`

                });

            }


            // ==========================================
            // UPDATE STATUS
            // ==========================================

            const updateSql = `
                UPDATE orders
                SET status = ?
                WHERE id = ?
            `;


            db.query(
                updateSql,
                [status, orderId],
                (updateErr, result) => {

                    if (updateErr) {

                        return res.status(500).json({
                            message:
                                "Failed to update order"
                        });

                    }


                    if (
                        result.affectedRows === 0
                    ) {

                        return res.status(400).json({
                            message:
                                "Order status could not be updated"
                        });

                    }


                    res.json({

                        message:
                            "Order status updated successfully",

                        status:
                            status

                    });

                }
            );

        }
    );

});


// =====================================================
// STAFF COLLECT ORDER
// STAFF AUTHENTICATION REQUIRED
// =====================================================

router.put(
    "/:id/collect",
    staffAuth,
    (req, res) => {

        const orderId =
            req.params.id;


        // Get counter from authenticated staff JWT
        // Do NOT trust counter sent by frontend

        const staffCounter =
            req.staff.counter;


        if (!staffCounter) {

            return res.status(403).json({
                message:
                    "Staff counter not assigned"
            });

        }


        const sql = `
            SELECT
                id,
                counter,
                status

            FROM orders

            WHERE id = ?
        `;


        db.query(
            sql,
            [orderId],
            (err, results) => {

                if (err) {

                    return res.status(500).json({
                        message:
                            "Database error"
                    });

                }


                if (
                    results.length === 0
                ) {

                    return res.status(404).json({
                        message:
                            "Order not found"
                    });

                }


                const order =
                    results[0];


                // Check staff counter from JWT

                if (
                    order.counter !==
                    staffCounter
                ) {

                    return res.status(403).json({
                        message:
                            "This order belongs to another counter"
                    });

                }


                if (
                    order.status !==
                    "READY"
                ) {

                    return res.status(400).json({
                        message:
                            "Order is not ready for collection"
                    });

                }


                const updateSql = `
                    UPDATE orders
                    SET status = 'COLLECTED'

                    WHERE id = ?
                    AND status = 'READY'
                `;


                db.query(
                    updateSql,
                    [orderId],
                    (updateErr, result) => {

                        if (updateErr) {

                            return res.status(500).json({
                                message:
                                    "Failed to collect order"
                            });

                        }


                        if (
                            result.affectedRows === 0
                        ) {

                            return res.status(400).json({
                                message:
                                    "Order could not be collected"
                            });

                        }


                        res.json({
                            message:
                                "Order collected successfully"
                        });

                    }
                );

            }
        );

    }
);


// ==========================================
// STUDENT CANCEL ORDER
// Student can cancel ONLY before
// admin starts preparing
// ==========================================

router.put("/:id/cancel", (req, res) => {

    const orderId =
        req.params.id;


    console.log(
        "Cancel request for Order ID:",
        orderId
    );


    // ==========================================
    // CHECK CURRENT ORDER STATUS
    // ==========================================

    const checkSql = `
        SELECT
            id,
            status

        FROM orders

        WHERE id = ?
    `;


    db.query(
        checkSql,
        [orderId],
        (err, results) => {

            if (err) {

                console.error(
                    "Cancel order database error:",
                    err.message
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to cancel order"
                });

            }


            // ======================================
            // ORDER NOT FOUND
            // ======================================

            if (
                results.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Order not found"
                });

            }


            const order =
                results[0];


            console.log(
                "Current order status:",
                order.status
            );


            // ======================================
            // ONLY PLACED ORDERS CAN BE CANCELLED
            // ======================================

            if (
                order.status !==
                "PLACED"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Order cannot be cancelled after preparation has started."
                });

            }


            // ======================================
            // CANCEL ORDER
            // ======================================

            const updateSql = `
                UPDATE orders
                SET status = 'CANCELLED'

                WHERE id = ?
                AND status = 'PLACED'
            `;


            db.query(
                updateSql,
                [orderId],
                (updateErr, result) => {

                    if (updateErr) {

                        console.error(
                            "Cancel update error:",
                            updateErr.message
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                "Failed to cancel order"
                        });

                    }


                    // ==================================
                    // CHECK UPDATE
                    // ==================================

                    if (
                        result.affectedRows === 0
                    ) {

                        return res.status(400).json({
                            success: false,
                            message:
                                "Order could not be cancelled."
                        });

                    }


                    console.log(
                        "Order cancelled successfully:",
                        orderId
                    );


                    // ==================================
                    // SUCCESS
                    // ==================================

                    res.json({
                        success: true,
                        message:
                            "Order cancelled successfully"
                    });

                }
            );

        }
    );

});


module.exports = router;