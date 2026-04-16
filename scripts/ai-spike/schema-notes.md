# Excalidraw Element Schema — Campos Obrigatórios

Extraído de `packages/excalidraw/element/types.ts`.

## Base (`_ExcalidrawElementBase`) — todos os elementos

| Campo | Tipo | Exemplo |
|---|---|---|
| `id` | string (único) | `"abc123"` |
| `x` | number | `100` |
| `y` | number | `200` |
| `width` | number | `160` |
| `height` | number | `80` |
| `angle` | number (radianos) | `0` |
| `strokeColor` | string (hex) | `"#1e1e1e"` |
| `backgroundColor` | string (hex ou `"transparent"`) | `"transparent"` |
| `fillStyle` | `"solid"` \| `"hachure"` \| `"cross-hatch"` \| `"zigzag"` | `"solid"` |
| `strokeWidth` | number | `2` |
| `strokeStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | `"solid"` |
| `roughness` | number (0-2) | `1` |
| `opacity` | number (0-100) | `100` |
| `seed` | number (integer aleatório) | `12345` |
| `version` | number | `1` |
| `versionNonce` | number | `0` |
| `index` | string \| null | `null` |
| `isDeleted` | boolean | `false` |
| `groupIds` | array | `[]` |
| `frameId` | string \| null | `null` |
| `boundElements` | array \| null | `null` |
| `updated` | number (epoch ms) | `1700000000000` |
| `link` | string \| null | `null` |
| `locked` | boolean | `false` |
| `roundness` | `null` \| `{ type: number }` | `null` |

## Tipos de Elemento

### `rectangle` / `ellipse` / `diamond`
Apenas os campos base. Sem campos extras.

### `text`
Campos extras além da base:
| Campo | Tipo | Exemplo |
|---|---|---|
| `type` | `"text"` | |
| `text` | string | `"Hello"` |
| `originalText` | string (igual a text) | `"Hello"` |
| `fontSize` | number | `20` |
| `fontFamily` | number (1=Excalifont, 2=Nunito, 3=Lilita, 4=Cascadia, 5=Segoe) | `1` |
| `textAlign` | `"left"` \| `"center"` \| `"right"` | `"center"` |
| `verticalAlign` | `"top"` \| `"middle"` \| `"bottom"` | `"middle"` |
| `containerId` | string \| null | `null` |
| `autoResize` | boolean | `true` |
| `lineHeight` | number | `1.25` |

### `arrow` / `line`
Campos extras além da base:
| Campo | Tipo | Exemplo |
|---|---|---|
| `type` | `"arrow"` | |
| `points` | array de `[x, y]` | `[[0,0],[160,0]]` |
| `lastCommittedPoint` | null | `null` |
| `startBinding` | null \| PointBinding | `null` |
| `endBinding` | null \| PointBinding | `null` |
| `startArrowhead` | null \| `"arrow"` | `null` |
| `endArrowhead` | `"arrow"` \| null | `"arrow"` |
| `elbowed` | boolean (só arrow) | `false` |

## Schema Mínimo Viável para o Prompt

Para diagramas simples gerados por IA, usar apenas:
- **Formas**: `rectangle`, `ellipse`, `diamond`, `text`
- **Conexões**: `arrow` com `points: [[0,0],[dx,dy]]`
- **Evitar**: bindings complexos, frameId, groupIds, roundness por enquanto

## Constantes Úteis
- `fontFamily: 1` = Excalifont (handwritten, padrão Excalidraw)
- `roughness: 1` = estilo desenhado à mão
- `fillStyle: "solid"` = preenchimento sólido
- `strokeColor: "#1e1e1e"` = cor padrão escura
