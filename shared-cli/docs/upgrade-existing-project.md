# 让已有项目接入 qiusoft-shared-cli

面向已有项目，把共享模板的同步能力接入进来，后续用一条命令更新公共模块。

## 前置条件

- Node.js >= 18
- Yarn
- 具备访问模板仓库的权限（私有仓库需要 `GITHUB_TOKEN`）

## 步骤 1：添加共享配置

在项目根目录创建 `.shared-config.json`：

```json
{
  "repo": "github:Nokecy/qiusoft-template",
  "ref": "main",
  "tokenEnv": "GITHUB_TOKEN",
  "lockFile": ".shared-lock.json",
  "manifestFile": "shared.manifest.json"
}
```

## 步骤 2：复制共享清单

从模板仓库根目录复制 `shared.manifest.json` 到你的项目根目录，保持同步范围一致。

## 步骤 3：加上 Yarn 脚本

在 `package.json` 加脚本：

```json
{
  "scripts": {
    "update:shared": "npx qiusoft-shared-cli update"
  }
}
```

## 步骤 4：首次同步

运行：

```bash
yarn update:shared -- --allow-dirty
```

说明：
- 如果你希望先确认将要更新的内容，可用 `--dry-run` 或 `--check`。
- 如遇到 “共享目录存在未提交改动”，可临时使用 `--allow-dirty`。

## 可选：添加业务子库

查看可用子库：

```
npx qiusoft-shared-cli submodule list
```

添加子库（示例）：

```
npx qiusoft-shared-cli submodule add appMes appWms
```

## 一次性初始化项

以下内容只在初始化阶段处理一次，后续不会同步覆盖：

- `public/config`

如果你的项目还没有这些目录，请从模板仓库复制一份后再执行同步。

## 可选：配置项目标题

登录页标题由项目配置控制。建议在项目根目录新增 `config/project.local.ts`：

```ts
export default {
  appTitle: '你的平台名称',
};
```

说明：
- `appTitle` 未配置时，默认使用 `${appName}数字平台`。
- `config/project.local.ts` 不记入同步范围，通常用于项目私有配置。

## 同步规则（要点）

实际同步范围由 `shared.manifest.json` 控制，重点规则如下：

- `config/routers.ts`：目标已存在时不会覆盖
- `public/config`：不再同步
- `config/swaggers`：不再同步
- `public`：只同步 `assets`、`font`、`scripts`、`styles`
- `src/pages/appLogin`：登录页已纳入同步

如果你希望强制重置 `config/routers.ts`，可以手动删除该文件再执行同步。

## 常见问题

**提示 “Source not found”**

通常是清单和模板不一致。请确认你复制的是最新的 `shared.manifest.json`。

**提示 “共享目录存在未提交改动”**

建议先提交或暂存修改；临时需要继续时可加 `--allow-dirty`。
