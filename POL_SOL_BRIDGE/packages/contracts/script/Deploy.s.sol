// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PreStockToken} from "../src/PreStockToken.sol";

/**
 * @title Deploy
 * @notice Deployment script for all PreStock ERC-20 tokens on Polygon
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url $POLYGON_RPC_URL --broadcast
 */
contract Deploy is Script {
    /// @notice Token configuration struct
    struct TokenConfig {
        string name;
        string symbol;
        string companyId;
    }

    /// @notice All PreStock tokens to deploy
    TokenConfig[] public tokens;

    function setUp() public {
        // Initialize token configurations
        tokens.push(TokenConfig("Vaulted Prestock SpaceX", "vSPACEX", "spacex"));
        tokens.push(TokenConfig("Vaulted Prestock Anthropic", "vANTHROPIC", "anthropic"));
        tokens.push(TokenConfig("Vaulted Prestock OpenAI", "vOPENAI", "openai"));
        tokens.push(TokenConfig("Vaulted Prestock Anduril", "vANDURIL", "anduril"));
        tokens.push(TokenConfig("Vaulted Prestock Kalshi", "vKALSHI", "kalshi"));
        tokens.push(TokenConfig("Vaulted Prestock Polymarket", "vPOLYMARKET", "polymarket"));
        tokens.push(TokenConfig("Vaulted Prestock xAI", "vXAI", "xai"));
    }

    function run() public {
        address owner = vm.envAddress("OWNER_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("POLYGON_PRIVATE_KEY");

        console2.log("Deploying PreStock tokens to Polygon...");
        console2.log("Owner address:", owner);

        vm.startBroadcast(deployerPrivateKey);

        for (uint256 i = 0; i < tokens.length; i++) {
            TokenConfig memory config = tokens[i];

            PreStockToken token = new PreStockToken(
                config.name,
                config.symbol,
                owner
            );

            console2.log("Deployed", config.symbol, "at:", address(token));
        }

        vm.stopBroadcast();

        console2.log("\nDeployment complete!");
        console2.log("Next steps:");
        console2.log("1. Verify contracts on Polygonscan");
        console2.log("2. Run NTT CLI to deploy NTT infrastructure");
        console2.log("3. Call setNttManager() on each token");
    }

    /// @notice Deploy a single token (for individual deployments)
    function deploySingle(
        string memory name,
        string memory symbol,
        address owner
    ) public returns (PreStockToken) {
        uint256 deployerPrivateKey = vm.envUint("POLYGON_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        PreStockToken token = new PreStockToken(name, symbol, owner);
        vm.stopBroadcast();

        console2.log("Deployed", symbol, "at:", address(token));
        return token;
    }
}

/**
 * @title SetNttManagers
 * @notice Script to set NTT Manager addresses after NTT deployment
 * @dev Run after deploying NTT infrastructure via CLI
 */
contract SetNttManagers is Script {
    struct ManagerConfig {
        address token;
        address nttManager;
    }

    function run(ManagerConfig[] calldata configs) public {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");

        vm.startBroadcast(ownerPrivateKey);

        for (uint256 i = 0; i < configs.length; i++) {
            PreStockToken token = PreStockToken(configs[i].token);
            token.setNttManager(configs[i].nttManager);
            console2.log("Set NTT Manager for", address(token), "to:", configs[i].nttManager);
        }

        vm.stopBroadcast();
    }
}
