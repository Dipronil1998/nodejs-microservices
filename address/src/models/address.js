import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "User ID is required"],
      ref: "User",
      index: true
    },

    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true
    },

    street: {
      type: String,
      required: [true, "Street address is required"],
      trim: true
    },

    landmark: {
      type: String,
      trim: true,
      default: ""
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true
    },

    state: {
      type: String,
      required: [true, "State is required"],
      trim: true
    },

    postalCode: {
      type: String,
      required: [true, "Postal code / Pincode is required"],
      trim: true
    },

    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      default: "India"
    },

    addressType: {
      type: String,
      enum: {
        values: ["home", "work", "other"],
        message: "{VALUE} is not a valid address type (home, work, other)"
      },
      default: "home"
    },

    isDefault: {
      type: Boolean,
      default: false
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

// Compound index for querying user's active/deleted addresses fast
addressSchema.index({ userId: 1, isDeleted: 1 });

// Instance method for soft deleting
addressSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return await this.save();
};

// Instance method for restoring a soft-deleted address
addressSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return await this.save();
};

// Static helper to find only active (non-deleted) records
addressSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isDeleted: false });
};

// Static helper to find only deleted records
addressSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true });
};

const Address = mongoose.model("Address", addressSchema);

export default Address;
