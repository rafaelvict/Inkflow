#!/usr/bin/env node
/**
 * Spike v2: Abordagem simplificada para modelos locais pequenos.
 *
 * O modelo gera apenas os campos ESSENCIAIS do diagrama.
 * O app preenche todos os campos obrigatórios do Excalidraw com defaults.
 *
 * Uso: node scripts/ai-spike/spike.mjs
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";

// ---------------------------------------------------------------------------
// Prompt minimalista — modelo só precisa gerar campos essenciais
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You generate Excalidraw diagram elements. Return ONLY a JSON object.

Schema:
{"elements": [
  {"type": "rectangle"|"ellipse"|"diamond"|"text"|"arrow", "x": number, "y": number, "width": number, "height": number, "label": "text to show inside", "color": "hex or transparent"},
  {"type": "arrow", "x": number, "y": number, "dx": number, "dy": number}
]}

Rules:
- Use "label" to put text inside shapes (optional for arrow)
- For arrows: x/y is start position, dx/dy is direction (e.g. dx:160 = arrow going right 160px)
- Space elements: at least 40px gap between shapes
- Max 10 elements total
- Return ONLY the JSON, nothing else`;

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

const TEST_CASES = [
  {
    name: "Fluxograma de Login",
    prompt: "Simple login flowchart: Start → Enter Credentials → Validate → Dashboard (if valid) or Error (if invalid)",
  },
  {
    name: "Mapa Mental React",
    prompt: "Mind map: central node 'React' with 4 branches: Components, Hooks, State, Props",
  },
  {
    name: "Diagrama de Componentes",
    prompt: "3-tier architecture: Frontend box → arrow → Backend box → arrow → Database box",
  },
];

// ---------------------------------------------------------------------------
// Converte o JSON simplificado em elementos Excalidraw completos
// ---------------------------------------------------------------------------

let _idCounter = 1;
function uid() { return `el${_idCounter++}`; }

function makeBase(overrides = {}) {
  return {
    id: uid(),
    type: "rectangle",
    x: 0, y: 0, width: 160, height: 60,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: Math.floor(Math.random() * 99999),
    version: 1,
    versionNonce: 0,
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1700000000000,
    link: null,
    locked: false,
    roundness: null,
    ...overrides,
  };
}

function makeText(text, x, y, color = "transparent") {
  return {
    ...makeBase({ type: "text", x, y, width: 140, height: 24, backgroundColor: color }),
    text,
    originalText: text,
    fontSize: 14,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: null,
    autoResize: true,
    lineHeight: 1.25,
  };
}

function makeArrow(x, y, dx, dy) {
  return {
    ...makeBase({ type: "arrow", x, y, width: Math.abs(dx) || 10, height: Math.abs(dy) || 10 }),
    points: [[0, 0], [dx, dy]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  };
}

/**
 * Converte os elementos simplificados do modelo em elementos Excalidraw completos.
 * Adiciona label como texto sobreposto ao shape quando presente.
 */
