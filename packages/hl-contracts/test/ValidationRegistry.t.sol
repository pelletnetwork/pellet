// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/ValidationRegistry.sol";

contract ValidationRegistryTest is Test {
    ValidationRegistry registry;
    address validator1 = address(0xABCD);
    address validator2 = address(0xABCE);

    function setUp() public {
        registry = new ValidationRegistry();
    }

    function test_PostValidation_MintsIdStartingFromOne() public {
        bytes32 hash = keccak256("proof-of-trade");
        vm.prank(validator1);
        uint256 id = registry.postValidation(1, hash, "ipfs://proof");
        assertEq(id, 1);
    }

    function test_PostValidation_IncrementsIds() public {
        vm.prank(validator1);
        uint256 id1 = registry.postValidation(1, bytes32(uint256(1)), "");
        vm.prank(validator1);
        uint256 id2 = registry.postValidation(1, bytes32(uint256(2)), "");
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_PostValidation_StoresRecord() public {
        bytes32 hash = keccak256("outcome-x");
        vm.prank(validator1);
        uint256 id = registry.postValidation(42, hash, "ipfs://p");
        ValidationRegistry.Validation memory v = registry.getValidation(id);
        assertEq(v.agentId, 42);
        assertEq(v.validator, validator1);
        assertEq(v.claimHash, hash);
        assertEq(v.proofURI, "ipfs://p");
        assertEq(uint256(v.timestamp), block.timestamp);
    }

    function test_PostValidation_EmitsEvent() public {
        bytes32 hash = keccak256("p");
        vm.expectEmit(true, true, true, true);
        emit ValidationRegistry.ValidationPosted(1, 7, validator1, hash, "ipfs://x", block.timestamp);
        vm.prank(validator1);
        registry.postValidation(7, hash, "ipfs://x");
    }

    function test_PostValidation_AllowsEmptyProofURI() public {
        bytes32 hash = keccak256("onchain-only");
        vm.prank(validator1);
        uint256 id = registry.postValidation(1, hash, "");
        ValidationRegistry.Validation memory v = registry.getValidation(id);
        assertEq(v.proofURI, "");
        assertEq(v.claimHash, hash);
    }

    function test_GetValidation_ReturnsZeroForUnknown() public {
        ValidationRegistry.Validation memory v = registry.getValidation(999);
        assertEq(v.agentId, 0);
        assertEq(v.validator, address(0));
        assertEq(v.claimHash, bytes32(0));
    }

    function test_ValidationCountForAgent_ReflectsPosts() public {
        assertEq(registry.validationCountForAgent(1), 0);
        vm.prank(validator1);
        registry.postValidation(1, bytes32(uint256(1)), "");
        vm.prank(validator2);
        registry.postValidation(1, bytes32(uint256(2)), "");
        assertEq(registry.validationCountForAgent(1), 2);
    }

    function test_ValidationCountByValidator_ReflectsPosts() public {
        assertEq(registry.validationCountByValidator(validator1), 0);
        vm.prank(validator1);
        registry.postValidation(1, bytes32(uint256(1)), "");
        vm.prank(validator1);
        registry.postValidation(2, bytes32(uint256(2)), "");
        assertEq(registry.validationCountByValidator(validator1), 2);
        assertEq(registry.validationCountByValidator(validator2), 0);
    }

    function test_MultipleAgents_TrackIndependently() public {
        vm.prank(validator1);
        registry.postValidation(1, bytes32(uint256(1)), "");
        vm.prank(validator1);
        registry.postValidation(2, bytes32(uint256(2)), "");
        assertEq(registry.validationCountForAgent(1), 1);
        assertEq(registry.validationCountForAgent(2), 1);
    }
}
