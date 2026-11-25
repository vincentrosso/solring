#!/usr/bin/env bash
# Wipes EVERY message, task and setting on the live site. Asks first; "reset.sh yes" skips the question.
set -euo pipefail
cd "$(dirname "$0")"
ok="${1:-}"
[ "$ok" = yes ] || read -r -p "Delete all Beatrix messages and tasks? type yes: " ok
[ "$ok" = yes ] || exit 1
export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"
export CLOUDFLARE_API_TOKEN="$(cat ~/tmp/cftoken-pastrami.txt)" CLOUDFLARE_ACCOUNT_ID="$(cat ~/tmp/cfaccountid.txt)"
npx -y wrangler d1 execute solring --remote -y --command "DELETE FROM messages; DELETE FROM tasks; DELETE FROM settings;" | tail -3
