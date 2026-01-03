# qiusoft-tools

前端模板与 CLI 工具集合（Yarn 优先）：

- shared-cli（同步共享模板）
- create-qiusoft-app（初始化项目）

## 目录结构

```
qiusoft-tools/
  shared-cli/
  create-qiusoft-app/
```

## 本地开发

以 shared-cli 为例：

```
cd shared-cli
yarn install
yarn build
node dist/index.js update --help
```

create-qiusoft-app：

```
cd create-qiusoft-app
yarn install
yarn build
node dist/index.js <project-name>
```

## 发布流程（手动）

1. 修改版本号（`package.json`）
2. 构建并发布

```
cd shared-cli
yarn install
yarn build
npm publish
```

```
cd create-qiusoft-app
yarn install
yarn build
npm publish
```

## 发布流程（CI）

仓库支持通过 GitHub Actions 发布，需配置以下 Secret：

- `NPM_TOKEN`：npm 访问令牌

触发方式（两选一）：

1) 打 Tag：

```
git tag shared-cli/v0.1.0
git push origin shared-cli/v0.1.0
```

```
git tag create-qiusoft-app/v0.1.0
git push origin create-qiusoft-app/v0.1.0
```

2) 手动触发：在 GitHub Actions 里选择要发布的包
