# Inkflow

Notepad + Excalidraw + IA em um app desktop.

Inkflow combina um editor Markdown com um canvas de diagramas (Excalidraw) em uma interface split-pane, tudo offline e no seu computador.

## Features

- Editor Markdown com CodeMirror 6 (checklist, formatacao, syntax highlighting)
- Canvas de diagramas com Excalidraw integrado
- Modo split, texto-only ou canvas-only
- Multi-tabs com drag-and-drop
- Templates prontos para anotacoes
- IA local com Ollama para gerar diagramas
- Busca full-text em todas as notas
- Tags e organizacao
- Temas claro e escuro
- Import/export (.note, .md, .png, .svg, .zip)
- Auto-save com debounce
- Auto-update via GitHub Releases

## Download

Baixe o instalador oficial para Windows, Linux ou macOS na pagina de [Releases](https://github.com/Inkflow/inkflow/releases).

O build oficial inclui cloud sync, colaboracao em tempo real e times (requer assinatura).

## Compilar do codigo fonte

O build a partir do source code funciona 100% offline, sem necessidade de conta ou assinatura.

```bash
# Clonar o repositorio
git clone https://github.com/Inkflow/inkflow.git
cd inkflow

# Instalar dependencias
npm install

# Rodar em modo dev
npm run dev

# Compilar instalador
npm run make
```

### Requisitos

- Node.js 20+
- npm 9+
- Electron 33+

## Arquitetura

```
src/
  main/          # Processo principal do Electron
  preload/       # Bridge segura entre main e renderer
  renderer/      # React app (UI)
    components/  # Componentes da interface
    editor/      # Extensoes CodeMirror
    hooks/       # React hooks
    lib/         # Utilidades e APIs
    styles/      # CSS/SASS
  shared/        # Tipos compartilhados
packages/
  excalidraw/    # Fork customizado do Excalidraw
  math/          # Utilidades matematicas
  utils/         # Utilidades gerais
```

## Cloud (build oficial)

O build oficial distribuido via GitHub Releases inclui features cloud:

| Feature | Community (source) | Oficial (release) |
|---|---|---|
| Editor completo | Sim | Sim |
| Excalidraw | Sim | Sim |
| IA com Ollama | Sim | Sim |
| Templates | Sim | Sim |
| Cloud sync | - | Sim |
| Colaboracao real-time | - | Sim |
| Times | - | Sim |
| Billing/assinatura | - | Sim |

## Contribuindo

Contribuicoes sao bem-vindas! Abra uma issue ou PR.

1. Fork o repositorio
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit suas mudancas (`git commit -m 'Adiciona minha feature'`)
4. Push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

## Licenca

Este projeto e licenciado sob a [AGPL-3.0](LICENSE).

Isso significa que voce pode usar, modificar e distribuir livremente. Porem, se voce modificar o Inkflow e oferecer como servico na rede, voce deve publicar o codigo-fonte das suas modificacoes.
