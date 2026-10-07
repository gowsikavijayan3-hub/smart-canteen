const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "24Gowsi2007",
    database: "smart_canteen"
});

db.connect((err) => {

    if (err) {

        console.log("MySQL connection failed!");
        console.log(err.message);

        return;
    }

    console.log("MySQL connected successfully!");

});

module.exports = db;