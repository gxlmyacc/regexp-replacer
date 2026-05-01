import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { useCommandSelection } from '../../webview/src/features/app/commands/selection';

function tick(): Promise<void> {
  return new Promise((r) => window.setTimeout(r, 0));
}

describe('commandSelection', () => {
  test('useCommandSelection：requestAutoSelectCommand 会在 effect 中消费并把 ruleIndex 归零', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const setSelectedId = vi.fn();
    const setSelectedRuleIndex = vi.fn();

    function Harness(): React.ReactElement {
      const api = useCommandSelection({
        selectedId: 'a',
        setSelectedId,
        setSelectedRuleIndex,
      });
      useEffect(() => {
        api.requestAutoSelectCommand('b');
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
      await tick();
    });
    await TestUtils.act(async () => {
      await tick();
    });

    expect(setSelectedId).toHaveBeenCalledWith('b');
    expect(setSelectedRuleIndex).toHaveBeenCalledWith(0);

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });

  test('useCommandSelection：requestAutoSelectRuleIndex 会在 effect 中消费并更新 ruleIndex', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const setSelectedId = vi.fn();
    const setSelectedRuleIndex = vi.fn();

    function Harness(): React.ReactElement {
      const api = useCommandSelection({
        selectedId: 'a',
        setSelectedId,
        setSelectedRuleIndex,
      });
      useEffect(() => {
        api.requestAutoSelectRuleIndex(2);
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
      await tick();
    });
    await TestUtils.act(async () => {
      await tick();
    });

    expect(setSelectedId).not.toHaveBeenCalled();
    expect(setSelectedRuleIndex).toHaveBeenCalledWith(2);

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });
});

