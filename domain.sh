#!/usr/bin/env bash
# One-time: serve the app at solring.ndex.us (Pages custom domain + proxied CNAME).
set -euo pipefail
T="$(cat ~/tmp/cftoken-pastrami.txt)"; ACCT="$(cat ~/tmp/cfaccountid.txt)"
A="https://api.cloudflare.com/client/v4"; H="Authorization: Bearer $T"
Z=$(curl -s -H "$H" "$A/zones?name=ndex.us" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"][0]["id"])')
curl -s -H "$H" -H 'content-type: application/json' -X POST "$A/accounts/$ACCT/pages/projects/solring/domains" \
  -d '{"name":"solring.ndex.us"}' | python3 -c 'import json,sys;d=json.load(sys.stdin);print("domain",d["success"],d.get("errors"))'
curl -s -H "$H" -H 'content-type: application/json' -X POST "$A/zones/$Z/dns_records" \
  -d '{"type":"CNAME","name":"solring","content":"solring.pages.dev","proxied":true}' | python3 -c 'import json,sys;d=json.load(sys.stdin);print("dns",d["success"],d.get("errors"))'
