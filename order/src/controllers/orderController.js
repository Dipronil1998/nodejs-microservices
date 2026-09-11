import mongoose from "mongoose";
import Order from "../models/order.js";
import OrderItem from "../models/orderItem.js";
import Cart from "../models/cart.js";
import axios from "axios";
import { publishToQueue } from "../config/rabbitmq.js";
import { generateOrderEmailHtml } from "../utils/generateOrderEmailHtml.js";

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://product:3002";
const ADDRESS_SERVICE_URL = process.env.ADDRESS_SERVICE_URL || "http://address:3004";
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth:3001";

/**
 * Generate unique Order Number: ORD-YYYYMMDD-RANDOM
 */
const generateOrderNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${dateStr}-${randomSuffix}`;
};

/**
 * Helper to fetch address details from Address service
 */
const fetchAddressDetails = async (addressId, userId) => {
  try {
    const response = await axios.get(`${ADDRESS_SERVICE_URL}/api/v1/address/${addressId}`, {
      headers: { "x-user-id": userId },
      timeout: 3000
    });
    return response.data?.data || response.data?.address || response.data;
  } catch (error) {
    return null;
  }
};

/**
 * Helper to fetch product details from Product service
 */
const fetchProductDetails = async (productId) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/v1/product/${productId}`, {
      timeout: 3000
    });
    return response.data?.product || response.data?.data || response.data;
  } catch (error) {
    return null;
  }
};

/**
 * Helper to fetch user details from Auth service
 */
const fetchUserDetails = async (userId) => {
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/v1/user/${userId}`, {
      timeout: 3000
    });
    return response.data?.data || response.data?.user || response.data;
  } catch (error) {
    return null;
  }
};



/**
 * Helper to dispatch Order Confirmation email job to RabbitMQ email_queue
 */
const sendOrderConfirmationEmail = async (order, reqUser, userId) => {
  try {
    let email = reqUser?.email;
    let username = reqUser?.username || reqUser?.name;

    if (!email) {
      const user = await fetchUserDetails(userId);
      email = user?.email;
      username = username || user?.username || user?.name;
    }

    if (!email) {
      console.warn(`[RabbitMQ Order Producer] No recipient email found for user ${userId}. Skipping email.`);
      return false;
    }

    const htmlContent = generateOrderEmailHtml(order, username);
    const plainText = `Thank you for your order! Your Order #${order.orderNumber} for ₹${order.pricing?.totalAmount} has been placed successfully. Payment Method: ${order.payment?.method || 'COD'}.`;

    const dispatched = await publishToQueue("email_queue", {
      to: email,
      subject: `Order Confirmation - #${order.orderNumber}`,
      body: plainText,
      html: htmlContent,
      orderNumber: order.orderNumber,
      totalAmount: order.pricing?.totalAmount
    });

    return dispatched;
  } catch (err) {
    console.error(`[RabbitMQ Order Producer] Failed to dispatch order email for #${order?.orderNumber}:`, err.message || err);
    return false;
  }
};

/**
 * @desc    Create order from Cart (Checkout)
 * @route   POST /api/v1/order/checkout
 * @access  Protected
 */
