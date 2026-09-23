#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077

package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
plugin_dir="$HOME/SillyTavern/plugins/moli-server-wake"
frontend_file="$HOME/SillyTavern/public/scripts/extensions/third-party/fourth-wall-phone/src/server-wake/scope-selection.js"
if [[ ! -f "$plugin_dir/cedar-activate-local.js" || ! -f "$plugin_dir/data/community-wake-v1.json" ]] \
   || ! grep -Fq 'mcpTransitionTargetName' "$plugin_dir/index.js" \
   || ! grep -Fq 'mcpTransitionTargetName' "$frontend_file"; then
  printf '请先确认 v3 切换补丁已安装；未修改。\n' >&2
  exit 1
fi
backup_dir="$HOME/moli-extension-backups/cedar-pending-v4-$(date +%Y%m%d-%H%M%S)"
mkdir -p -- "$backup_dir"
cp -- "$plugin_dir/cedar-activate-local.js" "$backup_dir/cedar-activate-local.js"
cp -- "$package_dir/cedar-activate-local.js" "$plugin_dir/cedar-activate-local.js"
printf '旧 custom 会话结果归档补丁已安装；原工具备份：%s\n' "$backup_dir"
printf '服务器状态和待回注结果尚未改动。\n'
