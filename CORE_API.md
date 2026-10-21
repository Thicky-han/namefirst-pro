# 核心、学习与搜索引擎集成接口

适用版本：`0.4.0-stage4`。核心与 DOM 无关，Bing/百度适配共用后台与核验政策；百度正常在线验收待完成。以下核心接口延续 L1。

## 调用入口

源码入口为 `extension/core/index.js`，浏览器构建入口为 `dist/<browser>/core/resolver.js`。浏览器包已包含解析与域名依赖，无需联网下载脚本。

```javascript
import { createResolver, createTaskRunner } from './extension/core/index.js';

const resolver = createResolver({
  networkAllowed: () => false, // 默认关闭；集成时接真实扩展权限检查
});
const runner = createTaskRunner(resolver);
const result = await runner.run({
  query: '一个尚未收录的工具 官网',
  pageCandidates: [],
  cacheCandidates: [],
}, {
  onProgress: ({ taskId, stage }) => console.log(taskId, stage),
});
```

不开启网络时返回 `blocked`，不会假装已核验。开发者可以注入 `fetcher` 做受控测试，或在自己明确启动的 CLI 在线实验中设置 `networkAllowed: () => true`。该配置属于可信宿主接口，不能接受搜索页传入的同名字段。

## 输入和信任边界

| 输入 | 接受内容 | 不接受的权力 |
| --- | --- | --- |
| `query` | 最多 256 字符的当前查询 | 不执行查询里的指令或脚本 |
| `pageCandidates` | 最多检查前 30 条的 URL、标题、广告标记 | 忽略 `official`、分数、主体 ID、证据 ID 等字段 |
| `cacheCandidates` | 历史 URL、标题，作为再次发现的线索 | 不接受缓存认证，不刷新旧证据时间 |
| `networkAllowed` | 可信宿主提供的权限查询函数 | 页面不能自行授权 |
| `fetcher` | 原生 Fetch 签名，供后台和测试注入 | 页面不能替换实际传输或伪造响应 |
| `sources` | 可信配置中的 `apache`、`wikidata` 开关 | 不从网页下载新的信任来源政策 |
| `model.predict(features, { query })` | 可信本地增量模型，按需影响非明确规则的意图 | 不接受网页提供模型，不认证域名 |
| `feedbackLabel` | 可信宿主当前明确标签 | 只纠正意图，不能提供官方证据 |

不提供内置实体名单。名称归一化使用 Unicode NFKC、大小写与合理空白；保留有意义的标点，不把形似字符当成同一个名称。导航、下载、登录和文档用途分别保留，资料查询直接退出联网。

## 流水线和状态

`intent → discovering → collecting-evidence → verifying → complete`。所有进度携带同一任务 ID。`createTaskRunner` 用于一个搜索视图，开始新任务时取消旧任务；旧结果标记 `discarded`，不得用于更新新卡片。多个标签页应使用多个 runner。

输出包含意图、候选、状态、证据、失败原因、请求计量、任务开始/完成时间。`checkedAt` 仅在唯一当前认证成功时有值；旧缓存、网络失败、歧义和未核验没有新的认证时间。

| 状态 | 当前含义 |
| --- | --- |
| `invalid` | 空、超长或含异常控制字符的查询 |
| `not-navigation` | 明确资料查询，未发出网络请求 |
| `verified` | 当前权威断言和可读目标页面一致，且没有同名冲突 |
| `unverified` | 有候选，但身份、用途或来源不满足认证政策 |
| `ambiguous` | 外部数据支持多个不同同名主体，或有多个可认证目标 |
| `blocked` | 权限、网络、验证码、登录、读取上限、取消或预算阻止任务 |
| `not-found` | 本次来源与预算内没有符合过滤要求的候选，不代表没有官网 |
| `cached` | 仅有历史线索且本次无法读取，未作当前认证 |

个人目标由 L4 的学习/记忆层单独返回 `personal`，不混入核心 `VerificationResult` 的认证事实；完整管理与备份界面仍属 L5。

## 候选发现

1. 接收本次搜索页提供的直接 HTTPS 候选，不要求名称命中目录。
2. 需要补充时，通过 Wikidata 的 `wbsearchentities` 与 `wbgetentities` 查找精确名称/别名和 P856 网址。请求英语、中文及 `mul` 通用标签，排除弃用或带结束时间的旧入口。
3. 明确搜索 Apache 产品，或已发现 Apache 子域候选时，读取 Apache 基金会的在线项目数据，按名称匹配当次记录。目录未随包内置，也不会常驻成一个实体白名单。

