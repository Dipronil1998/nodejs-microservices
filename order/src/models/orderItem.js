import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Order ID is required"],
      ref: "Order",
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "User ID is required"],
      ref: "User",
      index: true
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Product ID is required"],
      ref: "Product"
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"]
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      default: 1
    },

    image: {
      type: String,
      default: ""
    },

    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: [0, "Subtotal cannot be negative"]
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying user's purchased items fast
orderItemSchema.index({ userId: 1, productId: 1 });

const OrderItem = mongoose.model("OrderItem", orderItemSchema);

export default OrderItem;
