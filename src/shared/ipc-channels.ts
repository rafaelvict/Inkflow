export const IPC = {
  NOTE_CREATE: "note:create",
  NOTE_LOAD: "note:load",
  NOTE_SAVE: "note:save",
  NOTE_SAVE_TAGS: "note:save-tags",
  NOTE_LIST_RECENT: "note:list-recent",
  NOTE_DELETE: "note:delete",
  NOTE_PIN_TOGGLE: "note:pin-toggle",
  NOTE_SEARCH: "note:search",
  NOTE_ALL_TAGS: "note:all-tags",
  WORKSPACE_PATH: "workspace:path",

  EXPORT_NOTE_ZIP: "export:note-zip",
  IMPORT_NOTE_ZIP: "import:note-zip",
  EXPORT_FILE: "export:file",
  IMPORT_NOTE_FILE: "import:note-file",
  SHELL_OPEN_EXTERNAL: "shell:open-external",

  TEMPLATE_LIST: "template:list",
  TEMPLATE_CREATE_NOTE: "template:create-note",
  TEMPLATE_GET_SCENE: "template:get-scene",

  AI_DRAW: "ai:draw",
  AI_GET_SETTINGS: "ai:get-settings",
  AI_SAVE_SETTINGS: "ai:save-settings",
  AI_TEST_CONNECTION: "ai:test-connection",

  // Auto-update (electron-updater)
  APP_UPDATE_EVENT: "app:update-event",    // main → renderer push
  APP_UPDATE_INSTALL: "app:update-install", // renderer → main invoke
  APP_UPDATE_SIMULATE: "app:update-simulate", // dev-only: simulate an update event

  // Workspace / sync settings
  WORKSPACE_GET_PATH: "workspace:get-path",
  WORKSPACE_SET_PATH: "workspace:set-path",
  WORKSPACE_RESET_PATH: "workspace:reset-path",
  WORKSPACE_CHOOSE_PATH: "workspace:choose-path", // opens native folder picker dialog
  WORKSPACE_CHANGED: "workspace:changed", // main → renderer push (watcher event)
  NOTE_EXTERNALLY_MODIFIED: "note:externally-modified", // main → renderer push (external edit detected)
  NOTE_OPEN: "note:open", // renderer → main: update list of open note IDs
} as const;
