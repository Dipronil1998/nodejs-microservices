import express from 'express';
import dotenv from 'dotenv'
import connectToMongoDB from './src/db/connector.js';
dotenv.config()
connectToMongoDB();
const app = express();
const port = process.env.PORT || 5001;
import auth from './src/routes/userRoutes.js'
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Auth Services!' });
});

app.use('/api/v1/auth', auth)

app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
});