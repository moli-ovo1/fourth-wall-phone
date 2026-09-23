#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077

package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
st_dir="${ST_DIR:-$HOME/SillyTavern}"
plugin_dir="$st_dir/plugins/moli-server-wake"
extension_dir="$st_dir/public/scripts/extensions/third-party/fourth-wall-phone"
frontend_file="$extension_dir/src/server-wake/scope-selection.js"
if [[ ! -f "$plugin_dir/index.js" || ! -f "$plugin_dir/data/community-wake-v1.json" || ! -f "$frontend_file" ]]; then
  printf '找不到已安装的 moli 插件、前端或服务器绑定记录；未修改。\n' >&2
  exit 1
fi
backup_dir="$HOME/moli-extension-backups/cedar-rebind-$(date +%Y%m%d-%H%M%S)"
mkdir -p -- "$backup_dir"
cp -- "$plugin_dir/index.js" "$backup_dir/index.js"
cp -- "$plugin_dir/cedar-activate-local.js" "$backup_dir/cedar-activate-local.js"
cp -- "$frontend_file" "$backup_dir/scope-selection.js"
cp -- "$package_dir/index.js" "$plugin_dir/index.js"
cp -- "$package_dir/cedar-activate-local.js" "$plugin_dir/cedar-activate-local.js"
cp -- "$package_dir/scope-selection.js" "$frontend_file"
printf '旧会话到程妄的切换补丁已安装；备份：%s\n' "$backup_dir"
printf '尚未改动注册结果、MCP 地址或角色绑定。\n'
