import mongoose from "mongoose";
import Address from "../models/address.js";
import axios from "axios";
import { redisClient } from "../config/redis.js";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth:3001";
const CACHE_TTL_SECONDS = 3600; // 1 hour cache duration

/**
 * Invalidate Redis cache for a user or specific address
 */
const clearAddressCache = async (userId, addressId = null) => {
  try {
    if (!redisClient.isReady) return;

    const keysToDelete = [];

    if (addressId) {
      const addressSpecificKeys = await redisClient.keys(`address:${addressId}*`);
      keysToDelete.push(...addressSpecificKeys);
    }

    if (userId) {
      const userKeys = await redisClient.keys(`address:user:${userId}*`);
      const trashKeys = await redisClient.keys(`address:trash:${userId}*`);
      keysToDelete.push(...userKeys, ...trashKeys);
    }

    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
    }
  } catch (error) {
    console.error("Redis Cache Invalidation Error:", error.message);
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
    return response.data?.data || response.data;
  } catch (error) {
    return null;
  }
};

/**
 * @desc    Create a new address
 * @route   POST /api/v1/address
 * @access  Protected
 */
export const createAddress = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const {
      fullName,
      phone,
      street,
      landmark,
      city,
      state,
      postalCode,
      country = "India",
      addressType = "home",
      isDefault = false
    } = req.body;

    // Validate required fields
    if (!fullName || !phone || !street || !city || !state || !postalCode) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: fullName, phone, street, city, state, postalCode are required"
      });
    }

    // Check if this is the user's first active address
    const existingCount = await Address.countDocuments({ userId, isDeleted: false });
    const shouldBeDefault = isDefault === true || existingCount === 0;

    // If marked as default, unset other default addresses for this user
    if (shouldBeDefault) {
      await Address.updateMany(
        { userId, isDeleted: false },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = await Address.create({
      userId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      street: street.trim(),
      landmark: landmark ? landmark.trim() : "",
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
      addressType: addressType.toLowerCase(),
      isDefault: shouldBeDefault
    });

    // Invalidate user address cache
    await clearAddressCache(userId);

    return res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: newAddress
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to create address",
      error: error.message
    });
  }
};

/**
 * @desc    Get all addresses for logged-in user (Cached with Redis)
 * @route   GET /api/v1/address
 * @access  Protected
 */
export const getAllAddresses = async (req, res) => {
  try {
    const headerUserId = req.headers["x-user-id"];
    const userRoles = req.userRoles || [];
    const isAdmin = userRoles.includes("admin");

    let targetUserId = headerUserId;
    if (isAdmin && req.query.userId) {
      targetUserId = req.query.userId;
    }

    if (!targetUserId && !isAdmin) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    // Generate Redis Cache Key
    const cacheKey = `address:user:${targetUserId || "all"}:type=${req.query.addressType || ""}:def=${req.query.isDefault || ""}:del=${req.query.onlyDeleted || req.query.includeDeleted || "active"}:pop=${req.query.populateUser || ""}`;

    if (redisClient.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        return res.status(200).json({
          success: true,
          message: "Addresses fetched successfully (from cache)",
          count: parsed.length,
          data: parsed
        });
      }
    }

    const filter = {};
    if (targetUserId) {
      filter.userId = targetUserId;
    }

    // Soft-delete filter handling
    if (req.query.onlyDeleted === "true") {
      filter.isDeleted = true;
    } else if (req.query.includeDeleted !== "true") {
      filter.isDeleted = false;
    }

    // Optional query filters
    if (req.query.addressType) {
      filter.addressType = req.query.addressType.toLowerCase();
    }
    if (req.query.isDefault !== undefined) {
      filter.isDefault = req.query.isDefault === "true";
    }

    const addresses = await Address.find(filter).sort({ isDefault: -1, createdAt: -1 });

    // Optional user hydration
    let formattedAddresses = addresses;
    if (req.query.populateUser === "true") {
      formattedAddresses = await Promise.all(
        addresses.map(async (addr) => {
          const user = await fetchUserDetails(addr.userId);
          return {
            ...addr.toObject(),
            user
          };
        })
      );
    }

    // Save result to Redis cache
    if (redisClient.isReady) {
      await redisClient.set(cacheKey, JSON.stringify(formattedAddresses), {
        EX: CACHE_TTL_SECONDS
      });
    }

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      count: addresses.length,
      data: formattedAddresses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to fetch addresses",
      error: error.message
    });
  }
};

