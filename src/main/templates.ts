/**
 * Bundled templates — static data shipped with the app.
 * Each template defines markdown content and Excalidraw scene elements
 * that get copied into a new note when the user picks "Usar template".
 */

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  content: string;
  scene: {
    type: "excalidraw";
    version: 2;
    source: "Inkflow";
    elements: any[];
    appState: { viewBackgroundColor: string };
    files: Record<string, never>;
  };
}

let _seed = 1000;
function uid() { return `tpl${_seed++}`; }

function rect(x: number, y: number, w: number, h: number, bg: string, extra: Record<string, any> = {}) {
  return {
    id: uid(), type: "rectangle", x, y, width: w, height: h,
    angle: 0, strokeColor: "#1e1e1e", backgroundColor: bg,
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
    roughness: 1, opacity: 100, seed: Math.floor(Math.random() * 99999),
    version: 1, versionNonce: 0, index: null, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false, roundness: { type: 3 },
    ...extra,
  };
}

function text(x: number, y: number, t: string, size = 16, extra: Record<string, any> = {}) {
  return {
    id: uid(), type: "text", x, y, width: t.length * size * 0.6, height: size * 1.5,
    angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
    roughness: 1, opacity: 100, seed: Math.floor(Math.random() * 99999),
    version: 1, versionNonce: 0, index: null, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false, roundness: null,
    text: t, originalText: t, fontSize: size, fontFamily: 1,
    textAlign: "left", verticalAlign: "top", containerId: null,
    autoResize: true, lineHeight: 1.25,
    ...extra,
  };
}

function arrow(x1: number, y1: number, dx: number, dy: number) {
  return {
    id: uid(), type: "arrow", x: x1, y: y1,
    width: Math.abs(dx) || 10, height: Math.abs(dy) || 10,
    angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
    roughness: 1, opacity: 100, seed: Math.floor(Math.random() * 99999),
    version: 1, versionNonce: 0, index: null, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false, roundness: { type: 2 },
    points: [[0, 0], [dx, dy]],
    lastCommittedPoint: null, startBinding: null, endBinding: null,
    startArrowhead: null, endArrowhead: "arrow", elbowed: false,
  };
}

