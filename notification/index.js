import dotenv from 'dotenv'
dotenv.config()
import express from 'express';


const app = express();
const port = process.env.PORT || 5002;


import { connectRedis } from './src/config/redis.js';

connectRedis();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Notification Services!' });
});

// app.use('/api/v1/product', product);

app.listen(port, () => {
  console.log(`Notification service running on port ${port}`);
});