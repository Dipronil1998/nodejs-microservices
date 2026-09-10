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

const router = express.Router();

// Order creation
router.post("/checkout", checkoutCart);
router.post("/direct", createDirectOrder);

// Query orders
router.get("/", getAllOrders);
router.get("/:id", getOrderById);
router.get("/number/:orderNumber", getOrderByNumber);
router.get("/:id/items", getOrderItems);

// Order actions & management
router.patch("/:id/cancel", cancelOrder);
router.patch("/:id/status", roleCheck(["admin"]), updateOrderStatus);
router.patch("/:id/payment", roleCheck(["admin"]), updatePaymentStatus);
router.delete("/:id", softDeleteOrder);
router.patch("/:id/restore", roleCheck(["admin"]), restoreOrder);

export default router;
