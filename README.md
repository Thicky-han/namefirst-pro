# NameFirst Pro

**名称优先，现场取证。** 独立开发的浏览器扩展，目标是在百度/Bing 搜索时识别寻找官网的意图，为未知名称发现候选、实时核对证据，并通过明确反馈改进本地判断。

[English](./README.en.md) · [项目说明](./PROJECT_SPEC.md) · [实施计划](./IMPLEMENTATION_PLAN.md) · [L2 报告](./STAGE2_REPORT.md) · [隐私](./PRIVACY.md) · [AGPL-3.0](./LICENSE)

**当前为 `0.2.0-stage2` Bing 开发预览。** 已将导航意图、未知名称发现与有限来源核验接入真实 Bing 网页搜索，在原结果上方显示状态、入口、证据和时间。支持查询切换、取消旧任务、隐藏、重试及暂停。百度、主动学习训练、个人记忆和备份尚未实现，还没有 GitHub 发行包。

目前只有 Apache 官方项目数据政策可提供正向认证；Wikidata 和网页自称仅提供线索。名称不必在安装包中预先收录，原结果缺少入口时仍可补充发现；证据不足会保留待核验，不能据此声称已经能够认证所有官网。

## 与 NameFirst 的目标差异

| | NameFirst | NameFirst Pro 目标 |
| --- | --- | --- |
| 覆盖方式 | 预先整理的官网目录与个人记忆 | 本次搜索发现候选，不要求名称已收录 |
| 官网核验 | 制作目录时核实 | 当前导航任务现场取证，展示来源和时间 |
| 学习 | 个人显式记忆 | 意图不确定性判断、明确反馈增量学习和个人记忆 |
| 失败处理 | 未覆盖则不认定 | 证据不足、歧义、网络受阻分别说明，允许拒绝认定 |
| 项目来源 | 历史 fork 项目 | 独立代码、Git 历史与插件身份 |
| 许可 | 原版非商业共享源码 | AGPL-3.0-only 标准开源，允许商用 |

实时核验需要网络与用户授予的网站访问权限。搜索排名、HTTPS、网页自称“官网”、模型高分及用户选择均不单独证明官方身份；也不能保证任意未知名称都可自动认证。

## 当前开发版本：构建

需要 Node.js 24+、pnpm 11.25.0。项目已有稳定插件公钥；重新安装依赖不需要重新生成身份。

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm evaluate
pnpm build
```

构建输出为项目内的 `dist/chrome` 和 `dist/edge`，含可导入的 `core/resolver.js`。解析和域名依赖已打包在本地；不运行远端脚本，不需要账号、API Key 或项目服务器。依赖和许可见 [DEPENDENCIES.md](./DEPENDENCIES.md)。

## L1 核心演示

```powershell
# 不加 --live，默认不联网，返回权限未开启
node scripts/resolve.mjs 'Apache Arrow 官网'
# 通过当前 Node 网络进行现场发现与核验
node scripts/resolve.mjs 'Apache Arrow 官网' --live
# 受控的实体隔离回归评估，不访问网络
pnpm evaluate
```

结果包含状态、来源、时间、失败原因和实际请求数。`unverified`、`ambiguous`、`blocked` 都是允许的真实结果，不会强行生成认证。某些网络中 Node 直接请求失败而浏览器可用；本环境有此情况，CLI 超时没有计作通过。

浏览器中的独立核心实验可运行 `node scripts/core-browser-smoke.mjs --live --target=chrome`；搜索页在线实验为 `node scripts/bing-browser-smoke.mjs --live --target=chrome`。两者均采用单独的临时测试授权配置，真实可选权限对话框仍需有界面验收。详细接口见 [CORE_API.md](./CORE_API.md)。

## 逐步加载并使用 Bing 预览

1. 先完成上面的构建。
2. 在 Chrome 地址栏打开 `chrome://extensions`，或在 Edge 打开 `edge://extensions`。
3. 开启开发者/开发人员模式，点击“加载已解压的扩展程序”。
4. Chrome 选择项目内 `dist/chrome`；Edge 选择 `dist/edge`。所选目录须直接包含 `manifest.json`。
5. 在工具栏扩展菜单中打开 **NameFirst Pro — Bing 预览**；保持总开关和 Bing 开关开启。
6. 点击“开启联网核验权限”，阅读浏览器提示并按需授予。未授权时搜索页只显示权限提示，不访问候选站点或取证来源。
7. 打开 Bing 的普通桌面网页搜索，搜索 `Apache Arrow official website`。扩展在主要结果区顶部显示核验过程；访问失败时也可能显示未完成，不保证每次成功。
8. 展开证据可查看来源与读取时间；点击入口由你决定是否打开。原搜索结果保留，扩展不会自动跳转。
9. `Rust 官网` 可展示同名歧义；`Zotero 官网` 的一般公开知识线索不足以认证；`Apache Arrow 教程` 保留普通搜索。不确定意图先询问，确认只作用于本次查询，不训练模型。
10. 可隐藏本次卡片、重新核验、暂停 Bing，或在弹窗关闭总开关。点击“撤销权限”可停止跨站取证；恢复权限或设置后重新核验当前页。更新本地代码后重新构建、在扩展管理页重新加载，并刷新已有搜索页。

支持 `www.bing.com`、`cn.bing.com`、`bing.com` 的 HTTPS `/search` 普通结果页，其他页面或无法识别的布局不注入卡片。Bing 网站访问为必需权限；其他公开 HTTPS 网站为可选权限。弹窗折叠区保留阶段 0 的单页联网诊断，读取成功不代表官网认证。

## 验证与后续

浏览器验收：`pnpm test:browser`，使用独立临时配置。可通过环境变量 `NAMEFIRST_PRO_CHROME` 和 `NAMEFIRST_PRO_EDGE` 指定浏览器程序；默认使用本机 Chrome/Edge。在线能力实验：`node scripts/browser-smoke.mjs --live`。在线实验使用单独授权的测试副本，不修改产品权限；不自动操作真实权限对话框，详见阶段报告。

`pnpm test:bing-browser` 检查双浏览器 Bing 受控场景；`pnpm test:core-browser` 检查独立核心；`pnpm test:browser` 检查弹窗与权限边界。受控页面、真实在线结果及尚未自动化的权限提示分别记录在 [L2 报告](./STAGE2_REPORT.md)。[L1](./STAGE1_REPORT.md)和[阶段 0](./BASELINE_REPORT.md)报告保留历史状态。下一阶段为 L3：百度适配与浏览器矩阵，随后是主动学习、管理与成品分发。

贡献见 [CONTRIBUTING.md](./CONTRIBUTING.md)。本项目原创代码采用 AGPL-3.0-only；第三方开发工具保留各自许可。完整许可为准，本 README 为简述。
