const express = require("express");

const db = require("../config/db");

const adminAuth = require("../middleware/adminAuth");

const router = express.Router();


// Get all food items
// Public route - students need this to view the menu
router.get("/", (req, res) => {

    const sql = `
        SELECT id, name, price, available
        FROM food_items
        ORDER BY id DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {

            console.log(err);

            return res.status(500).json({
                message: "Database error"
            });

        }

        res.json(results);

    });

});


// Update food availability
// Admin only
router.put("/:id/availability", adminAuth, (req, res) => {

    const foodId = req.params.id;
    const { available } = req.body;

    const sql = `
        UPDATE food_items
        SET available = ?
        WHERE id = ?
    `;

    db.query(sql, [available, foodId], (err, result) => {

        if (err) {
            console.log(err);

            return res.status(500).json({
                message: "Database error"
            });
        }

        res.json({
            message: "Food availability updated successfully"
        });

    });

});


// Add new food item
// Admin only
router.post("/", adminAuth, (req, res) => {

    const { name, price, available } = req.body;

    const sql = `
        INSERT INTO food_items (name, price, available)
        VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [name, price, available ? 1 : 0],
        (err, result) => {

            if (err) {
                console.log(err);

                return res.status(500).json({
                    message: "Database error"
                });
            }

            res.json({
                message: "Food item added successfully",
                id: result.insertId
            });

        }
    );

});


// Edit food item
// Admin only
router.put("/:id", adminAuth, (req, res) => {

    const foodId = req.params.id;
    const { name, price } = req.body;

    const sql = `
        UPDATE food_items
        SET name = ?, price = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [name, price, foodId],
        (err, result) => {

            if (err) {
                console.log(err);

                return res.status(500).json({
                    message: "Database error"
                });
            }

            res.json({
                message: "Food item updated successfully"
            });

        }
    );

});


// Delete food item
// Admin only
router.delete("/:id", adminAuth, (req, res) => {

    const foodId = req.params.id;

    const sql = `
        DELETE FROM food_items
        WHERE id = ?
    `;

    db.query(sql, [foodId], (err, result) => {

        if (err) {
            console.log(err);

            return res.status(500).json({
                message: "Database error"
            });
        }

        res.json({
            message: "Food item deleted successfully"
        });

    });

});


module.exports = router;