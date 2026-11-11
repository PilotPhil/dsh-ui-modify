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
     * Settings page: one switch per refinement.
     * @param {object} props - slot props, including the locale reader, the configuration form and the writers.
     * @returns {object} the settings section element.
     */
    function SettingsSection(props) {
      const t = props.t;
      const form = props.useForm((snapshot) => snapshot);
      const write = props.useWrite((state) => state);
      const ready = form.status === 'ready';
      const writable = ready && form.writable === true;
      const busy = write.busy || !writable;
      // A missing value means the Config default: the control is shown.
      const showsMore = !ready || form.value?.[SHOW_MORE_FIELD] !== false;
      const showsTasks = !ready || form.value?.[SHOW_TASKS_FIELD] !== false;
      const showsNewSession = !ready || form.value?.[SHOW_NEW_SESSION_FIELD] !== false;
      return h('div', { className: 'dshuim_section' },
        h('h2', { className: 'dshuim_heading' }, t('title')),
        h('p', { className: 'dshuim_intro' }, t('intro')),
        h('div', { className: 'dshuim_group' },
          h(PreferenceRow, {
            label: t('newSession'),
            hint: t('newSessionHint'),
            checked: showsNewSession,
            disabled: busy,
            onChange: () => {
              void props.setFlag(SHOW_NEW_SESSION_FIELD, !showsNewSession);
            },
          }),
          h(PreferenceRow, {
            label: t('scheduledTasks'),
            hint: t('scheduledTasksHint'),
            checked: showsTasks,
            disabled: busy,
            onChange: () => {
              void props.setFlag(SHOW_TASKS_FIELD, !showsTasks);
            },
          }),
          h(PreferenceRow, {
            label: t('moreButton'),
            hint: t('moreButtonHint'),
            checked: showsMore,
            disabled: busy,
            onChange: () => {
              void props.setFlag(SHOW_MORE_FIELD, !showsMore);
            },
          })),
        ready && !writable ? h('p', { className: 'dshuim_note' }, t('readOnly')) : null,
        write.failed ? h('p', { className: 'dshuim_note dshuim_failed', role: 'status' }, t('saveFailed')) : null);
    }

    /**
     * Register the plugin's contribution to the browser.
     * @param {object} ctx - the browser plugin context.
     */
    function apply(ctx) {
      const form = ctx.configForms.get(SETTINGS_NS);
      const write = createWriteState();

      /** Whether the Host configuration keeps one control visible. */
      const shows = (field) => {
        const snapshot = form.getSnapshot();
        return snapshot.status !== 'ready' || snapshot.value?.[field] !== false;
      };

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ui-modify: dictionaries');

      // Keep the injected rules in sync with the Host configuration. When every
      // control stays visible the element is empty, so no rule is left behind.
      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {};
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-ui-modify';
        tag.dataset.pluginCss = 'dsh-ui-modify/sidebar-visibility.css';
        document.head.appendChild(tag);
        const sync = () => {
          const rules = [];
          if (!shows(SHOW_MORE_FIELD)) rules.push(HIDE_SIDEBAR_MORE_CSS);
          if (!shows(SHOW_TASKS_FIELD)) rules.push(HIDE_SCHEDULED_TASKS_CSS);
          if (!shows(SHOW_NEW_SESSION_FIELD)) rules.push(HIDE_NEW_SESSION_CSS);
          tag.textContent = rules.join('\n');
        };
        sync();
        const off = form.subscribe(sync);
        return () => {
          off();
          tag.remove();
        };
      }, 'dsh-ui-modify: sidebar visibility');

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

      /** Persist one toggle through the Host configuration form. */
      const setFlag = async (field, value) => {
        if (write.getSnapshot().busy) return;
        write.set({ busy: true, failed: false });
        let accepted = false;
        try {
          accepted = await form.set(field, value !== false);
        } catch {
          accepted = false;
        }
        write.set({ busy: false, failed: !accepted });
      };

      const pageInjection = () => ({
        hooks: { form, write },
        setFlag,
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
