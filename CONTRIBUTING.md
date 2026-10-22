# 参与 NameFirst Pro

当前准备首个正式版本 1.0.0。先阅读 [项目说明](./PROJECT_SPEC.md)和[实施计划](./IMPLEMENTATION_PLAN.md)，每次提交聚焦一个阶段或一个缺陷。

原创贡献按 AGPL-3.0-only 提供，保留作者版权；提交者应有权提供所提交内容。本项目不默认取得单独商业再许可权，也不继承 NameFirst 的 CLA。不要复制其非商业源码、官网目录编排或未经授权的品牌；已记录的维护者授权 Pro 图标衍生是窄例外，见 [品牌来源](./assets/brand/README.md)。

开发环境为 Node.js 24+、pnpm 11.25.0。执行 `pnpm install --frozen-lockfile`、`pnpm check`、`pnpm test` 和 `pnpm build`。涉及浏览器行为时执行 `pnpm test:browser`；测试使用独立临时配置，禁止复用个人浏览器资料。

报告问题请在 [Issues](https://github.com/Thicky-han/namefirst-pro/issues) 提供版本、浏览器、搜索引擎、复现步骤和证据状态。不要附带搜索历史、密码、令牌、私人备份或不愿公开的网址。
