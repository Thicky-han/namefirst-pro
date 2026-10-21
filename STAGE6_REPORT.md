# L6 首版候选与发布准备

2026-10-21，版本 `1.0.0-rc.1`。本地交付准备已完成；图标和公开发布等待用户本轮要求的最终确认，不创建远程仓库或提前推送。品牌 proposal 的配置保持 pending。

## 本轮内容

- 按用户新要求，基于 NameFirst 原创 NF/上箭头精修 Pro 候选；后续颜色反馈将主题改为深靛蓝、冰蓝箭头和淡金 PRO，与原版绿色区分。图标及来源见 [品牌记录](./assets/brand/README.md)，精修使用内置 imagegen，尺寸导出为浏览器 canvas，无新增模型/设计依赖。
- 产品弹窗、搜索卡片和管理页的品牌强调色统一为靛蓝；认证/个人入口仍有明确文本和语义状态，不用主题色冒充认证。
- 九语 README：简中、繁中、英文、日文、韩文、法文、德文、西文、巴西葡文。当前界面仍为简体中文。新增完整 [安装](./INSTALL.md)、[English installation](./INSTALL.en.md) 与 [发行说明](./RELEASE_NOTES.md)。
- 新的 36 名称意图留出和 24 信任场景，既有模型和政策未为追分改动；真实分母、5 条意图误触发和文档能力缺口见 [EVALUATION.md](./EVALUATION.md)，不宣称全网准确率。正常在线不再作为阶段门槛。
- 成品/完整对应源码 ZIP、固定 ZIP 时间戳、SHA256SUMS、版本/源文件哈希清单；Python 标准库独立读回、CRC、路径/体积/符号链接检查及源码/成品对应校验。源码排除开发配置、凭据、个人备份、依赖目录及生成垃圾。
- 实际从 ZIP 解压再在独立 Chrome/Edge 配置加载，不能只测试 dist 目录；20/20 项实际包检查通过，含两个引擎、默认不联网、身份/版本/图标、JSON 实际下载与导入、明暗主题及证据门槛。

## 确认与发布边界

`config/branding.json` 为 pending 时，普通构建不应用提案；本地审阅包通过 `--preview-brand` 展示，供用户确认。既有“先预览确认后定稿”要求继续执行，本轮只改变品牌素材与主题的选择。用户确认后，将图标状态改为 approved 并重建最终包。

本地候选目录是 `release/1.0.0-rc.1/`，没有虚构 public 仓库或下载链接。用户最终批准后才创建独立 public/main 仓库、推送及发 Release，届时再验证 `fork: false`、独立祖先、未登录可下载及在线包校验。当前不能将尚未发生的步骤标成完成。


## 最终本地验证

- `pnpm check`：124 个源码/文档文件、66 个 JS 语法检查，manifest/身份/链接/PNG 元数据和基本公开内容检查通过。PNG 只包含允许的数据块，无生成器附加元数据。
- `pnpm test`：206/206。新增标准 ZIP 字节往返、独立制造的路径穿越/反斜线/设备名/符号链接拒绝，以及 CRC 损坏检测。Windows Python 显式 UTF-8 模式处理中文工作目录；路径检查读取原始 ZIP 名称，避免 Windows 库先归一化反斜线。
- `pnpm test:browser`：14/14，Chrome 155.0.8059.85、Edge 155.0.4283.62；原始报告 `.cache/browser-EjA3xk/report.json`。
- `pnpm test:packaged-browser`：20/20，实际从 ZIP 解压加载，两浏览器共 20 项；最终 `.cache/l6-packaged-cbE9Ak/report.json`。2 条已知 Edge/Bing 匿名 `_G` 夹具噪声按精确消息/栈单列，其他页面错误 0。不把受控响应当在线验收。已视觉查看图标、弹窗、管理页及明暗卡片。
- `pnpm release:verify`：三个 ZIP 和元数据的 SHA256、CRC、完整条目、源码/成品文件哈希清单、许可、权限、稳定独立 ID、图标和冻结评估数据来源均匹配。成品仅含 5 个预期 JS 入口、HTML/CSS、图标和用户/许可文档；没有开发依赖、缓存、测试配置、个人备份、私钥或源码映射。静态扫描只覆盖已打包/受控源码，不保证发现所有秘密。
- `pnpm release:rebuild-check`：真正提取源码 ZIP 到另目录、使用本机已安装且锁定的依赖重建，Chrome/Edge 各 33 个运行文件逐字节一致，初次记录 `.cache/l6-source-rebuild-EFIDGu/report.json`。这不是全新网络安装依赖测试。构建只压缩空白、保留法律声明和完整可修改源码，避免工作目录路径注释破坏重建一致性。
- 公开评估保留原标签/期望：意图 25 正确/6 保留/5 错误，认证状态 23/24 符合，3 次认证没有误认证。文档预期未达成不改写为通过，详见 EVALUATION.md。

所有个人测试文件、原始浏览器配置、审阅拼图均在忽略的 `.cache` 中；公开源 ZIP 以 Git 已跟踪的明确材料构成，不包含 `.git` 或先前项目的祖先。原版 NameFirst 目录没有被修改。

## 可审阅材料

候选文件名为 `namefirst-pro-1.0.0-rc.1-chrome.zip`、`namefirst-pro-1.0.0-rc.1-edge.zip`、`namefirst-pro-1.0.0-rc.1-source.zip`，同目录 `SHA256SUMS` 和 `release-metadata.json` 给出本次精确哈希、源码提交和文件清单。元数据明确 publication 等待确认、brandApproval 为 pending，不伪造线上下载链接或 fork 状态。

发布目标账户已只读核对为 Thicky-han；目标 `Thicky-han/namefirst-pro` 目前未解析到已有仓库。未执行创建、推送、Release 或向他人发送消息。维护者确认后才做这些外部发布步骤，并补做远程独立性及匿名下载验证。本轮确认问题包含图标/配色定稿及是否批准公开发布此候选版。
