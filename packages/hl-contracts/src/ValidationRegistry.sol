// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IValidationRegistry} from "./interfaces/IValidationRegistry.sol";

/// @title ERC-8004 Validation Registry (Pellet HL)
/// @notice Stronger-than-attestation proofs of agent work. Validators post
///         hashed claims with off-chain proof references (e.g., zkProofs,
///         signed trade receipts, cryptographic commitments).
contract ValidationRegistry is IValidationRegistry {
    struct Validation {
        uint256 agentId;
        address validator;
        uint64 timestamp;
        bytes32 claimHash;
        string proofURI;
    }

    uint256 public nextValidationId = 1;
    mapping(uint256 => Validation) public validations;

    /// @notice All validation IDs ever posted about an agent (append-only).
    /// @dev Consumers needing "current" summaries should compute off-chain or via subgraph.
    mapping(uint256 => uint256[]) public validationsByAgent;

    /// @notice All validation IDs ever posted by a validator (append-only).
    mapping(address => uint256[]) public validationsByValidator;

    event ValidationPosted(
        uint256 indexed validationId,
        uint256 indexed agentId,
        address indexed validator,
        bytes32 claimHash,
        string proofURI,
        uint256 timestamp
    );

    /// @notice Post a validation of an agent's work.
    /// @dev `proofURI` may be empty (e.g., for on-chain-only proofs); consumers validate format.
    /// @param agentId Target agent's ID.
    /// @param claimHash keccak256 (or other) hash of the claim being validated.
    /// @param proofURI URI pointing to the off-chain proof (zkProof artifact, receipt JSON, etc.). May be empty.
    /// @return validationId The newly assigned validation ID.
    function postValidation(
        uint256 agentId,
        bytes32 claimHash,
        string calldata proofURI
    ) external returns (uint256 validationId) {
        validationId = nextValidationId++;
        validations[validationId] = Validation({
            agentId: agentId,
            validator: msg.sender,
            timestamp: uint64(block.timestamp),
            claimHash: claimHash,
            proofURI: proofURI
        });
        validationsByAgent[agentId].push(validationId);
        validationsByValidator[msg.sender].push(validationId);
        emit ValidationPosted(validationId, agentId, msg.sender, claimHash, proofURI, block.timestamp);
    }

    /// @notice Read a validation record.
    /// @param validationId The validation ID to look up.
    /// @return The validation record. Zero-initialized if ID does not exist (consumers must check `validator != address(0)`).
    function getValidation(uint256 validationId) external view returns (Validation memory) {
        return validations[validationId];
    }

    /// @notice Number of validations posted about an agent.
    /// @param agentId The agent ID to look up.
    /// @return count Total validations ever posted for this agent.
    function validationCountForAgent(uint256 agentId) external view returns (uint256 count) {
        return validationsByAgent[agentId].length;
    }

    /// @notice Number of validations posted by a validator.
    /// @param validator The validator address to look up.
    /// @return count Total validations ever posted by this validator.
    function validationCountByValidator(address validator) external view returns (uint256 count) {
        return validationsByValidator[validator].length;
    }
}
