import express from "express";
import { paymentMiddleware } from "x402-express";
import { createRequire } from "module";

const app = express();
const PORT = process.env.PORT || 3000;
const PAY_TO = process.env.PAY_TO || "0xcc2f51CfD41b7BD3c0ceeb59EF8d1f6A881B400E";

// Public
app.get("/health", (_req, res) => res.status(200).json({ status: "OK" }));
app.get("/hello", (_req, res) => res.type("text/plain").send("Hello, World!"));

// Protected API only under /api/**
const api = express.Router();

api.use(
  paymentMiddleware(PAY_TO, {
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