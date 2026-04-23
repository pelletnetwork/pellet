// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/IdentityRegistry.sol";
import "../src/ReputationRegistry.sol";
import "../src/ValidationRegistry.sol";

/// @title Deploy
/// @notice Deploys the three ERC-8004 registries (Identity, Reputation, Validation)
///         to HyperEVM. Reads PRIVATE_KEY from the environment.
/// @dev Intended for testnet + mainnet. After running, record the deployed
///      addresses in deployments/hyperevm-<chain>.json for consumers.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("=====================================");
        console2.log(unicode"Pellet HL — ERC-8004 registry deploy");
        console2.log("=====================================");
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("Block:    ", block.number);
        console2.log("");

        vm.startBroadcast(deployerKey);

        IdentityRegistry identity = new IdentityRegistry();
        ReputationRegistry reputation = new ReputationRegistry();
        ValidationRegistry validation = new ValidationRegistry();

        vm.stopBroadcast();

        console2.log("Deployed:");
        console2.log("  IdentityRegistry:    ", address(identity));
        console2.log("  ReputationRegistry:  ", address(reputation));
        console2.log("  ValidationRegistry:  ", address(validation));
        console2.log("");
        console2.log("Next: copy these addresses into");
        console2.log("  deployments/hyperevm-<chain>.json");
        console2.log("and update lib/hl/addresses.ts in any downstream SDK consumers.");
    }
}
