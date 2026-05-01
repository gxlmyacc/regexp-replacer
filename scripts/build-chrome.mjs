import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const YARN_BIN = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';

/**
 * 启动一个子进程并等待其结束，将输出透传到当前终端。
 *
 * @param {string} title 子进程标题（用于日志定位）。
 * @param {string} command 可执行命令（如 yarn）。
 * @param {string[]} args 命令参数数组。
 * @returns {Promise<void>} 无返回值（子进程失败将抛错并退出）。
 */
async function runProcess(title, command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true, env: process.env });

    child.on('error', (err) => reject(err));
    child.on('exit', (code) => {
      if (!code || code === 0) return resolve();
      reject(new Error(`[build:chrome] ${title} exited with code ${code}`));
    });
  });
}

/**
 * 读取 JSON 文件并解析。
 *
 * @param {string} jsonPath JSON 文件路径。
 * @returns {Promise<any>} 解析后的对象。
 */
async function readJson(jsonPath) {
  const raw = await fs.readFile(jsonPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * 判断文件/目录是否存在。
 *
 * @param {string} p 绝对路径或相对路径。
 * @returns {Promise<boolean>} 是否存在。
 */
async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * 复制文件到目标位置，并自动创建父目录。
 *
 * @param {string} src 源文件路径。
 * @param {string} dest 目标文件路径。
 * @returns {Promise<void>} 无返回值。
 */
async function copyFileEnsured(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

/**
 * 复制目录到目标位置（递归覆盖）。
 *
 * @param {string} srcDir 源目录路径。
 * @param {string} destDir 目标目录路径。
 * @returns {Promise<void>} 无返回值。
 */
async function copyDirEnsured(srcDir, destDir) {
  await fs.mkdir(path.dirname(destDir), { recursive: true });
  await fs.cp(srcDir, destDir, { recursive: true, force: true });
}

/**
 * 构建 Chrome 扩展的 UI 资源，并把扩展运行所需文件同步到 release 目录，生成完整可打包的扩展包目录。
 *
 * 产物结构：
 * - release/chrome-extension/manifest.json
 * - release/chrome-extension/background.js
 * - release/chrome-extension/ui/**（由 Vite 输出）
 * - release/chrome-extension/icon/**（如存在）
 *
 * @returns {Promise<void>} 无返回值。
 */
async function main() {
  const repoRoot = process.cwd();

  const srcRoot = path.resolve(repoRoot, 'chrome-extension');

  const manifestSrc = path.resolve(srcRoot, 'manifest.json');
  const backgroundSrc = path.resolve(srcRoot, 'background.js');
  const iconDirSrc = path.resolve(repoRoot, 'icon');
  const iconPngSrc = path.resolve(iconDirSrc, 'favicon.png');

  if (!(await pathExists(manifestSrc))) {
    throw new Error(`[build:chrome] 缺少扩展清单：${manifestSrc}`);
  }
  if (!(await pathExists(backgroundSrc))) {
    throw new Error(`[build:chrome] 缺少后台脚本：${backgroundSrc}`);
  }

  const manifest = await readJson(manifestSrc);
  const version = String(manifest?.version || '').trim();
  if (!version) {
    throw new Error(`[build:chrome] manifest.json 缺少 version 字段：${manifestSrc}`);
  }

  const releaseDirName = `chrome-extension-v${version}`;
  const releaseRoot = path.resolve(repoRoot, 'release', releaseDirName);

  // 1) 构建 UI 到 release/<chrome-extension-vX.Y.Z>/ui
  process.env.REGEXP_REPLACER_CHROME_RELEASE_DIR = releaseDirName;
  await runProcess('vite build (chrome ui)', YARN_BIN, ['vite', 'build', '-c', 'webview/vite.chrome.config.ts']);

  // 2) 同步扩展运行所需文件到 release/<chrome-extension-vX.Y.Z>
  await fs.mkdir(releaseRoot, { recursive: true });
  await copyFileEnsured(manifestSrc, path.resolve(releaseRoot, 'manifest.json'));
  await copyFileEnsured(backgroundSrc, path.resolve(releaseRoot, 'background.js'));

  // 3) 同步图标（manifest 当前引用 icon/favicon.png，缺失会导致扩展不可用）
  if (await pathExists(iconDirSrc)) {
    await copyDirEnsured(iconDirSrc, path.resolve(releaseRoot, 'icon'));
  }

  const uiIndex = path.resolve(releaseRoot, 'ui', 'index.html');
  if (!(await pathExists(uiIndex))) {
    throw new Error(
      `[build:chrome] UI 构建产物不完整：未找到 ${uiIndex}。请检查 webview/vite.chrome.config.ts 的 outDir 配置。`,
    );
  }

  if (!(await pathExists(iconPngSrc))) {
    throw new Error(
      `[build:chrome] 缺少图标文件：${iconPngSrc}。manifest.json 引用了 icon/favicon.png，请补齐 icon 目录后再构建。`,
    );
  }

  console.log(`[build:chrome] done: ${releaseRoot}`);
}

await main();
