import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../../webview/src/utils/storage', () => {
  return {
    readStoredLeftPanelCollapsed: vi.fn(() => false),
    readStoredSplitterToggleArrowVisible: vi.fn(() => true),
    persistLeftPanelCollapsed: vi.fn(),
  };
});

import { persistLeftPanelCollapsed } from '../../webview/src/utils/storage';
import { useLayoutPersistence } from '../../webview/src/features/app/layout/layoutPersistence';

function tick(): Promise<void> {
  return new Promise((r) => window.setTimeout(r, 0));
}

describe('layoutPersistence', () => {
  test('useLayoutPersistence：setLeftCollapsedAndPersist 会写入持久化', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    function Harness(): React.ReactElement {
      const { leftCollapsed, showSplitterToggleArrow, setLeftCollapsedAndPersist } = useLayoutPersistence();
      useEffect(() => {
        expect(leftCollapsed).toBe(false);
        expect(showSplitterToggleArrow).toBe(true);
        setLeftCollapsedAndPersist(true);
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(persistLeftPanelCollapsed).toHaveBeenCalledWith(true);

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });
});

