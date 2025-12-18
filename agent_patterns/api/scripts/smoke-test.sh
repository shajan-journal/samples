#!/usr/bin/env bash
# Smoke test for API server startup
# This script can be run in CI/CD to verify the server starts correctly

set -e

PORT=13000
TIMEOUT=10
URL="http://localhost:$PORT"

echo "🧪 Running smoke test for API server..."
echo "========================================"

# Start the server in the background
echo "Starting server on port $PORT..."
npm run start:api -- --port=$PORT &
SERVER_PID=$!

# Function to cleanup
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Wait for server to be ready
echo "Waiting for server to be ready..."
for i in $(seq 1 $TIMEOUT); do
  if curl -s "$URL/api/patterns" > /dev/null 2>&1; then
    echo "✅ Server is ready"
    break
  fi
  if [ $i -eq $TIMEOUT ]; then
    echo "❌ Server failed to start within ${TIMEOUT} seconds"
    exit 1
  fi
  sleep 1
done

# Test 1: Check patterns endpoint
echo ""
echo "Test 1: Checking /api/patterns endpoint..."
PATTERNS=$(curl -s "$URL/api/patterns")
echo "$PATTERNS" | jq '.' > /dev/null 2>&1 || (echo "❌ Invalid JSON response" && exit 1)

REACT_PATTERN=$(echo "$PATTERNS" | jq -r '.patterns[] | select(.name=="react") | .name')
if [ "$REACT_PATTERN" = "react" ]; then
  echo "✅ React pattern found"
else
  echo "❌ React pattern not found"
  echo "Available patterns: $(echo "$PATTERNS" | jq -r '.patterns[].name')"
  exit 1
fi

# Test 2: Check capabilities endpoint
echo ""
echo "Test 2: Checking /api/capabilities endpoint..."
CAPABILITIES=$(curl -s "$URL/api/capabilities")
echo "$CAPABILITIES" | jq '.' > /dev/null 2>&1 || (echo "❌ Invalid JSON response" && exit 1)
echo "✅ Capabilities endpoint working"

# Test 3: Check tools endpoint
echo ""
echo "Test 3: Checking /api/tools endpoint..."
TOOLS=$(curl -s "$URL/api/tools")
echo "$TOOLS" | jq '.' > /dev/null 2>&1 || (echo "❌ Invalid JSON response" && exit 1)

CALC_TOOL=$(echo "$TOOLS" | jq -r '.tools[] | select(.name=="calculator") | .name')
if [ "$CALC_TOOL" = "calculator" ]; then
  echo "✅ Calculator tool found"
else
  echo "❌ Calculator tool not found"
  exit 1
fi

# Test 4: Check execute endpoint with invalid request
echo ""
echo "Test 4: Checking /api/execute endpoint (invalid request)..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$URL/api/execute" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "400" ]; then
  echo "✅ Execute endpoint properly validates requests"
else
  echo "❌ Unexpected response code: $HTTP_CODE"
  exit 1
fi

echo ""
echo "================================================"
echo "✅ All smoke tests passed!"
echo "================================================"

exit 0
