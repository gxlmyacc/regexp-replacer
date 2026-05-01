import React, { forwardRef, memo } from 'react';
import './Layout.scss';

export type LayoutProps = {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/**
 * 布局根容器：提供 antd 风格的 Layout 组合能力（Client/Sider/Header/Content/Footer/Row）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function LayoutRoot(props: LayoutProps): React.ReactElement {
  const { className = '', style, children } = props;
  return (
    <div className={`rrLayout ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

/**
 * Layout.Client：应用页面主网格壳（替代原 .app）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
const LayoutClient = memo(
  forwardRef<HTMLDivElement, LayoutProps>(function LayoutClient(props, ref): React.ReactElement {
    const { className = '', style, children } = props;
    return (
      <div ref={ref} className={`rrLayout__client ${className}`.trim()} style={style}>
        {children}
      </div>
    );
  }),
);

/**
 * Layout.Sider：侧边区域容器。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function LayoutSider(props: LayoutProps): React.ReactElement {
  const { className = '', style, children } = props;
  return (
    <div className={`rrLayout__sider ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

/**
 * Layout.Header：顶部栏容器。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function LayoutHeader(props: LayoutProps): React.ReactElement {
  const { className = '', style, children } = props;
  return (
    <div className={`rrLayout__header ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

/**
 * Layout.Content：内容区容器。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function LayoutContent(props: LayoutProps): React.ReactElement {
  const { className = '', style, children } = props;
  return (
    <div className={`rrLayout__content ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

/**
 * Layout.Footer：底部区域容器。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function LayoutFooter(props: LayoutProps): React.ReactElement {
  const { className = '', style, children } = props;
  return (
    <div className={`rrLayout__footer ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

export type LayoutRowProps = LayoutProps & {
  gap?: number;
  align?: 'center' | 'start' | 'end' | 'stretch';
  justify?: 'start' | 'end' | 'center' | 'space-between';
};

/**
 * Layout.Row：水平排列容器（用于表达式行、工具栏左右区等）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function LayoutRow(props: LayoutRowProps): React.ReactElement {
  const { className = '', style, children, gap = 8, align = 'center', justify = 'start' } = props;
  return (
    <div
      className={`rrLayout__row rrLayout__row--align-${align} rrLayout__row--justify-${justify} ${className}`.trim()}
      style={{ gap, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * Layout：以属性挂载子组件，模仿 antd 的命名方式。
 */
export const Layout = Object.assign(memo(LayoutRoot), {
  Client: LayoutClient,
  Sider: memo(LayoutSider),
  Header: memo(LayoutHeader),
  Content: memo(LayoutContent),
  Footer: memo(LayoutFooter),
  Row: memo(LayoutRow),
});

