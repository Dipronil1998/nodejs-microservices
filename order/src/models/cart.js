import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
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
    required: true,
    min: [0, "Subtotal cannot be negative"],
    default: function () {
      return this.price * this.quantity;
    }
  }
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "User ID is required"],
      unique: true,
      index: true,
      ref: "User"
    },

    items: [cartItemSchema],

    totalQuantity: {
      type: Number,
      default: 0,
      min: 0
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

// Method to recalculate totals
cartSchema.methods.recalculateTotals = function () {
  let totalQty = 0;
  let totalAmt = 0;

  this.items.forEach((item) => {
    item.subtotal = Number((item.price * item.quantity).toFixed(2));
    totalQty += item.quantity;
    totalAmt += item.subtotal;
  });

  this.totalQuantity = totalQty;
  this.totalAmount = Number(totalAmt.toFixed(2));
};

// Pre-save hook to ensure totals are always accurate
cartSchema.pre("save", function (next) {
  this.recalculateTotals();
  next();
});

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;
