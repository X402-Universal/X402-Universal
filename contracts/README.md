# PaymentRouter Smart Contracts

Two identical smart contracts deployed on Base Sepolia and Sepolia networks for cross-chain payment routing with ERC20 token support.

## Features

- **Nested routing mapping**: Maps payment ID → chain ID → token address → recipient address
- **Payment counter**: Tracks number of payments per ID
- **ERC20 token support**: Accepts ERC20 token payments
- **Threshold detection**: Triggers event when counter surpasses 100
- **Batch configuration**: Set multiple routing configurations at once

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file with your configuration:
   ```
   PRIVATE_KEY=your_private_key_without_0x
   SEPOLIA_RPC_URL=https://rpc.sepolia.org
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   ETHERSCAN_API_KEY=your_etherscan_api_key
   BASESCAN_API_KEY=your_basescan_api_key
   ```

## Compilation

```bash
npm run compile
```

## Deployment

Deploy to Sepolia:
```bash
npm run deploy:sepolia
```

Deploy to Base Sepolia:
```bash
npm run deploy:base-sepolia
```

## Contract Functions

### makePayment(uint256 id, address token, uint256 amount)
Accepts ERC20 token payments for a specific ID. Requires token approval first.

### setRouting(uint256 id, uint256 chainId, address token, address recipient)
Sets routing configuration (owner only).

### setRoutingBatch(arrays)
Batch set multiple routing configurations (owner only).

### getRouting(uint256 id, uint256 chainId, address token)
Query routing configuration.

### getCounter(uint256 id)
Get current counter value for an ID.

### checkThreshold(uint256 id)
Check if threshold (100) is exceeded.

## Network Information

- **Sepolia**: Chain ID 11155111
- **Base Sepolia**: Chain ID 84532