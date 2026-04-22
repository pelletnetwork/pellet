// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IValidationRegistry
/// @notice Minimum interface for consumers (agent platforms, SDK clients) that
///         need to read validation summary data without pulling the full struct.
interface IValidationRegistry {
    /// @notice Number of validations posted about an agent.
    /// @param agentId The agent ID to look up.
    /// @return count Total validations ever posted for this agent.
    function validationCountForAgent(uint256 agentId) external view returns (uint256 count);
}
