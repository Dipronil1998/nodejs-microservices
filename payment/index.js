import express from 'express';

const app = express();
const port = 3002;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from payment Services!' });
});

app.listen(port, () => {
  console.log(`Payment service running on port ${port}`);
});