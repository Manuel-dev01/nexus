#!/bin/bash
# deploy_contracts.sh — Deploy Nexus Move contracts to Sui Testnet
#
# Prerequisites:
#   - Sui CLI installed and configured
#   - Active Sui address with testnet SUI tokens
#   - .env file configured with TATUM_API_KEY
#
# Usage: ./scripts/deploy_contracts.sh

set -euo pipefail

echo "🔮 Deploying Nexus contracts to Sui Testnet..."

cd "$(dirname "$0")/../move"

# Build first
echo "📦 Building Move package..."
sui move build

# Publish
echo "🚀 Publishing to testnet..."
PUBLISH_OUTPUT=$(sui client publish --gas-budget 100000000 --json)

# Extract package ID
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

echo ""
echo "✅ Deployment successful!"
echo "📋 Package ID: $PACKAGE_ID"
echo ""
echo "👉 Add this to your .env file:"
echo "   NEXUS_PACKAGE_ID=$PACKAGE_ID"
