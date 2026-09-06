import dotenv from 'dotenv'
dotenv.config()
import express from 'express';

import connectToMongoDB from './src/db/connector.js';


const app = express();
const port = process.env.PORT || 5002;
import product from './src/routes/productRoutes.js'
import { connectRedis } from './src/config/redis.js';
connectToMongoDB();
connectRedis();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Product Services!' });
});

app.use('/api/v1/product', product)

app.listen(port, () => {
  console.log(`Product service running on port ${port}`);
});