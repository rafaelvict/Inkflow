import { Menu, BrowserWindow } from "electron";

type WindowGetter = () => BrowserWindow | null;

export function buildMenu(getWindow: WindowGetter) {
  const send = (action: string) => {
    getWindow()?.webContents.send("menu-action", action);
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Arquivo",
      submenu: [
        {
          label: "Nova nota",
          accelerator: "CmdOrCtrl+N",
          click: () => send("new-note"),
        },
        {
          label: "Novo de template…",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => send("templates"),
        },
        {
          label: "Abrir recentes...",
          accelerator: "CmdOrCtrl+O",
          click: () => send("open-note"),
        },
        { type: "separator" },
        {
          label: "Salvar",
          accelerator: "CmdOrCtrl+S",
          click: () => send("save-note"),
        },
        { type: "separator" },
        {
          label: "Fechar aba",
          accelerator: "CmdOrCtrl+W",
          click: () => send("close-tab"),
        },
        { type: "separator" },
        {
          label: "Exportar",
          submenu: [
            {
              label: "Nota como .note (ZIP)",
              click: () => send("export-note-zip"),
            },
            {
              label: "Texto como .md",
              click: () => send("export-md"),
            },
            {
              label: "Canvas como .png",
              click: () => send("export-png"),
            },
            {
              label: "Canvas como .svg",
              click: () => send("export-svg"),
            },
          ],
        },
        {
          label: "Importar .note (ZIP)...",
          click: () => send("import-note-zip"),
        },
        { type: "separator" },
        { label: "Sair", accelerator: "Alt+F4", role: "quit" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        {
          label: "Modo Split",
          accelerator: "CmdOrCtrl+1",
          click: () => send("mode-split"),
        },
        {
          label: "Só Texto",
          accelerator: "CmdOrCtrl+2",
          click: () => send("mode-text"),
        },
        {
          label: "Só Canvas",
          accelerator: "CmdOrCtrl+3",
          click: () => send("mode-canvas"),
        },
        { type: "separator" },
        {
          label: "Próxima aba",
          accelerator: "CmdOrCtrl+Tab",
          click: () => send("next-tab"),
        },
        {
          label: "Aba anterior",
          accelerator: "CmdOrCtrl+Shift+Tab",
          click: () => send("prev-tab"),
        },
        { type: "separator" },
        {
          label: "Busca global",
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => send("global-search"),
        },
        {
          label: "Paleta de Comandos",
          accelerator: "CmdOrCtrl+K",
          click: () => send("command-palette"),
        },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Sobre o Inkflow",
          click: () => send("about"),
        },
        {
          label: "Pasta de notas (Sync)…",
          click: () => send("workspace-settings"),
        },
        {
          label: "Configurações de IA…",
          click: () => send("ai-settings"),
        },
        {
          label: "Times",
          click: () => send("teams"),
        },
        {
          label: "Assinatura",
          click: () => send("billing"),
        },
        { type: "separator" },
        {
          label: "Sair da conta",
          click: () => send("logout"),
        },
        { type: "separator" },
        {
          label: "☕ Apoiar o projeto",
          click: () => send("support"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
