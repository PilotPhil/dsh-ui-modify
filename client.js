/**
 * dsh-ui-modify — targeted UI refinements for the DSH Web interface (Client half).
 *
 * The settings page is grouped by interface area so later refinements can add
 * their own category. The Sidebar category currently owns:
 *
 * - an automatically discovered list of every sidebar button (native controls
 *   and slot registrations), each with its own visibility switch;
 * - an optional 2-column layout that groups the panel list and footer actions.
 *
 * Native controls are discovered from the shipped shell's stable behavior:
 * the More launcher exists while `sidebar.panellist.actions` has registrations,
 * and the New session button is a plain button. Slot-registered panel and
 * footer entries are discovered from the client slot registry, and hidden ones
 * are shadowed by a lower-priority registration, so no DOM nodes are moved and
 * no component is mounted twice.
 *
 * The preferences live in the Host plugin's volatile Config, so they survive
 * restarts and are shared across browsers. This half registers the Settings
 * page that edits them and keeps the injected stylesheet and shadow
 * registrations in sync with the configuration form projection.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ui-modify',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace owned by this plugin. */
    const NS = 'uiModify';
    /** Host plugin entry id; also this plugin's settings namespace. */
    const SETTINGS_NS = 'dsh-ui-modify';
    /** Volatile Config field names declared by the Host half. */
    const SHOW_MORE_FIELD = 'showSidebarMore';
    const SHOW_TASKS_FIELD = 'showScheduledTasks';
    const SHOW_NEW_SESSION_FIELD = 'showNewSession';
    const SIDEBAR_LAYOUT_FIELD = 'sidebarButtonLayout';
    const HIDDEN_ITEMS_FIELD = 'hiddenSidebarItems';
    const COLLAPSED_FIELD = 'sidebarButtonsCollapsed';
    const COLLAPSE_TOGGLE_ID = 'ui-modify-collapse-buttons';
    /** The two slot containers that render sidebar buttons. */
    const PANEL_SLOT = 'sidebar.panellist';
    const FOOTER_SLOT = 'sidebar.footer.action';
    /** Slot whose registrations make the shipped sidebar render its More launcher. */
    const PANEL_ACTION_SLOT = 'sidebar.panellist.actions';
    /** Keys for native controls that are not slot registrations. */
    const NATIVE_MORE_KEY = 'native:more';
    const NATIVE_NEW_SESSION_KEY = 'native:newSession';
    /** The Automation tasks row is a normal panel entry; this is its key. */
    const SCHEDULES_KEY = 'panellist:schedules';
    /**
     * Lowest priority wins a slot cell. Registering the same id at a lower
     * priority than the original registration shadows it (documented by the
     * slot registry), which is how a per-item switch removes an arbitrary
     * plugin button without moving DOM nodes.
     */
    const SHADOW_PRIORITY = -1e9;

    /**
     * The sidebar renders the More launcher as the Menu root element — a direct
     * child of the panel-list `nav` — with the panel row button inside it. The
     * rule targets that launcher only: the local class name suffix keeps it
     * scoped to the left sidebar even when the hashed prefix changes, and the
     * structural selector covers a future version that stops exporting the
     * `moreAnchor` class.
     */
    const HIDE_SIDEBAR_MORE_CSS = [
      '/* dsh-ui-modify: hide the left sidebar panel-list More launcher */',
      'nav[class*="panelList"] > span[class*="moreAnchor"],',
      'nav[class*="panelList"] > span:has(button[aria-haspopup="menu"]),',
      'nav[class*="panelList"] > button[aria-haspopup="menu"] {',
      '  display: none !important;',
      '}',
    ].join('\n');

    /**
     * The New session button is the only sidebar button whose local class name
     * is `newSession` (the brand row above it also starts a session, but uses
     * the `brand` class and stays visible). Hiding the button removes its own
     * margin and text, so the sidebar closes the gap.
     */
    const HIDE_NEW_SESSION_CSS = [
      '/* dsh-ui-modify: hide the left sidebar New session button */',
      'button[class*="newSession"] {',
      '  display: none !important;',
      '}',
    ].join('\n');

    /**
     * Reflow the expanded sidebar's two button containers into one 2-column
     * block. The global panel list (`sidebar.panellist` rows) and the footer
     * actions (`sidebar.footer.action` entries such as Remote) live in separate
     * containers, so this promotes the footer container's children into the
     * sidebar's flex column with `display: contents`, then uses flex `order` to
     * move both containers together. Each container becomes a matching
     * 2-column grid, which keeps their columns aligned.
     * @param {'top' | 'bottom'} placement - where the block sits relative to the workspace list.
     * @returns {string} CSS text.
     */
    function unifiedSidebarCss(placement) {
      const navOrder = placement === 'top' ? 10 : 20;
      const footerOrder = placement === 'top' ? 11 : 21;
      const regionOrder = placement === 'top' ? 20 : 10;
      const scope = ':has(> nav[class*="panelList"]):not([class*="collapsed"])';
      return [
        '/* dsh-ui-modify: unify sidebar buttons into a 2-column block */',
        `${scope} > [class*="footArea"] { display: contents; }`,
        `${scope} > [class*="regionArea"] { order: ${regionOrder}; }`,
        `${scope} > nav[class*="panelList"] {`,
        '  display: grid !important;',
        `  order: ${navOrder};`,
        '  grid-template-columns: repeat(2, minmax(0, 1fr));',
        '  gap: 4px;',
        '  margin: 0 0 4px;',
        '}',
        `${scope} > nav[class*="panelList"] button[class*="panelRow"] { width: 100%; }`,
        `${scope} > [class*="footArea"] > [class*="footerActions"] {`,
        '  display: grid;',
        `  order: ${footerOrder};`,
        '  grid-template-columns: repeat(2, minmax(0, 1fr));',
        '  gap: 4px;',
        '  margin: 0;',
        '}',
        `${scope} > [class*="footArea"] > [class*="footerActions"] > [data-slot="sidebar.footer.action"] { display: contents; }`,
        `${scope} > [class*="footArea"] > [class*="footerActions"] [class*="dshfm-quota"] { grid-column: 1 / -1; order: 10; }`,
        `${scope} > [class*="footArea"] > [class*="footerActions"] .dshRemoteSidebarEntry.isWide { width: auto; max-width: none; min-width: 0; }`,
        `${scope} > [class*="footArea"] > [class*="footerActions"] .dshRemoteSidebarEntry.isWide .dshRemoteModeButton { width: 100%; }`,
        `${scope} > [class*="footArea"] > [class*="settingsArea"] { order: 30; }`,
      ].join('\n');
    }

    /**
     * Marker rendered by a shadowed panel glyph. The matching rule hides the
     * containing panel row, which keeps the row's button, label and click
     * behavior owned by the shipped sidebar while making it invisible.
     */
    const HIDE_SHADOWED_PANEL_CSS = [
      '/* dsh-ui-modify: hide a panel row hidden through the dynamic item list */',
      'nav[class*="panelList"] > :has([data-dshuim-hidden-panel]) {',
      '  display: none !important;',
      '}',
    ].join('\n');

    /** Glyph stand-in for a hidden panel entry (it only carries the marker). */
    function HiddenPanelGlyph() {
      return h('span', { 'data-dshuim-hidden-panel': '' });
    }

    /** Stand-in for a hidden footer action: renders no box at all. */
    function HiddenFooterAction() {
      return null;
    }

    /**
     * Small footer row that folds the panel/footer button area. Registered as
     * a footer action so it stays mounted while the other actions are hidden;
     * `data-collapsed` is the marker the folded CSS keys off.
     * @param {object} props - slot props with the configuration form and the toggle action.
     * @returns {object} the collapse row.
     */
    function CollapseButton(props) {
      const t = props.t;
      const form = props.useForm((snapshot) => snapshot);
      const ready = form.status === 'ready';
      const collapsed = ready && form.value?.[COLLAPSED_FIELD] === true;
      return h('div', {
        className: 'dshuim_collapseRow',
        'data-dshuim-collapse-toggle': '',
        'data-collapsed': collapsed ? 'true' : 'false',
      },
      h('button', {
        type: 'button',
        className: 'dshuim_collapseButton',
        title: t(collapsed ? 'expandButtonArea' : 'collapseButtonArea'),
        'aria-expanded': collapsed ? 'false' : 'true',
        disabled: !ready,
        onClick: () => {
          props.toggle?.();
        },
      },
      h('svg', { width: 10, height: 10, viewBox: '0 0 10 10', 'aria-hidden': 'true' },
        h('path', {
          d: collapsed ? 'M2 4 L5 7 L8 4' : 'M2 6 L5 3 L8 6',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.4,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        })),
      h('span', null, t(collapsed ? 'expandButtonArea' : 'collapseButtonArea'))));
    }

    /**
     * Resolve one registered slot label (string or thunk) without throwing.
     * @param {unknown} option - the registration's label option.
     * @returns {string | undefined} the resolved label.
     */
    function resolveItemLabel(option) {
      try {
        const value = typeof option === 'function' ? option() : option;
        return typeof value === 'string' && value.trim() !== '' ? value : undefined;
      } catch {
        return undefined;
      }
    }

    /**
     * Read the sidebar's own registrations. Raw entries (not the deduplicated
     * slot view) are used so a hidden item's original registration is still
     * discoverable while this plugin shadows it. Native controls are discovered
     * from their shipped conditions: the More launcher exists while its actions
     * slot has registrations, and the New session button belongs to the shell.
     * @param {object} ctx - the browser plugin context.
     * @param {(key: string) => string} t - this plugin's locale reader.
     * @returns {Array<{ key: string, kind: 'native' | 'panellist' | 'footer', id: string, label: string, order: number }>} discovered items.
     */
    function readSidebarItems(ctx, t) {
      const items = [];
      const seen = new Set();
      const kindRank = { native: 0, panellist: 1, footer: 2 };
      let actions = [];
      try {
        actions = (typeof ctx.slots.entriesOfSlot === 'function'
          ? ctx.slots.entriesOfSlot(PANEL_ACTION_SLOT)
          : ctx.slots.entries(PANEL_ACTION_SLOT)) ?? [];
      } catch {
        actions = [];
      }
      if (actions.length > 0) {
        items.push({ key: NATIVE_MORE_KEY, kind: 'native', id: 'more', label: t('moreButton'), order: -100 });
      }
      items.push({ key: NATIVE_NEW_SESSION_KEY, kind: 'native', id: 'newSession', label: t('newSession'), order: -90 });
      for (const [kind, slot] of [['panellist', PANEL_SLOT], ['footer', FOOTER_SLOT]]) {
        let entries = [];
        try {
          entries = ctx.slots.entries(slot) ?? [];
        } catch {
          entries = [];
        }
        for (const entry of entries) {
          if (entry.component === HiddenPanelGlyph || entry.component === HiddenFooterAction) continue;
          const id = entry.options?.id;
          if (typeof id !== 'string' || id === '') continue;
          // The collapse control is structural, not a user-manageable button.
          if (id === COLLAPSE_TOGGLE_ID) continue;
          const key = `${kind}:${id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const registrant = typeof entry.registrant === 'string'
            ? entry.registrant
            : typeof entry.options?.registrant === 'string' ? entry.options.registrant : undefined;
          items.push({
            key,
            kind,
            id,
            label: resolveItemLabel(entry.options?.label) ?? registrant ?? id,
            order: entry.options?.order ?? 0,
          });
        }
      }
      items.sort((a, b) => kindRank[a.kind] - kindRank[b.kind]
        || a.order - b.order
        || a.label.localeCompare(b.label));
      return items;
    }

    /**
     * Observable directory of sidebar items. Labels follow the active locale
     * and the list follows plugin enable/disable changes.
     * @param {object} ctx - the browser plugin context.
     * @param {(key: string) => string} t - this plugin's locale reader.
     * @returns {{ getSnapshot: () => Array<object>, subscribe: (listener: () => void) => () => void, dispose: () => void } | undefined} the store, or undefined when the slot registry does not expose discovery.
     */
    function createSidebarItemsStore(ctx, t) {
      if (typeof ctx.slots.entries !== 'function' || typeof ctx.slots.subscribe !== 'function') return undefined;
      let current = readSidebarItems(ctx, t);
      const listeners = new Set();
      const notify = () => {
        for (const listener of [...listeners]) listener();
      };
      const sync = () => {
        const next = readSidebarItems(ctx, t);
        const unchanged = next.length === current.length
          && next.every((item, index) => item.key === current[index].key && item.label === current[index].label);
        if (unchanged) return;
        current = next;
        notify();
      };
      const offPanel = ctx.slots.subscribe(PANEL_SLOT, sync);
      const offFooter = ctx.slots.subscribe(FOOTER_SLOT, sync);
      const offActions = ctx.slots.subscribe(PANEL_ACTION_SLOT, sync);
      const offLocale = ctx.locale.subscribe(sync);
      return {
        getSnapshot: () => current,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        dispose() {
          offPanel();
          offFooter();
          offActions();
          offLocale();
        },
      };
    }

    /** Settings page styles: own class prefix, theme tokens only. */
    const SETTINGS_CSS = `
.dshuim_section { display: flex; flex-direction: column; gap: 12px; max-width: 760px; color: var(--dsw-alias-label-primary, inherit); }
.dshuim_heading { margin: 0; font-size: 18px; font-weight: 600; line-height: 26px; }
.dshuim_intro { margin: 0; color: var(--dsw-alias-label-secondary, #8b8b8b); font-size: 13px; line-height: 20px; }
.dshuim_group { display: flex; flex-direction: column; margin-top: 2px; }
.dshuim_row { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 16px 0; border-bottom: .5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3)); }
.dshuim_text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dshuim_label { font-size: 14px; line-height: 20px; }
.dshuim_hint { color: var(--dsw-alias-label-secondary, #8b8b8b); font-size: 12px; line-height: 18px; }
.dshuim_note { margin: 0; color: var(--dsw-alias-label-secondary, #8b8b8b); font-size: 12px; line-height: 18px; }
.dshuim_failed { color: var(--dsw-alias-state-error-primary, #e5484d); }
.dshuim_switch { box-sizing: border-box; position: relative; flex: 0 0 auto; width: 36px; height: 20px; padding: 2px; border: 0; border-radius: 999px; background: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2, #b0b0b0)); cursor: pointer; }
.dshuim_switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary, #3d6df6); }
.dshuim_switch:disabled { cursor: default; opacity: .5; }
.dshuim_switch:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3d6df6); outline-offset: 2px; }
.dshuim_thumb { display: block; width: 16px; height: 16px; border-radius: 50%; background: var(--dsw-alias-label-primary-foreground, #fff); transition: transform .12s ease; }
.dshuim_switch[aria-checked="false"] .dshuim_thumb { background: var(--dsw-alias-switch-thumb, #fff); }
.dshuim_switch[aria-checked="true"] .dshuim_thumb { transform: translate(16px); }
.dshuim_select { font: inherit; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-1, transparent); border: .5px solid var(--dsw-alias-border-l2, #b0b0b0); border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.dshuim_select:disabled { cursor: default; opacity: .5; }
.dshuim_category { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding-top: 14px; border-top: .5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3)); }
.dshuim_categoryTitle { margin: 0; font-size: 15px; font-weight: 600; line-height: 22px; }
.dshuim_categoryHint { margin: 0; color: var(--dsw-alias-label-secondary, #8b8b8b); font-size: 12px; line-height: 18px; }
.dshuim_subheading { margin: 6px 0 0; font-size: 13px; font-weight: 600; line-height: 20px; }
`;

    /**
     * Collapse control and folded button-area rules.
     *
     * The toggle is registered as a footer action, so it stays mounted when the
     * other footer actions are hidden. Its `data-collapsed` attribute drives
     * the CSS, which hides the panel list and every footer action except the
     * toggle itself. The sidebar root is identified by its direct `panelList`
     * child, the same scope used by the layout rules.
     */
    const COLLAPSE_CSS = `
.dshuim_collapseRow { grid-column: 1 / -1; order: -1; display: flex; width: 100%; margin: 2px 0; }
.dshuim_collapseButton { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 26px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary, #8b8b8b); font: inherit; font-size: 11px; line-height: 1; cursor: pointer; }
.dshuim_collapseButton:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.12)); color: var(--dsw-alias-label-primary, inherit); }
.dshuim_collapseButton:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3d6df6); outline-offset: -2px; }
.dshuim_collapseButton:disabled { cursor: default; opacity: .5; }
.dshuim_collapseButton svg { flex: none; }
[class*="footerActions"] > :has(.dshuim_collapseRow) { grid-column: 1 / -1; order: -1; }
:has(> nav[class*="panelList"]):has([data-dshuim-collapse-toggle][data-collapsed="true"]) nav[class*="panelList"] { display: none !important; }
:has(> nav[class*="panelList"]):has([data-dshuim-collapse-toggle][data-collapsed="true"]) [class*="footerActions"] > :not(.dshuim_collapseRow):not(:has(.dshuim_collapseRow)) { display: none !important; }
`;

    /** Simplified Chinese copy. */
    const zh = {
      nav: '界面优化',
      title: '界面优化',
      intro: '按你的习惯调整 DSH 主界面的显示细节。偏好保存在当前 profile 的插件配置中。',
      categorySidebar: '侧边栏',
      categorySidebarHint: '控制左侧栏按钮的显示与排列。',
      subsectionVisibility: '按钮可见性',
      subsectionVisibilityHint: '自动发现侧栏上的原生控件、面板按钮与底部动作，逐个控制是否显示。',
      subsectionLayout: '按钮布局',
      categoryOther: '其他区域',
      categoryOtherHint: '后续针对主界面、对话或其他区域的优化会显示在这里。',
      moreButton: '更多按钮',
      newSession: '新会话按钮',
      sidebarLayout: '按钮排列',
      sidebarLayoutHint: '把面板按钮和底部动作按钮统一排成 2 列网格。流量卡片会随底部动作区一起移动。',
      collapseButtonArea: '折叠按钮区',
      expandButtonArea: '展开按钮区',
      collapseButtonsHint: '隐藏面板按钮、底部动作与流量卡片，只保留一行展开按钮；工作区列表和账号行不受影响。',
      layoutDefault: '保持原样',
      layoutTop: '顶部 2 列',
      layoutBottom: '底部 2 列',
      noSidebarButtons: '当前没有发现侧栏按钮。',
      kindNative: '原生控件',
      kindPanel: '面板',
      kindFooter: '底部动作',
      readOnly: '当前部署的设置为只读，无法在这里修改。',
      saveFailed: '设置没有保存成功，请稍后再试。',
    };

    /** English copy. */
    const en = {
      nav: 'UI modifications',
      title: 'UI modifications',
      intro: "Adjust how the DSH interface looks. Preferences are saved in this profile's plugin configuration.",
      categorySidebar: 'Sidebar',
      categorySidebarHint: 'Control which sidebar buttons are shown and how they are arranged.',
      subsectionVisibility: 'Button visibility',
      subsectionVisibilityHint: 'Detects native controls, panel buttons, and footer actions so each can be shown or hidden.',
      subsectionLayout: 'Button layout',
      categoryOther: 'Other areas',
      categoryOtherHint: 'Future refinements for the main view, conversation, and other areas will appear here.',
      moreButton: 'More button',
      newSession: 'New session button',
      sidebarLayout: 'Button arrangement',
      sidebarLayoutHint: 'Groups panel buttons and footer actions into one 2-column grid. The usage card moves with the footer actions.',
      collapseButtonArea: 'Collapse button area',
      expandButtonArea: 'Expand button area',
      collapseButtonsHint: 'Hides panel buttons, footer actions, and the usage card, leaving a single expand bar; the workspace list and account row stay put.',
      layoutDefault: 'Keep as is',
      layoutTop: 'Top, 2 columns',
      layoutBottom: 'Bottom, 2 columns',
      noSidebarButtons: 'No sidebar buttons were detected.',
      kindNative: 'Native control',
      kindPanel: 'Panel',
      kindFooter: 'Footer action',
      readOnly: 'This deployment stores settings read-only.',
      saveFailed: 'The setting could not be saved. Try again.',
    };

    /**
     * Observable state of the current settings write.
     * @returns {{ getSnapshot: () => { busy: boolean, failed: boolean }, subscribe: (listener: () => void) => () => void, set: (next: { busy: boolean, failed: boolean }) => void }} the store.
     */
    function createWriteState() {
      let current = { busy: false, failed: false };
      const listeners = new Set();
      const notify = () => {
        for (const listener of [...listeners]) listener();
      };
      return {
        getSnapshot: () => current,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(next) {
          current = next;
          notify();
        },
      };
    }

    /**
     * One labeled switch row.
     * @param {object} props - label, hint, checked state, disabled state, and the change callback.
     * @returns {object} the row element.
     */
    function PreferenceRow(props) {
      return h('div', { className: 'dshuim_row' },
        h('div', { className: 'dshuim_text' },
          h('span', { className: 'dshuim_label' }, props.label),
          h('span', { className: 'dshuim_hint' }, props.hint)),
        h('button', {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked,
          'aria-label': props.label,
          className: 'dshuim_switch',
          disabled: props.disabled,
          onClick: props.onChange,
        }, h('span', { className: 'dshuim_thumb', 'aria-hidden': 'true' })));
    }

    /**
     * One labeled select row.
     * @param {object} props - label, hint, current value, disabled state, and the change callback.
     * @returns {object} the row element.
     */
    function LayoutRow(props) {
      return h('div', { className: 'dshuim_row' },
        h('div', { className: 'dshuim_text' },
          h('span', { className: 'dshuim_label' }, props.label),
          h('span', { className: 'dshuim_hint' }, props.hint)),
        h('select', {
          className: 'dshuim_select',
          value: props.value,
          disabled: props.disabled,
          'aria-label': props.label,
          onChange: props.onChange,
        },
        h('option', { value: 'default' }, props.defaultLabel),
        h('option', { value: 'top' }, props.topLabel),
        h('option', { value: 'bottom' }, props.bottomLabel)));
    }

    /**
     * Settings page, grouped by interface area.
     * @param {object} props - slot props, including the locale reader, the configuration form, the item directory and the writers.
     * @returns {object} the settings section element.
     */
    function SettingsSection(props) {
      const t = props.t;
      const form = props.useForm((snapshot) => snapshot);
      const writes = props.useWrite((state) => state);
      const ready = form.status === 'ready';
      const writable = ready && form.writable === true;
      const busy = writes.busy || !writable;
      const layout = ready ? form.value?.[SIDEBAR_LAYOUT_FIELD] ?? 'default' : 'default';
      const collapsed = ready && form.value?.[COLLAPSED_FIELD] === true;
      const items = props.useItems((value) => value);
      const hiddenKeys = new Set(ready && Array.isArray(form.value?.[HIDDEN_ITEMS_FIELD])
        ? form.value[HIDDEN_ITEMS_FIELD]
        : []);
      // Legacy single-item fields keep their old behavior until the user
      // toggles that item in the unified list, which clears the legacy field.
      if (ready && form.value?.[SHOW_MORE_FIELD] === false) hiddenKeys.add(NATIVE_MORE_KEY);
      if (ready && form.value?.[SHOW_NEW_SESSION_FIELD] === false) hiddenKeys.add(NATIVE_NEW_SESSION_KEY);
      if (ready && form.value?.[SHOW_TASKS_FIELD] === false) hiddenKeys.add(SCHEDULES_KEY);
      const kindLabel = (kind) => kind === 'native'
        ? t('kindNative')
        : kind === 'panellist' ? t('kindPanel') : t('kindFooter');
      return h('div', { className: 'dshuim_section' },
        h('h2', { className: 'dshuim_heading' }, t('title')),
        h('p', { className: 'dshuim_intro' }, t('intro')),
        h('section', { className: 'dshuim_category' },
          h('h3', { className: 'dshuim_categoryTitle' }, t('categorySidebar')),
          h('p', { className: 'dshuim_categoryHint' }, t('categorySidebarHint')),
          h('h4', { className: 'dshuim_subheading' }, t('subsectionVisibility')),
          h('p', { className: 'dshuim_categoryHint' }, t('subsectionVisibilityHint')),
          items.length === 0
            ? h('p', { className: 'dshuim_note' }, t('noSidebarButtons'))
            : h('div', { className: 'dshuim_group' }, items.map((item) => h(PreferenceRow, {
              key: item.key,
              label: item.label,
              hint: item.kind === 'native' ? kindLabel(item.kind) : `${kindLabel(item.kind)} · ${item.id}`,
              checked: !hiddenKeys.has(item.key),
              disabled: busy,
              onChange: () => {
                void props.setItemHidden(item.key, hiddenKeys.has(item.key));
              },
            }))),
          h('h4', { className: 'dshuim_subheading' }, t('subsectionLayout')),
          h('div', { className: 'dshuim_group' },
            h(LayoutRow, {
              label: t('sidebarLayout'),
              hint: t('sidebarLayoutHint'),
              value: layout,
              disabled: busy,
              defaultLabel: t('layoutDefault'),
              topLabel: t('layoutTop'),
              bottomLabel: t('layoutBottom'),
              onChange: (event) => {
                void props.setPreference(SIDEBAR_LAYOUT_FIELD, event.target.value);
              },
            }),
            h(PreferenceRow, {
              label: t('collapseButtonArea'),
              hint: t('collapseButtonsHint'),
              checked: collapsed,
              disabled: busy,
              onChange: () => {
                void props.setPreference(COLLAPSED_FIELD, !collapsed);
              },
            }))),
        h('section', { className: 'dshuim_category' },
          h('h3', { className: 'dshuim_categoryTitle' }, t('categoryOther')),
          h('p', { className: 'dshuim_categoryHint' }, t('categoryOtherHint'))),
        ready && !writable ? h('p', { className: 'dshuim_note' }, t('readOnly')) : null,
        writes.failed ? h('p', { className: 'dshuim_note dshuim_failed', role: 'status' }, t('saveFailed')) : null);
    }

    /**
     * Register the plugin's contribution to the browser.
     * @param {object} ctx - the browser plugin context.
     */
    function apply(ctx) {
      const form = ctx.configForms.get(SETTINGS_NS);
      const write = createWriteState();
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ui-modify: dictionaries');
      const t = ctx.locale.bind(NS);
      const itemsStore = createSidebarItemsStore(ctx, t);
      const emptyItems = [];
      const items = itemsStore ?? {
        getSnapshot: () => emptyItems,
        subscribe: () => () => {},
      };
      if (itemsStore !== undefined) {
        ctx.effect(() => () => itemsStore.dispose(), 'dsh-ui-modify: sidebar item discovery');
      }

      /** Legacy single-item fields mapped to the keys used by the unified list. */
      const legacyFieldOf = (key) => key === NATIVE_MORE_KEY
        ? SHOW_MORE_FIELD
        : key === NATIVE_NEW_SESSION_KEY
          ? SHOW_NEW_SESSION_FIELD
          : key === SCHEDULES_KEY ? SHOW_TASKS_FIELD : undefined;

      /** Effective hidden set: the unified list plus legacy false-valued fields. */
      const hiddenKeysOf = (snapshot = form.getSnapshot()) => {
        const hidden = new Set();
        if (snapshot.status !== 'ready') return hidden;
        const list = snapshot.value?.[HIDDEN_ITEMS_FIELD];
        if (Array.isArray(list)) {
          for (const key of list) if (typeof key === 'string') hidden.add(key);
        }
        if (snapshot.value?.[SHOW_MORE_FIELD] === false) hidden.add(NATIVE_MORE_KEY);
        if (snapshot.value?.[SHOW_NEW_SESSION_FIELD] === false) hidden.add(NATIVE_NEW_SESSION_KEY);
        if (snapshot.value?.[SHOW_TASKS_FIELD] === false) hidden.add(SCHEDULES_KEY);
        return hidden;
      };

      /** The configured button grouping: `default`, `top`, or `bottom`. */
      const sidebarLayout = () => {
        const snapshot = form.getSnapshot();
        if (snapshot.status !== 'ready') return 'default';
        const value = snapshot.value?.[SIDEBAR_LAYOUT_FIELD];
        return value === 'top' || value === 'bottom' ? value : 'default';
      };

      // ---- dynamic per-item visibility: shadow the original slot registration ----
      /** key -> disposer of the shadow registration. */
      const shadows = new Map();
      let syncingShadows = false;
      const slotOfKind = (kind) => kind === 'panellist' ? PANEL_SLOT : kind === 'footer' ? FOOTER_SLOT : undefined;
      const shadowComponentOfKind = (kind) => kind === 'panellist' ? HiddenPanelGlyph : HiddenFooterAction;
      /** Find the original registration for one id, ignoring this plugin's shadows. */
      const findOriginal = (slot, id, component) => {
        let entries = [];
        try {
          entries = ctx.slots.entries(slot) ?? [];
        } catch {
          entries = [];
        }
        return entries.find((entry) => entry.options?.id === id && entry.component !== component);
      };
      /** Reconcile one shadow registration per hidden key with the current registry. */
      const syncShadows = () => {
        if (syncingShadows) return;
        syncingShadows = true;
        try {
          const snapshot = form.getSnapshot();
          const hidden = hiddenKeysOf(snapshot);
          for (const [key, disposer] of [...shadows]) {
            const [kind, ...rest] = key.split(':');
            const id = rest.join(':');
            const slot = slotOfKind(kind);
            const component = shadowComponentOfKind(kind);
            const original = slot === undefined ? undefined : findOriginal(slot, id, component);
            if (!hidden.has(key) || original === undefined) {
              disposer();
              shadows.delete(key);
            }
          }
          if (snapshot.status !== 'ready') return;
          for (const key of hidden) {
            if (shadows.has(key)) continue;
            const [kind, ...rest] = key.split(':');
            const id = rest.join(':');
            const slot = slotOfKind(kind);
            const component = shadowComponentOfKind(kind);
            if (slot === undefined || id === '') continue;
            const original = findOriginal(slot, id, component);
            if (original === undefined) continue;
            const options = {
              name: slot,
              id,
              priority: SHADOW_PRIORITY,
              order: original.options?.order ?? 0,
            };
            if (kind === 'panellist' && original.options?.label !== undefined) options.label = original.options.label;
            const disposer = ctx.slots.inject(slot, () => {
              try {
                return ctx.slots.register(options, component);
              } catch {
                return () => {};
              }
            });
            shadows.set(key, disposer);
          }
        } finally {
          syncingShadows = false;
        }
      };

      // Keep the injected rules in sync with the Host configuration. The marker
      // rule is always present; it only matches rows shadowed by the unified
      // item list.
      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {};
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-ui-modify';
        tag.dataset.pluginCss = 'dsh-ui-modify/sidebar-visibility.css';
        document.head.appendChild(tag);
        const sync = () => {
          const hidden = hiddenKeysOf();
          const rules = [HIDE_SHADOWED_PANEL_CSS, COLLAPSE_CSS];
          if (hidden.has(NATIVE_MORE_KEY)) rules.push(HIDE_SIDEBAR_MORE_CSS);
          if (hidden.has(NATIVE_NEW_SESSION_KEY)) rules.push(HIDE_NEW_SESSION_CSS);
          const layout = sidebarLayout();
          if (layout !== 'default') rules.push(unifiedSidebarCss(layout));
          tag.textContent = rules.join('\n');
        };
        sync();
        const off = form.subscribe(sync);
        return () => {
          off();
          tag.remove();
        };
      }, 'dsh-ui-modify: sidebar visibility');

      // Reconcile the per-item shadows on preference changes and registry changes.
      ctx.effect(() => {
        const offForm = form.subscribe(syncShadows);
        let offPanel;
        let offFooter;
        try {
          offPanel = ctx.slots.subscribe(PANEL_SLOT, syncShadows);
          offFooter = ctx.slots.subscribe(FOOTER_SLOT, syncShadows);
        } catch {
          /* Discovery subscriptions are optional; form changes still reconcile. */
        }
        syncShadows();
        return () => {
          offForm();
          offPanel?.();
          offFooter?.();
          for (const disposer of shadows.values()) disposer();
          shadows.clear();
        };
      }, 'dsh-ui-modify: sidebar item shadows');

      // Settings page styles.
      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {};
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-ui-modify';
        tag.dataset.pluginCss = 'dsh-ui-modify/settings.css';
        tag.textContent = SETTINGS_CSS;
        document.head.appendChild(tag);
        return () => {
          tag.remove();
        };
      }, 'dsh-ui-modify: settings styles');

      /** Persist one preference through the Host configuration form. */
      const setPreference = async (field, value) => {
        if (write.getSnapshot().busy) return false;
        write.set({ busy: true, failed: false });
        let accepted = false;
        try {
          accepted = await form.set(field, value);
        } catch {
          accepted = false;
        }
        write.set({ busy: false, failed: !accepted });
        return accepted;
      };

      /** Show or hide one discovered sidebar item. */
      const setItemHidden = async (key, show) => {
        const snapshot = form.getSnapshot();
        if (snapshot.status !== 'ready') return;
        const current = Array.isArray(snapshot.value?.[HIDDEN_ITEMS_FIELD])
          ? snapshot.value[HIDDEN_ITEMS_FIELD].filter((value) => typeof value === 'string')
          : [];
        const next = show
          ? current.filter((value) => value !== key)
          : current.includes(key) ? current : [...current, key];
        const changed = !(next.length === current.length
          && next.every((value, index) => value === current[index]));
        if (changed) {
          const accepted = await setPreference(HIDDEN_ITEMS_FIELD, next);
          if (!accepted) return;
        }
        // Showing a legacy-hidden item must also clear its old dedicated field.
        const legacyField = legacyFieldOf(key);
        if (show && legacyField !== undefined) {
          const latest = form.getSnapshot();
          if (latest.status === 'ready' && latest.value?.[legacyField] === false) {
            await setPreference(legacyField, true);
          }
        }
      };

      const pageInjection = () => ({
        hooks: { form, write, items },
        setPreference,
        setItemHidden,
      });

      // The collapse control is a footer action so it remains mounted when the
      // other footer actions are hidden by the folded CSS.
      ctx.effect(() => ctx.slots.inject(FOOTER_SLOT, () => ctx.slots.register({
        name: FOOTER_SLOT,
        id: COLLAPSE_TOGGLE_ID,
        order: -1000,
        locale: NS,
        inject: () => ({
          hooks: { form },
          toggle: () => {
            const snapshot = form.getSnapshot();
            if (snapshot.status !== 'ready') return;
            const collapsed = snapshot.value?.[COLLAPSED_FIELD] === true;
            void setPreference(COLLAPSED_FIELD, !collapsed);
          },
        }),
      }, CollapseButton)), 'dsh-ui-modify: collapse control');

      // The page follows the Host namespace: a deployment that does not serve
      // this plugin's settings shows no trace of it.
      ctx.effect(() => ctx.configForms.whileServed([SETTINGS_NS], () => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'ui-modify',
        order: 100,
        label: () => ctx.locale.bind(NS)('nav'),
        locale: NS,
        inject: pageInjection,
      }, SettingsSection))), 'dsh-ui-modify: settings page');
    }

    return { inject: ['slots', 'locale', 'configForms'], apply };
  },
});
