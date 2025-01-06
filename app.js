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

app.post("/cart/remove/:index", (req, res) => {
  const index = parseInt(req.params.index);
  if (index >= 0 && index < req.session.cart.length) {
    req.session.cart.splice(index, 1);
  }
  res.redirect("/cart");
});

app.post("/place-order", async (req, res) => {
  if (!req.session.cart || req.session.cart.length === 0) {
    return res.redirect("/cart");
  }

  try {
    // Începem o tranzacție pentru a ne asigura că toate operațiunile sunt executate sau niciuna
    const [orderResult] = await connection.promise().query(
      "INSERT INTO comenzi (id_client, status_comanda) VALUES (?, ?)",
      [1, "Plasata"] // Folosim id_client = 1 temporar, ar trebui să fie id-ul utilizatorului autentificat
    );

    const orderId = orderResult.insertId;

    // Adăugăm fiecare produs din coș în detalii_comenzi
    for (const item of req.session.cart) {
      // Verificăm stocul disponibil
      const [stockResult] = await connection
        .promise()
        .query("SELECT stoc FROM produse WHERE id_produs = ?", [item.id]);

      if (stockResult[0].stoc < item.quantity) {
        throw new Error(`Stoc insuficient pentru produsul ${item.nume}`);
      }

      // Adăugăm în detalii_comenzi
      await connection
        .promise()
        .query(
          "INSERT INTO detalii_comenzi (id_comanda, id_produs, cantitate, pret_unitar) VALUES (?, ?, ?, ?)",
          [orderId, item.id, item.quantity, item.pret]
        );

      // Actualizăm stocul
      await connection
        .promise()
        .query("UPDATE produse SET stoc = stoc - ? WHERE id_produs = ?", [
          item.quantity,
          item.id,
        ]);
    }

    // Golim coșul după plasarea comenzii
    req.session.cart = [];

    res.redirect("/cart");
  } catch (err) {
    console.error("Error placing order:", err);
    res.status(500).send("Eroare la plasarea comenzii: " + err.message);
  }
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
