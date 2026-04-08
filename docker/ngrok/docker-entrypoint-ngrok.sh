#!/bin/sh
# ngrok entrypoint — generates a traffic-policy file for basic-auth at runtime.
#
# Why not --basic-auth?
#   Flag was deprecated in ngrok v3 in favour of traffic policies.
#   --traffic-policy-file is the current recommended way.
#
# Environment variables expected (provided via env_file: .env.ngrok):
#   NGROK_AUTHTOKEN  — ngrok account auth token (required)
#   NGROK_BASIC_AUTH — credentials in "username:password" format (required)
set -e

if [ -z "${NGROK_AUTHTOKEN}" ]; then
  echo "[ngrok-entrypoint] ERROR: NGROK_AUTHTOKEN is not set. Exiting." >&2
  exit 1
fi

if [ -z "${NGROK_BASIC_AUTH}" ]; then
  echo "[ngrok-entrypoint] ERROR: NGROK_BASIC_AUTH is not set. Exiting." >&2
  exit 1
fi

if [ -z "${NGROK_DOMAIN}" ]; then
  echo "[ngrok-entrypoint] ERROR: NGROK_DOMAIN is not set. Exiting." >&2
  exit 1
fi

# Write the traffic policy to a temp file so special characters in the
# credentials (#, @, !) are never misinterpreted by the shell.
#
# expressions condition:
#   Apply basic-auth ONLY when Sec-Fetch-Mode is "navigate" (real browser
#   page load) OR when the header is absent (old browsers without Fetch Metadata).
#   This skips the challenge for all JavaScript fetch() / XHR calls
#   (Sec-Fetch-Mode: cors | no-cors | same-origin | websocket), so Next.js
#   RSC data fetches, API calls and Socket.IO upgrades are never blocked,
#   preventing repeated credential prompts during in-app navigation.
POLICY_FILE="/tmp/ngrok-policy.yml"
cat > "${POLICY_FILE}" << EOF
inbound:
  - expressions:
      - "!('sec-fetch-mode' in req.headers) || 'navigate' in req.headers['sec-fetch-mode']"
    actions:
      - type: basic-auth
        config:
          credentials:
            - "${NGROK_BASIC_AUTH}"
EOF

echo "[ngrok-entrypoint] Starting tunnel → traefik:8081 (${NGROK_DOMAIN}) with basic-auth enforced"
exec ngrok http traefik:8081 \
  --url "${NGROK_DOMAIN}" \
  --traffic-policy-file "${POLICY_FILE}" \
  --log=stdout
