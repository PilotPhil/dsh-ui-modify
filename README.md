# dsh-ui-modify

针对 DeepSeek Harness Web 界面的小改动合集。所有改动都从「设置」里的独立页面开关控制。

## 功能

### 1. 隐藏左侧栏的「更多」按钮

DSH 左侧栏的面板列表末尾有一个「更多」按钮（`更多` / `More`），它由官方侧栏在 `sidebar.panellist.actions` 有注册项时渲染。这个按钮没有对应的 slot 可以关闭，因此本插件用一个作用域极窄的样式规则隐藏它：

- 只匹配左侧栏面板列表（`nav[class*="panelList"]`）里打开菜单的那个按钮；
- 不影响会话头部的「更多会话视图」和右侧栏的「更多工具」。

### 2. 隐藏左侧栏的「自动化任务」入口

「自动化任务」是官方 Sidebar 面板列表里的一个面板行（id `schedules`）。侧栏总是为每个 `sidebar.panellist` 注册项渲染一行，没有删除它的 slot。本插件按该行的可访问标签（覆盖官方 8 种界面语言：中文、英文、日文、西班牙文、法文、德文、俄文、葡萄牙文）匹配并隐藏整行：

- 只隐藏左侧栏的入口，不影响已创建的自动化任务，也不影响主面板；
- 不会影响其他面板行。

### 3. 隐藏左侧栏顶部的「新会话」按钮

侧栏顶部的「新会话」按钮是普通按钮，没有可见性 slot。本插件按其稳定的样式类名隐藏它：

- 只隐藏侧栏里的这个按钮（展开态和收起轨道都不再显示）；
- 品牌名行、窗口标题栏里的新建会话控件不受影响。

三个开关都位于「设置 → 界面优化」，默认全部开启（保持 DSH 原始外观）；关闭某项时才会注入对应的隐藏规则，重新开启后不残留任何全局样式。

### 4. 统一侧栏按钮布局（可选，默认关闭）

不同插件把按钮注册在不同的 slot：官方「插件」「上下文洞察」「自动化任务」在顶部的 `sidebar.panellist`，`Remote` 和流量卡片在底部的 `sidebar.footer.action`。本插件可以把这两组容器一起重排成一个连续的 **2 列网格**：

- **顶部 2 列**：面板按钮 + 底部动作按钮排在工作区列表上方；
- **底部 2 列**：同一组按钮排在工作区列表下方、账号与设置行上方；
- **保持原样**：不注入任何布局规则，完全使用 DSH 原始布局。

实现方式不改动其他插件的组件，也不搬 DOM：用 `display: contents` 让底部动作容器参与侧栏的纵向排布，再用 flex `order` 把两组容器放到一起，两个容器各自设为相同的 2 列 grid。收起为窄轨道时该布局不生效。

> 注意：流量卡片（flowmeter）属于底部动作区，会随「顶部 2 列」一起移动到顶部；账号与设置行始终保留在最底部。

## 偏好存储

开关写入本插件在当前 profile 中的 Host 配置字段：

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `showSidebarMore` | `true` | 是否显示左侧栏「更多」按钮 |
| `showScheduledTasks` | `true` | 是否显示左侧栏「自动化任务」入口 |
| `showNewSession` | `true` | 是否显示左侧栏「新会话」按钮 |
| `sidebarButtonLayout` | `default` | `default` / `top` / `bottom`：侧栏按钮的统一排列方式 |

- 字段都声明为 `volatile`，修改后立即生效，不会重启插件；
- 配置由 DSH 的设置编辑器持久化到当前 profile 的补丁层，重启应用、换浏览器都不会丢失；
- 浏览器端通过 `ctx.configForms` 读取同一份配置，多个窗口保持一致。

Host 半在 `index.js` 中声明 `Config`，并用 `settings.configure({ auto: false })` 表明本插件自带设置页，避免插件管理器再生成一份配置表单。

## 实现

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：`Config`（三个 volatile 布尔字段）与设置呈现策略。 |
| `client.js` | Client 半：设置页（`settings.section`）、配置表单订阅、三条隐藏规则。 |
| `cordis.patch.yml` | 插入 Host 行 `dsh-ui-modify`。 |
| `locale/*.json` | 插件在插件管理器中的标题与描述。 |
| `icon.svg` | 插件图标。 |

所有资源（样式标签、slot 注册）都挂在插件自己的 `ctx.effect` / `ctx.slots.inject` 上，卸载插件时一并移除。

## 安装

在 DSH 的当前 profile 中安装本目录：

```
plugin_manager install_bundle <本目录绝对路径>
```

Host 半依赖 `@deepseek-ai/schemastery`（已写入 `dependencies`），在目录内执行 `npm install` 即可。
安装后可在「设置 → 界面优化」看到三个开关。
