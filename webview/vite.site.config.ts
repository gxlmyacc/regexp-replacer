import path from 'node:path';
import { mergeConfig } from 'vite';
import chromeConfig from './vite.chrome.config';

/** 网站复用 Chrome UI 构建，只将静态产物输出到独立目录。 */
export default mergeConfig(chromeConfig, {
  build: {
    outDir: path.resolve(__dirname, '..', 'dist-site'),
  },
});
