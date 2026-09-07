import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { connectRedis } from './src/config/redis.js';
import notificationRoutes from './src/routes/notificationRoutes.js';

const app = express();
const port = process.env.PORT || 3003;

connectRedis();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Notification Services!' });
});

// Mount notification routes
app.use('/api/v1/notification', notificationRoutes);
app.use('/api/v1/email', notificationRoutes);

app.listen(port, () => {
  console.log(`Notification service running on port ${port}`);
});