import mongoose from "mongoose";
import Cart from "../models/cart.js";
import axios from "axios";

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://product:3002";

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
 * @desc    Get current user's cart
 * @route   GET /api/v1/cart
 * @access  Protected
 */
export const getCart = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({
        userId,
        items: [],
        totalQuantity: 0,
        totalAmount: 0
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to fetch cart",
      error: error.message
    });
  }
};

/**
 * @desc    Add item to cart
 * @route   POST /api/v1/cart/items
 * @access  Protected
 */
export const addToCart = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const { productId, quantity = 1 } = req.body;

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

    // Verify product with Product Service
    const product = await fetchProductDetails(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found in catalog"
      });
    }

    // Check product stock if provided
    if (product.stock !== undefined && product.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.stock} items available.`
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (existingItemIndex > -1) {
      const newQty = cart.items[existingItemIndex].quantity + qty;
      if (product.stock !== undefined && product.stock < newQty) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Total in cart (${newQty}) exceeds available stock (${product.stock}).`
        });
      }
      cart.items[existingItemIndex].quantity = newQty;
      cart.items[existingItemIndex].price = product.price; // Update with latest price
      cart.items[existingItemIndex].name = product.name;
      cart.items[existingItemIndex].image = product.image || cart.items[existingItemIndex].image;
      cart.items[existingItemIndex].subtotal = Number((cart.items[existingItemIndex].price * newQty).toFixed(2));
    } else {
      cart.items.push({
        productId: product._id || productId,
        name: product.name,
        price: product.price,
        quantity: qty,
        image: product.image || "",
        subtotal: Number((product.price * qty).toFixed(2))
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to add item to cart",
      error: error.message
    });
  }
};

/**
 * @desc    Update quantity of an item in cart
 * @route   PUT /api/v1/cart/items/:productId
 * @access  Protected
 */
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.user?.id;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product ID format"
      });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty)) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity number is required"
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart"
      });
    }

    // If quantity is 0 or less, remove item from cart
    if (qty <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      // Validate against product stock
      const product = await fetchProductDetails(productId);
      if (product && product.stock !== undefined && product.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Cannot update quantity. Only ${product.stock} items available.`
        });
      }

      cart.items[itemIndex].quantity = qty;
      if (product) {
        cart.items[itemIndex].price = product.price;
        cart.items[itemIndex].name = product.name;
        cart.items[itemIndex].image = product.image || cart.items[itemIndex].image;
      }
      cart.items[itemIndex].subtotal = Number((cart.items[itemIndex].price * qty).toFixed(2));
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to update cart item",
      error: error.message
    });
  }
};

/**
 * @desc    Remove an item from cart
 * @route   DELETE /api/v1/cart/items/:productId
 * @access  Protected
 */
export const removeFromCart = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.user?.id;
    const { productId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product ID format"
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId.toString()
    );

    if (cart.items.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart"
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to remove item from cart",
      error: error.message
    });
  }
};

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/v1/cart
 * @access  Protected
 */
export const clearCart = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    } else {
      cart.items = [];
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to clear cart",
      error: error.message
    });
  }
};
