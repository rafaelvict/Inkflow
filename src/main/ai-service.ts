/**
 * AI service — calls Ollama local API and converts simplified elements
 * to valid Excalidraw JSON via post-processing.
 *
 * The model generates only semantic fields (type, x, y, width, height, label).
 * This service fills in all 25+ required Excalidraw fields with sane defaults.
 */

export interface AiSettings {
  ollamaUrl: string;
  model: string;
}

export interface AiDrawResult {
  elements: any[];
  rawSimple: any[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const AI_SETTINGS_DEFAULTS: AiSettings = {
  ollamaUrl: "http://localhost:11434",
  model: "qwen2.5:1.5b",
};

// ---------------------------------------------------------------------------
// System prompt — minimal schema for small local models
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
// Post-processing helpers
// ---------------------------------------------------------------------------

let _idCounter = 1;
function uid() {
  return `ai${_idCounter++}`;
}

function makeBase(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: uid(),
    type: "rectangle",
    x: 0,
    y: 0,
    width: 160,
    height: 60,
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
    updated: Date.now(),
    link: null,
    locked: false,
    roundness: null,
    ...overrides,
  };
}

function makeTextElement(
  text: string,
  x: number,
  y: number,
  color = "transparent",
): Record<string, any> {
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

function makeArrowElement(
  x: number,
  y: number,
  dx: number,
  dy: number,
): Record<string, any> {
  return {
    ...makeBase({
      type: "arrow",
      x,
      y,
      width: Math.abs(dx) || 10,
      height: Math.abs(dy) || 10,
    }),
    points: [[0, 0], [dx, dy]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  };
}

export function convertToExcalidraw(simpleElements: any[]): any[] {
  _idCounter = 1;
  const result: any[] = [];

  for (const el of simpleElements) {
    if (!el.type) continue;

    if (el.type === "arrow") {
      result.push(makeArrowElement(
        el.x ?? 0,
        el.y ?? 0,
        el.dx ?? 100,
        el.dy ?? 0,
      ));
      continue;
    }

    if (el.type === "text") {
      result.push(makeTextElement(
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

    // Overlay label as text element centered on the shape
    if (el.label) {
      result.push(makeTextElement(
        el.label,
        (el.x ?? 0) + 10,
        (el.y ?? 0) + ((el.height ?? 60) / 2) - 12,
      ));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Ollama API call
// ---------------------------------------------------------------------------

function extractJSON(raw: string): any {
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  throw new Error("Could not extract valid JSON from model response");
}

export async function aiDraw(
  prompt: string,
  settings: AiSettings = AI_SETTINGS_DEFAULTS,
): Promise<AiDrawResult> {
  const { ollamaUrl, model } = settings;

  // Verify Ollama is reachable
  try {
    const ping = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!ping.ok) throw new Error(`status ${ping.status}`);
  } catch (e: any) {
    throw new Error(
      `Ollama não está acessível em ${ollamaUrl}. ` +
      `Verifique se o Ollama está rodando (ollama serve). Detalhe: ${e.message}`,
    );
  }

  // Call model
  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: false,
      format: "json",
      options: { temperature: 0.1, num_predict: 1024 },
    }),
    signal: AbortSignal.timeout(120_000), // 2 min timeout
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama retornou erro ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data.message?.content;
  if (!content) throw new Error("Resposta vazia do modelo");

  // Parse simplified schema
  let parsed: any;
  try {
    parsed = extractJSON(content);
  } catch {
    throw new Error(`Modelo retornou JSON inválido: ${content.slice(0, 200)}`);
  }

  const simpleElements = parsed.elements;
  if (!Array.isArray(simpleElements) || simpleElements.length === 0) {
    throw new Error("Modelo não gerou elementos. Tente reformular o prompt.");
  }

  const excalidrawElements = convertToExcalidraw(simpleElements);

  console.log(
    `[ai-service] Generated ${excalidrawElements.length} Excalidraw elements ` +
    `from ${simpleElements.length} model shapes`,
  );

  return { elements: excalidrawElements, rawSimple: simpleElements };
}
