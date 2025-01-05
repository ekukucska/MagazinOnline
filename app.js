// app.js
const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Database connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "MySQL2025*",
  database: "magazin_online",
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// Routes
app.get("/", async (req, res) => {
  try {
    const [products] = await connection
      .promise()
      .query(
        "SELECT p.*, c.nume_categorie FROM produse p JOIN categorii c ON p.id_categorie = c.id_categorie"
      );
    res.render("index", { products });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).send("Error fetching products");
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    const [product] = await connection
      .promise()
      .query(
        "SELECT p.*, c.nume_categorie FROM produse p JOIN categorii c ON p.id_categorie = c.id_categorie WHERE p.id_produs = ?",
        [req.params.id]
      );
    res.render("product", { product: product[0] });
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).send("Error fetching product");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