function diamond(x: number, y: number, w: number, h: number, bg: string) {
  return { ...rect(x, y, w, h, bg), type: "diamond", id: uid() };
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const kanban: Template = {
  id: "kanban",
  name: "Kanban",
  description: "Quadro com colunas To Do, Doing e Done",
  icon: "📋",
  content: `# Kanban Board

## To Do
- [ ] Tarefa 1
- [ ] Tarefa 2
- [ ] Tarefa 3

## Doing
- [ ] Tarefa em progresso

## Done
- [x] Tarefa concluida
`,
  scene: {
    type: "excalidraw", version: 2, source: "Inkflow",
    elements: [
      // Column headers
      rect(20, 20, 240, 50, "#a5d8ff"),
      text(50, 30, "📋 To Do", 20),
      rect(280, 20, 240, 50, "#ffec99"),
      text(310, 30, "🔨 Doing", 20),
      rect(540, 20, 240, 50, "#b2f2bb"),
      text(570, 30, "✅ Done", 20),
      // Column bodies
      rect(20, 80, 240, 400, "transparent"),
      rect(280, 80, 240, 400, "transparent"),
      rect(540, 80, 240, 400, "transparent"),
      // Sample cards
      rect(40, 100, 200, 60, "#e7f5ff"),
      text(50, 115, "Tarefa 1", 14),
      rect(40, 180, 200, 60, "#e7f5ff"),
      text(50, 195, "Tarefa 2", 14),
      rect(300, 100, 200, 60, "#fff9db"),
      text(310, 115, "Em progresso", 14),
      rect(560, 100, 200, 60, "#ebfbee"),
      text(570, 115, "Concluida", 14),
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  },
};

const swot: Template = {
  id: "swot",
  name: "SWOT",
  description: "Analise de Forcas, Fraquezas, Oportunidades e Ameacas",
  icon: "🎯",
  content: `# Analise SWOT

## Forcas (Strengths)
-

## Fraquezas (Weaknesses)
-

## Oportunidades (Opportunities)
-

## Ameacas (Threats)
-
`,
  scene: {
    type: "excalidraw", version: 2, source: "Inkflow",
    elements: [
      // Quadrants
      rect(20, 20, 300, 250, "#d3f9d8"),
      text(40, 35, "💪 Forcas", 20),
      text(40, 70, "Pontos fortes internos", 12, { strokeColor: "#868e96" }),

      rect(340, 20, 300, 250, "#ffe3e3"),
      text(360, 35, "😟 Fraquezas", 20),
      text(360, 70, "Pontos fracos internos", 12, { strokeColor: "#868e96" }),

      rect(20, 290, 300, 250, "#d0ebff"),
      text(40, 305, "🚀 Oportunidades", 20),
      text(40, 340, "Fatores externos positivos", 12, { strokeColor: "#868e96" }),

      rect(340, 290, 300, 250, "#fff4e6"),
      text(360, 305, "⚠️ Ameacas", 20),
      text(360, 340, "Fatores externos negativos", 12, { strokeColor: "#868e96" }),

      // Center label
      text(230, 260, "SWOT", 24, { strokeColor: "#868e96", textAlign: "center" }),
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  },
};

const flowchart: Template = {
  id: "flowchart",
  name: "Fluxograma",
  description: "Diagrama de fluxo com inicio, decisao e fim",
  icon: "🔄",
  content: `# Fluxograma

## Descricao
Diagrama de fluxo para mapear processos.

## Etapas
1. Inicio
2. Processo A
3. Decisao
4. Processo B (se sim)
5. Fim
`,
  scene: {
    type: "excalidraw", version: 2, source: "Inkflow",
    elements: [
      // Start (rounded rect)
      rect(160, 20, 160, 50, "#d3f9d8", { roundness: { type: 3 } }),
      text(195, 32, "Inicio", 18),

      arrow(240, 70, 0, 40),

      // Process A
      rect(160, 120, 160, 50, "#d0ebff"),
      text(180, 132, "Processo A", 18),

      arrow(240, 170, 0, 40),

      // Decision diamond
      diamond(160, 220, 160, 100, "#fff4e6"),
      text(190, 255, "Decisao?", 16),

      // Yes branch
      arrow(320, 270, 80, 0),
      rect(420, 245, 160, 50, "#d0ebff"),
      text(440, 257, "Processo B", 18),
      arrow(500, 295, 0, 60),

      // No branch
      arrow(160, 270, -80, 0),
      text(30, 255, "Nao", 14, { strokeColor: "#e03131" }),

      // Yes label
      text(330, 248, "Sim", 14, { strokeColor: "#2f9e44" }),

      // End
      rect(420, 370, 160, 50, "#ffe3e3", { roundness: { type: 3 } }),
      text(470, 382, "Fim", 18),
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  },
};

const wireframe: Template = {
  id: "wireframe",
  name: "Wireframe",
  description: "Esboco de interface com header, sidebar e conteudo",
  icon: "🖼️",
  content: `# Wireframe

## Layout
- Header com logo e navegacao
- Sidebar com menu
- Area de conteudo principal
- Footer

## Notas
- Responsivo para mobile
- Cores neutras
`,
  scene: {
    type: "excalidraw", version: 2, source: "Inkflow",
    elements: [
      // Browser frame
      rect(20, 20, 600, 450, "transparent"),

      // Header
      rect(20, 20, 600, 50, "#e9ecef"),
      text(40, 32, "🌐 Logo", 16),
      text(350, 35, "Home    About    Contact", 13, { strokeColor: "#868e96" }),

      // Sidebar
      rect(20, 70, 150, 350, "#f8f9fa"),
      text(40, 85, "Menu Item 1", 13),
      text(40, 110, "Menu Item 2", 13),
      text(40, 135, "Menu Item 3", 13),
      text(40, 160, "Menu Item 4", 13),

      // Content area
      rect(180, 80, 430, 40, "#e7f5ff"),
      text(200, 88, "Titulo da Pagina", 18),

      // Content cards
      rect(180, 140, 200, 120, "#f8f9fa"),
      text(200, 155, "Card 1", 14),
      text(200, 180, "Conteudo aqui...", 12, { strokeColor: "#868e96" }),

      rect(400, 140, 200, 120, "#f8f9fa"),
      text(420, 155, "Card 2", 14),
      text(420, 180, "Conteudo aqui...", 12, { strokeColor: "#868e96" }),

      // CTA button
      rect(180, 290, 140, 40, "#339af0"),
      text(200, 300, "Botao CTA", 14, { strokeColor: "#ffffff" }),

      // Footer
      rect(20, 420, 600, 50, "#e9ecef"),
      text(230, 435, "© 2025 Empresa", 12, { strokeColor: "#868e96" }),
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  },
};

const meetingNotes: Template = {
  id: "meeting-notes",
  name: "Meeting Notes",
  description: "Ata de reuniao com pauta, decisoes e action items",
  icon: "📝",
  content: `# Reuniao — [Titulo]

**Data:** ${new Date().toLocaleDateString("pt-BR")}
**Participantes:**

---

## Pauta
1.
2.
3.

## Discussao
-

## Decisoes
- [ ]

## Action Items
- [ ] **[Nome]** —
- [ ] **[Nome]** —

## Proximos passos
-
`,
  scene: {
    type: "excalidraw", version: 2, source: "Inkflow",
    elements: [
      rect(20, 20, 500, 50, "#e7f5ff"),
      text(30, 32, "📝 Meeting Notes", 22),
      rect(20, 90, 240, 150, "#f8f9fa"),
      text(30, 100, "Pauta", 18),
      rect(280, 90, 240, 150, "#fff4e6"),
      text(290, 100, "Decisoes", 18),
      rect(20, 260, 500, 150, "#ebfbee"),
      text(30, 270, "Action Items", 18),
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  },
};

const sprintRetro: Template = {
  id: "sprint-retro",
  name: "Sprint Retro",
  description: "Retrospectiva com O que foi bem, O que melhorar e Acoes",
  icon: "🔁",
  content: `# Sprint Retro — Sprint [N]

**Data:** ${new Date().toLocaleDateString("pt-BR")}
**Time:**

---

## 😊 O que foi bem
-

## 😕 O que melhorar
-

## 🎯 Acoes para o proximo sprint
- [ ]
- [ ]
`,
  scene: {
    type: "excalidraw", version: 2, source: "Inkflow",
    elements: [
      // Three columns
      rect(20, 20, 200, 50, "#b2f2bb"),
      text(35, 32, "😊 Foi bem", 18),
      rect(20, 80, 200, 300, "#ebfbee"),

      rect(240, 20, 200, 50, "#ffc9c9"),
      text(255, 32, "😕 Melhorar", 18),
      rect(240, 80, 200, 300, "#fff5f5"),

      rect(460, 20, 200, 50, "#a5d8ff"),
      text(475, 32, "🎯 Acoes", 18),
      rect(460, 80, 200, 300, "#e7f5ff"),
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const TEMPLATES: Template[] = [
  kanban,
  swot,
  flowchart,
  wireframe,
  meetingNotes,
  sprintRetro,
];

export function getTemplateList() {
  return TEMPLATES.map(({ id, name, description, icon }) => ({
    id, name, description, icon,
  }));
}

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
