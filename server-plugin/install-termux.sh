#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$script_dir/moli-extension/manifest.json" ]]; then
  package_dir="$script_dir"
else
  package_dir="$(cd -- "$script_dir/.." && pwd)"
fi
st_dir="${ST_DIR:-$HOME/SillyTavern}"
extension_base="$st_dir/public/scripts/extensions/third-party"
plugin_dir="$st_dir/plugins/moli-server-wake"

if [[ ! -f "$st_dir/server.js" || ! -f "$st_dir/config.yaml" ]]; then
  printf '找不到 SillyTavern：%s\n请先设置 ST_DIR 再运行本脚本。\n' "$st_dir" >&2
  exit 1
fi
if [[ ! -f "$package_dir/moli-extension/manifest.json" || ! -f "$package_dir/moli-server-wake/index.js" ]]; then
  printf '安装包不完整；请完整解压 ZIP 后再运行。\n' >&2
  exit 1
fi

matches=()
for manifest in "$extension_base"/*/manifest.json; do
  [[ -f "$manifest" ]] || continue
  if grep -Fq 'https://github.com/moli-ovo1/fourth-wall-phone' "$manifest"; then
    matches+=("$(dirname -- "$manifest")")
  fi
done
if (( ${#matches[@]} != 1 )); then
  printf '找到 %s 个 moli 前端目录，预期只有 1 个。请不要猜目录；先确认当前扩展安装。\n' "${#matches[@]}" >&2
  exit 1
fi
extension_dir="${matches[0]}"

printf '将安装到：\n前端 %s\n服务器插件 %s\n' "$extension_dir" "$plugin_dir"
read -r -p 'Provider 地址 [https://api.yuyanjia.top/v1]: ' base_url
base_url="${base_url:-https://api.yuyanjia.top/v1}"
read -r -p '模型 [[ais]gemini-3.1-pro-preview]: ' model
model="${model:-[ais]gemini-3.1-pro-preview}"
if [[ ! "$base_url" =~ ^https:// ]]; then
  printf 'Provider 地址必须以 https:// 开头。\n' >&2
  exit 1
fi
printf '请在手机本地输入 API Key（输入时不显示）：'
IFS= read -r -s api_key
printf '\n'
if [[ -z "$api_key" ]]; then
  printf '没有输入 API Key，安装未开始。\n' >&2
  exit 1
fi

umask 077
backup_root="$HOME/moli-extension-backups"
mkdir -p -- "$backup_root"
backup="$backup_root/$(basename -- "$extension_dir").pre-server-wake-$(date +%Y%m%d-%H%M%S)"
cp -a -- "$extension_dir" "$backup"
config_backup="${st_dir}/config.yaml.pre-server-wake-$(date +%Y%m%d-%H%M%S)"
cp -p -- "$st_dir/config.yaml" "$config_backup"
cp -a -- "$package_dir/moli-extension/." "$extension_dir/"
mkdir -p -- "$plugin_dir"
cp -- "$package_dir/moli-server-wake/index.js" "$package_dir/moli-server-wake/package.json" "$package_dir/moli-server-wake/README.md" "$plugin_dir/"

if grep -Eq '^[[:space:]]*enableServerPlugins:' "$st_dir/config.yaml"; then
  sed -i 's/^[[:space:]]*enableServerPlugins:[[:space:]]*false[[:space:]]*$/enableServerPlugins: true/' "$st_dir/config.yaml"
else
  printf '\nenableServerPlugins: true\n' >> "$st_dir/config.yaml"
fi
if ! grep -Eq '^[[:space:]]*enableServerPlugins:[[:space:]]*true[[:space:]]*$' "$st_dir/config.yaml"; then
  printf '无法启用 server plugin，请检查 config.yaml。\n' >&2
  exit 1
fi

env_file="$HOME/.moli-server-wake.env"
{
  printf 'export ST_DIR=%q\n' "$st_dir"
  printf 'export MOLI_WAKE_BASE_URL=%q\n' "$base_url"
  printf 'export MOLI_WAKE_MODEL=%q\n' "$model"
  printf 'export MOLI_WAKE_API_KEY=%q\n' "$api_key"
} > "$env_file"
chmod 600 -- "$env_file"
unset api_key

launcher="$HOME/start-moli-server-wake.sh"
cat > "$launcher" <<'LAUNCHER'
#!/data/data/com.termux/files/usr/bin/bash
set -e
source "$HOME/.moli-server-wake.env"
cd "$ST_DIR"
exec bash start.sh
LAUNCHER
chmod 700 -- "$launcher"

printf '\n文件已安装。旧前端备份：%s\n配置备份：%s\n' "$backup" "$config_backup"
printf '现在停止旧 SillyTavern 进程（Termux 中按 Ctrl+C），再运行：\n  bash ~/start-moli-server-wake.sh\n'
printf '重启后在浏览器打开 http://127.0.0.1:8000/api/plugins/moli-server-wake/status，检查 ready 是否为 true。\n'
