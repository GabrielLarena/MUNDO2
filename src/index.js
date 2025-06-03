import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

import { migrate, db } from './db/database.js';
migrate();

// Static files
app.use(express.static('public'))

app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`)
})
