#!/bin/bash
# loop-skills test runner
# Tests each skill with a minimal real API call
#
# Usage:
#   ./test.sh              # test all skills
#   ./test.sh web          # test web only
#   ./test.sh web browser  # test web and browser
#
# Required env vars:
#   PARALLEL_API_KEY    - for web skill (https://www.parallel.ai)
#   FIRECRAWL_API_KEY   - for firecrawl skill (https://firecrawl.dev)
#   ELEVEN_API_KEY      - for voice skill (https://elevenlabs.io)
#   (browser needs no key - just Playwright + Chrome)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
SKIP=0

green() { echo -e "\033[32m✅ $1\033[0m"; }
red()   { echo -e "\033[31m❌ $1\033[0m"; }
yellow(){ echo -e "\033[33m⏭️  $1\033[0m"; }

run_test() {
  local name="$1"
  local cmd="$2"
  local check="$3"  # string to grep for in output

  echo -n "  $name ... "
  output=$(eval "$cmd" 2>&1)
  exit_code=$?

  if [ $exit_code -eq 0 ] && echo "$output" | grep -q "$check"; then
    green "PASS"
    PASS=$((PASS + 1))
  else
    red "FAIL (exit=$exit_code)"
    echo "    Output: $(echo "$output" | head -3)"
    FAIL=$((FAIL + 1))
  fi
}

# ──────────────────────────────────────
# WEB SKILL
# ──────────────────────────────────────
test_web() {
  echo ""
  echo "📡 web skill"

  if [ -z "$PARALLEL_API_KEY" ]; then
    yellow "SKIP (PARALLEL_API_KEY not set)"
    SKIP=$((SKIP + 4))
    return
  fi

  cd "$SCRIPT_DIR/web"

  run_test "search" \
    "node search.js 'test query' --mode fast --max-results 1" \
    "Search Results"

  run_test "extract" \
    "node extract.js 'https://example.com' --objective 'page title'" \
    "Extracted Content"

  run_test "findall" \
    "node findall.js 'top 3 javascript frameworks' --max-entities 3" \
    "findall_"

  run_test "monitor (list)" \
    "node monitor.js list" \
    ""  # just needs to not crash
}

# ──────────────────────────────────────
# BROWSER SKILL
# ──────────────────────────────────────
test_browser() {
  echo ""
  echo "🌐 browser skill (@playwright/cli)"

  if ! command -v playwright-cli &> /dev/null; then
    yellow "SKIP (playwright-cli not installed — npm install -g @playwright/cli)"
    SKIP=$((SKIP + 3))
    return
  fi

  run_test "open + snapshot" \
    "playwright-cli open https://example.com 2>&1" \
    "Example Domain"

  run_test "screenshot" \
    "playwright-cli screenshot 2>&1" \
    "Screenshot"

  run_test "close" \
    "playwright-cli close 2>&1" \
    "closed"
}

# ──────────────────────────────────────
# FIRECRAWL SKILL
# ──────────────────────────────────────
test_firecrawl() {
  echo ""
  echo "🔥 firecrawl skill"

  if [ -z "$FIRECRAWL_API_KEY" ]; then
    yellow "SKIP (FIRECRAWL_API_KEY not set)"
    SKIP=$((SKIP + 1))
    return
  fi

  run_test "search" \
    "python3 $SCRIPT_DIR/firecrawl/scripts/search.py 'test query' --limit 1" \
    ""
}

# ──────────────────────────────────────
# VOICE SKILL
# ──────────────────────────────────────
test_voice() {
  echo ""
  echo "🎙️ voice skill"

  if [ -z "$ELEVEN_API_KEY" ]; then
    yellow "SKIP (ELEVEN_API_KEY not set)"
    SKIP=$((SKIP + 1))
    return
  fi

  run_test "tts" \
    "python3 $SCRIPT_DIR/voice/scripts/tts.py 'Hello from Loop Skills test' --output /tmp/loop-skills-test.mp3" \
    ""
}

# ──────────────────────────────────────
# MAIN
# ──────────────────────────────────────
echo "🧪 loop-skills test runner"
echo "=========================="

# If specific skills passed as args, test only those
if [ $# -gt 0 ]; then
  for skill in "$@"; do
    case "$skill" in
      web)       test_web ;;
      browser)   test_browser ;;
      firecrawl) test_firecrawl ;;
      voice)     test_voice ;;
      *)         echo "Unknown skill: $skill" ;;
    esac
  done
else
  test_web
  test_browser
  test_firecrawl
  test_voice
fi

# Summary
echo ""
echo "=========================="
echo "Results: $PASS passed, $FAIL failed, $SKIP skipped"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
