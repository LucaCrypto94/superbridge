// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SuperBridge {
    address public immutable feeRecipient;
    uint256 public constant FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Store the bridged amount for each user
    mapping(address => uint256) public totalBridged;

    event Bridge(
        address indexed sender,
        uint256 originalAmount,
        uint256 feeAmount,
        uint256 bridgedAmount
    );

    constructor() {
        feeRecipient = msg.sender;
    }

    function bridge() external payable {
        require(msg.value > 0, "Send some PEPU");
        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOMINATOR;
        uint256 bridged = msg.value - fee;

        // Forward the full amount to the deployer/feeRecipient
        (bool sent, ) = feeRecipient.call{value: msg.value}("");
        require(sent, "Forward failed");

        // Store the bridged amount for the sender
        totalBridged[msg.sender] += bridged;

        emit Bridge(msg.sender, msg.value, fee, bridged);
    }
} 