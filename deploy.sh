#!/usr/bin/env bash
# Deploys the page and the /api functions together (Pages bundles functions/).
# Token: the pastrami one (D1 + ndex.us). Schema is idempotent, applied every deploy.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-$(cat ~/tmp/cftoken-pastrami.txt)}"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$(cat ~/tmp/cfaccountid.txt)}"
echo "[$(date +%H:%M:%S)] schema"
npx -y wrangler d1 execute solring --remote --file schema.sql -y | tail -3
echo "[$(date +%H:%M:%S)] deploy"
npx -y wrangler pages deploy --project-name solring --branch main --commit-dirty=true | tail -4
echo "[$(date +%H:%M:%S)] done"
