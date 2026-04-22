// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/IdentityRegistry.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry registry;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        registry = new IdentityRegistry();
    }

    function test_RegisterAgent_MintsIdStartingFromOne() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://agent-alice");
        assertEq(id, 1);
    }

    function test_RegisterAgent_IncrementsIds() public {
        vm.prank(alice);
        uint256 id1 = registry.registerAgent("ipfs://agent-1");
        vm.prank(bob);
        uint256 id2 = registry.registerAgent("ipfs://agent-2");
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_RegisterAgent_StoresAgentRecord() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://meta");
        IdentityRegistry.Agent memory agent = registry.getAgent(id);
        assertEq(agent.controller, alice);
        assertEq(agent.metadataURI, "ipfs://meta");
        assertEq(uint256(agent.registeredAt), block.timestamp);
    }

    function test_RegisterAgent_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IdentityRegistry.AgentRegistered(1, alice, "ipfs://meta", block.timestamp);
        vm.prank(alice);
        registry.registerAgent("ipfs://meta");
    }

    function test_UpdateMetadata_RequiresController() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://old");
        vm.prank(bob);
        vm.expectRevert(IdentityRegistry.NotController.selector);
        registry.updateMetadata(id, "ipfs://new");
    }

    function test_UpdateMetadata_UpdatesUri() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://old");
        vm.prank(alice);
        registry.updateMetadata(id, "ipfs://new");
        IdentityRegistry.Agent memory agent = registry.getAgent(id);
        assertEq(agent.metadataURI, "ipfs://new");
    }

    function test_TransferController_MovesOwnership() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://meta");
        vm.prank(alice);
        registry.transferController(id, bob);
        IdentityRegistry.Agent memory agent = registry.getAgent(id);
        assertEq(agent.controller, bob);
    }

    function test_GetAgent_RevertsForUnknownId() public {
        vm.expectRevert(IdentityRegistry.AgentNotFound.selector);
        registry.getAgent(999);
    }

    function test_TotalAgents_ReflectsRegistrations() public {
        assertEq(registry.totalAgents(), 0);
        vm.prank(alice);
        registry.registerAgent("ipfs://1");
        vm.prank(bob);
        registry.registerAgent("ipfs://2");
        assertEq(registry.totalAgents(), 2);
    }

    function test_ControllerOf_ReturnsCurrentController() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://x");
        assertEq(registry.controllerOf(id), alice);
        vm.prank(alice);
        registry.transferController(id, bob);
        assertEq(registry.controllerOf(id), bob);
    }

    function test_ControllerOf_ReturnsZeroForUnknown() public {
        assertEq(registry.controllerOf(999), address(0));
    }
}
