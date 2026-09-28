#!/bin/bash
set -e

# The project's warehouse credentials are encrypted with LIGHTDASH_SECRET and
# point at 127.0.0.1:5532, which was a socat sidecar on the laptop. Rather than
# decrypt and rewrite them for every new host, keep the address true: forward
# 127.0.0.1:5532 to wherever the warehouse actually lives now.
#
#   WAREHOUSE_PROXY_TARGET=my-pg.internal:5432
if [ -n "${WAREHOUSE_PROXY_TARGET}" ]; then
  echo "Forwarding 127.0.0.1:5532 to ${WAREHOUSE_PROXY_TARGET}"
  socat TCP-LISTEN:5532,fork,reuseaddr,bind=127.0.0.1 "TCP:${WAREHOUSE_PROXY_TARGET}" &
fi

exec /usr/bin/prod-entrypoint.sh "$@"
