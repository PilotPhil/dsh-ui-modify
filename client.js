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
    const SHOW_HIDDEN_IN_MORE_MENU_FIELD = 'showHiddenInMoreMenu';
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
     * Effective hidden set from one configuration-form snapshot: the unified
     * list plus legacy single-item fields still set to false.
     * @param {object} snapshot - the configuration form snapshot.
     * @returns {Set<string>} hidden item keys.
     */
    function hiddenKeysOf(snapshot) {
      const hidden = new Set();
      if (snapshot?.status !== 'ready') return hidden;
      const list = snapshot.value?.[HIDDEN_ITEMS_FIELD];
      if (Array.isArray(list)) {
        for (const key of list) if (typeof key === 'string') hidden.add(key);
      }
      if (snapshot.value?.[SHOW_MORE_FIELD] === false) hidden.add(NATIVE_MORE_KEY);
      if (snapshot.value?.[SHOW_NEW_SESSION_FIELD] === false) hidden.add(NATIVE_NEW_SESSION_KEY);
      if (snapshot.value?.[SHOW_TASKS_FIELD] === false) hidden.add(SCHEDULES_KEY);
      return hidden;
    }

    /**
     * Whether a hidden item can be offered as a row in the sidebar's More menu.
     * Panels navigate somewhere; the New session control is an action. Footer
     * widgets (Remote, usage card) are not menu rows.
     * @param {object} item - one discovered item.
     * @returns {boolean} whether the item belongs in the menu section.
     */
    function isMenuEligible(item) {
      return item.kind === 'panellist' || item.key === NATIVE_NEW_SESSION_KEY;
    }

    /**
     * Hidden items that should appear in the More menu section.
     * @param {Array<object>} items - discovered sidebar items.
     * @param {Set<string>} hidden - effective hidden keys.
     * @returns {Array<object>} hidden menu-eligible items.
     */
    function hiddenMenuItems(items, hidden) {
      return items.filter((item) => item.key !== NATIVE_MORE_KEY && isMenuEligible(item) && hidden.has(item.key));
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
            icon: entry.component,
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
.dshuim_menuSection { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; padding-top: 4px; border-top: .5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3)); }
.dshuim_menuLabel { padding: 6px 10px 2px; color: var(--dsw-alias-label-secondary, #8b8b8b); font-size: 11px; font-weight: 500; }
.dshuim_menuItem { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary, inherit); font: inherit; font-size: 13px; line-height: 18px; text-align: left; cursor: pointer; }
.dshuim_menuItem:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.12)); }
.dshuim_menuItem:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3d6df6); outline-offset: -2px; }
.dshuim_menuGlyph { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex: none; color: var(--dsw-alias-label-secondary, #8b8b8b); }
.dshuim_menuText { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshuim_menuPlus { font-size: 16px; line-height: 16px; }
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
      subsectionMoreMenu: '更多菜单',
      hiddenInMoreMenu: '在「更多」菜单中显示隐藏项',
      hiddenInMoreMenuHint: '把隐藏的面板按钮和「新会话」放进侧栏的「更多」菜单，避免菜单位置空着。开启后，只要菜单里还有隐藏项，「更多」按钮就会保留；底部动作与流量卡片不放进菜单。',
      hiddenMenuGroup: '已隐藏',
      moreForcedHint: '有隐藏项放在「更多」菜单时保留此按钮',
      subsectionLayout: '按钮布局',
      categoryOther: '其他区域',
      categoryOtherHint: '后续针对主界面、对话或其他区域的优化会显示在这里。',
      moreButton: '更多按钮',
      newSession: '新会话按钮',
      sidebarLayout: '按钮排列',
      sidebarLayoutHint: '把面板按钮和底部动作按钮统一排成 2 列网格。流量卡片会随底部动作区一起移动。',
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
      subsectionMoreMenu: 'More menu',
      hiddenInMoreMenu: 'Show hidden items in the More menu',
      hiddenInMoreMenuHint: 'Moves hidden panel buttons and the New session action into the sidebar More menu instead of leaving the menu empty. While the menu hosts hidden items, the More button stays visible; footer actions and the usage card are not added to the menu.',
      hiddenMenuGroup: 'Hidden',
      moreForcedHint: 'Kept while the More menu hosts hidden items',
      subsectionLayout: 'Button layout',
      categoryOther: 'Other areas',
      categoryOtherHint: 'Future refinements for the main view, conversation, and other areas will appear here.',
      moreButton: 'More button',
      newSession: 'New session button',
      sidebarLayout: 'Button arrangement',
      sidebarLayoutHint: 'Groups panel buttons and footer actions into one 2-column grid. The usage card moves with the footer actions.',
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
     * Contain one panel glyph so a third-party icon cannot break the menu
     * section.
     */
    class MenuGlyphBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }

      static getDerivedStateFromError() {
        return { failed: true };
      }

      render() {
        return this.state.failed ? null : this.props.children;
      }
    }

    /**
     * More-menu section listing hidden panel buttons and the hidden New session
     * action. The section is only registered while at least one such item is
     * hidden, so the shipped More menu stays untouched otherwise.
     * @param {object} props - More-menu owner props plus this plugin's hooks and actions.
     * @returns {object | null} the section, or nothing when no hidden item is eligible.
     */
    function HiddenItemsMenu(props) {
      const t = props.t;
      const form = props.useForm((snapshot) => snapshot);
      const items = props.useItems((value) => value);
      if (form.status !== 'ready' || form.value?.[SHOW_HIDDEN_IN_MORE_MENU_FIELD] !== true) return null;
      const rows = hiddenMenuItems(items, hiddenKeysOf(form));
      if (rows.length === 0) return null;
      return h('div', { className: 'dshuim_menuSection' },
        h('div', { className: 'dshuim_menuLabel', role: 'presentation' }, t('hiddenMenuGroup')),
        rows.map((item) => h('button', {
          key: item.key,
          type: 'button',
          role: 'menuitem',
          className: 'dshuim_menuItem',
          onClick: () => {
            if (item.kind === 'panellist') props.onOpen?.(item.id);
            else if (item.key === NATIVE_NEW_SESSION_KEY) props.startSession?.();
            props.onDismiss?.();
          },
        },
        h('span', { className: 'dshuim_menuGlyph', 'aria-hidden': 'true' },
          item.kind === 'panellist' && typeof item.icon === 'function'
            ? h(MenuGlyphBoundary, null, h(item.icon, { size: 16, active: false }))
            : h('span', { className: 'dshuim_menuPlus' }, '+')),
        h('span', { className: 'dshuim_menuText' }, item.label))));
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
      const items = props.useItems((value) => value);
      const hiddenKeys = hiddenKeysOf(form);
      const menuFeature = ready && form.value?.[SHOW_HIDDEN_IN_MORE_MENU_FIELD] === true;
      // While hidden items occupy the More menu, the More button must stay
      // reachable; the list reflects that by forcing its switch on.
      const forceMore = menuFeature && hiddenMenuItems(items, hiddenKeys).length > 0;
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
            : h('div', { className: 'dshuim_group' }, items.map((item) => {
              const isMore = item.key === NATIVE_MORE_KEY;
              const forced = isMore && forceMore;
              return h(PreferenceRow, {
                key: item.key,
                label: item.label,
                hint: forced
                  ? t('moreForcedHint')
                  : item.kind === 'native' ? kindLabel(item.kind) : `${kindLabel(item.kind)} · ${item.id}`,
                checked: forced ? true : !hiddenKeys.has(item.key),
                disabled: busy || forced,
                onChange: () => {
                  void props.setItemHidden(item.key, hiddenKeys.has(item.key));
                },
              });
            })),
          h('h4', { className: 'dshuim_subheading' }, t('subsectionMoreMenu')),
          h('div', { className: 'dshuim_group' },
            h(PreferenceRow, {
              label: t('hiddenInMoreMenu'),
              hint: t('hiddenInMoreMenuHint'),
              checked: menuFeature,
              disabled: busy,
              onChange: () => {
                void props.setPreference(SHOW_HIDDEN_IN_MORE_MENU_FIELD, !menuFeature);
              },
            })),
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
          const snapshot = form.getSnapshot();
          const hidden = hiddenKeysOf(snapshot);
          // Keep the More button reachable while the menu hosts hidden items.
          const forceMore = snapshot.status === 'ready'
            && snapshot.value?.[SHOW_HIDDEN_IN_MORE_MENU_FIELD] === true
            && hiddenMenuItems(items.getSnapshot(), hidden).length > 0;
          const rules = [HIDE_SHADOWED_PANEL_CSS];
          if (hidden.has(NATIVE_MORE_KEY) && !forceMore) rules.push(HIDE_SIDEBAR_MORE_CSS);
          if (hidden.has(NATIVE_NEW_SESSION_KEY)) rules.push(HIDE_NEW_SESSION_CSS);
          const layout = sidebarLayout();
          if (layout !== 'default') rules.push(unifiedSidebarCss(layout));
          tag.textContent = rules.join('\n');
        };
        sync();
        const off = form.subscribe(sync);
        const offItems = itemsStore?.subscribe(sync);
        return () => {
          off();
          offItems?.();
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

      // Register the More-menu section only while it has hidden items to host.
      // The registration itself is what makes the shipped More button appear,
      // so it must be removed again when no hidden item is menu-eligible.
      let offMenu = null;
      const syncMenu = () => {
        const snapshot = form.getSnapshot();
        const wanted = snapshot.status === 'ready'
          && snapshot.value?.[SHOW_HIDDEN_IN_MORE_MENU_FIELD] === true
          && hiddenMenuItems(items.getSnapshot(), hiddenKeysOf(snapshot)).length > 0;
        if (wanted && offMenu === null) {
          offMenu = ctx.slots.inject(PANEL_ACTION_SLOT, () => ctx.slots.register({
            name: PANEL_ACTION_SLOT,
            id: 'ui-modify-hidden-items',
            order: 1000,
            locale: NS,
            inject: () => ({
              hooks: { form, items },
              startSession: () => {
                const workspace = ctx.get?.('uiWorkspace');
                workspace?.startSession?.();
              },
            }),
          }, HiddenItemsMenu));
        } else if (!wanted && offMenu !== null) {
          offMenu();
          offMenu = null;
        }
      };
      ctx.effect(() => {
        const offForm = form.subscribe(syncMenu);
        const offItems = itemsStore?.subscribe(syncMenu);
        syncMenu();
        return () => {
          offForm();
          offItems?.();
          offMenu?.();
          offMenu = null;
        };
      }, 'dsh-ui-modify: hidden items menu');

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