Wikidata 是社区维护线索，不是身份认证来源。没有结果页候选、公开来源也未收录时，当前核心不能凭空找到任意网站。适配层读取本次 Bing/百度普通结果，补充发现仍限上述公开来源，没有新增后台搜索服务或全网爬虫。

## 当前认证政策

政策版本为 `asf-project-directory-v1`，当前唯一认证来源是 Apache 维护的确切 JSON 端点；它只授权其中明确命名的 ASF 项目入口。不是所有 `apache.org` 网页、任意仓库、公开知识库或自称“官网”的页面都受信。

认证同时要求：

1. 本任务实际读取了无重定向的确切官方数据端点。
2. 记录名称/明确的 Apache 简称精确匹配当前实体，项目未退休。
3. 记录明确给出所请求用途的确切 URL。
4. 本次实际读取目标页面，名称出现在标题、主标题或有限身份元数据中，用途吻合，未遇到验证或登录阻碍。
5. 证据属于当前任务，在有效窗口内，不能由网页字段、序列化对象或缓存冒充。
6. 跨来源跳转不继承旧认证；同来源跳转保留原授权入口和逐跳链路。

公开来源的 HTTP 旧链接可仅升级为 **同主机、同路径的 HTTPS** 候选，记录 `publishedUrl` 与 `httpsUpgrade`；不发出 HTTP 请求，不改变域名或猜测下载路径。非默认端口、凭据、参数、片段和保留域仍被拒绝。

证据使用任务内品牌标记和不可变结构。核验器会忽略非本账本创建、其他任务、过期或未来日期的对象。序列化证据可以查看，但不能反序列化后重新取得本次认证。

发布者分组由包含私有托管后缀的 PSL 判断；同一注册域的子域不是独立票数，`one.github.io` 与 `two.github.io` 分开。分组数量仅解释来源，绝不用“两个网站都这么说”替代身份门槛。

## 网络预算和已知限制

默认总预算 12 秒，最多 6 次请求、2 个并发；单请求 8 秒，同来源发起间隔 250 毫秒，最多 3 次可检查跳转，最多读取两个所请求用途的候选页。每一跳都重新检查权限和地址，共享请求预算。429/503 后本任务不再次请求该来源。

HTML 最多 256 KiB，结构化 JSON 最多 2 MiB，个别 API 请求采用更小上限。超限停止，不读取完整大页面，不执行网页脚本；采用 parse5 惰性语法解析。页面阻止、权限或网络失败与证据不足分别返回。

响应正文当前按 UTF-8 解码，其他编码不属于已验证兼容范围；解析失败不能放宽认证门槛。

浏览器 Fetch 在某些跨站跳转只提供 `opaqueredirect`，无法检查下一跳；此时明确返回 `redirect-uninspectable`。Node 环境可以检查公开 Location，但不能因此假定浏览器也能。普通扩展的地址语法检查仍不能完整防范 DNS 重绑定。

独立核心仍可通过 CLI 和临时扩展测试页调用；产品后台已通过下面的受限桥接向 Bing/百度提供任务。不能将调试页的权限测试配置用于正式分发。

## 双引擎消息桥接

`extension/search/` 分为 `adapters`（按当前 URL 路由）、`bing-adapter` / `baidu-adapter`（读各引擎页面）、`content`（生命周期）、`protocol`（消息过滤）、`service`（后台任务）、`card`（文本渲染）和 `settings`（版本化开关）。网络仍只在后台的核心 transport 中发生。

内容脚本使用端口 `namefirst-pro:search:v2`。后台验证扩展 ID、顶部 frame、活动文档和支持的搜索 URL，再从 `chrome.tabs.get` 的当前地址取得查询；`sender.url` 在 `pushState` 后可能仍是初始地址，不能作为当前查询。当前地址必须与发送者同源；STATE 携带浏览器查询与引擎，前端再次核对本页 URL。运行前和发布结果前再次检查查询/任务所有权。

