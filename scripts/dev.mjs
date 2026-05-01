import { spawn } from 'node:child_process';
import net from 'node:net';

const YARN_BIN = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';

/**
 * 启动一个子进程，并把 stdout/stderr 透传到当前终端。
 *
 * @param {string} title 子进程显示名称（用于日志区分）。
 * @param {string} command 可执行命令（如 yarn）。
 * @param {string[]} args 命令参数。
 * @returns {{ child: import('node:child_process').ChildProcess, kill: () => void }} 子进程与 kill 方法。
 */
function startProcess(title, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      // 标记 webview 走开发模式（RegExp UI 直接加载本地 Vite 页面）
      REGEXP_REPLACER_WEBVIEW_DEV: '1',
    },
  });

  const kill = () => {
    try {
      child.kill();
    } catch {
      // ignore
    }
  };

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[dev] ${title} exited with code ${code}`);
      process.exit(code);
    }
  });

  return { child, kill };
}

/**
 * 检查端口是否“正在被占用”（尝试连接到 127.0.0.1 / ::1）。
 *
 * @param {number} port 端口号。
 * @returns {Promise<boolean>} 是否被占用。
 */
async function isPortInUse(port) {
  const tryConnect = async (host) =>
    await new Promise((resolve) => {
      const sock = net.connect({ host, port });
      const done = (v) => {
        try {
          sock.destroy();
        } catch {
          // ignore
        }
        resolve(v);
      };
      sock.setTimeout(300);
      sock.once('connect', () => done(true));
      sock.once('timeout', () => done(false));
      sock.once('error', () => done(false));
    });

  const v4 = await tryConnect('127.0.0.1');
  if (v4) return true;
  const v6 = await tryConnect('::1');
  return Boolean(v6);
}

/**
 * 从给定端口开始，自动寻找一个可用端口（避免交互式输入导致 yarn dev 卡住）。
 *
 * @param {number} startPort 起始端口。
 * @param {number} maxTries 最大尝试次数。
 * @returns {Promise<number>} 可用端口号。
 */
async function findFreePort(startPort, maxTries) {
  const base = Number.isFinite(startPort) ? startPort : 5173;
  const tries = Number.isFinite(maxTries) ? maxTries : 20;
  for (let i = 0; i < tries; i += 1) {
    const p = base + i;
    if (p < 1 || p > 65535) continue;
    // eslint-disable-next-line no-await-in-loop
    if (!(await isPortInUse(p))) return p;
  }
  return base;
}

/**
 * 并行启动 extension watch 与 webview dev server，用于本地调试。
 *
 * @returns {void} 无返回值。
 */
async function main() {
  const defaultPort = Number.parseInt(process.env.REGEXP_REPLACER_WEBVIEW_DEV_PORT ?? '5173', 10) || 5173;
  const port = await findFreePort(defaultPort, 20);
  if (port !== defaultPort) console.log(`[dev] 端口 ${defaultPort} 已被占用，自动切换为 ${port}。`);

  // 让扩展侧 webview dev 模式按该端口加载
  process.env.REGEXP_REPLACER_WEBVIEW_DEV_ORIGIN = `http://localhost:${port}`;

  const procs = [startProcess('extension:watch', YARN_BIN, ['watch'])];

  // 启动 webview dev，并强制使用指定端口（被占用时会在前面提示用户重新输入）
  procs.push(
    startProcess('webview:dev', YARN_BIN, ['dev:webview', '--', '--port', String(port), '--strictPort']),
  );

  const shutdown = () => {
    for (const p of procs) p.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();

