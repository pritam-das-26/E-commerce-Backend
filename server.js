const express = require("express");
const cors = require("cors");

const dotenv = require("dotenv");

const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");

const productRoutes = require("./routes/productRoutes");

const cartRoutes = require("./routes/cartRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const subscribeRoutes = require("./routes/subscribeRoute");
const adminRoutes = require("./routes/adminRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminOrders= require("./routes/adminOrderRoutes")



const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173", // for local development
      "https://your-frontend-name.vercel.app", // ⚠️ replace with your actual frontend domain
    ],
    credentials: true,
  })
);

dotenv.config();

const PORT = process.env.PORT || 3000;

connectDB();

app.get("/", (req, res) => {
  res.send("Welcome to Fancy API!");
});

app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/subscribe", subscribeRoutes);
app.use("/api/admin/users",adminRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin/orders",adminOrders)
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
