/**
 * A minimal in-memory chrome.* for testing the reminder engine.
 *
 * Only the surface Daybook actually touches is implemented. Anything the code
 * calls that is not modelled here throws, which is the point: it keeps the
 * stub honest as the code grows.
 */

import { webcrypto } from 'node:crypto';

/** @param {Record<string, unknown>} store */
function area(store) {
  return {
    async get(keys) {
      if (keys === undefined || keys === null) return { ...store };
      const list = Array.isArray(keys) ? keys : [keys];
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const k of list) if (k in store) out[k] = structuredClone(store[k]);
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) store[k] = structuredClone(v);
    },
    async remove(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
  };
}

export function installChromeStub() {
  const local = {};
  const sync = {};
  const session = {};

  const log = {
    windowsCreated: [],
    windowsUpdated: [],
    tabsUpdated: [],
    tabsCreated: [],
    notifications: [],
    /** Notification ids the code cleared. */
    notificationsCleared: /** @type {string[]} */ ([]),
    alarms: /** @type {Map<string, {when: number}>} */ (new Map()),
    badge: {},
    panelBehavior: /** @type {object | null} */ (null),
    panelsOpened: /** @type {object[]} */ ([]),
    /** Messages the code sent with runtime.sendMessage (the worker's broadcasts). */
    messages: /** @type {unknown[]} */ ([]),
    /** chrome.scripting.executeScript calls (the on-page note). */
    scripts: /** @type {object[]} */ ([]),
    /** Event listeners registered, keyed by event path. */
    listeners: /** @type {Record<string, Function[]>} */ ({}),
  };

  /** A chrome.events.Event that records what registered against it. */
  const event = (name) => ({
    addListener: (fn) => { (log.listeners[name] ??= []).push(fn); },
    removeListener: (fn) => {
      const list = log.listeners[name] ?? [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    hasListener: (fn) => (log.listeners[name] ?? []).includes(fn),
  });

  // Permissions granted now; `tabs` is optional in the manifest (W3) and granted here unless a test says otherwise.
  const state = { idle: 'active', focused: true, tab: /** @type {any} */ (null), injectFails: false, granted: new Set(['tabs']) };

  const chrome = {
    storage: {
      local: area(local),
      sync: area(sync),
      session: area(session),
      onChanged: event('storage.onChanged'),
    },
    runtime: {
      id: 'weekly',
      getURL: (p) => `chrome-extension://weekly/${p}`,
      sendMessage: async (m) => { log.messages.push(m); return { ok: true }; },
      openOptionsPage: async () => {},
      onInstalled: event('runtime.onInstalled'),
      onStartup: event('runtime.onStartup'),
      onMessage: event('runtime.onMessage'),
    },
    alarms: {
      async clear(name) { return log.alarms.delete(name); },
      create(name, info) { log.alarms.set(name, info); },
      async getAll() { return [...log.alarms].map(([name, info]) => ({ name, ...info })); },
      onAlarm: event('alarms.onAlarm'),
    },
    windows: {
      async create(opts) {
        const id = 100 + log.windowsCreated.length;   // never 1, the focused browser window
        log.windowsCreated.push({ id, ...opts });
        return { id };
      },
      async update(id, opts) {
        if (!log.windowsCreated.some((w) => w.id === id)) throw new Error('No window with id ' + id);
        log.windowsUpdated.push({ id, ...opts });
        return { id };
      },
      onRemoved: event('windows.onRemoved'),
      async getLastFocused() { return { id: 1, focused: state.focused }; },
      onFocusChanged: event('windows.onFocusChanged'),
    },
    tabs: {
      // A window this stub created (the reminder window) holds one tab; any other query sees the focused tab.
      async query(q) {
        if (log.windowsCreated.some((w) => w.id === q?.windowId)) return [{ id: 1000 + q.windowId, windowId: q.windowId }];
        return state.tab ? [state.tab] : [];
      },
      onActivated: event('tabs.onActivated'),
      onUpdated: event('tabs.onUpdated'),
      async update(id, opts) { log.tabsUpdated.push({ id, ...opts }); return { id, windowId: 1 }; },
      async create(opts) { log.tabsCreated.push(opts); return { id: 100, windowId: 1, ...opts }; },
      onRemoved: event('tabs.onRemoved'),
    },
    notifications: {
      async create(id, opts) { log.notifications.push({ id, ...opts }); return id; },
      async clear(id) { log.notificationsCleared.push(id); return true; },
      onClicked: event('notifications.onClicked'),
    },
    commands: { onCommand: event('commands.onCommand') },
    permissions: {
      async contains(q) { return (q?.permissions ?? []).every((p) => state.granted.has(p)); },
      async request(q) { for (const p of q?.permissions ?? []) state.granted.add(p); return true; },
      async remove(q) { for (const p of q?.permissions ?? []) state.granted.delete(p); return true; },
      onAdded: event('permissions.onAdded'),
      onRemoved: event('permissions.onRemoved'),
    },
    scripting: {
      // Logged before it settles, so a test can tell it was called inside the command's gesture.
      executeScript(o) {
        log.scripts.push(o);
        return state.injectFails ? Promise.reject(new Error('Cannot access contents of the page.')) : Promise.resolve([]);
      },
    },
    action: {
      async setBadgeText(o) { log.badge.text = o.text; },
      async setBadgeBackgroundColor(o) { log.badge.color = o.color; },
      async setTitle(o) { log.badge.title = o.title; },
    },
    sidePanel: {
      async setPanelBehavior(o) { log.panelBehavior = o; },
      async open(o) { log.panelsOpened.push(o); },
    },
    idle: {
      async queryState() { return state.idle; },
      setDetectionInterval() {},
      onStateChanged: event('idle.onStateChanged'),
    },
  };

  globalThis.crypto ??= webcrypto;
  globalThis.chrome = chrome;
  globalThis.structuredClone ??= (v) => JSON.parse(JSON.stringify(v));

  return {
    chrome, log, stores: { local, sync, session },
    setIdle: (s) => { state.idle = s; },
    setFocusedTab: (t) => { state.tab = t; },
    setWindowFocused: (f) => { state.focused = f; },
    setInjectFails: (f) => { state.injectFails = f; },
    setGranted: (list) => { state.granted = new Set(list); },
  };
}
