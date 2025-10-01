# X402-Universal

A comprehensive cross-chain micropayment aggregation system that collects X402 micropayments on one chain and performs batched cross-chain payouts to providers on destination chains.

## Overview

X402-Universal is a decentralized payment aggregation system designed to make X402 micropayments more interoperable across different blockchain networks. The system collects many small payments on Chain A and batches them into efficient cross-chain transfers to providers on Chain B using Hyperbridge, a Polkadot-based cross-chain infrastructure. This enables seamless cross-chain X402 payment flows and expands the reach of micropayment protocols across multiple blockchain ecosystems.

## Architecture

The project consists of four main components:

### 1. Smart Contracts (`/contracts`)
- **X402PoolA.sol**: Main contract that aggregates micropayments and handles cross-chain bridging via Hyperbridge
- **MockERC20.sol**: Mock ERC20 token for testing
- **MockTokenGateway.sol**: Mock implementation of the Hyperbridge TokenGateway for local testing

### 2. Frontend (`/frontend`)
- Next.js 15 application with React 19
- Tailwind CSS for styling
- TypeScript support
- Modern UI for payment interactions

### 3. Backend API (`/backend`)
- Express.js server
- RESTful API endpoints
- Payment processing logic
- Integration with blockchain networks

### 4. Validator Service (`/validator-service`)
- TypeScript-based validation service
- Payment verification and validation
- Resource management
- Docker containerized for deployment

## Key Features

- **Cross-Chain X402 Interoperability**: Enables X402 micropayments to work seamlessly across different blockchain networks
- **Micropayment Aggregation**: Collects multiple small payments into larger batches for efficient processing
- **Cross-Chain Bridging**: Uses Hyperbridge (Polkadot-based) TokenGateway for seamless cross-chain transfers
- **Provider Routing**: Configurable routing to different providers on destination chains
- **USD.h Integration**: Converts payments to USD.h tokens for cross-chain compatibility
- **Multi-Chain Support**: Supports routing to various destination chains through configurable routes
- **Admin Controls**: Owner-controlled routing and settlement functions

## Technology Stack

### Smart Contracts
- **Solidity** ^0.8.20
- **OpenZeppelin** contracts for security standards
- **Hardhat** for development and testing
- **Ethers.js** for blockchain interactions

### Frontend
- **Next.js** 15.5.4
- **React** 19.1.0
- **TypeScript** 5
- **Tailwind CSS** 4.1.13

### Backend
- **Node.js** >=18
- **Express.js** 5.1.0
- **TypeScript** 4.4.4

### Infrastructure
- **Docker** containerization
- **Heroku** deployment support
- **Hyperbridge** (Polkadot-based) for cross-chain functionality

## Getting Started

### Prerequisites
- Node.js >=18
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Built
   ```

2. **Install dependencies for each component**
   ```bash
   # Smart contracts
   cd contracts
   npm install

   # Frontend
   cd ../frontend
   npm install

   # Backend
   cd ../backend
   npm install

   # Validator service
   cd ../validator-service
   npm install
   ```

### Development

#### Smart Contracts
```bash
cd contracts

# Run tests
npx hardhat test

# Deploy to local network
npx hardhat run scripts/deploy-x402poolA.js

# Deploy to Base Sepolia (requires private key)
npx hardhat run scripts/deploy-x402poolA.js --network baseSepolia
```

#### Frontend
```bash
cd frontend
npm run dev
```

#### Backend
```bash
cd backend
npm start
```

#### Validator Service
```bash
cd validator-service
npm start
```

## Usage

### Setting Up Routes
1. Deploy the X402PoolA contract
2. Configure routes for each (token, providerId) pair using `setRoute()`
3. Set the USD.h token address using `setUSDh()`

### Processing Payments
1. Users call `postPayment()` to submit micropayments
2. Payments are aggregated in the contract
3. Admin calls `bulkTeleport()` to batch and bridge payments
4. Funds are sent to providers on destination chains

### Key Functions

- `postPayment(token, amount, providerId)`: Submit a micropayment
- `setRoute(token, providerId, assetId, destChain, recipient)`: Configure routing
- `bulkTeleport(token, providerId, amount, timeoutSeconds)`: Batch and bridge payments
- `setCredits(token, providerId, amount)`: Set credits (test-only)

## Testing

The project includes comprehensive tests for the smart contracts:

```bash
cd contracts
npx hardhat test
```

Tests cover:
- Route configuration
- Payment posting
- Credit management
- Cross-chain bridging
- Access control

## Deployment

### Heroku Deployment
The project includes Heroku configuration for easy deployment:

```bash
# Deploy to Heroku
git push heroku main
```

### Docker Deployment
The validator service is containerized:

```bash
cd validator-service
docker build -t validator-service .
docker run -p 3000:3000 validator-service
```

## Security Considerations

- Owner-only functions for critical operations
- Proper access controls on admin functions
- Input validation on all user functions
- Safe token transfer patterns
- Test-only functions clearly marked

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Support

For questions and support, please open an issue in the repository.

---

**Note**: This is a demonstration project. For production use, ensure proper security audits and remove test-only functions.

For devs

Switch between app contexts if working on /backend or /validator-service

heroku config --app backend-app
heroku config --app validator-service-app

OR

heroku open --app backend-app
heroku open --app validator-service-app



Test the /api/hello endpoint
https://validator-service-app-94f8eaf18c93.herokuapp.com

curl https://validator-service-app-94f8eaf18c93.herokuapp.com/api/hello

<!-- Set environment variables specific to validator-service
heroku config:set NODE_ENV=production --app validator-service-app

// temporarily set the default remote
heroku git:remote -a validator-service-app -r heroku -->

// TO DEPLOY
git subtree push --prefix validator-service validator-service main --force
