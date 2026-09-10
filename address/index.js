import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import connectToMongoDB from './src/db/connector.js';
import { connectRedis } from './src/config/redis.js';
import { requestLogger } from './src/middleware/requestLogger.js';
import { rateLimiter } from './src/middleware/rateLimiter.js';
import addressRoutes from './src/routes/addressRoutes.js';

const app = express();
app.set('trust proxy', 1);
app.use(requestLogger('Address Service'));
app.use(rateLimiter());
const port = process.env.PORT || 3004;

connectToMongoDB();
connectRedis();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Address Service!' });
});

app.use('/api/v1/address', addressRoutes);

app.listen(port, () => {
  console.log(`Address service running on port ${port}`);
});