export const checkoutCart = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const {
      addressId,
      shippingAddress: customShippingAddress,
      paymentMethod = "COD",
      orderNotes = "",
      discount = 0
    } = req.body;

    // 1. Fetch user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty. Cannot proceed with checkout."
      });
    }

    // 2. Resolve shipping address snapshot
    let finalShippingAddress = null;

    if (addressId) {
      const addressDoc = await fetchAddressDetails(addressId, userId);
      if (!addressDoc) {
        return res.status(404).json({
          success: false,
          message: "Selected shipping address not found in Address service"
        });
      }
      finalShippingAddress = {
        fullName: addressDoc.fullName,
        phone: addressDoc.phone,
        street: addressDoc.street,
        landmark: addressDoc.landmark || "",
        city: addressDoc.city,
        state: addressDoc.state,
        postalCode: addressDoc.postalCode,
        country: addressDoc.country || "India"
      };
    } else if (customShippingAddress) {
      const { fullName, phone, street, city, state, postalCode } = customShippingAddress;
      if (!fullName || !phone || !street || !city || !state || !postalCode) {
        return res.status(400).json({
          success: false,
          message: "Missing required shipping address fields: fullName, phone, street, city, state, postalCode"
        });
      }
      finalShippingAddress = {
        fullName: customShippingAddress.fullName.trim(),
        phone: customShippingAddress.phone.trim(),
        street: customShippingAddress.street.trim(),
        landmark: customShippingAddress.landmark ? customShippingAddress.landmark.trim() : "",
        city: customShippingAddress.city.trim(),
        state: customShippingAddress.state.trim(),
        postalCode: customShippingAddress.postalCode.trim(),
        country: customShippingAddress.country ? customShippingAddress.country.trim() : "India"
      };
    } else {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required (provide addressId or shippingAddress object)"
      });
    }

    // 3. Verify items and calculate live pricing
    const orderItems = [];
    let itemsTotal = 0;

    for (const item of cart.items) {
      const product = await fetchProductDetails(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.name}" (${item.productId}) is no longer available in the store catalog.`
        });
      }

      if (product.stock !== undefined && product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product "${product.name}". Requested: ${item.quantity}, Available: ${product.stock}`
        });
      }

      const itemPrice = product.price;
      const subtotal = Number((itemPrice * item.quantity).toFixed(2));
      itemsTotal += subtotal;

      orderItems.push({
        productId: product._id || item.productId,
        name: product.name,
        price: itemPrice,
        quantity: item.quantity,
        image: product.image || item.image || "",
        subtotal
      });
    }

    // 4. Calculate final pricing
    const shippingFee = itemsTotal > 500 ? 0 : 40; // Free shipping over 500
    const tax = Number((itemsTotal * 0.05).toFixed(2)); // 5% standard tax
    const discountAmt = Math.max(0, Number(discount) || 0);
    const totalAmount = Number((itemsTotal + shippingFee + tax - discountAmt).toFixed(2));

    const orderNumber = generateOrderNumber();

    // 5. Create Order document
    const order = await Order.create({
      orderNumber,
      userId,
      items: orderItems,
      shippingAddress: finalShippingAddress,
      payment: {
        method: ["COD", "CARD", "UPI", "NET_BANKING"].includes(paymentMethod) ? paymentMethod : "COD",
        status: paymentMethod === "COD" ? "PENDING" : "PENDING"
      },
      orderStatus: "PENDING",
      pricing: {
        itemsTotal: Number(itemsTotal.toFixed(2)),
        shippingFee,
        tax,
        discount: discountAmt,
        totalAmount
      },
      orderNotes: orderNotes.trim()
    });

    // 6. Create normalized OrderItem records
    const orderItemDocs = orderItems.map((item) => ({
      orderId: order._id,
      userId,
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      subtotal: item.subtotal
    }));
    await OrderItem.insertMany(orderItemDocs);

    // 7. Clear user's cart
    cart.items = [];
    await cart.save();

    // 8. Publish RabbitMQ Event
    publishToQueue("order_queue", {
      event: "ORDER_CREATED",
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      totalAmount: order.pricing.totalAmount,
      itemCount: order.items.length,
      createdAt: order.createdAt
    });

    // 9. Dispatch Order Confirmation Email via RabbitMQ
    await sendOrderConfirmationEmail(order, req.user, userId);

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to checkout order",
      error: error.message
    });
  }
};

/**
 * @desc    Direct Order / Buy Now (bypassing cart)
 * @route   POST /api/v1/order/direct
 * @access  Protected
 */
export const createDirectOrder = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const {
      productId,
      quantity = 1,
      addressId,
      shippingAddress: customShippingAddress,
      paymentMethod = "COD",
      orderNotes = "",
      discount = 0
    } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Product ID is required"
      });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1"
      });
    }

    const product = await fetchProductDetails(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found in store catalog"
      });
    }

    if (product.stock !== undefined && product.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Requested: ${qty}, Available: ${product.stock}`
      });
    }

    // Resolve Shipping Address
    let finalShippingAddress = null;
    if (addressId) {
      const addressDoc = await fetchAddressDetails(addressId, userId);
      if (!addressDoc) {
        return res.status(404).json({
          success: false,
          message: "Selected shipping address not found"
        });
      }
      finalShippingAddress = {
        fullName: addressDoc.fullName,
        phone: addressDoc.phone,
        street: addressDoc.street,
        landmark: addressDoc.landmark || "",
        city: addressDoc.city,
        state: addressDoc.state,
        postalCode: addressDoc.postalCode,
        country: addressDoc.country || "India"
      };
    } else if (customShippingAddress) {
      finalShippingAddress = {
        fullName: customShippingAddress.fullName,
        phone: customShippingAddress.phone,
        street: customShippingAddress.street,
        landmark: customShippingAddress.landmark || "",
        city: customShippingAddress.city,
        state: customShippingAddress.state,
        postalCode: customShippingAddress.postalCode,
        country: customShippingAddress.country || "India"
      };
    } else {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required"
      });
    }

    const subtotal = Number((product.price * qty).toFixed(2));
    const shippingFee = subtotal > 500 ? 0 : 40;
    const tax = Number((subtotal * 0.05).toFixed(2));
    const discountAmt = Math.max(0, Number(discount) || 0);
    const totalAmount = Number((subtotal + shippingFee + tax - discountAmt).toFixed(2));

    const orderNumber = generateOrderNumber();

    const orderItem = {
      productId: product._id || productId,
      name: product.name,
      price: product.price,
      quantity: qty,
      image: product.image || "",
      subtotal
    };

    const order = await Order.create({
      orderNumber,
      userId,
      items: [orderItem],
      shippingAddress: finalShippingAddress,
      payment: {
        method: paymentMethod,
        status: "PENDING"
      },
      orderStatus: "PENDING",
      pricing: {
        itemsTotal: subtotal,
        shippingFee,
        tax,
        discount: discountAmt,
        totalAmount
      },
      orderNotes: orderNotes.trim()
    });

    await OrderItem.create({
      orderId: order._id,
      userId,
      productId: orderItem.productId,
      name: orderItem.name,
      price: orderItem.price,
      quantity: orderItem.quantity,
      image: orderItem.image,
      subtotal: orderItem.subtotal
    });

    publishToQueue("order_queue", {
      event: "ORDER_CREATED",
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      totalAmount: order.pricing.totalAmount
    });

    // Dispatch Order Confirmation Email via RabbitMQ
    await sendOrderConfirmationEmail(order, req.user, userId);

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to create direct order",
      error: error.message
    });
  }
};

