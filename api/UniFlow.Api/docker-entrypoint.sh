#!/bin/sh
set -eu

port="${PORT:-8080}"
export ASPNETCORE_URLS="http://0.0.0.0:${port}"

exec dotnet UniFlow.Api.dll
