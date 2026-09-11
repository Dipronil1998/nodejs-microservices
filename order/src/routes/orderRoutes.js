import express from "express";
import roleCheck from "../middleware/roleCheck.js";
import {
  checkoutCart,
  createDirectOrder,
  getAllOrders,
  getOrderById,
  getOrderByNumber,
  getOrderItems,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  softDeleteOrder,
  restoreOrder
} from "../controllers/orderController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Order creation
router.post("/checkout", authMiddleware, checkoutCart);
router.post("/direct", authMiddleware, createDirectOrder);

// Query orders
router.get("/", authMiddleware, getAllOrders);
router.get("/:id", authMiddleware, getOrderById);
router.get("/number/:orderNumber", authMiddleware, getOrderByNumber);
router.get("/:id/items", authMiddleware, getOrderItems);

// Order actions & management
router.patch("/:id/cancel", authMiddleware, cancelOrder);
router.patch("/:id/status", roleCheck(["admin"]), updateOrderStatus);
router.patch("/:id/payment", roleCheck(["admin"]), updatePaymentStatus);
router.delete("/:id", authMiddleware, softDeleteOrder);
router.patch("/:id/restore", roleCheck(["admin"]), restoreOrder);

export default router;
