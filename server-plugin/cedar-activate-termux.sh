#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077

package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
plugin_dir="$HOME/SillyTavern/plugins/moli-server-wake"
if [[ ! -f "$plugin_dir/index.js" || ! -f "$plugin_dir/data/community-wake-v1.json" ]]; then
  printf '找不到已安装的服务器插件或绑定记录；未修改。\n' >&2
  exit 1
fi
if ! grep -Fq 'mcpCredentialFingerprint' "$plugin_dir/index.js"; then
  printf '现有服务器版本不匹配；未修改。\n' >&2
  exit 1
fi
backup_dir="$HOME/moli-extension-backups/cedar-activation-$(date +%Y%m%d-%H%M%S)"
mkdir -p -- "$backup_dir"
cp -- "$plugin_dir/index.js" "$backup_dir/index.js"
for file in index.js cedar-register-local.js cedar-activate-local.js; do
  cp -- "$package_dir/$file" "$plugin_dir/$file"
done
printf '切换工具已安装；旧服务器文件备份：%s\n' "$backup_dir"
printf '注册结果与现有配置均未改变。\n'
