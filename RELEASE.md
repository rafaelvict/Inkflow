# Inkflow — Guia de Release

Este documento descreve como gerar um build de produção, criar um release no GitHub, e como o auto-update funciona no app.

---

## Pré-requisitos

- Node.js 20+ e npm
- Windows (para gerar o instalador `.exe` via Squirrel)
- Token do GitHub com permissão `repo` (para publicar releases)
- Conta GitHub com repositório `Inkflow/inkflow` criado

---

## 1. Bump de versão

Antes de gerar o build, atualize a versão em dois lugares:

```
apps/desktop/package.json       → campo "version"
apps/desktop/forge.config.ts    → campo packagerConfig.appVersion
```

Ambos devem estar sincronizados (ex: `"0.6.0"`).

---

## 2. Gerar o build de produção

```bash
cd apps/desktop
npm run make
```

Isso executa `electron-forge make` e gera os artefatos em `apps/desktop/out/make/`:

- `squirrel.windows/x64/Inkflow-0.6.0 Setup.exe` — instalador para o usuário
- `squirrel.windows/x64/RELEASES` — feed do Squirrel para auto-update
- `squirrel.windows/x64/Inkflow-0.6.0-full.nupkg` — pacote de atualização

---

## 3. Publicar o release no GitHub

### Opção A: via electron-forge publish (recomendado)

```bash
cd apps/desktop
GH_TOKEN=ghp_... npm run make
# O publisher-github está configurado em forge.config.ts
# Publica automaticamente como draft no repositório Inkflow/inkflow
```

Para publicar diretamente (sem draft):
- Edite `forge.config.ts` e mude `draft: true` para `draft: false`, ou
- Acesse o GitHub, vá em Releases, edite o draft e clique em "Publish release"

### Opção B: upload manual

1. Acesse `https://github.com/Inkflow/inkflow/releases/new`
2. Crie uma tag: `v0.6.0`
3. Faça upload de todos os arquivos de `out/make/squirrel.windows/x64/`
4. Publique o release

---

## 4. Como o auto-update funciona

1. O app usa `electron-updater` configurado em `src/main/updater.ts`
2. Após o app inicializar (3s de delay), `autoUpdater.checkForUpdates()` é chamado
3. O `electron-updater` lê `https://github.com/Inkflow/inkflow/releases/latest/download/RELEASES`
4. Se houver versão nova, faz download em segundo plano (`autoDownload: true`)
5. Ao fechar o app, instala automaticamente (`autoInstallOnAppQuit: true`)
6. O renderer recebe eventos via IPC `APP_UPDATE_EVENT` e exibe o `UpdateBanner`

### Estados do UpdateBanner

| Fase | Trigger | Visual |
|------|---------|--------|
| `available` | `update-available` | Banner com versão + "(baixando em segundo plano…)" |
| `downloading` | `download-progress` | Barra de progresso com percentual |
| `ready` | `update-downloaded` | Botão "Instalar e reiniciar" |
| `error` | `error` | Mensagem de erro (auto-dismiss em 8s) |

---

## 5. Testar o UpdateBanner em modo dev

O `updater.ts` registra um handler IPC de simulação quando o app não está empacotado:

```js
// No DevTools do Electron (Ctrl+Shift+I no app dev):
window.electronAPI.update.simulate("available");
window.electronAPI.update.simulate("progress");   // 72% simulado
window.electronAPI.update.simulate("downloaded");
window.electronAPI.update.simulate("error");
window.electronAPI.update.simulate("checking");
window.electronAPI.update.simulate("not-available");
```

Execute em sequência para ver a progressão completa: `available` → `progress` → `downloaded`.

---

## 6. Assinatura de código (Windows)

O Squirrel **não exige** assinatura de código para funcionar, mas sem ela:
- O Windows Defender / SmartScreen pode mostrar aviso "Publisher unknown"
- O usuário precisa clicar em "Executar mesmo assim"

Para release público, recomendado assinar com um certificado EV (Extended Validation).
Para testes internos ou beta, pode ignorar este passo.

---

## 7. URL do feed de atualização alternativo

Para testar o auto-update sem GitHub, configure a variável de ambiente antes de iniciar o app:

```bash
APP_UPDATE_FEED=http://localhost:8080 npm run dev
```

O `electron-updater` consultará esse endereço em vez do GitHub Releases.
