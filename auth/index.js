import express from 'express';

const app = express();
const port = 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Auth Services!' });
});

app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
});