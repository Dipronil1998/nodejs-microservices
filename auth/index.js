import dotenv from 'dotenv'
dotenv.config()
import express from 'express';

import connectToMongoDB from './src/db/connector.js';


const app = express();
const port = process.env.PORT || 5001;
import auth from './src/routes/authRoutes.js';
import user from './src/routes/userRoutes.js';
import { connectRedis } from './src/config/redis.js';
connectToMongoDB();
connectRedis();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Auth Services!' });
});

app.use('/api/v1/auth', auth)
app.use('/api/v1/user', user)

app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
});