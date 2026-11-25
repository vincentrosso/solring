#!/usr/bin/env bash
# One-time per name: serve the app at <name>.ndex.us (Pages custom domain + proxied CNAME).
# Usage: domain.sh beatrix      (the Pages project keeps its original name, solring)
set -euo pipefail
N="${1:?name, e.g. beatrix}"
T="$(cat ~/tmp/cftoken-pastrami.txt)"; ACCT="$(cat ~/tmp/cfaccountid.txt)"
A="https://api.cloudflare.com/client/v4"; H="Authorization: Bearer $T"
Z=$(curl -s -H "$H" "$A/zones?name=ndex.us" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"][0]["id"])')
curl -s -H "$H" -H 'content-type: application/json' -X POST "$A/accounts/$ACCT/pages/projects/solring/domains" \
  -d "{\"name\":\"$N.ndex.us\"}" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("domain",d["success"],d.get("errors"))'
curl -s -H "$H" -H 'content-type: application/json' -X POST "$A/zones/$Z/dns_records" \
  -d "{\"type\":\"CNAME\",\"name\":\"$N\",\"content\":\"solring.pages.dev\",\"proxied\":true}" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("dns",d["success"],d.get("errors"))'
