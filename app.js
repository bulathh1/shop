'use strict';

const mysql = require("mysql2");
const express = require("express");

const app = express();
const urlencodedParser = express.urlencoded({ extended: false });

const pool = mysql.createPool({
    connectionLimit: 5,
    host: "localhost",
    user: "root",
    database: "AutoPartsStore",
    password: "Student" // ������ ������������ root  
});



// Middleware ��� �������� JSON
app.use(express.json());

// Middleware ��� �������� URL-������������ ������
app.use(express.urlencoded({ extended: true }));





app.set("view engine", "hbs");

app.use(express.static('public'));

app.set("view engine", "hbs");
// ����� ���� ������ �������� ������� � ���� �������
let cart = []; 
const hbs = require('hbs');

// ����������� ������� `eq`
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});


app.get("/add-to-cart/:partsId", function (req, res) {
    const partsId = req.params.partsId;

    // ���������� �������� � �������
    pool.query(
        "INSERT INTO cart (partsId, quantity) VALUES (?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1",
        [partsId],
        function (err) {
            if (err) {
                console.error("������ ��� ���������� � �������:", err);
                return res.status(500).send("������ �������");
            }
            res.redirect("/store");
        }
    );
});

app.get("/cart", function (req, res) {
    pool.query("SELECT c.quantity, p.name, p.price FROM cart c JOIN parts p ON c.partsId = p.partsId", function (err, cartItems) {
        if (err) {
            console.error("������ ��� ��������� ������ �� �������:", err);
            return res.status(500).send("������ �������");
        }

        // ���������� ����� ���������
        let totalPrice = 0;
        cartItems.forEach(item => {
            totalPrice += item.price * item.quantity; // �������� ���� �� ����������
        });

        res.render("cart.hbs", {
            Cart: cartItems,
            totalPrice: totalPrice // �������� ����� ��������� � ������
        });
    });
});
app.get("/checkout", function (req, res) {
    pool.query("SELECT c.quantity, p.name, p.price FROM cart c JOIN parts p ON c.partsId = p.partsId", function (err, cartItems) {
        if (err) {
            console.error("������ ��� ��������� ������ �� �������:", err);
            return res.status(500).send("������ �������");
        }

        pool.query("SELECT SUM(p.price * c.quantity) AS totalPrice FROM cart c JOIN parts p ON c.partsId = p.partsId", function (err, result) {
            if (err) {
                console.error("������ ��� ���������� ����� ���������:", err);
                return res.status(500).send("������ �������");
            }

            const totalPrice = result[0] ? result[0].totalPrice || 0 : 0;

            res.render("Checkout.hbs", {
                totalPrice: totalPrice,
                cartStore: cartItems  // �������� ������ ������� � ������
            });
        });
    });
});
app.post("/checkout", function (req, res) {
    console.log(req.body); // ������� ���������� req.body � �������
    const { name, phone, email, payment } = req.body; // �������� ������ �� �����

    // ����� ����� �������� ������ ��� ��������� ����� ��������� �� �������
    pool.query("SELECT SUM(c.quantity * p.price) AS totalPrice FROM cart c JOIN parts p ON c.partsId = p.partsId", function (err, result) {
        if (err) {
            console.error("������ ��� ��������� ����� ���������:", err);
            return res.status(500).send("������ �������");
        }

        const totalPrice = result[0].totalPrice;

        // ������� ������ ������ � ������� history
        const createdAt = new Date(); // �������� ������� ����
        pool.query("INSERT INTO history (name, phone, email, payment, totalPrice, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
            [name, phone, email, payment, totalPrice, createdAt], function (err) {
                if (err) {
                    console.error("������ ��� ���������� ������:", err);
                    return res.status(500).send("������ �������");
                }

                // ������� ������� ����� ��������� ���������� ������
                pool.query("DELETE FROM cart", function (err) {
                    if (err) {
                        console.error("������ ��� ������� �������:", err);
                        return res.status(500).send("������ �������");
                    }

                    // ��������������� �� �������� ������� �������
                    res.redirect("/history");
                });
            });
    });
});
app.get("/history", function (req, res) {
    pool.query("SELECT * FROM history ORDER BY createdAt DESC", function (err, orders) {
        if (err) {
            console.error("������ ��� ��������� ������� �������:", err);
            return res.status(500).send("������ �������");
        }

        res.render("history.hbs", { orders: orders }); // �������� ������ � ������
    });
});

