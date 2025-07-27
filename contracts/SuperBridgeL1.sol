// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SuperBridgeL1 - L1 Payout Contract  
 * @notice Handles ERC20 token payouts from L2 to L1
 */
contract SuperBridgeL1 is 
    Ownable, 
    ReentrancyGuard,
    Pausable
{
    // ========== STORAGE ==========
    
    address public TOKEN;
    
    mapping(bytes32 => bool) public payoutCompleted;
    
    // Emergency features
    mapping(address => bool) public emergencyOperators;
    uint256 public emergencyWithdrawDelay;
    uint256 public emergencyWithdrawTime;
    
    // Version tracking
    string public version;

    // ========== EVENTS ==========
    event PayoutCompleted(bytes32 indexed transferId, address indexed user, uint256 bridgedAmount);
    event EmergencyOperatorUpdated(address indexed operator, bool status);
    event EmergencyWithdrawInitiated(uint256 executeTime);
    event EmergencyWithdrawExecuted(address token, uint256 amount);
    event TokenUpdated(address oldToken, address newToken);

    // ========== ERRORS ==========
    error InvalidToken();
    error AlreadyPaid();
    error InsufficientBalance();
    error PayoutFailed();
    error NotEmergencyOperator();
    error EmergencyNotReady();
    error WithdrawFailed();

    // ========== MODIFIERS ==========
    modifier onlyEmergencyOperator() {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator();
        _;
    }

    constructor(
        address _token
    ) Ownable(msg.sender) {
        if (_token == address(0)) revert InvalidToken();
        
        TOKEN = _token;
        emergencyWithdrawDelay = 24 hours;
        version = "1.0.0";
        
        // Set deployer as emergency operator
        emergencyOperators[msg.sender] = true;
        emit EmergencyOperatorUpdated(msg.sender, true);
    }

    // ========== MAIN FUNCTIONS ==========

    /**
     * @notice Pay out tokens to user after L2 bridge completion
     * @param transferId Unique transfer identifier from L2
     * @param user Recipient address
     * @param bridgedAmount Amount to pay out
     */
    function payout(
        bytes32 transferId, 
        address user, 
        uint256 bridgedAmount
    ) external onlyOwner nonReentrant whenNotPaused {
        if (payoutCompleted[transferId]) revert AlreadyPaid();
        
        payoutCompleted[transferId] = true;
        
        IERC20 token = IERC20(TOKEN);
        if (token.balanceOf(address(this)) < bridgedAmount) revert InsufficientBalance();
        
        if (!token.transfer(user, bridgedAmount)) revert PayoutFailed();
        
        emit PayoutCompleted(transferId, user, bridgedAmount);
    }

    // ========== EMERGENCY FUNCTIONS ==========

    /**
     * @notice Add/remove emergency operator
     */
    function setEmergencyOperator(address operator, bool status) external onlyOwner {
        emergencyOperators[operator] = status;
        emit EmergencyOperatorUpdated(operator, status);
    }

    /**
     * @notice Emergency pause (can be called by emergency operators)
     */
    function emergencyPause() external onlyEmergencyOperator {
        _pause();
    }

    /**
     * @notice Unpause (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Initiate emergency withdraw (24 hour delay)
     */
    function initiateEmergencyWithdraw() external onlyEmergencyOperator {
        emergencyWithdrawTime = block.timestamp + emergencyWithdrawDelay;
        emit EmergencyWithdrawInitiated(emergencyWithdrawTime);
    }

    /**
     * @notice Execute emergency withdraw after delay
     */
    function executeEmergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (block.timestamp < emergencyWithdrawTime) revert EmergencyNotReady();
        
        IERC20 tokenContract = IERC20(token);
        if (!tokenContract.transfer(owner(), amount)) revert WithdrawFailed();
        
        // Reset emergency withdraw time
        emergencyWithdrawTime = 0;
        
        emit EmergencyWithdrawExecuted(token, amount);
    }

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @notice Update token address
     */
    function updateToken(address newToken) external onlyOwner {
        if (newToken == address(0)) revert InvalidToken();
        
        address oldToken = TOKEN;
        TOKEN = newToken;
        
        emit TokenUpdated(oldToken, newToken);
    }

    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Get contract version
     */
    function getVersion() external view returns (string memory) {
        return version;
    }

    /**
     * @notice Get token balance of contract
     */
    function getBalance() external view returns (uint256) {
        return IERC20(TOKEN).balanceOf(address(this));
    }
}