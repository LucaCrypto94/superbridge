// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SuperBridge {
    address public immutable feeRecipient;
    uint256 public constant FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Store the bridged amount for each user
    mapping(address => uint256) public totalBridged;

    // Fee exemption mapping
    mapping(address => bool) public isFeeExempt;

    event Bridge(
        address indexed sender,
        uint256 originalAmount,
        uint256 feeAmount,
        uint256 bridgedAmount
    );

    constructor() {
        feeRecipient = msg.sender;
        isFeeExempt[0x17CaBc8001a30800835DD8206CEB0c4bA90B5913] = true;
    }

    // Set fee exemption (only feeRecipient/owner)
    function setFeeExempt(address user, bool exempt) external {
        require(msg.sender == feeRecipient, "Not authorized");
        isFeeExempt[user] = exempt;
    }

    function bridge() external payable {
        require(msg.value > 0, "Send some PEPU");
        uint256 fee = 0;
        uint256 bridged = msg.value;
        if (!isFeeExempt[msg.sender]) {
            fee = (msg.value * FEE_BPS) / BPS_DENOMINATOR;
            bridged = msg.value - fee;
        }
        // Forward the full amount to feeRecipient (auto-forward)
        (bool sent, ) = feeRecipient.call{value: msg.value}("");
        require(sent, "Forward failed");
        totalBridged[msg.sender] += bridged;
        emit Bridge(msg.sender, msg.value, fee, bridged);
    }
} 