import Post from "../models/post.js";
import axios from "axios";

export const createPost = async (req, res) => {
  try {
    const { title, content, image } = req.body;
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID not found in headers"
      });
    }

    const post = await Post.create({
      userId,
      title,
      content,
      image
    });

    res.status(201).json({
      message: "Post created successfully",
      post
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 });

    const updatedPosts = await Promise.all(
      posts.map(async (post) => {
        try {
          const response = await axios.get(
            `http://auth:3001/api/v1/auth/user/${post.userId}`
          );
          return {
            ...post.toObject(),
            user: response.data
          };
        } catch (error) {
          return {
            ...post.toObject(),
            user: null
          };
        }
      })
    );

    res.status(200).json({
      message: "Posts fetched successfully",
      posts: updatedPosts
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, image } = req.body;
    const userId = req.headers["x-user-id"];

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found"
      });
    }

    // OWNERSHIP CHECK
    if (post.userId.toString() !== userId) {
      return res.status(403).json({
        message: "You can update only your own post"
      });
    }

    post.title = title || post.title;
    post.content = content || post.content;
    post.image = image || post.image;

    await post.save();

    res.status(200).json({
      message: "Post updated successfully",
      post
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"];

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found"
      });
    }

    // OWNERSHIP CHECK
    if (post.userId.toString() !== userId) {
      return res.status(403).json({
        message: "You can delete only your own post"
      });
    }

    await Post.findByIdAndDelete(id);

    res.status(200).json({
      message: "Post deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};