/**
 * dsh-ui-modify — targeted UI refinements for the DSH Web interface (Host half).
 *
 * The Host half owns the durable preferences and, in the desktop application,
 * the native application menu. The page reports the hidden sidebar items it
 * wants offered through `POST /dsh-ui-modify/app-menu`; this half turns them
 * into a new top-level menu in the Electron application menu and routes menu
 * clicks back to the page as a `dsh-ui-modify:menu-command` DOM event.
 *
 * Electron is only available in the desktop application. A browser-only host
 * still answers the route (with `desktop: false`) so the page can report the
 * feature as unavailable instead of failing silently.
 */
import { createRequire } from 'node:module'
import z from '@deepseek-ai/schemastery'

const require = createRequire(import.meta.url)

/** Stable id of the top-level menu item this plugin owns. */
const MENU_ID = 'dsh-ui-modify-hidden-items'
/** Page-to-Host route carrying the hidden items. */
const ROUTE = '/dsh-ui-modify/app-menu'
/** Upper bound for one menu-state payload. */
const MAX_BODY_BYTES = 64 * 1024
/** Upper bound for menu rows and labels. */
const MAX_ITEMS = 50
const MAX_LABEL_CHARS = 80

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
  /**
   * Whether hidden panel buttons and the hidden New session action should be
   * offered in a new top-level menu of the desktop application menu bar.
   */
  showHiddenInAppMenu: z.boolean().default(false).volatile(),
})

/**
 * Load the Electron main-process API when this host runs inside the desktop app.
 * @returns {object | undefined} the Electron module, or undefined in a plain Node host.
 */
function loadElectron() {
  if (process.versions.electron === undefined) return undefined
  try {
    const electron = require('electron')
    return electron !== null
      && typeof electron === 'object'
      && typeof electron.Menu === 'function'
      && typeof electron.MenuItem === 'function'
      && electron.webContents !== undefined
      ? electron
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Read a bounded UTF-8 request body.
 * @param {object} req - the Node request.
 * @returns {Promise<string>} the body.
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

/**
 * Narrow an untrusted menu payload to the shape the native menu can render.
 * @param {unknown} payload - the parsed request body.
 * @returns {{ title: string, items: Array<object> }} the sanitized state.
 */
function sanitizeMenuState(payload) {
  const items = []
  const rawItems = payload !== null && typeof payload === 'object' && Array.isArray(payload.items)
    ? payload.items.slice(0, MAX_ITEMS)
    : []
  for (const raw of rawItems) {
    if (raw === null || typeof raw !== 'object') continue
    const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, MAX_LABEL_CHARS) : ''
    if (label === '') continue
    if (raw.type === 'panel' && typeof raw.id === 'string' && raw.id !== '') {
      items.push({ type: 'panel', id: raw.id.slice(0, 200), label })
    } else if (raw.type === 'newSession') {
      items.push({ type: 'newSession', label })
    }
  }
  const title = payload !== null
    && typeof payload === 'object'
    && typeof payload.title === 'string'
    && payload.title.trim() !== ''
    ? payload.title.trim().slice(0, MAX_LABEL_CHARS)
    : 'Hidden items'
  return { title, items }
}

/**
 * Register the settings presentation policy and, when running as the desktop
 * app, the native menu bridge.
 * @param {object} ctx - the Host plugin context.
 */
export function apply(ctx) {
  ctx.inject(['settings'], (child) => {
    child.effect(
      () => child.settings.configure({ auto: false }, ctx.fiber),
      'dsh-ui-modify: settings presentation',
    )
  })

  ctx.inject(['webServer'], (child) => {
    child.effect(() => {
      const electron = loadElectron()
      let menuState = { title: 'Hidden items', items: [] }
      let ensureTimer

      /**
       * Send one menu action to every live page; only the DSH page owns the
       * listener, and unrelated webContents ignore the event.
       */
      const sendCommand = (entry) => {
        if (electron === undefined) return
        const detail = entry.type === 'panel'
          ? { type: 'panel', id: entry.id }
          : { type: 'newSession' }
        const script = `window.dispatchEvent(new CustomEvent('dsh-ui-modify:menu-command', { detail: ${JSON.stringify(detail)} }))`
        for (const contents of electron.webContents.getAllWebContents()) {
          if (contents.isDestroyed()) continue
          try {
            void contents.executeJavaScript(script).catch(() => {})
          } catch {
            /* A vanished page must not break the menu. */
          }
        }
      }

      /** Create or update this plugin's top-level application menu. */
      const ensureMenu = () => {
        if (electron === undefined) return
        const { Menu, MenuItem } = electron
        const applicationMenu = Menu.getApplicationMenu()
        if (applicationMenu === null) return
        let item = applicationMenu.getMenuItemById(MENU_ID)
        if (item === undefined) {
          item = new MenuItem({
            id: MENU_ID,
            label: menuState.title,
            submenu: [],
            visible: menuState.items.length > 0,
          })
          applicationMenu.append(item)
        }
        item.label = menuState.title
        item.visible = menuState.items.length > 0
        item.submenu = Menu.buildFromTemplate(menuState.items.map((entry) => ({
          label: entry.label,
          click: () => sendCommand(entry),
        })))
        Menu.setApplicationMenu(applicationMenu)
      }

      /** Hide the menu without disturbing the rest of the application menu. */
      const hideMenu = () => {
        if (electron === undefined) return
        const applicationMenu = electron.Menu.getApplicationMenu()
        if (applicationMenu === null) return
        const item = applicationMenu.getMenuItemById(MENU_ID)
        if (item === undefined) return
        item.visible = false
        item.submenu = electron.Menu.buildFromTemplate([])
        try {
          electron.Menu.setApplicationMenu(applicationMenu)
        } catch {
          /* The window may be closing. */
        }
      }

      const routeDispose = child.webServer.register({
        kind: 'exact',
        path: ROUTE,
        handler: async (req, res) => {
          const headers = {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          }
          if (req.method !== 'POST') {
            res.writeHead(405, headers)
            res.end(JSON.stringify({ ok: false, desktop: electron !== undefined }))
            return
          }
          try {
            const body = await readRequestBody(req)
            menuState = sanitizeMenuState(JSON.parse(body))
            ensureMenu()
            res.writeHead(200, headers)
            res.end(JSON.stringify({
              ok: true,
              desktop: electron !== undefined,
              items: menuState.items.length,
            }))
          } catch (error) {
            res.writeHead(400, headers)
            res.end(JSON.stringify({
              ok: false,
              desktop: electron !== undefined,
              error: error instanceof Error ? error.message : String(error),
            }))
          }
        },
      })

      // The desktop shell rebuilds the application menu on locale and update
      // changes; re-insert this plugin's item if that happened.
      ensureTimer = setInterval(ensureMenu, 3000)
      ensureTimer.unref?.()
      ensureMenu()

      return () => {
        clearInterval(ensureTimer)
        try {
          routeDispose()
        } catch {
          /* Route disposal is idempotent. */
        }
        hideMenu()
      }
    }, 'dsh-ui-modify: desktop app menu')
  })
}
