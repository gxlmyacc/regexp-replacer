# 参与开发

本文面向 **克隆仓库并在本地构建扩展** 的贡献者与维护者。扩展的安装与使用说明见 [README.zh-CN.md](README.zh-CN.md)（英文：[README.md](README.md)）。

## 前置条件

- Node.js 与 npm

## 安装依赖

如果你本机配置了私有 npm registry，可强制指定公共 registry：

```bash
npm install --registry https://registry.npmjs.org/
```

## 构建 Webview

```bash
cd webview
npm install --registry https://registry.npmjs.org/
npm run build
```

## 编译扩展

```bash
npm run compile
```

## 运行 / 调试

- 在 VS Code 中按 `F5` 启动 Extension Development Host 调试。

或使用 dev 脚本（同时启动 TS watch 与 Webview dev server，并在端口占用时提示输入新端口）：

```bash
npm run dev
```