/**
 * @desc    Get all orders (User gets own; Admin gets all with filters)
 * @route   GET /api/v1/order
 * @access  Protected
 */
export const getAllOrders = async (req, res) => {
  try {
    const headerUserId = req.userId;
    const userRoles = req.userRoles || [];
    const isAdmin = userRoles.includes("admin");

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    // Ownership vs Admin access
    if (!isAdmin) {
      if (!headerUserId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User ID not found in headers"
        });
      }
      filter.userId = headerUserId;
    } else if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    // Soft-delete handling
    if (req.query.onlyDeleted === "true") {
      filter.isDeleted = true;
    } else if (req.query.includeDeleted !== "true") {
      filter.isDeleted = false;
    }

    // Status filters
    if (req.query.orderStatus) {
      filter.orderStatus = req.query.orderStatus.toUpperCase();
    }
    if (req.query.paymentStatus) {
      filter["payment.status"] = req.query.paymentStatus.toUpperCase();
    }
    if (req.query.paymentMethod) {
      filter["payment.method"] = req.query.paymentMethod.toUpperCase();
    }

    console.log(filter, "PPPPPPP");


    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      data: orders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to fetch orders",
      error: error.message
    });
  }
};

/**
 * @desc    Get order by ID
 * @route   GET /api/v1/order/:id
 * @access  Protected
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format"
      });
    }

    const order = await Order.findOne({ _id: id, isDeleted: false });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Ownership check
    if (userId && order.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to view this order"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to fetch order",
      error: error.message
    });
  }
};

/**
 * @desc    Get order by Order Number
 * @route   GET /api/v1/order/number/:orderNumber
 * @access  Protected
 */
export const getOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.userId;
    const userRoles = req.userRoles || [];

    const order = await Order.findOne({ orderNumber, isDeleted: false });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order #${orderNumber} not found`
      });
    }

    if (userId && order.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to view this order"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to fetch order by number",
      error: error.message
    });
  }
};

