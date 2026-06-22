#!/usr/bin/env bash
# ============================================================================
# TOTENSTURM — install the recurring map-audit cron job (every 3 days).
#
#   bash tools/cron-setup.sh           # install
#   bash tools/cron-setup.sh --shots   # also regenerate screenshots each run
#   bash tools/cron-setup.sh --remove  # uninstall
#
# NOTE ON ENVIRONMENTS: a host crontab only persists on a long-lived machine.
# In an ephemeral/cloud dev container the container is reclaimed, so the cron
# won't survive — use your platform's SCHEDULED TRIGGER there instead (for
# Claude Code on the web, point a 3-day schedule at `npm run audit`, or at a
# review prompt that runs this + reads reports/map-audit-latest.md).
# ============================================================================
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node || echo /usr/bin/node)"
TAG="# totensturm-map-audit"

if [ "$1" = "--remove" ]; then
  ( crontab -l 2>/dev/null | grep -v "$TAG" ) | crontab - || true
  echo "Removed the map-audit cron job."
  exit 0
fi

CMD="cd $REPO && $NODE tools/map-audit.js >> reports/cron.log 2>&1"
[ "$1" = "--shots" ] && CMD="cd $REPO && $NODE tools/map-audit.js >> reports/cron.log 2>&1 && $NODE tools/shots.js >> reports/cron.log 2>&1"
# 09:00 every 3rd day of the month
LINE="0 9 */3 * * $CMD $TAG"

( crontab -l 2>/dev/null | grep -v "$TAG" ; echo "$LINE" ) | crontab -
echo "Installed map-audit cron (every 3 days at 09:00):"
echo "  $LINE"
echo "Reports land in $REPO/reports/  (latest: reports/map-audit-latest.md)"
