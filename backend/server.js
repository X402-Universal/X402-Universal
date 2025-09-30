const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware to check for X-HEADER
app.use((req, res, next) => {
  const header = req.get("X-HEADER");
  if (!header) {
    return res.status(404).send("X-HEADER missing");
  }
  next();
});

// Single GET endpoint
app.get("/", (req, res) => {
  res.status(200).send("Success: X-HEADER received");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
