import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} from "../controllers/cartController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getCart);
router.post("/items", authMiddleware, addToCart);
router.put("/items/:productId", authMiddleware, updateCartItem);
router.delete("/items/:productId", authMiddleware, removeFromCart);
router.delete("/", authMiddleware, clearCart);

export default router;