function convertToExcalidraw(simpleElements) {
  _idCounter = 1;
  const result = [];

  for (const el of simpleElements) {
    if (!el.type) continue;

    if (el.type === "arrow") {
      result.push(makeArrow(
        el.x ?? 0,
        el.y ?? 0,
        el.dx ?? 100,
        el.dy ?? 0,
      ));
      continue;
    }

    if (el.type === "text") {
      result.push(makeText(
        el.label || el.text || "text",
        el.x ?? 0,
        el.y ?? 0,
        el.color ?? "transparent",
      ));
      continue;
    }

    // rectangle, ellipse, diamond
    const shape = makeBase({
      type: el.type,
      x: el.x ?? 0,
      y: el.y ?? 0,
      width: el.width ?? 160,
      height: el.height ?? 60,
      backgroundColor: el.color ?? "transparent",
    });
    result.push(shape);

    // Se tem label, adiciona texto centralizado sobre o shape
    if (el.label) {
      result.push(makeText(
        el.label,
        (el.x ?? 0) + 10,
        (el.y ?? 0) + (el.height ?? 60) / 2 - 12,
        "transparent",
      ));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Validação final dos elementos Excalidraw gerados
// ---------------------------------------------------------------------------

const REQUIRED_BASE = [
  "id","type","x","y","width","height","angle","strokeColor","backgroundColor",
  "fillStyle","strokeWidth","strokeStyle","roughness","opacity","seed","version",
  "versionNonce","isDeleted","groupIds","frameId","boundElements","updated",
  "link","locked","roundness",
];
const REQUIRED_TEXT = ["text","originalText","fontSize","fontFamily","textAlign","verticalAlign","containerId","autoResize","lineHeight"];
const REQUIRED_ARROW = ["points","lastCommittedPoint","startBinding","endBinding","startArrowhead","endArrowhead","elbowed"];

function validate(elements) {
  const errors = [];
  const ids = new Set();
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    for (const f of REQUIRED_BASE) if (!(f in el)) errors.push(`[${i}] ${el.type}: campo base ausente '${f}'`);
    if (ids.has(el.id)) errors.push(`[${i}]: ID duplicado '${el.id}'`);
    ids.add(el.id);
    if (el.type === "text") for (const f of REQUIRED_TEXT) if (!(f in el)) errors.push(`[${i}] text: campo ausente '${f}'`);
    if (el.type === "arrow") for (const f of REQUIRED_ARROW) if (!(f in el)) errors.push(`[${i}] arrow: campo ausente '${f}'`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Chamada Ollama
// ---------------------------------------------------------------------------

async function callOllama(prompt) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: false,
      format: "json",
      options: { temperature: 0.1, num_predict: 1024 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.message?.content;
  if (!content) throw new Error("Resposta vazia");
  return content;
}

function extractJSON(raw) {
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  throw new Error("JSON inválido: " + raw.slice(0, 200));
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🔬 Spike v2: Ollama → Excalidraw (post-processing approach)`);
  console.log(`   Model : ${MODEL} @ ${OLLAMA_URL}\n`);

  // Ping
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (e) {
    console.error(`❌ Ollama offline: ${e.message}`);
    process.exit(1);
  }

  let passed = 0;

  for (const tc of TEST_CASES) {
    console.log(`─── ${tc.name} ───`);
    console.log(`    "${tc.prompt}"`);
    const t0 = Date.now();

    try {
      const raw = await callOllama(tc.prompt);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      let parsed;
      try { parsed = extractJSON(raw); }
      catch (e) {
        console.log(`❌ Parse falhou (${elapsed}s): ${e.message}`);
        console.log();
        continue;
      }

      const simple = parsed.elements;
      if (!Array.isArray(simple) || simple.length === 0) {
        console.log(`❌ 'elements' vazio ou ausente (${elapsed}s)`);
        console.log(`   Raw: ${raw.slice(0, 300)}`);
        console.log();
        continue;
      }

      // Converte para Excalidraw completo
      const excalidrawElements = convertToExcalidraw(simple);
      const errors = validate(excalidrawElements);

      if (errors.length === 0) {
        const types = {};
        for (const el of excalidrawElements) types[el.type] = (types[el.type] || 0) + 1;
        console.log(`✅ Válido (${elapsed}s) — modelo gerou ${simple.length} shapes → ${excalidrawElements.length} elementos Excalidraw`);
        console.log(`   Tipos: ${Object.entries(types).map(([t,n])=>`${n}×${t}`).join(", ")}`);
        passed++;
      } else {
        console.log(`❌ Validação falhou (${elapsed}s) — ${errors.length} erro(s):`);
        for (const e of errors.slice(0, 4)) console.log(`   • ${e}`);
      }
    } catch (e) {
      console.log(`❌ Erro: ${e.message}`);
    }

    console.log();
  }

  console.log(`═══ ${passed}/${TEST_CASES.length} passaram ═══\n`);
  process.exit(passed === TEST_CASES.length ? 0 : 1);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
