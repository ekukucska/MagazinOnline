const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// Database connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "MySQL2025*",
  database: "magazin_online",
});

// Cart middleware
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  next();
});

// Routes pentru frontend
app.get("/", async (req, res) => {
  try {
    const [products] = await connection
      .promise()
      .query(
        "SELECT p.*, c.nume_categorie FROM produse p JOIN categorii c ON p.id_categorie = c.id_categorie"
      );
    res.render("index", { products });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Error fetching products");
  }
});

// Adăugăm ruta pentru pagina individuală a produsului
app.get("/product/:id", async (req, res) => {
  try {
    const [product] = await connection
      .promise()
      .query(
        "SELECT p.*, c.nume_categorie FROM produse p " +
          "JOIN categorii c ON p.id_categorie = c.id_categorie " +
          "WHERE p.id_produs = ?",
        [req.params.id]
      );

    if (product[0]) {
      res.render("product", { product: product[0] });
    } else {
      res.status(404).send("Produsul nu a fost găsit");
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Error fetching product");
  }
});

// Routes pentru coșul de cumpărături
app.post("/cart/add", async (req, res) => {
  const { productId, quantity } = req.body;
  try {
    const [product] = await connection
      .promise()
      .query("SELECT * FROM produse WHERE id_produs = ?", [productId]);

    if (product[0] && product[0].stoc >= quantity) {
      const cartItem = {
        id: product[0].id_produs,
        nume: product[0].nume_produs,
        pret: product[0].pret,
        quantity: parseInt(quantity),
      };
      req.session.cart.push(cartItem);
      res.json({ success: true, message: "Produs adăugat în coș" });
    } else {
      res.json({ success: false, message: "Stoc insuficient" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding to cart" });
  }
});

app.get("/cart", (req, res) => {
  res.render("cart", { cart: req.session.cart });
});

// Routes pentru administrare (CRUD)
app.get("/admin", async (req, res) => {
  try {
    const [products] = await connection
      .promise()
      .query(
        "SELECT p.*, c.nume_categorie FROM produse p JOIN categorii c ON p.id_categorie = c.id_categorie"
      );
    const [categories] = await connection
      .promise()
      .query("SELECT * FROM categorii");
    res.render("admin", { products, categories });
  } catch (err) {
    res.status(500).send("Error accessing admin panel");
  }
});

// Create
app.post("/admin/product", async (req, res) => {
  const { nume_produs, descriere, pret, stoc, id_categorie } = req.body;
  try {
    await connection
      .promise()
      .query(
        "INSERT INTO produse (nume_produs, descriere, pret, stoc, id_categorie) VALUES (?, ?, ?, ?, ?)",
        [nume_produs, descriere, pret, stoc, id_categorie]
      );
    res.redirect("/admin");
  } catch (err) {
    res.status(500).send("Error creating product");
  }
});

// Update
app.post("/admin/product/:id", async (req, res) => {
  const { nume_produs, descriere, pret, stoc, id_categorie } = req.body;
  try {
    await connection
      .promise()
      .query(
        "UPDATE produse SET nume_produs=?, descriere=?, pret=?, stoc=?, id_categorie=? WHERE id_produs=?",
        [nume_produs, descriere, pret, stoc, id_categorie, req.params.id]
      );
    res.redirect("/admin");
  } catch (err) {
    res.status(500).send("Error updating product");
  }
});

// Delete
app.post("/admin/product/:id/delete", async (req, res) => {
  try {
    await connection
      .promise()
      .query("DELETE FROM produse WHERE id_produs = ?", [req.params.id]);
    res.redirect("/admin");
  } catch (err) {
    res.status(500).send("Error deleting product");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
