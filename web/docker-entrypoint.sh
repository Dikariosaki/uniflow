#!/bin/sh
set -eu
api_base_url="${API_BASE_URL:-/api}"
case "$api_base_url" in
  http://*|https://*)
    api_base_url="${api_base_url%/}"
    case "$api_base_url" in
      */api) ;;
      *) api_base_url="${api_base_url}/api" ;;
    esac
    ;;
esac
export API_BASE_URL="$api_base_url"
envsubst '${API_BASE_URL} ${SUPABASE_URL} ${SUPABASE_ANON_KEY}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js
rm /usr/share/nginx/html/config.template.js
