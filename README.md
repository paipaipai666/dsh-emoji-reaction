# Emoji reaction

一个娱乐性插件：给模型一个 `express_reaction` 工具，让它偶尔在消息上"贴"一个 emoji，而不是再用文字回答。

灵感来自 [AgentNexus](D:\code\AgentNexus) 的 `agentnexus/tools/user_reaction.py`，顺手把展示也接进了 Harness 的客户端 slot。

## 它长什么样

反应贴在你自己的消息气泡上方，一行小字，没有边框和底色：

- `🤩 这需求我能吹一年` —— 带评论
- `😑 无语` —— 只有 emoji，名字走翻译
- 一轮里贴了多个反应时，它们按调用顺序排成一行，放不下就换行

工具调用本身不再出现在折叠的工具步骤里：插件占住了 `tool.call.toolview` 的 `express_reaction` 键并渲染空节点，既不让通用工具行冒出来，也不留药丸。

## 反应表

| 名字 | emoji | 什么时候用 |
| --- | --- | --- |
| `like` | 👍 | 认可 |
| `dislike` | 👎 | 想法不行 |
| `excited` | 🤩 | 好玩、有野心的点子 |
| `frustrated` | 😔 | 同一个问题又来了 |
| `confused` | 🤔 | 需求自相矛盾 |
| `speechless` | 😑 | 无话可说 |
| `surprised` | 😲 | 没想到 |
| `sleepy` | 🥱 | 太无聊 |

## Config

十个字段，全部 `.volatile()`，改完下一次调用就生效，不用重启：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `emojiLike` … `emojiSleepy` | 见上表 | 八个内置反应各自的 emoji，改成什么都行 |
| `customReactions` | `[]` | 自定义反应，每条 `{ name, emoji }`，例如 `大肥鱼` / `🐟` |
| `size` | `11` | 印章字号（px，8–20），emoji 比正文大 1px |

**入口在「设置」里**：设置 → 表情回应（左栏，排在「Agent 预设」和「桌宠配置」之间）。这一页由插件自己注册 `settings.section` 的 `id: emoji-reaction` / `order: 25` 得到，分成三张卡：

- **反应**：八个内置反应排成网格，点一个就地展开调色板（84 个常用 emoji，也可以直接粘贴）；选中即刻预览，保存后生效。
- **自定义反应**：一行一个，`emoji 按钮 + 名字 + 删除`，名字随便写（「大肥鱼」就行）。保存时校验名字非空、不重复、不和内置名字撞车。
- **字号**：8–20 的滑杆，右侧直接用草稿字号画出两枚印章预览，所见即所得。

保存是一次 `mutate`：8 个 emoji 字段各一条 `{ op: 'set' }`、`customReactions` 整条数组一条 `set`、加上 `size`。之所以整条数组一起写，是因为 `dsh-settings` 只允许「完全 volatile 的路径」——`['customReactions']` 可以，`['customReactions', 0, 'emoji']` 会被判为 `Config field … is not volatile`。

为什么不是自动生成的表单：`dsh-settings` 的 `autoGenerate` 至今没有客户端实现（README 原话 "no shipped client does so yet"），所以每个插件都得自己渲染。插件在这里做的是读 `configForms.get('emoji-reaction')` 这个 Host 表单控制器（`getSnapshot()` / `subscribe()` / `mutate(ops, revision)`），并在 `configForms.whileServed(['emoji-reaction'], …)` 里注册这一页 —— 如果某个部署没有把 Config 暴露出来，左栏就不会多出一栏死页面。

同一份表单也注册在 `plugins.row.config` 的 `<包名>#<行 id>` 键上，理论上插件管理页的详情里也会有入口；目前实际可用的入口是「设置」这一页。

改 emoji 只换外观，模型在调用参数里只给名字。但**自定义反应的名字必须让模型知道**，所以工具参数 `reaction` 不是枚举，而是普通字符串；插件另外往 system prompt 里加了一节（`order: 2950`，紧挨着 `TOOL_REPORT`），内容是当前可用的全部名字：

```text
`express_reaction` accepts these reaction names: like 👍, dislike 👎, …, sleepy 🥱.
The user also defined custom reactions: 大肥鱼 🐟.
```

