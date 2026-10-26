#!/bin/sh
set -eu

upload_dir="${LOCAL_UPLOAD_DIR:-/app/local_uploads}"
mkdir -p "$upload_dir"
chown node:node "$upload_dir"

exec setpriv --reuid=node --regid=node --init-groups "$@"