/**
 * @desc    Update order status (Admin only)
 * @route   PATCH /api/v1/order/:id/status
 * @access  Protected (Admin)
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format"
      });
    }

    const validStatuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    const upperStatus = orderStatus ? orderStatus.toUpperCase() : null;

    if (!validStatuses.includes(upperStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: [${validStatuses.join(", ")}]`
      });
    }

    const order = await Order.findOne({ _id: id, isDeleted: false });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    order.orderStatus = upperStatus;

    if (upperStatus === "DELIVERED") {
      order.deliveredAt = new Date();
      if (order.payment.method === "COD") {
        order.payment.status = "PAID";
        order.payment.paidAt = new Date();
      }
    } else if (upperStatus === "CANCELLED") {
      order.cancellation.cancelledAt = new Date();
      order.cancellation.reason = req.body.reason || "Cancelled by admin";
    }

    await order.save();

    publishToQueue("order_queue", {
      event: "ORDER_STATUS_UPDATED",
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      updatedAt: order.updatedAt
    });

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${upperStatus}`,
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to update order status",
      error: error.message
    });
  }
};

/**
 * @desc    Update payment status
 * @route   PATCH /api/v1/order/:id/payment
 * @access  Protected (Admin / Webhook)
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, transactionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format"
      });
    }

    const validStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"];
    const upperStatus = paymentStatus ? paymentStatus.toUpperCase() : null;

    if (!validStatuses.includes(upperStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Allowed values: [${validStatuses.join(", ")}]`
      });
    }

    const order = await Order.findOne({ _id: id, isDeleted: false });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    order.payment.status = upperStatus;
    if (transactionId) {
      order.payment.transactionId = transactionId;
    }
    if (upperStatus === "PAID") {
      order.payment.paidAt = new Date();
      if (order.orderStatus === "PENDING") {
        order.orderStatus = "CONFIRMED";
      }
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Payment status updated to ${upperStatus}`,
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to update payment status",
      error: error.message
    });
  }
};

/**
 * @desc    Cancel Order (by Customer or Admin)
 * @route   PATCH /api/v1/order/:id/cancel
 * @access  Protected
 */
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRoles = req.userRoles || [];
    const { reason = "Cancelled by user" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format"
      });
    }

    const order = await Order.findOne({ _id: id, isDeleted: false });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Ownership check
    if (userId && order.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only cancel your own order"
      });
    }

    // Cancellation eligibility check
    if (["SHIPPED", "DELIVERED", "CANCELLED"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because it is already in ${order.orderStatus} status.`
      });
    }

    order.orderStatus = "CANCELLED";
    order.cancellation = {
      reason: reason.trim(),
      cancelledAt: new Date()
    };

    if (order.payment.status === "PAID") {
      order.payment.status = "REFUNDED";
    }

    await order.save();

    publishToQueue("order_queue", {
      event: "ORDER_CANCELLED",
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      reason: order.cancellation.reason
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to cancel order",
      error: error.message
    });
  }
};

/**
 * @desc    Get items for a specific order
 * @route   GET /api/v1/order/:id/items
 * @access  Protected
 */
export const getOrderItems = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format"
      });
    }

    const order = await Order.findOne({ _id: id, isDeleted: false });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (userId && order.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Access denied"
      });
    }

    const items = await OrderItem.find({ orderId: id });

    return res.status(200).json({
      success: true,
      message: "Order items retrieved successfully",
      count: items.length,
      data: items
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to fetch order items",
      error: error.message
    });
  }
};

/**
 * @desc    Soft Delete an Order
 * @route   DELETE /api/v1/order/:id
 * @access  Protected
 */
export const softDeleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format"
      });
    }

    const order = await Order.findOne({ _id: id, isDeleted: false });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or already deleted"
      });
    }

    if (userId && order.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only delete your own order records"
      });
    }

    await order.softDelete();

    return res.status(200).json({
      success: true,
      message: "Order soft-deleted successfully",
      data: {
        id: order._id,
        isDeleted: order.isDeleted,
        deletedAt: order.deletedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to delete order",
      error: error.message
    });
  }
};

/**
 * @desc    Restore a soft-deleted Order
 * @route   PATCH /api/v1/order/:id/restore
 * @access  Protected (Admin / Owner)
 */
export const restoreOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format"
      });
    }

    const order = await Order.findOne({ _id: id, isDeleted: true });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Soft-deleted order not found"
      });
    }

    if (userId && order.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Access denied"
      });
    }

    await order.restore();

    return res.status(200).json({
      success: true,
      message: "Order restored successfully",
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to restore order",
      error: error.message
    });
  }
};
