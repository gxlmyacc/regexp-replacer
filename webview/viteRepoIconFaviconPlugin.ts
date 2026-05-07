import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** 扩展与 Chrome 构建共用的 PNG 图标（仓库根目录 `icon/favicon.png`）。 */
export const repoIconFaviconFsPath = path.resolve(__dirname, '..', 'icon', 'favicon.png');

/**
 * 开发时在 dev server 提供 `/favicon.png`，构建结束时将其复制到产物根目录，与 `icon/favicon.png` 保持同源。
 *
 * 无入参。
 *
 * @returns Vite 插件对象。
 */
export function repoIconFaviconPlugin(): Plugin {
  let buildOutDirAbs = '';

  return {
    name: 'repo-icon-favicon',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (pathname !== '/favicon.png') {
          next();
          return;
        }
        fs.stat(repoIconFaviconFsPath, (err, st) => {
          if (err || !st.isFile()) {
            next();
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-cache');
          fs.createReadStream(repoIconFaviconFsPath).pipe(res);
        });
      });
    },
    configResolved(config) {
      buildOutDirAbs = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!fs.existsSync(repoIconFaviconFsPath)) return;
      fs.copyFileSync(repoIconFaviconFsPath, path.join(buildOutDirAbs, 'favicon.png'));
    },
  };
}
