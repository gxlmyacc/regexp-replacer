import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const YARN_BIN = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';

/**
 * 同步执行一条命令并在失败时抛错。
 *
 * @param cmd 可执行文件名，例如 npm/node。
 * @param args 参数数组。
 * @param cwd 工作目录（可选）。
 * @returns 无返回值。
 */
function run(cmd, args, cwd) {
  const useShell = process.platform === 'win32' && cmd.toLowerCase().endsWith('.cmd');
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: useShell,
  });

  if (res.error) throw res.error;
  if (typeof res.status === 'number' && res.status !== 0) {
    throw new Error(`命令执行失败：${cmd} ${args.join(' ')}（exit=${res.status}）`);
  }
}

/**
 * VS Code 扩展发布前构建：先构建 webview，再 bundle 扩展宿主代码。
 *
 * @returns 无返回值。
 */
export function main() {
  // 打包前确保 dist-webview 干净，避免残留旧 chunk 导致 VSIX 体积膨胀。
  const distWebviewDir = path.resolve(process.cwd(), 'dist-webview');
  try {
    fs.rmSync(distWebviewDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  run(YARN_BIN, ['build:webview']);
  run('node', ['./scripts/bundle-extension.mjs']);
}

main();

