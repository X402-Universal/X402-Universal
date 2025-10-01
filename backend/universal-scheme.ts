export interface CrossChainPaymentPayload {
  x402Version: number;
  scheme: "crosschain";  // New custom scheme
  sourceChain: {
    network: string;     // e.g., "base-sepolia"
    chainId: number;     // e.g., 84532
    tokenAddress: string; // USDC address on source chain
  };
  destinationChain: {
    network: string;     // e.g., "sepolia"
    chainId: number;     // e.g., 11155111
    tokenAddress: string; // USDC address on destination chain
  };
  bridgeContract: string; // Your bridge contract address
  payload: string;        // Signed transaction hex
  metadata: {
    providerId: string;
    serverAddress: string;
    amount: string;
    nonce: string;
  };
}