import Category from "../models/category.js";
import axios from "axios";

export const createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID not found in headers"
      });
    }

    if (!name) {
      return res.status(400).json({
        message: "Category name is required"
      });
    }

    const existingCategory = await Category.findOne({ name: name.trim() });
    if (existingCategory) {
      return res.status(400).json({
        message: "Category with this name already exists"
      });
    }

    const category = await Category.create({
      userId,
      name: name.trim(),
      description,
      image
    });

    return res.status(201).json({
      message: "Category created successfully",
      category
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    const updatedCategories = await Promise.all(
      categories.map(async (category) => {
        try {
          const response = await axios.get(
            `http://auth:3001/api/v1/user/${category.userId}`
          );

          return {
            ...category.toObject(),
            user: response.data.data || response.data
          };
        } catch (error) {
          console.log(
            `User fetch error for category ${category._id}:`,
            error.message
          );

          return {
            ...category.toObject(),
            user: null
          };
        }
      })
    );

    return res.status(200).json({
      message: "Categories fetched successfully",
      categories: updatedCategories
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    let user = null;
    try {
      const response = await axios.get(
        `http://auth:3001/api/v1/user/${category.userId}`
      );
      user = response.data.data || response.data;
    } catch (error) {
      console.log(
        `User fetch error for category ${category._id}:`,
        error.message
      );
    }

    return res.status(200).json({
      message: "Category fetched successfully",
      category: {
        ...category.toObject(),
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

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image } = req.body;
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    // Ownership / Admin check
    const userRoles = req.userRoles || [];
    if (category.userId.toString() !== userId && !userRoles.includes('admin')) {
      return res.status(403).json({
        message: "You can update only your own category"
      });
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({
          message: "Category name cannot be empty"
        });
      }

      const existingCategory = await Category.findOne({
        name: trimmedName,
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({
          message: "Category with this name already exists"
        });
      }

      category.name = trimmedName;
    }

    if (description !== undefined) {
      category.description = description;
    }

    if (image !== undefined) {
      category.image = image;
    }

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      category
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    // Ownership / Admin check
    const userRoles = req.userRoles || [];
    if (category.userId.toString() !== userId && !userRoles.includes('admin')) {
      return res.status(403).json({
        message: "You can delete only your own category"
      });
    }

    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Category deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};
