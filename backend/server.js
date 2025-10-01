const express = require("express");
const app = express();

// npm install @x402/express-middleware

const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  // How much you want to charge, and where you want the funds to land
  paymentMiddleware("0xYourAddress", { "/your-endpoint": "$0.01" })
);
// That's it! See examples/typescript/servers/express.ts for a complete example. Instruction below for running on base-sepolia.

let paymentRequiredResponse = 
{
  // Version of the x402 payment protocol
  x402Version: int,

  // List of payment requirements that the resource server accepts. A resource server may accept on multiple chains, or in multiple currencies.
  accepts: [paymentRequirements]

  // Message from the resource server to the client to communicate errors in processing payment
  error: string
}


// Middleware to check for X-HEADER
app.use((req, res, next) => {
  const header = req.get("X-PAYMENT");
  // get b64 payload
  if (!header) {
    return res.status(402).send("X-PAYMENT missing");
  }
  next();
});


// Single GET endpoint
app.get("/", (req, res) => {
  res.status(200).send("Success: X-PAYMENT received");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
