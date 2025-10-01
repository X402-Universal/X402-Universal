import { Request, Response, NextFunction } from 'express';
import { createWalletClient, http, keccak256, parseUnits } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';

// Type definitions
interface CrossChainPaymentPayload {
  scheme: string;
  payload: `0x${string}`;
  sourceChain: string;
  destinationChain: string;
  tokenAddress: string;
  amount: string;
  providerId: string;
  serverAddress: string;
  timestamp: number;
}

// Mock function for storing pending transactions
async function storePendingTransaction(
  txHash: `0x${string}`,
  paymentObj: CrossChainPaymentPayload,
  path: string
): Promise<void> {
  // TODO: Implement actual storage logic (e.g., database, in-memory store)
  console.log('Storing pending transaction:', {
    txHash,
    paymentObj,
    path,
    timestamp: new Date().toISOString()
  });
}

export function crosschainPaymentMiddleware(
  paymentAddress: string,
  routes: any,
  bridgeContract: string,
  providerId: string
) {
  // Create clients for both chains
  const baseClient = createWalletClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });
  
  const sepoliaClient = createWalletClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const currentRoute = req.method + " " + req.path;
    const routeConfig = routes[currentRoute];
    
    if (!routeConfig) {
      next();
      return;
    }

    // Check for payment header
    const paymentHeader = req.header("X-Payment");
    if (!paymentHeader) {
      // Return 402 with cross-chain payment requirements
      res.status(402).json({
        error: "Payment Required",
        paymentRequirements: [{
          scheme: "crosschain",
          sourceChains: ["base-sepolia"],
          destinationChain: "sepolia",
          bridgeContract: bridgeContract,
          providerId: providerId,
          serverAddress: paymentAddress,
          price: routeConfig.price,
          tokenAddress: {
            "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
            "sepolia": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" // USDC on Sepolia
          }
        }]
      });
      return;
    }

    // Decode and parse payment
    const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
    let paymentObj: CrossChainPaymentPayload;
    
    try {
      paymentObj = JSON.parse(decoded);
    } catch (e) {
      res.status(400).json({ error: "Invalid payment JSON" });
      return;
    }

    // Validate it's our custom scheme
    if (paymentObj.scheme !== "crosschain") {
      res.status(400).json({ error: "Unsupported payment scheme" });
      return;
    }

    // Store transaction for facilitator tracking
    const txHash = keccak256(paymentObj.payload) as `0x${string}`;
    await storePendingTransaction(txHash, paymentObj, req.path);

    // Submit to bridge contract (fire-and-forget)
    baseClient.sendRawTransaction({ 
      serializedTransaction: paymentObj.payload 
    }).catch(err => {
      console.error(`Bridge transaction failed: ${err.message}`);
    });

    // Optimistically continue - facilitator will handle settlement
    res.setHeader("X-Payment-Response", Buffer.from(JSON.stringify({
      success: true,
      transaction: txHash,
      status: "pending_bridge",
      bridgeContract: bridgeContract
    })).toString("base64"));

    next();
  };
}