/**
 * @desc    Get single address by ID (Cached with Redis)
 * @route   GET /api/v1/address/:id
 * @access  Protected
 */
export const getAddressById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] || req.user?.id;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    const includeDeleted = req.query.includeDeleted === "true";
    const cacheKey = `address:${id}:del=${includeDeleted}:pop=${req.query.populateUser || ""}`;

    if (redisClient.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const address = JSON.parse(cachedData);
        if (userId && address.userId?.toString() !== userId && !userRoles.includes("admin")) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You do not have permission to access this address"
          });
        }
        return res.status(200).json({
          success: true,
          message: "Address retrieved successfully (from cache)",
          data: address
        });
      }
    }

    const filter = { _id: id };
    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    const address = await Address.findOne(filter);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or has been deleted"
      });
    }

    // Ownership check (only owner or admin can view)
    if (userId && address.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to access this address"
      });
    }

    let user = null;
    if (req.query.populateUser === "true") {
      user = await fetchUserDetails(address.userId);
    }

    const responseData = {
      ...address.toObject(),
      ...(user ? { user } : {})
    };

    if (redisClient.isReady) {
      await redisClient.set(cacheKey, JSON.stringify(responseData), {
        EX: CACHE_TTL_SECONDS
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address retrieved successfully",
      data: responseData
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to fetch address",
      error: error.message
    });
  }
};

/**
 * @desc    Update an address
 * @route   PUT /api/v1/address/:id
 * @access  Protected
 */
export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] || req.user?.id;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    const address = await Address.findOne({ _id: id, isDeleted: false });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or has been deleted"
      });
    }

    // Ownership check
    if (userId && address.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only update your own address"
      });
    }

    const {
      fullName,
      phone,
      street,
      landmark,
      city,
      state,
      postalCode,
      country,
      addressType,
      isDefault
    } = req.body;

    if (fullName !== undefined) address.fullName = fullName.trim();
    if (phone !== undefined) address.phone = phone.trim();
    if (street !== undefined) address.street = street.trim();
    if (landmark !== undefined) address.landmark = landmark.trim();
    if (city !== undefined) address.city = city.trim();
    if (state !== undefined) address.state = state.trim();
    if (postalCode !== undefined) address.postalCode = postalCode.trim();
    if (country !== undefined) address.country = country.trim();
    if (addressType !== undefined) {
      if (!["home", "work", "other"].includes(addressType.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid addressType. Allowed values: 'home', 'work', 'other'"
        });
      }
      address.addressType = addressType.toLowerCase();
    }

    // Handle isDefault update
    if (isDefault === true) {
      await Address.updateMany(
        { userId: address.userId, _id: { $ne: address._id }, isDeleted: false },
        { $set: { isDefault: false } }
      );
      address.isDefault = true;
    } else if (isDefault === false) {
      address.isDefault = false;
    }

    await address.save();

    // Invalidate Redis cache
    await clearAddressCache(address.userId, address._id);

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to update address",
      error: error.message
    });
  }
};

/**
 * @desc    Soft delete an address (marks isDeleted: true and sets deletedAt)
 * @route   DELETE /api/v1/address/:id
 * @access  Protected
 */
