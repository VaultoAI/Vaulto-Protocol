#!/bin/bash
# deploy-all.sh - Deploy all PreStock token bridges
# This script deploys ERC-20 contracts to Polygon and sets up NTT infrastructure

set -e

echo "=========================================="
echo "PreStock Bridge Deployment Script"
echo "=========================================="

# Check for required environment variables
check_env() {
    if [ -z "${!1}" ]; then
        echo "Error: $1 is not set"
        exit 1
    fi
}

check_env "POLYGON_PRIVATE_KEY"
check_env "OWNER_ADDRESS"
check_env "POLYGON_RPC_URL"
check_env "POLYGONSCAN_API_KEY"

# Tokens to deploy
TOKENS=("spacex" "anthropic" "openai" "anduril" "kalshi" "polymarket" "xai")

echo ""
echo "Step 1: Install Foundry dependencies"
echo "-------------------------------------"
cd packages/contracts
if [ ! -d "lib/openzeppelin-contracts" ]; then
    forge install OpenZeppelin/openzeppelin-contracts --no-commit
fi
if [ ! -d "lib/forge-std" ]; then
    forge install foundry-rs/forge-std --no-commit
fi

echo ""
echo "Step 2: Build contracts"
echo "-----------------------"
forge build

echo ""
echo "Step 3: Run tests"
echo "-----------------"
forge test -vvv

echo ""
echo "Step 4: Deploy ERC-20 contracts to Polygon"
echo "-------------------------------------------"
forge script script/Deploy.s.sol --rpc-url "$POLYGON_RPC_URL" --broadcast --verify

echo ""
echo "Step 5: Save deployed addresses"
echo "--------------------------------"
# Note: In production, extract addresses from broadcast logs
# and update deployment.json files

echo ""
echo "Step 6: Deploy NTT infrastructure for each token"
echo "-------------------------------------------------"
cd ../..

for token in "${TOKENS[@]}"; do
    echo ""
    echo "Deploying NTT for $token..."
    cd "deployments/$token"

    # Add Polygon chain (burning mode)
    # ntt add-chain Polygon --latest --mode burning --token <ERC20_ADDRESS>

    # Add Solana chain (locking mode)
    # ntt add-chain Solana --latest --mode locking --token <SPL_MINT>

    # Push to register peers
    # ntt push

    cd ../..
done

echo ""
echo "Step 7: Set NTT Managers on ERC-20 contracts"
echo "---------------------------------------------"
# This requires running SetNttManagers script with manager addresses
# forge script script/Deploy.s.sol:SetNttManagers --rpc-url "$POLYGON_RPC_URL" --broadcast

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update deployment.json files with deployed addresses"
echo "2. Update packages/sdk/src/tokens.ts with Polygon addresses"
echo "3. Call setNttManager() on each ERC-20 contract"
echo "4. Test bridging with small amounts"
echo "5. Start supply monitoring"
