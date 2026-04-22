// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry registry;
    address attester1 = address(0xA7751);
    address attester2 = address(0xA7752);
    bytes32 constant OUTCOME_SUCCESS = keccak256("outcome:success");
    bytes32 constant OUTCOME_FAILURE = keccak256("outcome:failure");

    function setUp() public {
        registry = new ReputationRegistry();
    }

    function test_PostAttestation_MintsIdStartingFromOne() public {
        vm.prank(attester1);
        uint256 id = registry.postAttestation(1, OUTCOME_SUCCESS, 100, "ipfs://receipt");
        assertEq(id, 1);
    }

    function test_PostAttestation_IncrementsIds() public {
        vm.prank(attester1);
        uint256 id1 = registry.postAttestation(1, OUTCOME_SUCCESS, 10, "ipfs://a");
        vm.prank(attester1);
        uint256 id2 = registry.postAttestation(1, OUTCOME_SUCCESS, 20, "ipfs://b");
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_PostAttestation_StoresRecord() public {
        vm.prank(attester1);
        uint256 id = registry.postAttestation(42, OUTCOME_SUCCESS, 100, "ipfs://r");
        ReputationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.agentId, 42);
        assertEq(att.attester, attester1);
        assertEq(att.attestationType, OUTCOME_SUCCESS);
        assertEq(att.score, int256(100));
        assertEq(att.metadataURI, "ipfs://r");
        assertEq(uint256(att.timestamp), block.timestamp);
    }

    function test_PostAttestation_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ReputationRegistry.AttestationPosted(
            1,
            42,
            attester1,
            OUTCOME_SUCCESS,
            int256(100),
            "ipfs://r",
            block.timestamp
        );
        vm.prank(attester1);
        registry.postAttestation(42, OUTCOME_SUCCESS, 100, "ipfs://r");
    }

    function test_PostAttestation_AllowsNegativeScore() public {
        vm.prank(attester1);
        uint256 id = registry.postAttestation(7, OUTCOME_FAILURE, -50, "ipfs://loss");
        ReputationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.score, int256(-50));
    }

    function test_PostAttestation_AllowsEmptyMetadata() public {
        vm.prank(attester1);
        uint256 id = registry.postAttestation(1, OUTCOME_SUCCESS, 10, "");
        ReputationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.metadataURI, "");
    }

    function test_GetAttestation_ReturnsZeroForUnknown() public {
        ReputationRegistry.Attestation memory att = registry.getAttestation(999);
        assertEq(att.agentId, 0);
        assertEq(att.attester, address(0));
        assertEq(att.score, int256(0));
    }

    function test_AttestationCountForAgent_ReflectsPosts() public {
        assertEq(registry.attestationCountForAgent(1), 0);
        vm.prank(attester1);
        registry.postAttestation(1, OUTCOME_SUCCESS, 10, "ipfs://a");
        vm.prank(attester2);
        registry.postAttestation(1, OUTCOME_SUCCESS, 20, "ipfs://b");
        assertEq(registry.attestationCountForAgent(1), 2);
    }

    function test_AttestationCountByAttester_ReflectsPosts() public {
        assertEq(registry.attestationCountByAttester(attester1), 0);
        vm.prank(attester1);
        registry.postAttestation(1, OUTCOME_SUCCESS, 10, "ipfs://a");
        vm.prank(attester1);
        registry.postAttestation(2, OUTCOME_SUCCESS, 20, "ipfs://b");
        assertEq(registry.attestationCountByAttester(attester1), 2);
        assertEq(registry.attestationCountByAttester(attester2), 0);
    }

    function test_MultipleAgents_TrackIndependently() public {
        vm.prank(attester1);
        registry.postAttestation(1, OUTCOME_SUCCESS, 10, "");
        vm.prank(attester1);
        registry.postAttestation(2, OUTCOME_SUCCESS, 10, "");
        assertEq(registry.attestationCountForAgent(1), 1);
        assertEq(registry.attestationCountForAgent(2), 1);
    }
}
