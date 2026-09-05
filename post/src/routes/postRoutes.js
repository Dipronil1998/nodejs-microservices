import express from 'express';
import { createPost, deletePost, getAllPosts, updatePost } from '../controllers/postController.js';  

const router = express.Router();

router.post('/', createPost);
router.get('/', getAllPosts);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

export default router;
