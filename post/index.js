import dotenv from 'dotenv'
dotenv.config()
import express from 'express';

import connectToMongoDB from './src/db/connector.js';


const app = express();
const port = process.env.PORT || 5002;
import post from './src/routes/postRoutes.js'
import { connectRedis } from './src/config/redis.js';
connectToMongoDB();
connectRedis();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Post Services!' });
});

app.use('/api/v1/post', post)

app.listen(port, () => {
  console.log(`Post service running on port ${port}`);
});