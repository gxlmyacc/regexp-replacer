import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test } from 'vitest';
import { useRuleUiCache } from '../../webview/src/hooks/useRuleUiCache';

type HostProps = {
  cmdId?: string;
  ruleIndex: number;
  ruleUid?: string;
  onSnapshot: (v: { testText: string; applyPreHooks: boolean }) => void;
};

/**
 * 测试宿主组件：挂载 useRuleUiCache 并在状态变化时把快照回传给测试。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function Host(props: HostProps): React.ReactElement {
  const ui = useRuleUiCache({
    isReady: true,
    selectedCmdId: props.cmdId,
    selectedRuleIndex: props.ruleIndex,
    selectedRuleUid: props.ruleUid,
    getDefaultReplaceTemplate: () => '',
    getDefaultTestText: () => '',
    onRestore: () => {},
  });

  useEffect(() => {
    props.onSnapshot({ testText: ui.testText, applyPreHooks: ui.applyPreHooks });
  }, [props, ui.testText, ui.applyPreHooks]);

  // 触发写回：模拟用户操作
  useEffect(() => {
    ui.setTestText('T1');
    ui.setApplyPreHooks(true);
  }, []);

  return <div />;
}

describe('webview useRuleUiCache', () => {
  test('restores per (cmdId + ruleUid) cache when selection changes', async () => {
    const hostEl = document.createElement('div');
    document.body.appendChild(hostEl);

    const snaps: Array<{ testText: string; applyPreHooks: boolean }> = [];
    const onSnapshot = (v: { testText: string; applyPreHooks: boolean }) => snaps.push(v);

    try {
      ReactDOM.render(<Host cmdId="c1" ruleIndex={0} ruleUid="u1" onSnapshot={onSnapshot} />, hostEl);
      // 切换选择：同命令不同 ruleUid
      ReactDOM.render(<Host cmdId="c1" ruleIndex={1} ruleUid="u2" onSnapshot={onSnapshot} />, hostEl);
      // 再切回 u1，应恢复之前写回的状态
      ReactDOM.render(<Host cmdId="c1" ruleIndex={0} ruleUid="u1" onSnapshot={onSnapshot} />, hostEl);

      const last = snaps[snaps.length - 1];
      expect(last.testText).toBe('T1');
      expect(last.applyPreHooks).toBe(true);
    } finally {
      ReactDOM.unmountComponentAtNode(hostEl);
      hostEl.remove();
    }
  });
});

