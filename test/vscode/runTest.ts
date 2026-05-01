import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runTests } from '@vscode/test-electron';

/**
 * VS Code 扩展测试入口：启动测试版 VS Code，并加载测试套件运行。
 *
 * @returns 无返回值。
 */
export async function main(): Promise<void> {
  try {
    const repoRoot = path.resolve(process.cwd());
    const realExtensionDevelopmentPath = repoRoot;
    const extensionTestsPathFromDist = path.resolve(repoRoot, 'dist', 'test-vscode', 'test', 'vscode', 'suite', 'index');

    /**
     * 获取一个用于测试的临时工作区目录（避免路径包含空格导致的启动参数解析问题）。
     *
     * @returns 临时工作区绝对路径。
     */
    function getTempWorkspacePath(): string {
      const dir = path.join(os.tmpdir(), 'regexp-replacer-vscode-test-workspace');
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    }

    /**
     * 为扩展开发目录创建一个“无空格路径”的映射，规避启动参数解析把空格截断的问题。
     *
     * @param target 真实扩展目录。
     * @returns 可用于启动参数的目录路径（尽量无空格）。
     */
    function getNoSpaceExtensionPath(target: string): string {
      try {
        // 方案 1：优先在同盘创建 junction（无空格路径、且不依赖虚拟盘符）
        try {
          const parent = path.dirname(target);
          const link = path.join(parent, 'regexp-replacer-ext-link');
          try {
            fs.rmSync(link, { recursive: true, force: true });
          } catch {
            // ignore
          }
          fs.symlinkSync(target, link, 'junction');
          return link;
        } catch {
          // ignore
        }

        // 方案 2：回退到 subst（参数数组传递可正确处理空格路径）
        const drive = 'R:';
        try {
          execFileSync('subst', [drive, '/D'], { stdio: 'ignore' });
        } catch {
          // ignore
        }
        execFileSync('subst', [drive, target], { stdio: 'ignore' });
        return `${drive}\\`;
      } catch {
        return target;
      }
    }

    /**
     * 获取无空格的测试入口路径（避免参数解析把空格截断）。
     *
     * @param noSpaceExtPath 无空格的扩展目录。
     * @returns 可用于 --extensionTestsPath 的入口路径。
     */
    function getNoSpaceTestsPath(noSpaceExtPath: string): string {
      // dist/test-vscode/test/vscode/suite/index.js
      return path.join(noSpaceExtPath, 'dist', 'test-vscode', 'test', 'vscode', 'suite', 'index');
    }

    const noSpaceExtPath = getNoSpaceExtensionPath(realExtensionDevelopmentPath);
    // eslint-disable-next-line no-console
    console.log('[test:vscode] extensionDevelopmentPath =', noSpaceExtPath);
    await runTests({
      extensionDevelopmentPath: noSpaceExtPath,
      extensionTestsPath:
        noSpaceExtPath === realExtensionDevelopmentPath ? extensionTestsPathFromDist : getNoSpaceTestsPath(noSpaceExtPath),
      launchArgs: [getTempWorkspacePath(), '--disable-extensions'],
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

void main();

