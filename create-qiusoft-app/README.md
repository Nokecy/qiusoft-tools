# create-qiusoft-app

一键生成项目模板，默认从当前目录读取模板。

## 使用

```
create-qiusoft-app my-app
```

## 交互式选择子库

```
create-qiusoft-app my-app --interactive
```

提示：
- 模板默认包含 `appSYS` 子库
- 交互支持编号/名称/`all`/`none`

## 指定模板仓库

```
create-qiusoft-app my-app --repo github:your-org/your-template
```

## 选择子库（非交互）

```
create-qiusoft-app my-app --submodules appMes,appWms
```

## 可选参数

- `--repo <repo>`：模板仓库
- `--ref <ref>`：分支/标签/提交
- `--manifest <path>`：共享清单文件名
- `--submodules <list>`：子库列表（逗号分隔），或 `all`/`none`
- `--interactive`：交互式选择子库
- `--skip-install`：跳过 yarn install

## 子库列表

- appSYS
- appMES
- appWMS
- appPDM
- appWorkflow
- appTMS
- appCommon
