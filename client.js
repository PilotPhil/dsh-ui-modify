/**
 * dsh-ui-modify — targeted UI refinements for the DSH Web interface (Client half).
 *
 * The shipped sidebar shell renders three controls this plugin can hide:
 *
 * 1. The "More" launcher at the end of the panel list. It exists while
 *    `sidebar.panellist.actions` has registrations and offers no slot for
 *    suppression.
 * 2. The "Automation tasks" panel row (id `schedules`). The sidebar always
 *    renders a row per `sidebar.panellist` entry, and no slot removes it.
 * 3. The "New session" button above the panel list. It is a plain sidebar
 *    button with no visibility slot either.
 *
 * All three controls are therefore hidden with narrowly scoped stylesheet
 * rules. The Automation tasks rule matches the row's accessible label in every
 * locale the schedule plugin ships, so no other sidebar row is touched.
 *
 * The preferences live in the Host plugin's volatile Config, so they survive
 * restarts and are shared across browsers. This half registers the Settings
 * page that edits them and keeps the injected stylesheet in sync with the
 * configuration form projection.
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
    /** The two slot containers that render sidebar buttons. */
    const PANEL_SLOT = 'sidebar.panellist';
    const FOOTER_SLOT = 'sidebar.footer.action';
    /**
     * Lowest priority wins a slot cell. Registering the same id at a lower
     * priority than the original registration shadows it (documented by the
     * slot registry), which is how a per-item switch removes an arbitrary
     * plugin button without moving DOM nodes.
     */
    const SHADOW_PRIORITY = -1e9;
    /** The Automation tasks row has its own switch; keep it out of the dynamic list. */
    const DEDICATED_ITEM_KEYS = new Set([`panellist:schedules`]);

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
     * Panel labels the shipped schedule plugin renders for the `schedules`
     * entry, in every locale its client dictionary ships. Matching the
     * accessible label keeps the rule stable across hash-prefix changes and
     * works in both the expanded list and the collapsed rail.
     */
    const SCHEDULED_TASKS_LABELS = [
      '自动化任务',
      '自動化タスク',
      'Automation tasks',
      'Tareas de automatización',
      "Tâches d'automatisation",
      'Automatisierungsaufgaben',
      'Задачи автоматизации',
      'Tarefas de automação',
    ];

    /** Escape one label as a CSS string literal. */
    const cssString = (value) => JSON.stringify(value);

    /**
     * PanelRow sets the accessible label on its button; the Tooltip wrapper may
     * be the nav's direct child instead. Both shapes are covered, and the
     * `:has()` form hides the whole row rather than just the button box.
     */
    const HIDE_SCHEDULED_TASKS_CSS = [
      '/* dsh-ui-modify: hide the left sidebar Automation tasks entry */',
      `${SCHEDULED_TASKS_LABELS.flatMap((label) => [
        `nav[class*="panelList"] > button[aria-label=${cssString(label)}]`,
        `nav[class*="panelList"] > :has(button[aria-label=${cssString(label)}])`,
      ]).join(',\n')} {`,
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
     * discoverable while this plugin shadows it.
     * @param {object} ctx - the browser plugin context.
     * @returns {Array<{ key: string, kind: 'panellist' | 'footer', id: string, label: string, order: number }>} discovered items.
     */
    function readSidebarItems(ctx) {
      const items = [];
      const seen = new Set();
      const kindRank = { panellist: 0, footer: 1 };
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
          const key = `${kind}:${id}`;
          if (seen.has(key) || DEDICATED_ITEM_KEYS.has(key)) continue;
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
     * @returns {{ getSnapshot: () => Array<object>, subscribe: (listener: () => void) => () => void, dispose: () => void } | undefined} the store, or undefined when the slot registry does not expose discovery.
     */
    function createSidebarItemsStore(ctx) {
      if (typeof ctx.slots.entries !== 'function' || typeof ctx.slots.subscribe !== 'function') return undefined;
      let current = readSidebarItems(ctx);
      const listeners = new Set();
      const notify = () => {
        for (const listener of [...listeners]) listener();
      };
      const sync = () => {
        const next = readSidebarItems(ctx);
        const unchanged = next.length === current.length
          && next.every((item, index) => item.key === current[index].key && item.label === current[index].label);
        if (unchanged) return;
        current = next;
        notify();
      };
      const offPanel = ctx.slots.subscribe(PANEL_SLOT, sync);
      const offFooter = ctx.slots.subscribe(FOOTER_SLOT, sync);
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
.dshuim_subheading { margin: 10px 0 0; font-size: 14px; font-weight: 600; line-height: 22px; }
`;

    /** Simplified Chinese copy. */
    const zh = {
      nav: '界面优化',
      title: '界面优化',
      intro: '按你的习惯调整 DSH 主界面的显示细节。偏好保存在当前 profile 的插件配置中。',
      moreButton: '左侧栏「更多」按钮',
      moreButtonHint: '显示左侧栏面板列表末尾的「更多」按钮。',
      scheduledTasks: '左侧栏「自动化任务」',
      scheduledTasksHint: '显示左侧栏的「自动化任务」入口。隐藏后不影响已创建的自动化任务。',
      newSession: '左侧栏「新会话」按钮',
      newSessionHint: '显示左侧栏顶部的「新会话」按钮。',
      sidebarLayout: '侧栏按钮布局',
      sidebarLayoutHint: '把顶部面板按钮和底部动作按钮统一排成 2 列网格。流量卡片会随底部动作区一起移动。',
      layoutDefault: '保持原样',
      layoutTop: '顶部 2 列',
      layoutBottom: '底部 2 列',
      otherButtons: '其他侧栏按钮',
      otherButtonsHint: '自动发现侧栏上的面板按钮和底部动作，逐个控制是否显示。',
      noOtherButtons: '当前没有发现其他侧栏按钮。',
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
      moreButton: 'Sidebar More button',
      moreButtonHint: 'Show the More button at the end of the sidebar panel list.',
      scheduledTasks: 'Sidebar Automation tasks entry',
      scheduledTasksHint: 'Show the Automation tasks entry in the left sidebar. Hiding it does not affect existing automation tasks.',
      newSession: 'Sidebar New session button',
      newSessionHint: 'Show the New session button at the top of the left sidebar.',
      sidebarLayout: 'Sidebar button layout',
      sidebarLayoutHint: 'Groups the global panel buttons and footer actions into one 2-column grid. The usage card moves with the footer actions.',
      layoutDefault: 'Keep as is',
      layoutTop: 'Top, 2 columns',
      layoutBottom: 'Bottom, 2 columns',
      otherButtons: 'Other sidebar buttons',
      otherButtonsHint: 'Detects panel buttons and footer actions so each can be shown or hidden.',
      noOtherButtons: 'No other sidebar buttons were detected.',
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
     * Settings page: one switch per refinement.
     * @param {object} props - slot props, including the locale reader, the configuration form and the writers.
     * @returns {object} the settings section element.
     */
    function SettingsSection(props) {
      const t = props.t;
      const form = props.useForm((snapshot) => snapshot);
      const writes = props.useWrite((state) => state);
      const ready = form.status === 'ready';
      const writable = ready && form.writable === true;
      const busy = writes.busy || !writable;
      // A missing value means the Config default: the control is shown.
      const showsMore = !ready || form.value?.[SHOW_MORE_FIELD] !== false;
      const showsTasks = !ready || form.value?.[SHOW_TASKS_FIELD] !== false;
      const showsNewSession = !ready || form.value?.[SHOW_NEW_SESSION_FIELD] !== false;
      const layout = ready ? form.value?.[SIDEBAR_LAYOUT_FIELD] ?? 'default' : 'default';
      const items = props.useItems((value) => value);
      const hiddenKeys = new Set(ready && Array.isArray(form.value?.[HIDDEN_ITEMS_FIELD])
        ? form.value[HIDDEN_ITEMS_FIELD]
        : []);
      return h('div', { className: 'dshuim_section' },
        h('h2', { className: 'dshuim_heading' }, t('title')),
        h('p', { className: 'dshuim_intro' }, t('intro')),
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
            label: t('newSession'),
            hint: t('newSessionHint'),
            checked: showsNewSession,
            disabled: busy,
            onChange: () => {
              void props.setPreference(SHOW_NEW_SESSION_FIELD, !showsNewSession);
            },
          }),
          h(PreferenceRow, {
            label: t('scheduledTasks'),
            hint: t('scheduledTasksHint'),
            checked: showsTasks,
            disabled: busy,
            onChange: () => {
              void props.setPreference(SHOW_TASKS_FIELD, !showsTasks);
            },
          }),
          h(PreferenceRow, {
            label: t('moreButton'),
            hint: t('moreButtonHint'),
            checked: showsMore,
            disabled: busy,
            onChange: () => {
              void props.setPreference(SHOW_MORE_FIELD, !showsMore);
            },
          })),
        h('h3', { className: 'dshuim_subheading' }, t('otherButtons')),
        h('p', { className: 'dshuim_intro' }, t('otherButtonsHint')),
        items.length === 0
          ? h('p', { className: 'dshuim_note' }, t('noOtherButtons'))
          : h('div', { className: 'dshuim_group' }, items.map((item) => h(PreferenceRow, {
            key: item.key,
            label: item.label,
            hint: `${item.kind === 'panellist' ? t('kindPanel') : t('kindFooter')} · ${item.id}`,
            checked: !hiddenKeys.has(item.key),
            disabled: busy,
            onChange: () => {
              void props.setItemHidden(item.key, hiddenKeys.has(item.key));
            },
          }))),
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
      const itemsStore = createSidebarItemsStore(ctx);
      const emptyItems = [];
      const items = itemsStore ?? {
        getSnapshot: () => emptyItems,
        subscribe: () => () => {},
      };
      if (itemsStore !== undefined) {
        ctx.effect(() => () => itemsStore.dispose(), 'dsh-ui-modify: sidebar item discovery');
      }

      /** Whether the Host configuration keeps one control visible. */
      const shows = (field) => {
        const snapshot = form.getSnapshot();
        return snapshot.status !== 'ready' || snapshot.value?.[field] !== false;
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
          const hidden = new Set(Array.isArray(snapshot.value?.[HIDDEN_ITEMS_FIELD])
            ? snapshot.value[HIDDEN_ITEMS_FIELD].filter((key) => typeof key === 'string')
            : []);
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

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ui-modify: dictionaries');

      // Keep the injected rules in sync with the Host configuration. The marker
      // rule is always present; it only matches rows shadowed by the dynamic
      // item list.
      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {};
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-ui-modify';
        tag.dataset.pluginCss = 'dsh-ui-modify/sidebar-visibility.css';
        document.head.appendChild(tag);
        const sync = () => {
          const rules = [HIDE_SHADOWED_PANEL_CSS];
          if (!shows(SHOW_MORE_FIELD)) rules.push(HIDE_SIDEBAR_MORE_CSS);
          if (!shows(SHOW_TASKS_FIELD)) rules.push(HIDE_SCHEDULED_TASKS_CSS);
          if (!shows(SHOW_NEW_SESSION_FIELD)) rules.push(HIDE_NEW_SESSION_CSS);
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
        if (write.getSnapshot().busy) return;
        write.set({ busy: true, failed: false });
        let accepted = false;
        try {
          accepted = await form.set(field, value);
        } catch {
          accepted = false;
        }
        write.set({ busy: false, failed: !accepted });
      };

      /** Show or hide one dynamically discovered sidebar item. */
      const setItemHidden = async (key, show) => {
        const snapshot = form.getSnapshot();
        if (snapshot.status !== 'ready') return;
        const current = Array.isArray(snapshot.value?.[HIDDEN_ITEMS_FIELD])
          ? snapshot.value[HIDDEN_ITEMS_FIELD].filter((value) => typeof value === 'string')
          : [];
        const next = show
          ? current.filter((value) => value !== key)
          : current.includes(key) ? current : [...current, key];
        if (next.length === current.length && next.every((value, index) => value === current[index])) return;
        await setPreference(HIDDEN_ITEMS_FIELD, next);
      };

      const pageInjection = () => ({
        hooks: { form, write, items },
        setPreference,
        setItemHidden,
      });

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
