import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "User ID is required"],
      ref: "User",
      index: true
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "Product"
        },
        name: {
          type: String,
          required: true,
          trim: true
        },
        price: {
          type: Number,
          required: true,
          min: 0
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        image: {
          type: String,
          default: ""
        },
        subtotal: {
          type: Number,
          required: true,
          min: 0
        }
      }
    ],

    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      landmark: { type: String, default: "" },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, default: "India" }
    },

    payment: {
      method: {
        type: String,
        enum: ["COD", "CARD", "UPI", "NET_BANKING"],
        default: "COD"
      },
      status: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
        default: "PENDING"
      },
      transactionId: {
        type: String,
        default: ""
      },
      paidAt: {
        type: Date,
        default: null
      }
    },

    orderStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PENDING",
      index: true
    },

    pricing: {
      itemsTotal: {
        type: Number,
        required: true,
        min: 0
      },
      shippingFee: {
        type: Number,
        default: 0,
        min: 0
      },
      tax: {
        type: Number,
        default: 0,
        min: 0
      },
      discount: {
        type: Number,
        default: 0,
        min: 0
      },
      totalAmount: {
        type: Number,
        required: true,
        min: 0
      }
    },

    orderNotes: {
      type: String,
      default: ""
    },

    cancellation: {
      reason: { type: String, default: "" },
      cancelledAt: { type: Date, default: null }
    },

    deliveredAt: {
      type: Date,
      default: null
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index for user orders lookup
orderSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });

// Soft delete instance method
orderSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return await this.save();
};

// Restore instance method
orderSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return await this.save();
};

// Static helpers
orderSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isDeleted: false });
};

orderSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true });
};

const Order = mongoose.model("Order", orderSchema);

export default Order;