| 方向 | 消息 | 边界 |
| --- | --- | --- |
| 后台 → 页面 | `STATE { engine, query, state }` | 状态来自可信设置和真实网站权限；查询来自浏览器 |
| 页面 → 后台 | `RESOLVE { requestId, candidates }` | requestId 为 8—80 位字母数字/连字符；最多 12 个候选，拒绝其他顶层字段 |
| 后台 → 页面 | `PROGRESS { requestId, taskId, stage }` | 仅当前任务更新进度 |
| 后台 → 页面 | `RESULT { requestId, result }` | 只含有限候选/相关证据摘要，去除原 HTML、页面链接清单和请求轨迹 |
| 页面 → 后台 | `CANCEL` / `OPEN_SETTINGS` / `PAUSE_ENGINE` | 取消或固定设置操作，不能选择读取地址 |
| 后台 → 页面 | `INVALIDATED` / `ERROR` / `ACTION_DONE` | 设置/权限变化先中止旧任务，再由页面重新读取状态 |

候选标题必须与当前实体相关；URL 再次经过公开 HTTPS 检查、去重并剔除引擎跳转目标，丢弃 `official`、分数和证据字段。Bing 包装链接展开、百度 `mu` / `data-landurl` 仅是候选提示，绝不构成认证。百度不透明 `/link` 没有安全显式目标时跳过，不读取跳转端点，不猜展示域名；广告结果排除。内容脚本不接收网页 postMessage 或执行页面代码。

同标签页最多一个活动端口，跨标签页最多 3 个正在运行的任务；每标签页每分钟 30 次，同查询重试至少间隔 1 秒。连接断开、查询变化、页面关闭、设置或权限变化均取消，旧完成/旧 disconnect 不能覆盖新任务。

单次 `GET_SEARCH_STATE` 仅向合格搜索 frame 返回状态。`GET_STATE`、`SET_SETTINGS` 和阶段 0 的 `PROBE_PAGE` 只向确切受信 `popup.html` 开放；不能从搜索页调用诊断作为任意地址代理。

开关结构为 `{ version: 3, enabled, bingEnabled, baiduEnabled, learningEnabled, promptsEnabled }`，五项均为 boolean，键为 `namefirstProSettings`；兼容读取 L2/L3 版本 1/2 并保留旧偏好，修改后写版本 3。异常结构关闭功能。暂停所用引擎由后台从发送者与当前标签页推导，页面不能指定要暂停另一个引擎。没有全部查询历史或证据缓存；明确标签/个人记录按下节独立保存。页面结果区重建时重挂已有卡片，不重新发出网络请求；资料查询不显示卡片，不确定查询先进行本次确认。结果区不存在或不可见时不取证；监听有限样式/可见性属性和资源加载事件，恢复可识别可见布局后再开始。本次隐藏在同查询结果区暂时消失/恢复后仍有效。

## L4 本地视图与反馈

`GET_SEARCH_VIEW` 仅向合格搜索 frame 返回当前浏览器查询的意图、单个个人目标、提示预算结论和短期 token。`GET_ACTIVE_VIEW` 仅供受信弹窗读取当前搜索页，或从卡片打开设置时对应的搜索页。普通资料查询也执行本地判断，默认不显示官网卡片。

`LEARNING_ACTION { token, action }` 允许 `LABEL`、`SAVE_PERSONAL`、`REJECT_PERSONAL`、`UNDO` 和不持久化的 `CONFIRM_ONCE`。查询不由消息指定，标签只允许 navigation/informational；网址只写个人记录，不发起任意 URL 请求。训练向量、官方标记和模型对象不能从消息输入。写入前重新检查当前 tab 查询、来源及学习开关。整页加载清除旧令牌。

`GET_LEARNING_SUMMARY` 返回有限计数/版本/最近一步撤销标识；`UNDO_LEARNING { id, revision }` 只供确切受信弹窗调用。所有数据写入在后台串行执行，旧撤销无法覆盖后续更改。`namefirstProLearning` 与官网证据分开存储，个人目标以 `status: personal` 返回，并且没有本次认证时间。

后台在每次取证前取得可信学习上下文，将 `model` 和 `feedbackLabel` 注入 `createResolver`；未确认的不确定任务被拒绝启动，资料意图直接返回 `not-navigation`，不会因页面主动发 `RESOLVE` 而联网。模型/个人记录损坏时保留原数据，核心退回规则判断。认证仍必须满足原始来源及目标证据政策。

更多 schema、特征、限频、容量、内部可移植边界及用户操作见 [LEARNING.md](./LEARNING.md)。备份/导入导出 UI 属于 L5。