这一节的 `text` 是个函数，每次组装 prompt 时现算，所以在设置里加完自定义反应，下一轮模型就能用；名字写错时 `execute` 会拒掉并列出有效值。客户端要显示你配置的 emoji，靠的是工具结果上的 `presentationMeta`：它把这次真正用到的 emoji 和字号一起塞进结果的 `meta`，气泡再从 Chat Node 的 `root.meta` 里读出来。这也是客户端 bundle 能拿到 Host Config 的唯一通道（启动图里没有 config 字段）。

## 语言

客户端词典覆盖 `zh / en / ja / ko / fr / es / de / ru / pt`；emoji 本身不翻译。

## 设计取舍

- **可选，且默认不用。** 描述里明确写了大多数消息不需要反应，正经干活时不要贴 emoji。娱乐插件一旦变成噪音就不娱乐了。
- **工具本身没有副作用。** 只校验名字、把评论折叠空白并截断到 50 字，然后原样回显；展示完全交给客户端 slot：`tool.call.toolview`（空节点，压掉工具行）、`conversation.chat.user.before`（气泡上方那行印章）、`settings.section`（设置页里的表单）和 `plugins.row.config`（同一份表单的插件详情入口）。
- **气泡怎么找到自己的消息。** 该链式 slot 只给到消息的 `source`（里面有 `rpcId`），所以客户端在 Chat 快照里按 `rpcId` 找到这条用户消息对应的 Chat Node，再取它所在 Turn 里所有 `express_reaction` 调用。Turn 优先按 `location.turn` 判定；工具结果的 Node 上没有 turn 时，改用「本消息 `anchorSeq` → 下一条用户消息 `anchorSeq`」这个区间兜底——只按 `anchorSeq > 本消息` 兜底会把后面每一轮的反应都回贴到前面的消息上。全部是派生数据，不写会话、不建客户端 store。
- **Config 只在 Host 侧。** 客户端 bundle 从启动图拿到的是 `{ id, url, rev, inject, external, immediately }`，没有 config；所以客户端的取值只能跟着工具结果走，而不是自己去读配置。
- **保留 `presentCall`。** 客户端 bundle 没加载时，工具行仍然是可读的文字，而不是空行。

## 安装

已发布到 npm：`dsh-emoji-reaction@0.1.1`。

### 桌面端（无需命令行）

**设置 → 插件 → 添加插件**，输入包名：

```
dsh-emoji-reaction
```

确认来源、装好，刷新页面即可。插件管理器接受 npm 包名、GitHub 仓库地址或本机目录路径；它会校验包里的 `dsh.bundle`，没声明的包会被拒绝为「这个包没有声明组合包，无法作为插件安装」。

### 命令行（`dsh web` 等自管 profile）

先装好 `@deepseek-ai/dsh`，然后：

```sh
dsh plugin --profile web add dsh-emoji-reaction
```

装完重启 `dsh web`。`dsh plugin` 只是把剩下的参数原样转给 profile 目录里的 pnpm，所以 `remove`、`why` 也能直接用：

```sh
dsh plugin --profile web remove dsh-emoji-reaction
```

桌面端使用的 `desktop` profile 由 Electron 应用单独管理，命令行会直接拒绝：

```
error: profile "desktop" is managed exclusively by the Electron application
```

### 从 GitHub 源码

```sh
dsh plugin --profile web add github:paipaipai666/dsh-emoji-reaction
```

### 本地目录（开发）

```js
plugin_manager({ action: 'install_bundle', target: 'D:\\code\\dsh\\dsh-emoji-reaction' })
```

### 插件市场

还没收录进 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 的精选目录，所以现在在 **插件 → 插件市场** 里搜不到（dshmarket 只安装精选列表内的来源）。收录之后可以直接搜名字一键安装。

本地目录安装得到的是软链接。`client.js` 改完**刷新页面**即可；`index.js` 改完**必须重启入口**——链接目录里的 Host 文件不会被重新 import，用 `plugin_manager` 把 bundle 禁用再启用一次（或重启 DSH）就行。判断是否生效看 `cordis_inspect_query` 的 `Config/listConfigs`：`absent` 是旧代码，`schema` 才是新代码。

## 卸载

```sh
dsh plugin --profile web remove dsh-emoji-reaction
```

桌面端在 **设置 → 插件 → 已安装** 里卸载；本地链接安装也可以用 `plugin_manager({ action: 'remove_bundle', target: 'dsh-emoji-reaction' })`。