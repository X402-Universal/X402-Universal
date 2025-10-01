// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockTokenGateway
 * @notice Mock implementation of TokenGateway for local testing
 * @dev This contract simulates the real TokenGateway behavior for development/testing
 */
contract MockTokenGateway {
    
    /* ---------------- events ---------------- */
    event TeleportExecuted(
        address indexed token,
        uint256 amount,
        bytes32 indexed assetId,
        bytes32 indexed to,
        bytes dest,
        address sender
    );

    /* ---------------- storage ---------------- */
    mapping(bytes32 => uint256) public totalTeleported; // track total per assetId
    uint256 public teleportCount;
    
    /* ---------------- TeleportParams struct (must match real gateway) ---------------- */
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

    /* ---------------- mock teleport function ---------------- */
    
    /// @notice Mock teleport function - accepts tokens and emits event
    /// @dev In real gateway, this would initiate cross-chain transfer
    function teleport(TeleportParams calldata p) external payable {
        require(p.amount > 0, "MockGateway: zero amount");
        require(p.to != bytes32(0), "MockGateway: zero recipient");
        
        // Extract token address from the calling context
        // In a real scenario, we'd map assetId to token address
        // For mock, we'll assume the caller is X402PoolA and extract from there
        
        teleportCount++;
        totalTeleported[p.assetId] += p.amount;
        
        // Emit event to simulate successful teleport
        emit TeleportExecuted(
            address(0), // We don't know the token address in this mock
            p.amount,
            p.assetId,
            p.to,
            p.dest,
            msg.sender
        );
        
        // Mock success - in real gateway, tokens would be locked/burned here
        // and minted on destination chain
    }
    
    /* ---------------- helper functions for testing ---------------- */
    
    /// @notice Get total amount teleported for an asset
    function getTotalTeleported(bytes32 assetId) external view returns (uint256) {
        return totalTeleported[assetId];
    }
    
    /// @notice Get total number of teleport calls
    function getTeleportCount() external view returns (uint256) {
        return teleportCount;
    }
    
    /// @notice Reset counters (useful for testing)
    function reset() external {
        teleportCount = 0;
        // Note: individual assetId totals remain for historical tracking
    }
    
    /// @notice Convert bytes32 back to address (for testing/debugging)
    function bytes32ToAddress(bytes32 b) external pure returns (address) {
        return address(uint160(uint256(b)));
    }
}