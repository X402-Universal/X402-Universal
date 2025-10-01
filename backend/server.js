import express from "express";
import { paymentMiddleware } from "x402-express";
import { createWalletClient, http, parseAbi, keccak256 } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const app = express();
const PORT = process.env.PORT || 3000;
const PAY_TO = process.env.PAY_TO || "0xcc2f51CfD41b7BD3c0ceeb59EF8d1f6A881B400E";

// Keep your teammate's public routes unchanged
app.get("/health", (_req, res) => res.status(200).json({ status: "OK" }));
app.get("/hello", (_req, res) => res.type("text/plain").send("Hello, World!"));

// New: Setup for cross-chain facilitator
const BRIDGE_CONTRACT = "0x1234567890123456789012345678901234567890";
const FACILITATOR_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(FACILITATOR_KEY);
const wallet = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http("https://sepolia-preconf.base.org"),
});

// New: Custom middleware that handles both exact and crosschain schemes
function multiSchemePaymentMiddleware(paymentAddress, routes) {
  // Get the original CDP middleware for exact payments
  const exactMiddleware = paymentMiddleware(paymentAddress, routes);
  
  return (req, res, next) => {
    const currentRoute = req.path;
    const routeConfig = routes[currentRoute];
    
    if (!routeConfig) {
      next();
      return;
    }
    
    const paymentHeader = req.header("X-Payment");
    
    // No payment header - return 402 with both payment options
    if (!paymentHeader) {
      res.status(402).json({
        error: "Payment Required",
        paymentOptions: [
          // Option 1: Regular CDP exact payment
          {
            scheme: "exact",
            network: "base-sepolia",
            price: routeConfig.price,
            recipient: paymentAddress
          },
          // Option 2: Cross-chain payment
          {
            scheme: "crosschain-erc3009",
            network: "base-sepolia",
            token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            recipient: BRIDGE_CONTRACT,
            amount: routeConfig.price,
            destination: "sepolia"
          }
        ]
      });
      return;
    }
    
    // Decode payment
    const payment = JSON.parse(Buffer.from(paymentHeader, "base64").toString());
    
    // Route based on scheme
    if (payment.scheme === "exact") {
      // Use original CDP middleware
      exactMiddleware(req, res, next);
    } else if (payment.scheme === "crosschain-erc3009") {
      // Handle cross-chain payment
      const txHash = keccak256(JSON.stringify(payment));
      
      // Submit ERC-3009 (fire and forget)
      wallet.writeContract({
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        abi: parseAbi([
          'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)'
        ]),
        functionName: 'transferWithAuthorization',
        args: [
          payment.from,
          payment.to,
          BigInt(payment.value),
          BigInt(payment.validAfter),
          BigInt(payment.validBefore),
          payment.nonce,
          payment.v,
          payment.r,
          payment.s
        ],
      });
      
      // Return success
      res.setHeader("X-Payment-Response", Buffer.from(JSON.stringify({
        success: true,
        transaction: txHash,
        scheme: "crosschain-erc3009"
      })).toString("base64"));
      
      next();
    }
  };
}

// Keep your teammate's API router structure
const api = express.Router();

// Apply the multi-scheme middleware
api.use(
  multiSchemePaymentMiddleware(PAY_TO, {
    "/": {
      price: "0.0001",
      network: "base-sepolia",
      config: { description: "API root access" },
    },
    "/weather": {
      price: "0.0001",
      network: "base-sepolia",
      config: { description: "singapore weather data" },
    },
  })
);

// Keep your teammate's API endpoints unchanged
api.get("/", (_req, res) => {
  res.json({ message: "API root (paid)" });
});

api.get("/weather", (_req, res) => {
  res.json({
    location: "Singapore",
    units: "metric",
    temperatureC: 31,
    condition: "Cloudy",
    humidityPct: 70,
    windKph: 10,
    updatedAt: new Date().toISOString(),
  });
});

app.use("/api", api);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});