app.post("/clear-cart", function (req, res) {
    pool.query("DELETE FROM cart", function (err) {
        if (err) {
            console.error("������ ��� ������� �������:", err);
            return res.status(500).send("������ �������");
        }
        res.redirect("/cart"); // ��������������� ������� � �������
    });
});

// ������� ��������
app.get("/", function (req, res) {
    res.render("Main.hbs");
});
// �������� "�� �����������"
app.get("/about", function (req, res) {
    res.render("About.hbs");
});
app.get("/AutoPartsStore", function (req, res) {
    pool.query("SELECT * FROM parts", function (err, autoparts) {
        if (err) return console.log(err);
        res.render("store.hbs", {
            Allparts: store
        });
    });
});
app.get("/store", function (req, res) {
    const filterType = req.query.filterType || 'name';
    const filter = req.query.filter || '';

    let query = "SELECT * FROM parts";
    let queryParams = [];

    // ������� ���������� ��� ������ �� ����
    if (filter) {
        if (filterType === 'price') {
            const priceValue = parseFloat(filter);
            query += " WHERE price = ?";
            queryParams.push(priceValue);
        } else {
            query += " WHERE name LIKE ?";
            queryParams.push('%' + filter + '%');
        }
    }

    // ���������� ���������� �� �������� ��� ����
    if (filterType === 'price') {
        query += " ORDER BY price ASC";  // ���������� �� ����
    } else {
        query += " ORDER BY name ASC";  // ���������� �� ��������
    }

    // ���������� �������
    pool.query(query, queryParams, function (err, data) {
        if (err) return console.log(err);
        res.render("store.hbs", { parts: data, filter: filter, filterType: filterType, cartLen: cart.length });
    });
});
//------------------------------------------------------------
// ��������� ������ �������������
//------------------------------------------------------------
app.get("/store", function (req, res) {
    pool.query("SELECT * FROM parts", function (err, data) {
        if (err) return console.log(err);
        res.render("store.hbs", {
            parts: data
        });
    });
});
app.get("/create", function (req, res) {
    res.render("create.hbs");
});

app.post("/create", urlencodedParser, function (req, res) {

    if (!req.body) return res.sendStatus(400);

    const partsId = req.body.partsId;
    const name = req.body.name;
    const price = req.body.price;
    const count = req.body.count;
    const suplierId = req.body.suplierId;

    pool.query("INSERT INTO parts (partsId, name, price, count, suplierId) VALUES (?, ?, ?, ?, ?)",
        [partsId, name, price, count, suplierId], function (err, data) {
            if (err) return console.log(err);
            res.redirect("/store");
        });
});
app.get("/edit/:partsId", function (req, res) {
    const partsId = req.params.partsId;
    pool.query("SELECT * FROM parts WHERE partsId=?", [partsId], function (err, data) {
        if (err) return console.log(err);
        res.render("edit.hbs", {
            parts: data[0]
        });
    });
});
app.post("/edit", urlencodedParser, function (req, res) {

    if (!req.body) return res.sendStatus(400);
    const partsId = req.body.partsId;
    const name = req.body.name;
    const price = req.body.price;
    const count = req.body.count;
    const suplierId = req.body.suplierId;

    pool.query("UPDATE parts SET name=?, price=?, count=?, suplierId=? WHERE partsId=?", [name, price, count, suplierId, partsId], function (err, data) {
        if (err) return console.log(err);

        res.redirect("/store");
    });
});
app.post("/delete/:partsId", function (req, res) {

    const partsId = req.params.partsId;
    pool.query("DELETE FROM parts WHERE partsId=?", [partsId], function (err, data) {
        if (err) return console.log(err);
        console.log("��������", partsId);
        res.redirect("/store");
    });
});




//------------------------------------------------
app.listen(3000, function () {
    console.log("Server is ready to Connect...");
});

