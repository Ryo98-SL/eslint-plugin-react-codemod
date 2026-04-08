# Contribute

## 文档工作区

文档站位于独立的 workspace package：

```txt
docs/
```

它的 `package.json` 只放 VitePress 专属脚本和依赖，方便文档站独立演进。

## 根脚本

项目根目录暴露了几个便捷命令：

```bash
bun run docs:dev
bun run docs:build
bun run docs:preview
```

这些命令会转发到 `docs` workspace package。

## 站点配置

`docs/.vitepress/config.ts` 里的关键配置包括：

- `base`: 保证 GitHub Pages 项目站点下的资源路径正确
- `locales`: 提供英文和简体中文两套入口
- `cleanUrls`: 生成不带 `.html` 的 URL
- `search.provider`: 启用本地搜索
- `editLink`: 给每个页面提供 GitHub 编辑入口

## 内容结构

当前文档内容大致组织为：

```txt
docs/
  .vitepress/
  guide/
  zh/
  public/
  index.md
  examples.md
```

## 部署

文档站按 GitHub Pages 项目站点构建，VitePress `base` 为：

```txt
/eslint-plugin-react-codemod/
```

如果仓库名或 GitHub 账号变更，需要同步修改 VitePress 配置中的基础路径和相关链接。
