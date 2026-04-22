// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IIdentityRegistry
/// @notice Minimum interface for consumers (e.g. sibling Reputation / Validation registries)
///         that need to look up agent controllers or existence.
interface IIdentityRegistry {
    /// @notice Get the current controller for an agent ID.
    /// @param agentId The agent ID to look up.
    /// @return controller The current controller address, or address(0) if the agent does not exist.
    function controllerOf(uint256 agentId) external view returns (address controller);
}
