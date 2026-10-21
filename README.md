# NameFirst Pro

![NameFirst Pro 候选图标](./assets/brand/icon-128.png)

**名称优先，现场取证。** 在 Bing/百度当前搜索中判断是否寻找官方入口，为未知名称发现候选、核对证据，并从明确反馈中改进本地意图判断。独立 AGPL-3.0-only 项目，非 fork；图标按本轮要求基于 NameFirst 原创 NF/上箭头精修，待确认。

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

当前为 **1.0.0-rc.1 本地发行候选**。Chrome/Edge 包、对应源码、校验和在 `release/1.0.0-rc.1/`，公开仓库/下载地址将在确认发布后建立。普通安装不需要 Node、账号、API Key 或项目服务器。界面目前简体中文；九语 README 不等于九语界面。

## 安装和使用

1. Chrome 选 `namefirst-pro-1.0.0-rc.1-chrome.zip`，Edge 选 `namefirst-pro-1.0.0-rc.1-edge.zip`；全部解压到长期保留的文件夹，源码 ZIP 不作插件加载包。
2. 打开 `chrome://extensions` / `edge://extensions`，开启开发者模式，加载直接包含 `manifest.json` 的解压目录。
3. 打开工具栏弹窗，保持总开关与所需引擎开关开启；按需点击“开启联网核验权限”，阅读浏览器提示。未授权不读取外部证据；可随时撤销。
4. 在普通桌面 Bing/百度搜索名称，例如 `Apache Arrow official website`。查看独立卡片的本次状态、确切入口、来源和时间；不会自动跳转，原结果保留。
5. 教程/新闻等资料查询通常不取证；意图误判时可明确选择“这次查资料”。同名、网络失败或证据不足允许不下结论。
6. 从弹窗进入数据管理，导出 JSON；在新浏览器选择文件、预览合并/替换，再确认。权限/开关/缓存/撤销不迁移；未知格式不覆盖。卸载前先备份。
7. 更新前备份，完整替换加载目录中的文件，在扩展管理页“重新加载”，再刷新搜索页；只替换文件可能继续运行旧后台。

逐步安装、暂停、反馈、恢复与故障处理见 [安装说明](./INSTALL.md)，数据格式与并发保护见 [管理说明](./MANAGEMENT.md)，网络接收方及本地保留见 [隐私](./PRIVACY.md)。

## 能力与边界

未知名称不需要出现在已装目录，候选来自当前结果页及受限公开发现。当前唯一正向权威政策支持 Apache 官方项目目录明确给出的主页/下载地址；Wikidata、自称官网、排名、HTTPS、个人偏好和模型分数均不能单独认证。文档/登录没有通用权威政策，不保证任意官网都能认证，也不判断软件安全或资质。

仅支持已识别的桌面 Bing 三个 HTTPS 主机 `/search` 和 `www.baidu.com/s` UTF-8 普通网页结果。验证码、隐藏/未知布局、登录、限流、网络超时会停止或降级；不绕过限制。正常在线矩阵按本轮要求不作阶段门槛，历史记录仍据实保留。

明确标签才训练，本地模型与个人入口/别名/否定分开；跳过/未点击不训练。可关闭学习、关闭主动提示、编辑/删除/撤销。默认不存完整搜索历史。历史证据始终标为缓存，失败不刷新旧认证时间，每次导航仍取当前证据。

[公开评估](./EVALUATION.md)：36 条人工编写的真实名称查询，学习后正确 25、拒绝判断 6，仍有 5 条资料误触发；24 项合成认证场景状态符合 23 项、3 次认证中误认证 0。文档入口有一项安全拒绝但未达到期望。不是自然流量或全网准确率。

## 开发与审阅

Node.js 24+、pnpm 11.25.0：

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm evaluate:release
pnpm build
```

开发者准备发行还需 Git、Python 3.9+：`pnpm release:prepare`、`pnpm release:verify`；本地候选构建用待确认图标供审阅，普通构建在品牌批准前不应用。`pnpm test:packaged-browser` 只加载从 ZIP 实际解压的包。运行时依赖本地打包，无远端脚本；详见 [依赖](./DEPENDENCIES.md)、[核心接口](./CORE_API.md)。

[发行说明](./RELEASE_NOTES.md) · [L6 报告](./STAGE6_REPORT.md) · [实施计划](./IMPLEMENTATION_PLAN.md) · [本地学习](./LEARNING.md) · [贡献](./CONTRIBUTING.md) · [许可](./LICENSE)

原创代码及本轮授权的 Pro 衍生品牌按 AGPL-3.0-only，允许商用并遵守其条款；依赖保留各自许可。不继承原项目的非商业公众许可或 CLA，不复制其源码、数据、插件身份或 Git 历史；品牌例外来源见 [记录](./assets/brand/README.md)。
