import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import connectToMongoDB from './src/db/connector.js';
import { connectRedis } from './src/config/redis.js';
import { requestLogger } from './src/middleware/requestLogger.js';
import { rateLimiter } from './src/middleware/rateLimiter.js';
import product from './src/routes/productRoutes.js';
import category from './src/routes/categoryRoutes.js';

const app = express();
app.set('trust proxy', 1);
app.use(requestLogger('Product Service'));
app.use(rateLimiter());
const port = process.env.PORT || 3002;

connectToMongoDB();
connectRedis();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Product Services!' });
});

app.use('/api/v1/product', product);
app.use('/api/v1/category', category);

app.listen(port, () => {
  console.log(`Product service running on port ${port}`);
});