# Prompt Engineering — Inkflow AI Draw

## Abordagem: Post-processing (não full-schema)

Modelos locais pequenos (1.5b–3b) não conseguem gerar reliably o schema
completo do Excalidraw (25+ campos obrigatórios). A abordagem correta é:

1. **Modelo gera schema mínimo** — só os campos semânticos essenciais
2. **App preenche os defaults** — todos os campos técnicos obrigatórios

Isso torna o sistema robusto independente do modelo usado.

## System Prompt (validado)

```
You generate Excalidraw diagram elements. Return ONLY a JSON object.

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
- Return ONLY the JSON, nothing else
```

## Resultados do Spike

| Teste | Resultado | Tempo | Shapes → Elementos |
|---|---|---|---|
| Fluxograma de Login | ✅ | 13.7s | 4 → 8 |
| Mapa Mental React | ✅ | 18.4s | 5 → 10 |
| Diagrama de Componentes | ✅ | 14.2s | 5 → 8 |

**Modelo**: qwen2.5:1.5b via Ollama local  
**Configuração**: temperature=0.1, num_predict=1024, format=json

## Função de Post-processing

Ver `spike.mjs` — funções `convertToExcalidraw()`, `makeBase()`, `makeText()`, `makeArrow()`.

Estas funções serão portadas para `src/main/ai-service.ts` no S02.

## Parâmetros Ollama

```json
{
  "model": "qwen2.5:1.5b",
  "format": "json",
  "options": { "temperature": 0.1, "num_predict": 1024 }
}
```

O `format: "json"` do Ollama força saída JSON — elimina o problema de markdown fences.