export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] || req.user?.id;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    const address = await Address.findOne({ _id: id, isDeleted: false });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or already deleted"
      });
    }

    // Ownership check
    if (userId && address.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only delete your own address"
      });
    }

    const wasDefault = address.isDefault;

    // Perform soft delete
    await address.softDelete();

    // If the deleted address was default, set another active address as default if available
    if (wasDefault) {
      const nextActiveAddress = await Address.findOne({
        userId: address.userId,
        isDeleted: false
      }).sort({ createdAt: -1 });

      if (nextActiveAddress) {
        nextActiveAddress.isDefault = true;
        await nextActiveAddress.save();
      }
    }

    // Invalidate Redis cache
    await clearAddressCache(address.userId, address._id);

    return res.status(200).json({
      success: true,
      message: "Address soft-deleted successfully",
      data: {
        id: address._id,
        isDeleted: address.isDeleted,
        deletedAt: address.deletedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to delete address",
      error: error.message
    });
  }
};

/**
 * @desc    Restore a soft-deleted address
 * @route   PATCH /api/v1/address/:id/restore
 * @access  Protected
 */
export const restoreAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] || req.user?.id;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    const address = await Address.findOne({ _id: id, isDeleted: true });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Soft-deleted address not found"
      });
    }

    // Ownership check
    if (userId && address.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only restore your own address"
      });
    }

    // Perform restore
    await address.restore();

    // Invalidate Redis cache
    await clearAddressCache(address.userId, address._id);

    return res.status(200).json({
      success: true,
      message: "Address restored successfully",
      data: address
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to restore address",
      error: error.message
    });
  }
};

/**
 * @desc    Get all soft-deleted addresses (Trash bin - Cached with Redis)
 * @route   GET /api/v1/address/trash
 * @access  Protected
 */
export const getDeletedAddresses = async (req, res) => {
  try {
    const headerUserId = req.headers["x-user-id"] || req.user?.id;
    const userRoles = req.userRoles || [];
    const isAdmin = userRoles.includes("admin");

    let targetUserId = headerUserId;
    if (isAdmin && req.query.userId) {
      targetUserId = req.query.userId;
    }

    if (!targetUserId && !isAdmin) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const cacheKey = `address:trash:${targetUserId || "all"}`;

    if (redisClient.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        return res.status(200).json({
          success: true,
          message: "Deleted addresses fetched successfully (from cache)",
          count: parsed.length,
          data: parsed
        });
      }
    }

    const filter = { isDeleted: true };
    if (targetUserId) {
      filter.userId = targetUserId;
    }

    const deletedAddresses = await Address.find(filter).sort({ deletedAt: -1 });

    if (redisClient.isReady) {
      await redisClient.set(cacheKey, JSON.stringify(deletedAddresses), {
        EX: CACHE_TTL_SECONDS
      });
    }

    return res.status(200).json({
      success: true,
      message: "Deleted addresses fetched successfully",
      count: deletedAddresses.length,
      data: deletedAddresses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to fetch deleted addresses",
      error: error.message
    });
  }
};

/**
 * @desc    Set an address as default
 * @route   PATCH /api/v1/address/:id/default
 * @access  Protected
 */
export const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] || req.user?.id;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    const address = await Address.findOne({ _id: id, isDeleted: false });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or has been deleted"
      });
    }

    // Ownership check
    if (userId && address.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only modify your own address"
      });
    }

    // Unset all other addresses
    await Address.updateMany(
      { userId: address.userId, isDeleted: false },
      { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();

    // Invalidate Redis cache
    await clearAddressCache(address.userId, address._id);

    return res.status(200).json({
      success: true,
      message: "Address set as default successfully",
      data: address
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to set default address",
      error: error.message
    });
  }
};

/**
 * @desc    Permanently delete an address (Hard delete from database)
 * @route   DELETE /api/v1/address/:id/permanent
 * @access  Protected
 */
export const hardDeleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] || req.user?.id;
    const userRoles = req.userRoles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    // Ownership check
    if (userId && address.userId.toString() !== userId && !userRoles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only permanently delete your own address"
      });
    }

    await Address.findByIdAndDelete(id);

    // Invalidate Redis cache
    await clearAddressCache(address.userId, address._id);

    return res.status(200).json({
      success: true,
      message: "Address permanently deleted from database"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error: Failed to permanently delete address",
      error: error.message
    });
  }
};
