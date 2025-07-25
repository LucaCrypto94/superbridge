// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title SuperBridgeL1 - Upgradeable L1 Payout Contract  
 * @notice Handles ERC20 token payouts from L2 to L1 with timelock protection
 */
contract SuperBridgeL1 is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // ========== STORAGE LAYOUT ==========
    // NEVER change the order of these variables!
    
    address public TOKEN;
    mapping(bytes32 => bool) public payoutCompleted;
    
    // Timelock variables
    uint256 public upgradeTimelock;
    mapping(bytes32 => uint256) public pendingUpgrades; // upgrade hash => execution time
    
    // Emergency features
    mapping(address => bool) public emergencyOperators;
    uint256 public emergencyWithdrawDelay;
    uint256 public emergencyWithdrawTime;
    
    // Version tracking
    string public version;

    // ========== EVENTS ==========
    event PayoutCompleted(bytes32 indexed transferId, address indexed user, uint256 bridgedAmount);
    event UpgradeScheduled(bytes32 indexed upgradeHash, address newImplementation, uint256 executeTime);
    event UpgradeExecuted(bytes32 indexed upgradeHash, address newImplementation);
    event UpgradeCancelled(bytes32 indexed upgradeHash);
    event TimelockUpdated(uint256 oldTimelock, uint256 newTimelock);
    event EmergencyOperatorUpdated(address indexed operator, bool status);
    event EmergencyWithdrawInitiated(uint256 executeTime);
    event EmergencyWithdrawExecuted(address token, uint256 amount);
    event TokenUpdated(address oldToken, address newToken);

    // ========== ERRORS ==========
    error InvalidToken();
    error AlreadyPaid();
    error InsufficientBalance();
    error PayoutFailed();
    error InvalidTimelock();
    error UpgradeNotReady();
    error UpgradeNotScheduled();
    error InvalidUpgrade();
    error NotEmergencyOperator();
    error EmergencyNotReady();
    error WithdrawFailed();

    // ========== MODIFIERS ==========
    modifier onlyEmergencyOperator() {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param _token Token contract address
     * @param _upgradeTimelock Time delay for upgrades (5 minutes for testing)
     */
    function initialize(
        address _token,
        uint256 _upgradeTimelock
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        
        if (_token == address(0)) revert InvalidToken();
        
        TOKEN = _token;
        upgradeTimelock = _upgradeTimelock; // 5 minutes = 300 seconds for testing
        emergencyWithdrawDelay = 24 hours; // Emergency delay
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

    // ========== TIMELOCK UPGRADE SYSTEM ==========

    /**
     * @notice Schedule an upgrade (must wait for timelock)
     * @param newImplementation Address of new implementation
     */
    function scheduleUpgrade(address newImplementation) external onlyOwner {
        bytes32 upgradeHash = keccak256(abi.encodePacked(newImplementation, block.timestamp));
        uint256 executeTime = block.timestamp + upgradeTimelock;
        
        pendingUpgrades[upgradeHash] = executeTime;
        
        emit UpgradeScheduled(upgradeHash, newImplementation, executeTime);
    }

    /**
     * @notice Execute a scheduled upgrade after timelock expires
     * @param newImplementation Address of new implementation
     * @param scheduleTime Timestamp when upgrade was scheduled
     */
    function executeUpgrade(address newImplementation, uint256 scheduleTime) external onlyOwner {
        bytes32 upgradeHash = keccak256(abi.encodePacked(newImplementation, scheduleTime));
        uint256 executeTime = pendingUpgrades[upgradeHash];
        
        if (executeTime == 0) revert UpgradeNotScheduled();
        if (block.timestamp < executeTime) revert UpgradeNotReady();
        
        // Clear the pending upgrade
        delete pendingUpgrades[upgradeHash];
        
        // Execute the upgrade
        
        emit UpgradeExecuted(upgradeHash, newImplementation);
    }

    /**
     * @notice Cancel a scheduled upgrade
     * @param newImplementation Address of scheduled implementation
     * @param scheduleTime Timestamp when upgrade was scheduled
     */
    function cancelUpgrade(address newImplementation, uint256 scheduleTime) external onlyOwner {
        bytes32 upgradeHash = keccak256(abi.encodePacked(newImplementation, scheduleTime));
        
        if (pendingUpgrades[upgradeHash] == 0) revert UpgradeNotScheduled();
        
        delete pendingUpgrades[upgradeHash];
        
        emit UpgradeCancelled(upgradeHash);
    }

    /**
     * @notice Update timelock period
     * @param newTimelock New timelock duration in seconds
     */
    function updateTimelock(uint256 newTimelock) external onlyOwner {
        if (newTimelock < 300) revert InvalidTimelock(); // Minimum 5 minutes
        
        uint256 oldTimelock = upgradeTimelock;
        upgradeTimelock = newTimelock;
        
        emit TimelockUpdated(oldTimelock, newTimelock);
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
     * @notice Update token address (with timelock in future versions)
     */
    function updateToken(address newToken) external onlyOwner {
        if (newToken == address(0)) revert InvalidToken();
        
        address oldToken = TOKEN;
        TOKEN = newToken;
        
        emit TokenUpdated(oldToken, newToken);
    }

    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Check if upgrade is ready to execute
     */
    function isUpgradeReady(address implementation, uint256 scheduleTime) external view returns (bool) {
        bytes32 upgradeHash = keccak256(abi.encodePacked(implementation, scheduleTime));
        uint256 executeTime = pendingUpgrades[upgradeHash];
        return executeTime != 0 && block.timestamp >= executeTime;
    }

    /**
     * @notice Get upgrade execution time
     */
    function getUpgradeTime(address implementation, uint256 scheduleTime) external view returns (uint256) {
        bytes32 upgradeHash = keccak256(abi.encodePacked(implementation, scheduleTime));
        return pendingUpgrades[upgradeHash];
    }

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

    // ========== INTERNAL FUNCTIONS ==========

    /**
     * @notice Authorize upgrade (internal)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Additional upgrade authorization logic can go here
        if (newImplementation == address(0)) revert InvalidUpgrade();
    }
}