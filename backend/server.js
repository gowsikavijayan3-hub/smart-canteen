require("dotenv").config();

const express = require("express");
const cors = require("cors");

const foodRoutes = require("./routes/food");
const orderRoutes = require("./routes/order");
const authRoutes = require("./routes/auth");

const app = express();


// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());
app.use(express.json());


// ===============================
// API ROUTES
// ===============================

app.use("/api/food", foodRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);


// ===============================
// TEST ROUTE
// ===============================

app.get("/", (req, res) => {

    res.send("Smart Canteen Backend is Running!");

});


// ===============================
// START SERVER
// ===============================

const PORT = 5000;

app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});