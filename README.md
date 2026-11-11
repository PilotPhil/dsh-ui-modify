# dsh-ui-modify

针对 DeepSeek Harness Web 界面的小改动合集。所有改动都从「设置 → 界面优化」里的分类页面控制；偏好保存在当前 profile 的插件配置中。

## 结构

设置页按**界面区域**分类，方便以后增加其他区域的优化：

- **侧边栏**
  - **按钮可见性**：自动发现侧栏上的所有按钮，逐个控制显示/隐藏；
  - **桌面菜单**：把隐藏的面板按钮和「新会话」放进桌面应用顶部菜单栏的新菜单；
  - **按钮布局**：把侧栏按钮统一排成 2 列网格（顶部/底部/保持原样）。
- **其他区域**：预留，后续针对主界面、对话等区域的优化会显示在这里。

## 侧边栏

### 按钮可见性（自动发现）

列表由三部分组成：

1. **原生控件**
   - 「更多」按钮：仅在 `sidebar.panellist.actions` 有注册项（官方侧栏会因此渲染该按钮）时出现；
   - 「新会话」按钮：官方侧栏顶部的原生按钮。
2. **面板按钮**：读取 `sidebar.panellist` 的注册项，例如「插件」「上下文洞察」「自动化任务」。
3. **底部动作**：读取 `sidebar.footer.action` 的注册项，例如 `Remote`、流量卡片。

列表随插件启用/禁用和界面语言变化自动更新。每一项一个开关；隐藏方式：

- **原生控件**：注入作用域很窄的样式规则（更多按钮只匹配左侧栏面板列表里的菜单按钮；新会话按钮只匹配侧栏里的 `newSession` 按钮）。
- **面板按钮**：用同一个 id、更低 `priority` 注册一个“影子”图标（slot 注册表本身支持最低优先级遮蔽），影子只渲染一个标记，再由一条 CSS 规则隐藏整行。面板本身仍可通过「更多」菜单等方式打开。
- **底部动作**：同样用更低 priority 的影子注册，但组件返回 `null`，原组件不再挂载；重新打开后原注册自动恢复。

底部动作多数没有注册 `label`，列表中会回退显示插件 id（如 `ds-harness-remote`、`dsh-flowmeter`）。插件卸载或某项消失时，列表和影子注册会自动清理；配置中残留的键在条目重新出现时继续生效。

### 桌面菜单（仅桌面应用）

开启「在桌面菜单栏中显示隐藏项」后，页面会把隐藏项列表发给 Host，Host 在 **Electron 应用顶层菜单栏**（macOS 屏幕顶部 DeepSeek Harness / 文件 / Edit / Window 所在的那一行）新增一个菜单，标题为「隐藏的侧栏按钮」，菜单项是：

- 隐藏的**面板按钮**（插件、上下文洞察、自动化任务等）→ 点击打开对应面板；
- 隐藏的**「新会话」**→ 点击启动一个新会话。

实现方式：

- Client 通过 `POST /dsh-ui-modify/app-menu` 把当前隐藏项（或空列表）发给 Host；
- Host 用 Electron `Menu` / `MenuItem` 把我们的顶层菜单项插到应用菜单末尾，并监听点击；
- 点击时 Host 向页面派发 `dsh-ui-modify:menu-command` 事件，Client 再调用 `layout.selectPanel()` 或 `uiWorkspace.startSession()`；
- 桌面外壳重建菜单（切换语言、更新）后，Host 会定时把菜单项补回去；
- 没有隐藏项或开关关闭时，菜单项隐藏；仅在桌面应用中生效，普通浏览器（`dsh web`）没有应用菜单，Host 会返回 `desktop: false`。

**底部动作**（`Remote`、流量卡片）不放进桌面菜单：它们不是可导航的面板项，无法用一个通用命令可靠地触发，隐藏后仍保持隐藏。

### 按钮布局

不同插件把按钮放在不同位置：面板按钮在顶部，`Remote` 等底部动作在最底部。选择布局模式后，本插件用 `display: contents` + flex `order` 把两个容器放到一起，并分别设为相同的 2 列 grid：

- **顶部 2 列**：按钮组排在工作区列表上方；
- **底部 2 列**：按钮组排在工作区列表下方、账号与设置行上方；
- **保持原样**：不注入任何布局规则。

只在侧栏展开态生效，收起的窄轨道保持原样。流量卡片属于底部动作区，会随按钮组一起移动；账号与设置行始终保留在最底部。

## 偏好存储

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `hiddenSidebarItems` | `[]` | 统一列表中隐藏的条目，键形如 `native:more`、`panellist:plugins`、`footer:<id>` |
| `sidebarButtonLayout` | `default` | `default` / `top` / `bottom`：侧栏按钮排列 |
| `showHiddenInAppMenu` | `false` | 是否把隐藏的面板按钮和「新会话」放进桌面应用菜单栏 |
| `showSidebarMore` | `true` | **兼容旧版**：等价于隐藏 `native:more` |
| `showScheduledTasks` | `true` | **兼容旧版**：等价于隐藏 `panellist:schedules` |
| `showNewSession` | `true` | **兼容旧版**：等价于隐藏 `native:newSession` |

- 字段都声明为 `volatile`，修改后立即生效，不会重启插件；
- 配置由 DSH 的设置编辑器持久化到当前 profile 的补丁层，重启应用、换浏览器都不会丢失；
- 浏览器端通过 `ctx.configForms` 读取同一份配置，多个窗口保持一致；
- 旧版三个布尔字段仍被读取；在统一列表里重新打开对应项时会自动把它们清回 `true`。

Host 半在 `index.js` 中声明 `Config`，并用 `settings.configure({ auto: false })` 表明本插件自带设置页，避免插件管理器再生成一份配置表单。

## 实现

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：`Config`、设置呈现策略、Electron 应用菜单与 `/dsh-ui-modify/app-menu` 路由。 |
| `client.js` | Client 半：分类设置页、配置表单订阅、按钮发现、影子注册、布局与隐藏样式、桌面菜单同步。 |
| `cordis.patch.yml` | 插入 Host 行 `dsh-ui-modify`。 |
| `locale/*.json` | 插件在插件管理器中的标题与描述。 |
| `icon.svg` | 插件图标。 |

所有资源（样式标签、slot 注册、订阅）都挂在插件自己的 `ctx.effect` / `ctx.slots.inject` 上，卸载插件时一并移除。

## 安装

在 DSH 的当前 profile 中安装本目录：

```
plugin_manager install_bundle <本目录绝对路径>
```

Host 半依赖 `@deepseek-ai/schemastery`（已写入 `dependencies`），在目录内执行 `npm install` 即可。
安装后可在「设置 → 界面优化 → 侧边栏」看到自动发现的按钮列表与布局选项。
