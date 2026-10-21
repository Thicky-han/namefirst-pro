# L1 依赖与来源记录

日期：2026-10-21。版本从官方 npm 元数据核对，源码说明及许可从上游和本地安装包读取；不是完整供应链安全审计。

| 依赖 | 锁定版本 | 用途 | 许可 |
| --- | --- | --- | --- |
| parse5 | 8.0.1 | 不依赖浏览器 DOM 的 HTML 语法解析，不运行远端脚本 | MIT |
| entities | 8.1.0，parse5 间接依赖 | HTML 实体解码 | BSD-2-Clause |
| tldts | 7.4.19 | 注册域与发布者分组，包含私有托管后缀 | MIT |
| tldts-core | 7.4.19，间接依赖 | 域名解析核心 | MIT |
| esbuild | 0.28.2，开发依赖 | 将核心和依赖打包为可加载浏览器 ESM | MIT |
| Playwright | 1.63.0，开发依赖 | 独立配置的实际浏览器验收 | Apache-2.0 |

运行时的四份完整第三方许可由构建脚本从锁定安装包复制到 `third-party-notices.txt`。域名后缀数据来自 Public Suffix List，保留来源及 MPL-2.0 说明；完整文本见 [LICENSES/MPL-2.0.txt](./LICENSES/MPL-2.0.txt)，构建包也携带该文本。原创部分继续采用 AGPL-3.0-only，第三方权利不被覆盖。

锁文件固定所有解析版本。`pnpm-workspace.yaml` 只允许 esbuild 的构建脚本，并保存 pnpm 为这次两个固定 tldts 版本生成的发布时间例外；不使用通配的生命周期脚本授权。esbuild 的本机平台二进制由锁定的可选依赖提供，不是扩展运行时依赖。

核心打包后约 0.46 MiB，实际字节以本次构建输出为准。插件不在运行时从 CDN 获取库，不把开发工具、安装器或测试配置复制进成品。

来源：

- [parse5 上游](https://github.com/inikulin/parse5)
- [tldts 上游](https://github.com/remusao/tldts)
- [esbuild 上游](https://github.com/evanw/esbuild)
- [Public Suffix List](https://publicsuffix.org/list/)
- [Apache 项目目录说明](https://projects.apache.org/about.html)：说明官方维护主体、DOAP 来源及 JSON 生成机制。
- [Apache 在线项目数据](https://projects.apache.org/json/foundation/projects.json)：现场查询，不随项目复制实体表。
- [Wikibase API](https://www.mediawiki.org/wiki/Wikibase/API)：候选名称和声明的读取接口。
- [Wikidata P856](https://www.wikidata.org/wiki/Property:P856)：可能包含当前或历史网站，仅用作线索。

本项目没有导入这些项目的完整应用或 Git 历史；公开页面和 JSON 只在查询时读取，测试报告保留必要摘要，开发产物处于忽略目录。
