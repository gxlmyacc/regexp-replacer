import React, { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom';
import './ToastHost.scss';

type Listener = (toast: ToastState | null) => void;

let currentToast: ToastState | null = null;
let listeners: Listener[] = [];
let mounted = false;
let timer: number | undefined;
let dismissAt: number | null = null;
let remainingMs: number | null = null;

export type ToastKind = 'info' | 'error';

export type ToastState = {
  message: string;
  kind: ToastKind;
};

/**
 * 根据提示文案长度计算 toast 默认显示时长，便于用户阅读。
 *
 * @param message 提示文案。
 * @returns 自动计算的显示时长（毫秒），范围为 1600–5000ms。
 */
function computeAutoDurationMs(message: string): number {
  const minMs = 1600;
  const maxMs = 5000;
  const len = Math.max(0, (message ?? '').trim().length);
  // 经验值：约 60ms/字符（中文/英文都适用），并做上下限裁剪。
  const ms = minMs + Math.ceil(len * 60);
  return Math.min(maxMs, Math.max(minMs, ms));
}

export type ToastHostProps = {
  toast: ToastState | null;
  onDismiss: () => void;
  onPause: () => void;
  onResume: () => void;
};

/**
 * Webview 通用 Toast 组件：用于在页面顶部展示短提示信息。
 *
 * @param props 组件属性。
 * @returns React 元素或 null。
 */
export const ToastHost = React.memo(function ToastHost(props: ToastHostProps): React.ReactElement | null {
  const { toast, onDismiss, onPause, onResume } = props;
  useEffect(() => {
    if (!toast) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onDismiss, toast]);

  if (!toast) return null;

  return (
    <div
      className={`rrToast ${toast.kind === 'error' ? 'rrToastError' : ''}`}
      role="status"
      onMouseDown={onDismiss}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
    >
      {toast.message}
    </div>
  );
});

/**
 * 通知所有订阅者 toast 状态变化。
 *
 * @returns 无返回值。
 */
function emit(): void {
  for (const l of listeners) l(currentToast);
}

/**
 * 订阅 toast 状态变化。
 *
 * @param listener 监听函数。
 * @returns 取消订阅函数。
 */
function subscribe(listener: Listener): () => void {
  listeners = [...listeners, listener];
  listener(currentToast);
  return () => {
    listeners = listeners.filter((x) => x !== listener);
  };
}

/**
 * 确保 ToastHost 已被挂载到 document.body（只挂载一次）。
 *
 * @returns 无返回值。
 */
function ensureMounted(): void {
  if (mounted) return;
  mounted = true;

  const id = 'rr-toast-root';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  ReactDOM.render(<ToastRuntime />, el);
}

/**
 * Toast 运行时宿主：订阅全局 toast 状态并渲染 ToastHost。
 *
 * @returns React 元素或 null。
 */
function ToastRuntime(): React.ReactElement | null {
  const [toast, setToast] = useState<ToastState | null>(currentToast);
  useEffect(() => subscribe(setToast), []);
  return <ToastHost toast={toast} onDismiss={() => Toast.dismiss()} onPause={() => Toast.pause()} onResume={() => Toast.resume()} />;
}

/**
 * 清理当前计时器并重置相关状态。
 *
 * @returns 无返回值。
 */
function clearTimerState(): void {
  if (timer) window.clearTimeout(timer);
  timer = undefined;
  dismissAt = null;
  remainingMs = null;
}

/**
 * 使用剩余时长启动计时器。
 *
 * @param ms 剩余毫秒数。
 * @returns 无返回值。
 */
function startTimer(ms: number): void {
  clearTimerState();
  remainingMs = Math.max(0, ms);
  dismissAt = Date.now() + remainingMs;
  timer = window.setTimeout(() => {
    clearTimerState();
    currentToast = null;
    emit();
  }, remainingMs);
}

/**
 * 全局 Toast API：无需在 App 中手动注册组件即可使用。
 */
export const Toast = {
  /**
   * 显示一条 toast，并在指定延时后自动关闭。
   *
   * @param message 提示文案。
   * @param kind 提示类型（info/error）。
   * @param durationMs 自动关闭延时（毫秒）；不传时会根据 message 字数自动计算（最少 1600ms，最多 5000ms）。
   * @returns 无返回值。
   */
  show(message: string, kind: ToastKind = 'info', durationMs?: number): void {
    ensureMounted();
    currentToast = { message, kind };
    emit();
    const ms = durationMs === undefined ? computeAutoDurationMs(message) : Math.max(0, durationMs);
    startTimer(ms);
  },

  /**
   * 立即关闭当前 toast。
   *
   * @returns 无返回值。
   */
  dismiss(): void {
    clearTimerState();
    currentToast = null;
    emit();
  },

  /**
   * 暂停 toast 的自动关闭计时（鼠标悬停时使用）。
   *
   * @returns 无返回值。
   */
  pause(): void {
    if (!currentToast) return;
    if (!timer || dismissAt === null) return;
    const left = Math.max(0, dismissAt - Date.now());
    clearTimerState();
    remainingMs = left;
  },

  /**
   * 恢复 toast 的自动关闭计时（鼠标移出时使用）。
   *
   * @returns 无返回值。
   */
  resume(): void {
    if (!currentToast) return;
    if (timer) return;
    if (remainingMs === null) return;
    startTimer(remainingMs);
  },
};

