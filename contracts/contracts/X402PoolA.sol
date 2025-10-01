
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/* ---------- Hyperbridge TokenGateway (real gateway exposes teleport(TeleportParams)) ---------- */
interface ITokenGateway {
    struct TeleportParams {
        uint256 amount;        // amount to bridge
        uint256 relayerFee;    // leave 0 for hackathon
        bytes32 assetId;       // registered asset id for 'token' on Chain A
        bool    redeem;        // true: redeem ERC20 on dest
        bytes32 to;            // recipient on Chain B (bytes32-encoded)
        bytes   dest;          // destination state-machine (chain) id
        uint64  timeout;       // seconds until refund is possible
        uint256 nativeCost;    // native fee for dispatch (0 => use host fee token if configured)
        bytes   data;          // optional payload
    }
    function teleport(TeleportParams calldata p) external payable;
}

/**
 * @title X402PoolA
 * @notice Collects many x402 micropayments on Chain A and performs *batched* cross-chain payouts to Chain B.
 * @dev You can run this with a MockTokenGateway locally, then swap to the real TokenGateway on testnets.
 *      Note: Bridge converts tokens to USD.h on destination (1:1 peg with USDC).
 */
contract X402PoolA is Ownable {
    /* ---------------- events ---------------- */
    event PaymentPosted(address indexed payer, address indexed token, uint256 amount, bytes32 providerId);
    event BulkTeleported(address indexed token, bytes32 indexed providerId, uint256 amount, address recipient, bytes destChain);
    event RouteSet(address indexed token, bytes32 indexed providerId, bytes32 assetId, bytes destChain, address recipient);

    /* ---------------- storage ---------------- */
    // credits accumulated per (token, providerId)
    mapping(address => mapping(bytes32 => uint256)) public credits;

    // routing info for bulk settlement to B (per (token, providerId))
    struct Route {
        bytes32 assetId;      // TokenGateway assetId for `token` on A
        bytes   destChain;    // destination chain id
        address recipient;    // provider's wallet on destination chain
        bool    set;
    }
    mapping(address => mapping(bytes32 => Route)) public routes;

    // TokenGateway on Chain A
    address public immutable TOKEN_GATEWAY;
    
    // USD.h ERC20 token address
    address public usdh;

    constructor(address _tokenGateway, address _usdh, address _owner) Ownable(_owner) {
        TOKEN_GATEWAY = _tokenGateway;
        usdh = _usdh;
    }

    /* ---------------- admin ---------------- */

    /// @notice Configure the bridge route for a (token, providerId) pair.
    /// @dev Funds will be sent directly to the provider's wallet on the destination chain
    function setRoute(
        address token,
        bytes32 providerId,
        bytes32 assetId,
        bytes calldata destChain,
        address recipient
    ) external onlyOwner {
        routes[token][providerId] = Route({
            assetId: assetId,
            destChain: destChain,
            recipient: recipient,
            set: true
        });
        emit RouteSet(token, providerId, assetId, destChain, recipient);
    }

    /* ---------------- user payments ---------------- */

    /// @notice x402 payment ingestion: transfer funds into the pool and increment credits.
    function postPayment(
        address token,
        uint256 amount,
        bytes32 providerId
    ) external {
        require(amount > 0, "zero amount");

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        credits[token][providerId] += amount;
        emit PaymentPosted(msg.sender, token, amount, providerId);
    }

    /* ---------------- bulk settlement ---------------- */

    /// @notice Bridge a batch of credits for a (token, providerId) to the configured Distributor on Chain B.
    /// @dev In production, gate this to an ops role / keeper. For demo, owner is enough.
    function bulkTeleport(
        address token,
        bytes32 providerId,
        uint256 amount,
        uint64 timeoutSeconds   // e.g., 20 minutes
    ) external onlyOwner {
        require(amount > 0, "zero");
        require(credits[token][providerId] >= amount, "insufficient credits");

        Route memory r = routes[token][providerId];
        require(r.set, "route not set");

        credits[token][providerId] -= amount;

        // Approve gateway (approve MAX once for gas efficiency)
        if (IERC20(usdh).allowance(address(this), TOKEN_GATEWAY) < usdcToUSDh(amount)) {
            IERC20(usdh).approve(TOKEN_GATEWAY, type(uint256).max);
        }

        // Convert address to bytes32 for TokenGateway
        bytes32 recipientBytes32 = evmAddressToBytes32(r.recipient);

        ITokenGateway.TeleportParams memory p = ITokenGateway.TeleportParams({
            amount:     usdcToUSDh(amount),
            relayerFee: 0,                     // leave 0 for hackathon
            assetId:    r.assetId,
            redeem:     false,                 // bridge handles USD.h conversion
            to:         recipientBytes32,      // provider wallet
            dest:       r.destChain,           // destination chain id
            timeout:    timeoutSeconds,
            nativeCost: 0,                     // free for USD.h testnet
            data:       "0x"                   // no additional data needed
        });

        ITokenGateway(TOKEN_GATEWAY).teleport(p);
        emit BulkTeleported(token, providerId, amount, r.recipient, r.destChain);
    }

    /* ---------------- helpers ---------------- */

    /// @notice Set the USD.h token address
    /// @dev Only owner can update the USD.h token address
    function setUSDh(address _usdh) external onlyOwner {
        usdh = _usdh;
    }

    /// @notice TEST-ONLY: Owner can set credits for an arbitrary (token, providerId)
    /// @dev Useful for local testing and demos. REMOVE for production deployments.
    function setCredits(address token, bytes32 providerId, uint256 amount) external onlyOwner {
        credits[token][providerId] = amount;
    }

    /// @notice Utility: convert EVM 20-byte address to bytes32 for TokenGateway 'to' field.
    /// @dev TokenGateway expects bytes32 with address in the low 20 bytes (left-padded with zeros).
    function evmAddressToBytes32(address a) public pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    /* ---------------- decimal conversion utils ---------------- */

    /// @notice Scale an amount between tokens with different decimals.
    /// @dev Rounds down on division (safe default for payouts).
    function scaleAmount(
        uint256 amount,
        uint8 fromDecimals,
        uint8 toDecimals
    ) public pure returns (uint256) {
        if (fromDecimals == toDecimals) return amount;
        if (fromDecimals < toDecimals) {
            unchecked {
                uint8 diff = toDecimals - fromDecimals;
                uint256 factor = 10 ** diff;
                return amount * factor;
            }
        } else {
            unchecked {
                uint8 diff = fromDecimals - toDecimals;
                uint256 factor = 10 ** diff;
                return amount / factor; // floor
            }
        }
    }

    /// @notice Convert 6-decimal USDC units to 18-decimal USD.h units.
    function usdcToUSDh(uint256 amountUSDC) public pure returns (uint256) {
        return scaleAmount(amountUSDC, 6, 18);
    }

    /// @notice Convert 18-decimal USD.h units to 6-decimal USDC units (floors).
    function usdhToUSDC(uint256 amountUSDh) public pure returns (uint256) {
        return scaleAmount(amountUSDh, 18, 6);
    }
}
