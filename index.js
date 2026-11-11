/**
 * dsh-ui-modify — targeted UI refinements for the DSH Web interface (Host half).
 *
 * The Host half owns the durable preference. It declares one volatile Config
 * field (live-editable, no plugin restart) and marks the plugin as shipping its
 * own settings page, so the Plugin Manager does not auto-generate a second
 * form. The Client half renders that page and reads the value through the
 * shared configuration-form projection.
 */
import z from '@deepseek-ai/schemastery'

/** Live UI preference projected to the browser. */
export const Config = z.object({
  /**
   * Legacy single-item preferences. The unified sidebar item list writes
   * `hiddenSidebarItems` instead; these fields remain so earlier saved
   * choices keep hiding their item until it is toggled in the list.
   */
  showSidebarMore: z.boolean().default(true).volatile(),
  showScheduledTasks: z.boolean().default(true).volatile(),
  showNewSession: z.boolean().default(true).volatile(),
  /**
   * Sidebar button grouping:
   * - `default`: keep each button where its plugin put it.
   * - `top`: reflow the global panel list and footer actions into one
   *   2-column block above the workspace list.
   * - `bottom`: the same 2-column block below the workspace list.
   */
  sidebarButtonLayout: z.union(['default', 'top', 'bottom']).default('default').volatile(),
  /**
   * Sidebar items hidden through the unified item list, keyed by
   * `<kind>:<id>`: `native:more`, `native:newSession`, `panellist:plugins`,
   * `footer:ds-harness-remote-workspace`. Unknown or stale keys are harmless:
   * they only apply if the item returns.
   */
  hiddenSidebarItems: z.array(z.string()).default([]).volatile(),
})

/**
 * Register the settings presentation policy.
 * @param {object} ctx - the Host plugin context.
 */
export function apply(ctx) {
  ctx.inject(['settings'], (child) => {
    child.effect(
      () => child.settings.configure({ auto: false }, ctx.fiber),
      'dsh-ui-modify: settings presentation',
    )
  })
}
