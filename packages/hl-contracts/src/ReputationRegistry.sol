// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IReputationRegistry} from "./interfaces/IReputationRegistry.sol";

/// @title ERC-8004 Reputation Registry (Pellet HL)
/// @notice Allows permissionless attestations about agent behavior.
///         Attesters post signed claims tied to an agent ID.
///         Scores are int256 to allow negative signals (failed outcomes, penalties).
contract ReputationRegistry is IReputationRegistry {
    /// @dev Packed layout: (agentId u256) (attester a20 + timestamp u64 + pad | attestationType b32) (int256 score) (string metadataURI ptr)
    ///      Effective slots: 5 (one for agentId, two for attester+timestamp+attestationType pair, one for score, one for URI pointer).
    struct Attestation {
        uint256 agentId;
        address attester;
        uint64 timestamp;
        bytes32 attestationType;
        int256 score;
        string metadataURI;
    }

    uint256 public nextAttestationId = 1;
    mapping(uint256 => Attestation) public attestations;

    /// @notice All attestation IDs ever posted about an agent (append-only).
    /// @dev Consumers needing "current" reputation summaries should compute off-chain or via subgraph.
    mapping(uint256 => uint256[]) public attestationsByAgent;

    /// @notice All attestation IDs ever posted by an attester (append-only).
    mapping(address => uint256[]) public attestationsByAttester;

    event AttestationPosted(
        uint256 indexed attestationId,
        uint256 indexed agentId,
        address indexed attester,
        bytes32 attestationType,
        int256 score,
        string metadataURI,
        uint256 timestamp
    );

    /// @notice Post an attestation about an agent.
    /// @dev `metadataURI` may be empty; consumers validate format.
    /// @param agentId Target agent's ID.
    /// @param attestationType bytes32 identifier for the type (e.g. keccak256("outcome:success")).
    /// @param score Numeric score (positive or negative int256).
    /// @param metadataURI URI pointing to full attestation detail (e.g. trade receipt). May be empty.
    /// @return attestationId The newly assigned attestation ID.
    function postAttestation(
        uint256 agentId,
        bytes32 attestationType,
        int256 score,
        string calldata metadataURI
    ) external returns (uint256 attestationId) {
        attestationId = nextAttestationId++;
        attestations[attestationId] = Attestation({
            agentId: agentId,
            attester: msg.sender,
            timestamp: uint64(block.timestamp),
            attestationType: attestationType,
            score: score,
            metadataURI: metadataURI
        });
        attestationsByAgent[agentId].push(attestationId);
        attestationsByAttester[msg.sender].push(attestationId);
        emit AttestationPosted(
            attestationId,
            agentId,
            msg.sender,
            attestationType,
            score,
            metadataURI,
            block.timestamp
        );
    }

    /// @notice Read an attestation record.
    /// @param attestationId The attestation ID to look up.
    /// @return The attestation record. Zero-initialized if ID does not exist (consumers must check `attester != address(0)`).
    function getAttestation(uint256 attestationId) external view returns (Attestation memory) {
        return attestations[attestationId];
    }

    /// @notice Number of attestations posted about an agent.
    /// @param agentId The agent ID to look up.
    /// @return count Total attestations ever posted for this agent.
    function attestationCountForAgent(uint256 agentId) external view returns (uint256 count) {
        return attestationsByAgent[agentId].length;
    }

    /// @notice Number of attestations posted by an attester.
    /// @param attester The attester address to look up.
    /// @return count Total attestations ever posted by this attester.
    function attestationCountByAttester(address attester) external view returns (uint256 count) {
        return attestationsByAttester[attester].length;
    }
}
