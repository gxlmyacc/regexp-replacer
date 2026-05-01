import { spawnSync } from 'node:child_process';

/**
 * 同步执行命令并在失败时退出。
 *
 * @param cmd 可执行文件名。
 * @param args 参数数组。
 * @returns 无返回值。
 */
function run(cmd, args) {
  const useShell = process.platform === 'win32' && cmd.toLowerCase().endsWith('.cmd');
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: useShell });
  if (res.error) throw res.error;
  if (typeof res.status === 'number' && res.status !== 0) process.exit(res.status);
}

/**
 * 编译并运行 VS Code 扩展集成测试。
 *
 * @returns 无返回值。
 */
export function main() {
  run(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', ['compile:test:vscode']);
  run('node', ['./dist/test-vscode/test/vscode/runTest.js']);
}

main();

