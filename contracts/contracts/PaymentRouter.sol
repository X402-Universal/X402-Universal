// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PaymentRouter is Ownable {
    using SafeERC20 for IERC20;

    // Nested mapping: id => chainId => tokenAddress => recipientAddress
    mapping(uint256 => mapping(uint256 => mapping(address => address))) public routingMap;

    // Counter mapping: id => counter
    mapping(uint256 => uint256) public counters;

    // Events
    event PaymentReceived(
        uint256 indexed id,
        address indexed token,
        uint256 amount,
        uint256 newCounter
    );

    event ThresholdExceeded(uint256 indexed id, uint256 counter);

    event RoutingConfigured(
        uint256 indexed id,
        uint256 indexed chainId,
        address indexed token,
        address recipient
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Accepts ERC20 token payments for a specific ID
     * @param id The payment ID to associate with this payment
     * @param token The ERC20 token address
     * @param amount The amount of tokens to transfer
     */
    function makePayment(
        uint256 id,
        address token,
        uint256 amount
    ) external {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");

        // Transfer tokens from sender to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Increment the counter for this ID
        counters[id]++;

        // Emit payment received event
        emit PaymentReceived(id, token, amount, counters[id]);

        // Check if counter surpassed 100
        if (counters[id] > 100) {
            _handleThresholdReached(id);
        }
    }

    /**
     * @dev Sets the routing configuration for a specific ID, chain, and token
     * @param id The payment ID
     * @param chainId The destination chain ID
     * @param token The token address
     * @param recipient The recipient address on the destination chain
     */
    function setRouting(
        uint256 id,
        uint256 chainId,
        address token,
        address recipient
    ) public onlyOwner {
        require(token != address(0), "Invalid token address");
        require(recipient != address(0), "Invalid recipient address");

        routingMap[id][chainId][token] = recipient;

        emit RoutingConfigured(id, chainId, token, recipient);
    }

    /**
     * @dev Batch set routing configurations
     * @param ids Array of payment IDs
     * @param chainIds Array of chain IDs
     * @param tokens Array of token addresses
     * @param recipients Array of recipient addresses
     */
    function setRoutingBatch(
        uint256[] calldata ids,
        uint256[] calldata chainIds,
        address[] calldata tokens,
        address[] calldata recipients
    ) external onlyOwner {
        require(
            ids.length == chainIds.length &&
            ids.length == tokens.length &&
            ids.length == recipients.length,
            "Array lengths must match"
        );

        for (uint256 i = 0; i < ids.length; i++) {
            setRouting(ids[i], chainIds[i], tokens[i], recipients[i]);
        }
    }

    /**
     * @dev Get the routing recipient for a specific configuration
     * @param id The payment ID
     * @param chainId The chain ID
     * @param token The token address
     * @return The recipient address
     */
    function getRouting(
        uint256 id,
        uint256 chainId,
        address token
    ) external view returns (address) {
        return routingMap[id][chainId][token];
    }

    /**
     * @dev Get the counter value for a specific ID
     * @param id The payment ID
     * @return The current counter value
     */
    function getCounter(uint256 id) external view returns (uint256) {
        return counters[id];
    }

    /**
     * @dev Internal function to handle when counter surpasses 100
     * @param id The payment ID that exceeded the threshold
     */
    function _handleThresholdReached(uint256 id) internal {
        // Placeholder function - for now just emit an event
        // This will be expanded later based on requirements
        emit ThresholdExceeded(id, counters[id]);

        // Placeholder return message (this is logged in event)
        // In future implementations, this could trigger cross-chain messages,
        // automated transfers, or other actions
    }

    /**
     * @dev Check if threshold is exceeded for a specific ID
     * @param id The payment ID to check
     * @return message indicating if threshold is exceeded
     */
    function checkThreshold(uint256 id) external view returns (string memory) {
        if (counters[id] > 100) {
            return "counter surpassed 100";
        }
        return "threshold not reached";
    }
}