import express from "express";
import roleCheck from "../middleware/roleCheck.js";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from "../controllers/categoryController.js";

const router = express.Router();

// Public
router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

// Protected (via Nginx auth_request)
router.post("/", roleCheck(['admin']), createCategory);
router.put("/:id", roleCheck(['admin']), updateCategory);
router.delete("/:id", roleCheck(['admin']), deleteCategory);

export default router;
