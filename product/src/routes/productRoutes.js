import express from "express";
import roleCheck from "../middleware/roleCheck.js";
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct
} from "../controllers/productController.js";

const router = express.Router();

// Public
router.get("/", getAllProducts);
router.get("/:id", getProductById);

// Protected (requires admin or vendor role)
router.post("/", roleCheck(['admin', 'vendor']), createProduct);
router.put("/:id", roleCheck(['admin', 'vendor']), updateProduct);
router.delete("/:id", roleCheck(['admin', 'vendor']), deleteProduct);

export default router;