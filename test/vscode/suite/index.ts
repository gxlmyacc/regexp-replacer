import * as path from 'node:path';
import * as fs from 'node:fs';
import Module from 'node:module';

/**
 * 加载 Mocha 构造器：优先按常规模块解析加载；若在扩展宿主环境下解析失败，则回退到基于绝对路径加载。
 *
 * @returns Mocha 构造器。
 */
function loadMocha(): typeof import('mocha') {
  // 扩展宿主环境下，subst/junction 等路径可能导致依赖解析不稳定；
  // 这里显式把 repoRoot/node_modules 加到全局搜索路径，避免 mocha 的依赖（如 escape-string-regexp）解析失败。
  const repoRoot = path.resolve(__dirname, '../../../../../');
  const repoNodeModules = path.join(repoRoot, 'node_modules');
  try {
    const prev = process.env.NODE_PATH ?? '';
    const parts = prev ? prev.split(path.delimiter) : [];
    if (!parts.includes(repoNodeModules)) {
      process.env.NODE_PATH = [...parts, repoNodeModules].filter(Boolean).join(path.delimiter);
      // 重新初始化全局路径（影响 Module.globalPaths）
      (Module as unknown as { _initPaths?: () => void })._initPaths?.();
    }
  } catch {
    // ignore
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mocha') as typeof import('mocha');
  } catch {
    // dist/test-vscode/test/vscode/suite -> repoRoot/node_modules/mocha
    const abs = path.join(repoRoot, 'node_modules', 'mocha');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(abs) as typeof import('mocha');
  }
}

/**
 * 递归收集目录下的所有 `*.test.js` 文件（替代 glob 依赖，避免扩展宿主环境下模块解析不稳定）。
 *
 * @param root 根目录。
 * @returns 测试文件绝对路径列表。
 */
function collectTestFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop() as string;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile() && ent.name.endsWith('.test.js')) out.push(full);
    }
  }
  return out;
}

/**
 * 加载并运行扩展测试用例（Mocha）。
 *
 * @returns 无返回值。
 */
export async function run(): Promise<void> {
  const Mocha = loadMocha();
  const runner = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60_000,
  });

  const testsRoot = path.resolve(__dirname);
  const files = collectTestFiles(testsRoot);
  for (const f of files) runner.addFile(f);

  await new Promise<void>((resolve, reject) => {
    runner.run((failures: number) => {
      if (failures > 0) reject(new Error(`${failures} tests failed.`));
      else resolve();
    });
  });
}

