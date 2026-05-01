import * as path from 'node:path';
import Mocha from 'mocha';
import { glob } from 'glob';

/**
 * Node 侧单元测试入口：不启动 VS Code，仅对纯函数/模块做快速回归。
 *
 * @returns 无返回值。
 */
export async function main(): Promise<void> {
  const runner = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 30_000,
  });

  const root = path.resolve(__dirname);
  const files = await glob('**/*.test.js', { cwd: root });
  for (const f of files) runner.addFile(path.resolve(root, f));

  await new Promise<void>((resolve, reject) => {
    runner.run((failures: number) => {
      if (failures > 0) reject(new Error(`${failures} tests failed.`));
      else resolve();
    });
  });
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

