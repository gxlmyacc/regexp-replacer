import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const VSCE_CLI = path.resolve(process.cwd(), 'node_modules', '@vscode', 'vsce', 'vsce');

/**
 * 同步执行命令并将输出透传到当前终端。
 *
 * @param cmd 可执行文件名。
 * @param args 参数数组。
 * @returns 无返回值。
 */
function run(cmd, args) {
  /**
   * 将参数按 Windows CMD 规则做最小转义（主要处理空格与双引号）。
   *
   * @param s 参数值。
   * @returns 可安全拼接到 cmd /c 的参数字符串。
   */
  function quoteForCmd(s) {
    if (s === '') return '""';
    const needsQuote = /[\s"]/g.test(s);
    if (!needsQuote) return s;
    return `"${s.replaceAll('"', '""')}"`;
  }

  const isCmd = process.platform === 'win32' && cmd.toLowerCase().endsWith('.cmd');
  const res = isCmd
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${quoteForCmd(cmd)} ${args.map(quoteForCmd).join(' ')}`], {
        stdio: 'inherit',
        shell: false,
      })
    : spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (res.error) throw res.error;
  if (typeof res.status === 'number' && res.status !== 0) process.exit(res.status);
}

/**
 * 一键打包 VSIX：执行发布前构建，然后调用 vsce 打包。
 *
 * @returns 无返回值。
 */
export function main() {
  /**
   * 读取根 package.json 的 name/version，并生成默认输出文件名。
   *
   * @returns 输出文件绝对路径。
   */
  function getVsixOutPath() {
    const pkgJsonPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const name = String(pkg.name ?? 'extension');
    const version = String(pkg.version ?? '0.0.0');

    const releaseDir = path.resolve(process.cwd(), 'release');
    fs.mkdirSync(releaseDir, { recursive: true });
    return path.join(releaseDir, `${name}-${version}.vsix`);
  }

  run('node', [VSCE_CLI, 'package', '--yarn', '--out', getVsixOutPath()]);
}

main();

