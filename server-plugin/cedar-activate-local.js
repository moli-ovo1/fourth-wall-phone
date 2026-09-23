'use strict';

// One-time local migration from Cedar guest mode to the registered machine.
// Never print the token or send the registration result to moli.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createClient, findToken } = require('./cedar-register-local.js');

const EXPECTED_NAME = '程妄_moli';
const text = value => String(value ?? '').trim();

function latestResult(home = os.homedir()) {
  const candidates = fs.readdirSync(home).filter(name => /^\.moli-cedar-registration-/.test(name))
    .map(name => path.join(home, name, 'account-result.json')).filter(file => fs.existsSync(file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!candidates.length) throw new Error('找不到本机注册结果');
  return candidates[0];
}

function tokenEndpoint(resultFile) {
  const token = findToken(JSON.parse(fs.readFileSync(resultFile, 'utf8')));
  if (!/^[A-Za-z0-9_-]{12,}$/.test(token)) throw new Error('注册结果中没有可识别的 Token');
  return `https://toy.cedarstar.org/${token}`;
}

async function verifyAccount(endpoint, fetchImpl = fetch) {
  const client = createClient(endpoint, '', fetchImpl);
  await client.init();
  const profile = await client.callAccount({ action: 'get_profile' });
  const details = (Array.isArray(profile?.content) ? profile.content : [])
    .filter(item => item?.type === 'text').map(item => text(item.text)).join('\n');
  if (profile?.isError || !details.includes(EXPECTED_NAME)) throw new Error('Token 未能确认属于程妄_moli；未切换');
}

function migrateState(state) {
  if (!state?.profile && state?.mcpTransitionFrom && !state.mcpTransitionTargetName
      && (!Array.isArray(state.pending) || state.pending.length === 0))
    return { ...state, mcpTransitionTargetName: '程妄' };
  if (!state?.profile?.request) throw new Error('服务器尚无原人物快照；未切换');
  const prior = state.profile.request;
  if (text(prior.actorName) !== '程妄' && !text(prior.characterId).startsWith('custom:'))
    throw new Error('旧服务器人物既非程妄也非旧 custom 会话；未切换');
  if (state.profile.request.scopeKey !== 'global:phone') throw new Error('服务器尚未进入全局陪伴作用域；未切换');
  if (!state.profile.request.schedule?.externalWakeEnabled) throw new Error('当前未授权 MCP Wake；未切换');
  if (Array.isArray(state.pending) && state.pending.length) throw new Error('尚有待回注结果；未切换');
  if (state.mcpTransitionFrom) throw new Error('已有未完成的 MCP 切换；请先在 Via 完整刷新');
  const oldBinding = state.mcpBinding || prior.identity?.bindings?.[0] || null;
  return { ...state, mcpBinding: null, mcpTransitionFrom: oldBinding, mcpTransitionTargetName: '程妄',
    mcpConfigFingerprint: '', mcpCredentialFingerprint: '',
    profile: null, lastStatus: 'mcp-rebind-awaiting-browser' };
}

function writeActivation({ endpoint, envFile, stateFile, pluginFile }) {
  const source = fs.readFileSync(pluginFile, 'utf8');
  if (!source.includes('mcp-new-binding-required')) throw new Error('服务器补丁缺少新绑定保护；未切换');
  const current = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const next = migrateState(current);
  const previousEnv = fs.readFileSync(envFile, 'utf8');
  const backupDir = fs.mkdtempSync(path.join(path.dirname(envFile), '.moli-cedar-switch-backup-'));
  fs.chmodSync(backupDir, 0o700);
  fs.writeFileSync(path.join(backupDir, 'moli-server-wake.env'), previousEnv, { mode: 0o600 });
  fs.copyFileSync(stateFile, path.join(backupDir, 'community-wake-v1.json'));
  fs.chmodSync(path.join(backupDir, 'community-wake-v1.json'), 0o600);
  const escaped = `'${endpoint.replaceAll("'", "'\\''")}'`;
  const updatedEnv = previousEnv.replace(/^\s*export\s+MOLI_WAKE_MCP_URL=.*$/gm, '')
    .replace(/^\s*export\s+MOLI_WAKE_MCP_BEARER=.*$/gm, '')
    .trimEnd() + `\nexport MOLI_WAKE_MCP_URL=${escaped}\n`;
  const envTemp = `${envFile}.cedar.tmp`, stateTemp = `${stateFile}.cedar.tmp`;
  fs.writeFileSync(envTemp, updatedEnv, { mode: 0o600 });
  fs.writeFileSync(stateTemp, JSON.stringify(next), { mode: 0o600 });
  fs.renameSync(envTemp, envFile);
  fs.renameSync(stateTemp, stateFile);
  return backupDir;
}

async function serverRunning(fetchImpl = fetch) {
  try {
    await fetchImpl('http://127.0.0.1:8000/api/plugins/moli-server-wake/status',
      { signal: AbortSignal.timeout(2000) });
    return true;
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
      throw new Error('无法确认酒馆已停止；请先停止');
    return false;
  }
}

async function activate({ home = os.homedir(), fetchImpl = fetch } = {}) {
  const resultFile = latestResult(home);
  const endpoint = tokenEndpoint(resultFile);
  await verifyAccount(endpoint, fetchImpl);
  if (await serverRunning(fetchImpl)) throw new Error('酒馆仍在运行；先在启动它的 Termux 窗口按 Ctrl+C');
  const envFile = path.join(home, '.moli-server-wake.env');
  const pluginDir = path.join(home, 'SillyTavern', 'plugins', 'moli-server-wake');
  const backupDir = writeActivation({ endpoint, envFile,
    stateFile: path.join(pluginDir, 'data', 'community-wake-v1.json'),
    pluginFile: path.join(pluginDir, 'index.js') });
  return { backupDir };
}

async function prepare({ home = os.homedir(), fetchImpl = fetch } = {}) {
  const resultFile = latestResult(home);
  const endpoint = tokenEndpoint(resultFile);
  await verifyAccount(endpoint, fetchImpl);
  const urlFile = path.join(path.dirname(resultFile), 'mcp-url.txt');
  fs.writeFileSync(urlFile, `${endpoint}\n`, { mode: 0o600 });
  fs.chmodSync(urlFile, 0o600);
  return { urlFile };
}

async function main() {
  try {
    if (process.argv[2] === 'prepare') {
      const result = await prepare();
      process.stdout.write(`已核对程妄_moli；私密 MCP 地址文件：${result.urlFile}\n`);
      process.stdout.write('请将此地址粘贴到 moli 中原有的 CEDAR TOY MCP 项并保存，切勿截图。\n');
    } else {
      const result = await activate();
      process.stdout.write(`已核对程妄_moli并切换手机本地服务器配置；备份目录：${result.backupDir}\n`);
      process.stdout.write('现在启动酒馆，并在 Via 完整刷新，让新的 MCP 绑定同步。\n');
    }
  } catch (error) {
    process.stderr.write(`${text(error?.message).replace(/https?:\/\/[^\s"'<>]+/g, '[地址已隐藏]').slice(0, 250)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
module.exports = { latestResult, tokenEndpoint, verifyAccount, migrateState, writeActivation, activate, prepare };
