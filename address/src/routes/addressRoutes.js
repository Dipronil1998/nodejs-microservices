import express from "express";
import {
  createAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  restoreAddress,
  getDeletedAddresses,
  setDefaultAddress,
  hardDeleteAddress
} from "../controllers/addressController.js";

const router = express.Router();

// CRUD & Trash routes
router.post("/", createAddress);
router.get("/", getAllAddresses);
router.get("/trash", getDeletedAddresses);
router.get("/:id", getAddressById);
router.put("/:id", updateAddress);
router.patch("/:id/default", setDefaultAddress);
router.patch("/:id/restore", restoreAddress);
router.delete("/:id", deleteAddress); // Soft delete
router.delete("/:id/permanent", hardDeleteAddress); // Permanent delete

export default router;
