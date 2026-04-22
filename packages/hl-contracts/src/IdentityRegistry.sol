// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title ERC-8004 Identity Registry (Pellet HL)
/// @notice Assigns unique uint256 IDs to autonomous agents on Hyperliquid.
///         Each agent has a controller address and a metadata URI.
///         This is the reference implementation for Pellet's agent identity layer.
contract IdentityRegistry is IIdentityRegistry {
    struct Agent {
        address controller;
        uint64 registeredAt;
        string metadataURI;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) public agents;

    /// @notice Append-only history of agent IDs ever owned by an address (including past ownership).
    /// @dev Entries are NOT pruned on `transferController`. Consumers iterating this mapping MUST
    ///      filter by `agents[id].controller == addr` to get currently-owned agents. Prefer
    ///      subgraph-indexed queries for live ownership lookup.
    mapping(address => uint256[]) public agentsByController;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed controller,
        string metadataURI,
        uint256 timestamp
    );

    event AgentMetadataUpdated(
        uint256 indexed agentId,
        string newMetadataURI,
        uint256 timestamp
    );

    event AgentControllerTransferred(
        uint256 indexed agentId,
        address indexed previousController,
        address indexed newController
    );

    error NotController();
    error AgentNotFound();
    error InvalidAddress();

    /// @notice Register a new agent, minting a fresh ID.
    /// @dev `metadataURI` may be empty string; consumers are expected to validate format.
    /// @param metadataURI URI pointing to agent metadata (JSON schema per ERC-8004). May be empty.
    /// @return agentId The newly assigned agent ID.
    function registerAgent(string calldata metadataURI) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        agents[agentId] = Agent({
            controller: msg.sender,
            registeredAt: uint64(block.timestamp),
            metadataURI: metadataURI
        });
        agentsByController[msg.sender].push(agentId);
        emit AgentRegistered(agentId, msg.sender, metadataURI, block.timestamp);
    }

    /// @notice Update an agent's metadata URI. Only callable by the current controller.
    /// @param agentId The agent to update.
    /// @param newMetadataURI The new metadata URI.
    function updateMetadata(uint256 agentId, string calldata newMetadataURI) external {
        Agent storage agent = agents[agentId];
        if (agent.controller == address(0)) revert AgentNotFound();
        if (agent.controller != msg.sender) revert NotController();
        agent.metadataURI = newMetadataURI;
        emit AgentMetadataUpdated(agentId, newMetadataURI, block.timestamp);
    }

    /// @notice Transfer controller rights to a new address.
    /// @dev The previous controller's `agentsByController` entry is not pruned; see mapping notes.
    /// @param agentId The agent whose controller is being transferred.
    /// @param newController The address receiving controller rights. Must be non-zero.
    function transferController(uint256 agentId, address newController) external {
        if (newController == address(0)) revert InvalidAddress();
        Agent storage agent = agents[agentId];
        if (agent.controller == address(0)) revert AgentNotFound();
        if (agent.controller != msg.sender) revert NotController();
        address previous = agent.controller;
        agent.controller = newController;
        agentsByController[newController].push(agentId);
        emit AgentControllerTransferred(agentId, previous, newController);
    }

    /// @notice Read an agent record.
    /// @param agentId The agent ID to look up.
    /// @return The agent record. Reverts with AgentNotFound if the ID has not been registered.
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        Agent memory agent = agents[agentId];
        if (agent.controller == address(0)) revert AgentNotFound();
        return agent;
    }

    /// @notice Get the current controller for an agent ID, or zero if unregistered.
    /// @dev Cheap authorization lookup for sibling registries (Reputation, Validation).
    /// @param agentId The agent ID to look up.
    /// @return controller The current controller address, or address(0) if the agent does not exist.
    function controllerOf(uint256 agentId) external view returns (address controller) {
        return agents[agentId].controller;
    }

    /// @notice Total agents registered on this registry.
    /// @return Number of `registerAgent` calls ever made.
    function totalAgents() external view returns (uint256) {
        return nextAgentId - 1;
    }
}
