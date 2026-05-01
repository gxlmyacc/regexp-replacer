import React, { memo } from 'react';
import { Button, Tooltip } from './base';
import './RegexFlagChips.scss';

const FLAG_ORDER = ['g', 'i', 'm', 's', 'u', 'y'] as const;
export type RegexFlagChar = (typeof FLAG_ORDER)[number];

export type RegexFlagChipsLabels = {
  flags: string;
  flagG: string;
  flagI: string;
  flagM: string;
  flagS: string;
  flagU: string;
  flagY: string;
};

export type RegexFlagChipsProps = {
  /** 已启用的 flag 字符组成的字符串，如 "gi"。 */
  enabledFlags: string;
  /** 切换某 flag（'g' 为锁定，不会回调）。 */
  onToggle: (flag: string) => void;
  labels: RegexFlagChipsLabels;
};

/**
 * 正则引擎 flags 的 g/i/m/s/u/y 标签行（g 锁定不可点）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const RegexFlagChips = memo(function RegexFlagChips(props: RegexFlagChipsProps): React.ReactElement {
  const { enabledFlags, onToggle, labels: t } = props;

  function tipFor(f: RegexFlagChar): string {
    if (f === 'g') return t.flagG;
    if (f === 'i') return t.flagI;
    if (f === 'm') return t.flagM;
    if (f === 's') return t.flagS;
    if (f === 'u') return t.flagU;
    return t.flagY;
  }

  return (
    <div className="regexFlagChips" aria-label={t.flags}>
      {FLAG_ORDER.map((f) => {
        const enabled = enabledFlags.includes(f);
        const tip = tipFor(f);
        return (
          <Tooltip key={f} content={tip}>
            <Button
              preset="chip"
              active={enabled}
              onClick={() => onToggle(f)}
              aria-pressed={enabled}
            >
              {f}
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
});
