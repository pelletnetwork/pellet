// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IReputationRegistry
/// @notice Minimum interface for consumers (agent platforms, SDK clients) that
///         need to read reputation summary data without pulling the full struct.
interface IReputationRegistry {
    /// @notice Number of attestations posted about an agent.
    /// @param agentId The agent ID to look up.
    /// @return count Total attestations ever posted for this agent.
    function attestationCountForAgent(uint256 agentId) external view returns (uint256 count);
}
