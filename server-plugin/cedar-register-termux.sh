#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
env_file="$HOME/.moli-server-wake.env"
if [[ ! -f "$env_file" ]]; then
  printf '找不到手机本地的 moli MCP 配置。\n' >&2
  exit 1
fi
source "$env_file"
if [[ -z "${MOLI_WAKE_MCP_URL:-}" ]]; then
  printf '尚未设置 MCP 地址。\n' >&2
  exit 1
fi

printf '本操作只注册一个 CEDAR TOY 小机账号；不会修改正在运行的 moli 或 MCP 配置。\n'
printf '用户名（直接回车使用「程妄」）：'
IFS= read -r username
username="${username:-程妄}"
printf '请为该账号设置密码，输入时不会显示。请另行妥善保存密码。\n密码：'
IFS= read -r -s password
printf '\n再次输入密码：'
IFS= read -r -s password_again
printf '\n'
if [[ "$password" != "$password_again" ]]; then
  printf '两次密码不一致；没有发送注册请求。\n' >&2
  exit 1
fi
unset password_again
printf '%s\n%s\n' "$username" "$password" | node "$script_dir/cedar-register-local.js"
unset password username
