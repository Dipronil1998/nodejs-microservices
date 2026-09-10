import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import connectToMongoDB from './src/db/connector.js';
import { connectRedis } from './src/config/redis.js';
import { connectRabbitMQ } from './src/config/rabbitmq.js';
import { requestLogger } from './src/middleware/requestLogger.js';
import { rateLimiter } from './src/middleware/rateLimiter.js';
import cartRoutes from './src/routes/cartRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';

const app = express();
app.set('trust proxy', 1);
app.use(requestLogger('Order Service'));
app.use(rateLimiter());
const port = process.env.PORT || 3005;

// Initialize Database and Message Broker
connectToMongoDB();
connectRedis();
connectRabbitMQ();

app.use(express.json());

// Base health route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Order & Cart Service!' });
});

// Mount Routes
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/order', orderRoutes);

app.listen(port, () => {
  console.log(`Order service running on port ${port}`);
});
