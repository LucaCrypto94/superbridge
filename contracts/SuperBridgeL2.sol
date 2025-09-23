// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SuperBridgeL2 - L2 to L1 Bridge
 * @notice Handles native token bridging from L2 to L1 with validator signatures
 */
contract SuperBridgeL2 is 
    Ownable, 
    ReentrancyGuard,
    Pausable
{
    // ========== STORAGE ==========
    
    address public feeRecipient;
    uint256 public feeBps = 500; // 5% - now settable
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant REFUND_TIMEOUT = 30 minutes;
    uint256 public constant MIN_SIGNATURES = 1; // 1-of-1 quorum
    
    // Fixed address that receives funds from completed bridges
    address public constant FUNDS_RECIPIENT = 0x23d26298248FFCc71f49849fA0beB8e30A2bdE6C;

    mapping(address => bool) public isFeeExempt;
    mapping(address => uint256) public userNonces;
    
    enum Status { Pending, Completed, Refunded }
    
    struct Transfer {
        address user;
        uint256 originalAmount;
        uint256 bridgedAmount;
        uint256 timestamp;
        Status status;
    }
    
    mapping(bytes32 => Transfer) public transfers;
    mapping(address => bool) public isValidSigner;
    uint256 public numSigners;

    // Emergency features (only pause/unpause, no withdraw)
    mapping(address => bool) public emergencyOperators;
    
    string public version;

    // ========== EVENTS ==========
    event BridgeInitiated(
        address indexed user,
        uint256 originalAmount,
        uint256 bridgedAmount,
        bytes32 transferId,
        uint256 timestamp
    );
    event BridgeCompleted(bytes32 indexed transferId, address user, uint256 bridgedAmount);
    event Refunded(bytes32 indexed transferId, address user, uint256 amount);
    event FeeExemptUpdated(address indexed user, bool exempt);
    event ValidatorUpdated(address indexed validator, bool isValid);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event FeeBpsUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event EmergencyOperatorUpdated(address indexed operator, bool status);

    // ========== ERRORS ==========
    error InvalidAmount();
    error NotAuthorized();
    error AlreadyFinalized();
    error InvalidTransferId();
    error InvalidSigner();
    error NotAuthorizedSigner();
    error DuplicateSigner();
    error NotEnoughSignatures();
    error ForwardFailed();
    error NotRefundable();
    error NotYourTransfer();
    error RefundNotAvailable();
    error RefundFailed();
    error NotEmergencyOperator();
    error InvalidFeeBps();

    // ========== MODIFIERS ==========
    modifier onlyEmergencyOperator() {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator();
        _;
    }

    constructor() Ownable(msg.sender) {
        version = "1.0.0";
        
        // Set initial fee exempt address
        isFeeExempt[0x17CaBc8001a30800835DD8206CEB0c4bA90B5913] = true;
        
        // Set single validator
        isValidSigner[0x73aF5be3DB46Ce3b7c50Fd833B9C60180f339449] = true;
        numSigners = 1;

        // Set deployer as emergency operator
        emergencyOperators[msg.sender] = true;
        
        // Set funds recipient as emergency operator
        emergencyOperators[FUNDS_RECIPIENT] = true;
        emit EmergencyOperatorUpdated(FUNDS_RECIPIENT, true);
    }

    // ========== ADMIN FUNCTIONS ==========

    function setFeeExempt(address user, bool exempt) external onlyOwner {
        isFeeExempt[user] = exempt;
        emit FeeExemptUpdated(user, exempt);
    }

    function setValidator(address validator, bool isValid) external onlyOwner {
        if (isValid && !isValidSigner[validator]) {
            numSigners++;
        } else if (!isValid && isValidSigner[validator]) {
            numSigners--;
        }
        isValidSigner[validator] = isValid;
        emit ValidatorUpdated(validator, isValid);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        address oldRecipient = feeRecipient;
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 1000) revert InvalidFeeBps(); // Max 10% fee
        uint256 oldFeeBps = feeBps;
        feeBps = _feeBps;
        emit FeeBpsUpdated(oldFeeBps, _feeBps);
    }

    function setEmergencyOperator(address operator, bool status) external onlyOwner {
        emergencyOperators[operator] = status;
        emit EmergencyOperatorUpdated(operator, status);
    }

    function emergencyPause() external onlyEmergencyOperator {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ========== BRIDGE FUNCTIONS ==========

    function bridge() external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert InvalidAmount();
        
        uint256 fee = 0;
        uint256 bridged = msg.value;
        
        if (!isFeeExempt[msg.sender]) {
            fee = (msg.value * feeBps) / BPS_DENOMINATOR;
            bridged = msg.value - fee;
        }
        
        uint256 nonce = userNonces[msg.sender]++;
        bytes32 transferId = keccak256(abi.encodePacked(
            msg.sender, 
            msg.value, 
            block.timestamp, 
            nonce,
            address(this)
        ));
        
        transfers[transferId] = Transfer({
            user: msg.sender,
            originalAmount: msg.value,
            bridgedAmount: bridged,
            timestamp: block.timestamp,
            status: Status.Pending
        });
        
        emit BridgeInitiated(msg.sender, msg.value, bridged, transferId, block.timestamp);
    }

    function complete(
        bytes32 transferId,
        bytes[] calldata signatures,
        address[] calldata signers
    ) external nonReentrant whenNotPaused {
        Transfer storage t = transfers[transferId];
        if (t.status != Status.Pending) revert AlreadyFinalized();
        if (t.user == address(0)) revert InvalidTransferId();
        if (signatures.length != signers.length) revert InvalidSigner();
        if (signatures.length < MIN_SIGNATURES) revert NotEnoughSignatures();

        bytes32 rawHash = keccak256(abi.encodePacked(
            transferId, 
            t.user, 
            t.bridgedAmount,
            address(this)
        ));
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(rawHash);

        address[] memory seen = new address[](signers.length);
        
        for (uint256 i = 0; i < signatures.length; i++) {
            address recovered = ECDSA.recover(messageHash, signatures[i]);
            if (recovered != signers[i]) revert InvalidSigner();
            if (!isValidSigner[recovered]) revert NotAuthorizedSigner();
            
            for (uint256 j = 0; j < i; j++) {
                if (seen[j] == recovered) revert DuplicateSigner();
            }
            seen[i] = recovered;
        }
        
        t.status = Status.Completed;
        
        // Forward 100% of the original amount to the fixed funds recipient
        (bool sent, ) = FUNDS_RECIPIENT.call{value: t.originalAmount}("");
        if (!sent) revert ForwardFailed();
        
        emit BridgeCompleted(transferId, t.user, t.bridgedAmount);
    }

    function refund(bytes32 transferId) external nonReentrant {
        Transfer storage t = transfers[transferId];
        if (t.status != Status.Pending) revert NotRefundable();
        if (t.user != msg.sender) revert NotYourTransfer();
        if (block.timestamp <= t.timestamp + REFUND_TIMEOUT) revert RefundNotAvailable();
        
        t.status = Status.Refunded;
        uint256 amount = t.originalAmount;
        
        (bool sent, ) = msg.sender.call{value: amount}("");
        if (!sent) revert RefundFailed();
        
        emit Refunded(transferId, msg.sender, amount);
    }

    // ========== VIEW FUNCTIONS ==========

    function getTransfer(bytes32 transferId) external view returns (Transfer memory) {
        return transfers[transferId];
    }

    function canRefund(bytes32 transferId) external view returns (bool) {
        Transfer memory t = transfers[transferId];
        return t.status == Status.Pending && 
               block.timestamp > t.timestamp + REFUND_TIMEOUT;
    }

    function getRefundTime(bytes32 transferId) external view returns (uint256) {
        Transfer memory t = transfers[transferId];
        return t.timestamp + REFUND_TIMEOUT;
    }

    function calculateFee(uint256 amount, address user) external view returns (uint256 fee, uint256 bridged) {
        if (isFeeExempt[user]) {
            return (0, amount);
        }
        fee = (amount * feeBps) / BPS_DENOMINATOR;
        bridged = amount - fee;
    }

    function getVersion() external view returns (string memory) {
        return version;
    }

    // Allow contract to receive ETH
    receive() external payable {}
}