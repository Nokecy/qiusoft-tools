# qiusoft-shared-cli

用于同步共享模板到项目。

## 使用

```
shared-cli update
```

## 子库管理

列出可用子库：

```
shared-cli submodule list
```

添加指定子库：

```
shared-cli submodule add appMes appWms
```

添加全部子库：

```
shared-cli submodule add --all
```

仅预览：

```
shared-cli submodule add appMes --dry-run
```

## 子库列表

- appSYS
- appMES
- appWMS
- appPDM
- appWorkflow
- appTMS
- appCommon

## 已有项目升级

查看 [已有项目接入指南](docs/upgrade-existing-project.md)。

## 配置

在项目根目录放置 `.shared-config.json`，其中 `repo` 支持 `github:org/name` 或本地路径（如 `file:C:\template`）。
