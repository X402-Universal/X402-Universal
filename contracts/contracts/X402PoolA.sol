
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

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
contract X402PoolA is Ownable, AccessControl, ReentrancyGuard, Pausable {
    /* ---------------- events ---------------- */
    event PaymentPosted(address indexed payer, address indexed token, uint256 amount, bytes32 providerId);
    event BulkTeleported(address indexed token, bytes32 indexed providerId, uint256 amount, address recipient, bytes destChain);
    event RouteSet(address indexed token, bytes32 indexed providerId, bytes32 assetId, bytes destChain, address recipient);
    event USDhUpdated(address indexed oldUSDh, address indexed newUSDh);
    event CreditsSet(address indexed token, bytes32 indexed providerId, uint256 amount);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event ClaimAttempted(address indexed caller, address indexed recipient, bool success);

    /* ---------------- storage ---------------- */
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CREDIT_MANAGER_ROLE = keccak256("CREDIT_MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Signature-based claiming
    mapping(bytes32 => bool) public usedSignatures; // prevent signature replay
    mapping(address => mapping(bytes32 => uint256)) public nonces; // prevent signature replay per (token, providerId)
    
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
    
    // Maximum credit limit per (token, providerId) to prevent DoS
    mapping(address => mapping(bytes32 => uint256)) public maxCredits;
    
    // Emergency pause flag
    bool public emergencyPaused;

    constructor(address _tokenGateway, address _usdh, address _owner) Ownable(_owner) {
        require(_tokenGateway != address(0), "Invalid token gateway");
        require(_usdh != address(0), "Invalid USDh address");
        require(_owner != address(0), "Invalid owner");
        
        TOKEN_GATEWAY = _tokenGateway;
        usdh = _usdh;
        
        // Set up role hierarchy
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(ADMIN_ROLE, _owner);
        _grantRole(CREDIT_MANAGER_ROLE, _owner);
        _grantRole(OPERATOR_ROLE, _owner);
    }

    /* ---------------- admin ---------------- */

    /// @notice Configure the bridge route for a (token, providerId) pair.
    /// @dev Can be called by owner OR with a valid signature from the Chain B recipient
    /// @dev This enables both centralized route management and decentralized self-service
    function setRoute(
        address token,
        bytes32 providerId,
        bytes32 assetId,
        bytes calldata destChain,
        address recipient,
        bytes memory signature  // optional signature from Chain B recipient
    ) external whenNotPaused {
        require(token != address(0), "Invalid token address");
        require(recipient != address(0), "Invalid recipient");
        require(assetId != bytes32(0), "Invalid asset ID");
        require(destChain.length > 0, "Invalid destination chain");
        
        // Check if caller is authorized (owner) or has valid signature
        bool isAuthorized = hasRole(ADMIN_ROLE, msg.sender) || msg.sender == owner();
        
        if (!isAuthorized) {
            require(signature.length > 0, "Signature required for non-owners");
            
            // Verify signature-based authorization
            bytes32 messageHash = keccak256(abi.encodePacked(
                "SET_ROUTE",
                token,
                providerId,
                assetId,
                destChain,
                recipient,
                block.chainid,
                address(this)
            ));
            bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
            address signer = ethSignedMessageHash.recover(signature);
            require(signer == recipient, "Invalid signature from recipient");
        }
        
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
    ) external whenNotPaused nonReentrant {
        require(amount > 0, "zero amount");
        require(token != address(0), "Invalid token address");
        require(providerId != bytes32(0), "Invalid provider ID");
        require(!emergencyPaused, "Contract is emergency paused");

        // Check if adding this amount would exceed max credits
        uint256 newCredits = credits[token][providerId] + amount;
        if (maxCredits[token][providerId] > 0) {
            require(newCredits <= maxCredits[token][providerId], "Exceeds max credits");
        }

        // Transfer tokens from sender to contract
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        credits[token][providerId] = newCredits;
        emit PaymentPosted(msg.sender, token, amount, providerId);
    }

    /* ---------------- bulk settlement ---------------- */

    /// @notice Bridge a batch of credits for a (token, providerId) to the configured Distributor on Chain B.
    /// @dev Can be called by operators OR with a valid signature from the Chain B recipient
    /// @dev This enables both centralized operations and decentralized signature-based claiming
    function bulkTeleport(
        address token,
        bytes32 providerId,
        uint256 amount,
        uint64 timeoutSeconds,   // e.g., 20 minutes
        bytes memory signature    // optional signature from Chain B recipient
    ) external whenNotPaused nonReentrant {
        Route memory r = routes[token][providerId];
        require(r.set, "route not set");
        
        // Check if caller is authorized (operator) or has valid signature
        bool isAuthorized = hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender);
        
        if (!isAuthorized) {
            require(signature.length > 0, "Signature required for non-operators");
            
            // Verify signature-based authorization
            uint256 nonce = nonces[token][providerId];
            bytes32 messageHash = keccak256(abi.encodePacked(
                token,
                providerId,
                amount,
                timeoutSeconds,
                nonce,           // prevent replay attacks
                block.chainid,   // prevent cross-chain replay
                address(this)    // prevent contract replay
            ));
            bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
            address signer = ethSignedMessageHash.recover(signature);
            require(signer == r.recipient, "Invalid signature from recipient");
            
            // Prevent signature replay
            bytes32 signatureHash = keccak256(signature);
            require(!usedSignatures[signatureHash], "Signature already used");
            usedSignatures[signatureHash] = true;
            
            // Increment nonce for this (token, providerId) pair
            nonces[token][providerId] = nonce + 1;
        }
        require(amount > 0, "zero");
        require(token != address(0), "Invalid token address");
        require(providerId != bytes32(0), "Invalid provider ID");
        require(timeoutSeconds > 0, "Invalid timeout");
        require(credits[token][providerId] >= amount, "insufficient credits");
        require(!emergencyPaused, "Contract is emergency paused");

        // Check maxCredits limit (if set)
        if (maxCredits[token][providerId] > 0) {
            require(amount <= maxCredits[token][providerId], "Amount exceeds max credits");
        }

        // Check USDh balance BEFORE state changes
        uint256 usdhAmount = usdcToUSDh(amount);
        require(IERC20(usdh).balanceOf(address(this)) >= usdhAmount, "Insufficient USDh balance");

        // Update state before external call to prevent reentrancy
        credits[token][providerId] = credits[token][providerId] - amount;

        // Approve gateway (approve MAX once for gas efficiency)
        if (IERC20(usdh).allowance(address(this), TOKEN_GATEWAY) < usdhAmount) {
            IERC20(usdh).approve(TOKEN_GATEWAY, type(uint256).max);
        }

        // Convert address to bytes32 for TokenGateway
        bytes32 recipientBytes32 = evmAddressToBytes32(r.recipient);

        ITokenGateway.TeleportParams memory p = ITokenGateway.TeleportParams({
            amount:     usdhAmount,
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
        emit ClaimAttempted(msg.sender, r.recipient, true);
    }

    /* ---------------- helpers ---------------- */

    /// @notice Set the USD.h token address
    /// @dev Only owner can update the USD.h token address
    function setUSDh(address _usdh) external onlyOwner {
        require(_usdh != address(0), "Invalid USDh address");
        address oldUSDh = usdh;
        usdh = _usdh;
        emit USDhUpdated(oldUSDh, _usdh);
    }

    /// @notice TEST-ONLY: Owner can set credits for an arbitrary (token, providerId)
    /// @dev Useful for local testing and demos. REMOVE for production deployments.
    function setCredits(address token, bytes32 providerId, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(providerId != bytes32(0), "Invalid provider ID");
        credits[token][providerId] = amount;
        emit CreditsSet(token, providerId, amount);
    }
    
    /// @notice Set maximum credits limit for a (token, providerId) pair
    /// @dev Prevents DoS attacks by limiting credit accumulation
    /// @dev Can be called by ADMIN_ROLE or CREDIT_MANAGER_ROLE
    function setMaxCredits(address token, bytes32 providerId, uint256 maxAmount) external {
        require(hasRole(ADMIN_ROLE, msg.sender) || hasRole(CREDIT_MANAGER_ROLE, msg.sender), "Unauthorized");
        require(token != address(0), "Invalid token address");
        require(providerId != bytes32(0), "Invalid provider ID");
        maxCredits[token][providerId] = maxAmount;
    }
    
    /// @notice Emergency pause function
    /// @dev Can be called by owner to pause critical functions
    function emergencyPause() external onlyOwner {
        emergencyPaused = true;
        _pause();
    }
    
    /// @notice Unpause function
    /// @dev Can be called by owner to unpause the contract
    function unpause() external onlyOwner {
        emergencyPaused = false;
        _unpause();
    }
    
    /// @notice Emergency withdraw function
    /// @dev Allows owner to withdraw tokens in case of emergency
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid amount");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        
        require(IERC20(token).transfer(owner(), amount), "Transfer failed");
        emit EmergencyWithdraw(token, amount);
    }
    
    /* ---------------- role management ---------------- */
    
    /// @notice Grant CREDIT_MANAGER_ROLE to an address
    /// @dev Only ADMIN_ROLE can grant this role
    function grantCreditManagerRole(address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Unauthorized");
        _grantRole(CREDIT_MANAGER_ROLE, account);
    }
    
    /// @notice Grant OPERATOR_ROLE to an address
    /// @dev Only ADMIN_ROLE can grant this role
    function grantOperatorRole(address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Unauthorized");
        _grantRole(OPERATOR_ROLE, account);
    }
    
    /// @notice Revoke CREDIT_MANAGER_ROLE from an address
    /// @dev Only ADMIN_ROLE can revoke this role
    function revokeCreditManagerRole(address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Unauthorized");
        _revokeRole(CREDIT_MANAGER_ROLE, account);
    }
    
    /// @notice Revoke OPERATOR_ROLE from an address
    /// @dev Only ADMIN_ROLE can revoke this role
    function revokeOperatorRole(address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Unauthorized");
        _revokeRole(OPERATOR_ROLE, account);
    }

    /// @notice Check if an address can claim funds for a (token, providerId) pair
    /// @dev Returns true if the caller is the rightful recipient and has credits available
    function canClaim(address token, bytes32 providerId, address claimant) external view returns (bool) {
        Route memory r = routes[token][providerId];
        return r.set && claimant == r.recipient && credits[token][providerId] > 0;
    }
    
    /// @notice Get the recipient address for a (token, providerId) pair
    /// @dev Useful for frontends to check who can claim funds
    function getRecipient(address token, bytes32 providerId) external view returns (address) {
        Route memory r = routes[token][providerId];
        return r.recipient;
    }
    
    /// @notice Get available credits for a (token, providerId) pair
    /// @dev Returns the amount of credits available for claiming
    function getAvailableCredits(address token, bytes32 providerId) external view returns (uint256) {
        return credits[token][providerId];
    }
    
    /// @notice Get the raw message hash that needs to be signed for signature-based claiming
    /// @dev This is what the Chain B recipient needs to sign
    function getClaimMessageHash(
        address token,
        bytes32 providerId,
        uint256 amount,
        uint64 timeoutSeconds
    ) external view returns (bytes32) {
        uint256 nonce = nonces[token][providerId];
        return keccak256(abi.encodePacked(
            token,
            providerId,
            amount,
            timeoutSeconds,
            nonce,
            block.chainid,
            address(this)
        ));
    }
    
    /// @notice Get the current nonce for a (token, providerId) pair
    /// @dev Useful for frontends to know what nonce to use in signatures
    function getNonce(address token, bytes32 providerId) external view returns (uint256) {
        return nonces[token][providerId];
    }
    
    /// @notice Get the message hash that needs to be signed for route setting
    /// @dev This is what the Chain B recipient needs to sign
    function getRouteMessageHash(
        address token,
        bytes32 providerId,
        bytes32 assetId,
        bytes calldata destChain,
        address recipient
    ) external view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "SET_ROUTE",
            token,
            providerId,
            assetId,
            destChain,
            recipient,
            block.chainid,
            address(this)
        ));
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
        require(fromDecimals <= 18, "Invalid from decimals");
        require(toDecimals <= 18, "Invalid to decimals");
        
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
