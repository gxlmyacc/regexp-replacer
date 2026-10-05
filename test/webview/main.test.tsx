import { expect, test, vi } from 'vitest';
const render = vi.fn();
vi.mock('react-dom', () => ({ render }));
vi.mock('../../webview/src/App', () => ({ App: () => null }));
test('入口仅在挂载点存在时渲染', async () => {
  vi.resetModules(); document.body.innerHTML = ''; await import('../../webview/src/main'); expect(render).not.toHaveBeenCalled();
  vi.resetModules(); document.body.innerHTML = '<div id="root"></div>'; await import('../../webview/src/main');
  expect(render).toHaveBeenCalledOnce(); expect(render.mock.lastCall?.[1]).toBe(document.getElementById('root')); document.body.innerHTML = '';
});
