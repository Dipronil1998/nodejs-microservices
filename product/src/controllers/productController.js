import Product from "../models/product.js";
import axios from "axios";

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      image,
      categoryId,
      stock
    } = req.body;

    // Nginx থেকে আসবে
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const product = await Product.create({
      userId,
      name,
      description,
      price,
      image,
      categoryId,
      stock
    });

    return res.status(201).json({
      message: "Product created successfully",
      product
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 });

    const updatedProducts = await Promise.all(
      products.map(async (product) => {
        try {
          // Product creator information Auth Service থেকে আনা হচ্ছে
          const response = await axios.get(
            `http://auth:3001/api/v1/user/${product.userId}`
          );

          return {
            ...product.toObject(),
            user: response.data.data || response.data
          };

        } catch (error) {
          console.log(
            `User fetch error for ${product.userId}:`,
            error.message
          );

          return {
            ...product.toObject(),
            user: null
          };
        }
      })
    );

    return res.status(200).json({
      message: "Products fetched successfully",
      products: updatedProducts
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    let user = null;

    try {
      const response = await axios.get(
        `http://auth:3001/api/v1/user/${product.userId}`
      );

      user = response.data.data || response.data;

    } catch (error) {
      console.log(
        `User fetch error for ${product.userId}:`,
        error.message
      );
    }

    return res.status(200).json({
      message: "Product fetched successfully",
      product: {
        ...product.toObject(),
        user
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      price,
      image,
      categoryId,
      stock
    } = req.body;

    // Nginx → Auth Service verify করার পরে পাঠাবে
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    // ==========================================
    // OWNERSHIP CHECK
    // ==========================================
    if (product.userId.toString() !== userId) {
      return res.status(403).json({
        message: "You can update only your own product"
      });
    }

    // শুধু যেসব field পাঠানো হয়েছে সেগুলো update হবে
    if (name !== undefined) {
      product.name = name;
    }

    if (description !== undefined) {
      product.description = description;
    }

    if (price !== undefined) {
      product.price = price;
    }

    if (image !== undefined) {
      product.image = image;
    }

    if (categoryId !== undefined) {
      product.categoryId = categoryId;
    }

    if (stock !== undefined) {
      product.stock = stock;
    }

    await product.save();

    return res.status(200).json({
      message: "Product updated successfully",
      product
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Nginx থেকে পাওয়া authenticated user
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    if (product.userId.toString() !== userId) {
      return res.status(403).json({
        message: "You can delete only your own product"
      });
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Product deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};