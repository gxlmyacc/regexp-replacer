import { build } from 'esbuild';
import path from 'node:path';

/**
 * 将扩展端 TypeScript 代码打包为单文件（适配 vsce 发布）。
 *
 * @param options 构建选项。
 * @param options.minify 是否压缩输出（默认 false，便于调试）。
 * @returns 构建 Promise。
 */
async function bundleExtension(options = { minify: false }) {
  const entry = path.resolve('src/extension.ts');
  const outfile = path.resolve('dist/extension.js');

  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    sourcemap: false,
    minify: true,
    external: ['vscode'],
    target: ['node18'],
    logLevel: 'info',
  });
}

await bundleExtension({ minify: true });

