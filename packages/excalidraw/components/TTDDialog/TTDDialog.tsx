import { Dialog } from "../Dialog";
import { useApp, useExcalidrawSetAppState } from "../App";
import MermaidToExcalidraw from "./MermaidToExcalidraw";
import TTDDialogTabs from "./TTDDialogTabs";
import type { ChangeEventHandler } from "react";
import { useEffect, useRef, useState } from "react";
import { useUIAppState } from "../../context/ui-appState";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTab } from "./TTDDialogTab";
import { t } from "../../i18n";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";
import type { MermaidToExcalidrawLibProps } from "./common";
import {
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";
import type { NonDeletedExcalidrawElement } from "../../element/types";
import type { BinaryFiles } from "../../types";
import { ArrowRightIcon } from "../icons";

import "./TTDDialog.scss";
import { atom, useAtom } from "../../editor-jotai";
import { trackEvent } from "../../analytics";
import { InlineIcon } from "../InlineIcon";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";
import { isFiniteNumber } from "@excalidraw/math";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { EDITOR_LS_KEYS } from "../../constants";

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 1000;

/** Rate-limit TTL: midnight UTC resets the daily quota */
const getRateLimitResetMs = () => {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.getTime();
};

type PersistedRateLimits = {
  rateLimit: number;
  rateLimitRemaining: number;
  resetAt: number; // ms epoch
};

const loadPersistedRateLimits = (): {
  rateLimit: number;
  rateLimitRemaining: number;
} | null => {
  const stored = EditorLocalStorage.get<PersistedRateLimits>(
    EDITOR_LS_KEYS.TTD_RATE_LIMIT,
  );
  if (!stored) {
    return null;
  }
  // expired — drop stale data so UI doesn't show 0 requests after midnight
  if (Date.now() >= stored.resetAt) {
    EditorLocalStorage.delete(EDITOR_LS_KEYS.TTD_RATE_LIMIT);
    return null;
  }
  return { rateLimit: stored.rateLimit, rateLimitRemaining: stored.rateLimitRemaining };
};

const persistRateLimits = (rateLimit: number, rateLimitRemaining: number) => {
  EditorLocalStorage.set(EDITOR_LS_KEYS.TTD_RATE_LIMIT, {
    rateLimit,
    rateLimitRemaining,
    resetAt: getRateLimitResetMs(),
  } satisfies PersistedRateLimits);
};

const rateLimitsAtom = atom<{
  rateLimit: number;
  rateLimitRemaining: number;
} | null>(loadPersistedRateLimits());

const ttdGenerationAtom = atom<{
  generatedResponse: string | null;
  prompt: string | null;
} | null>(null);

type OnTestSubmitRetValue = {
  rateLimit?: number | null;
  rateLimitRemaining?: number | null;
} & (
  | { generatedResponse: string | undefined; error?: null | undefined }
  | {
      error: Error;
      generatedResponse?: null | undefined;
    }
);

export const TTDDialog = (
  props:
    | {
        onTextSubmit(value: string): Promise<OnTestSubmitRetValue>;
      }
    | { __fallback: true },
) => {
  const appState = useUIAppState();

  if (appState.openDialog?.name !== "ttd") {
    return null;
  }

  return <TTDDialogBase {...props} tab={appState.openDialog.tab} />;
};

/**
 * Text to diagram (TTD) dialog
 */
export const TTDDialogBase = withInternalFallback(
  "TTDDialogBase",
  ({
    tab,
    ...rest
  }: {
    tab: "text-to-diagram" | "mermaid";
  } & (
    | {
        onTextSubmit(value: string): Promise<OnTestSubmitRetValue>;
      }
    | { __fallback: true }
  )) => {
    const app = useApp();
    const setAppState = useExcalidrawSetAppState();

    const someRandomDivRef = useRef<HTMLDivElement>(null);

    const [ttdGeneration, setTtdGeneration] = useAtom(ttdGenerationAtom);

    const [text, setText] = useState(ttdGeneration?.prompt ?? "");

    const prompt = text.trim();

    const handleTextChange: ChangeEventHandler<HTMLTextAreaElement> = (
      event,
    ) => {
      setText(event.target.value);
      setTtdGeneration((s) => ({
        generatedResponse: s?.generatedResponse ?? null,
        prompt: event.target.value,
      }));
    };

    const [onTextSubmitInProgess, setOnTextSubmitInProgess] = useState(false);
    const [rateLimits, setRateLimits] = useAtom(rateLimitsAtom);
    // ref to the AbortController for the in-flight request so we can cancel it
    const abortControllerRef = useRef<AbortController | null>(null);

    // cancel any in-flight request when the dialog unmounts
    useEffect(() => {
      return () => {
        abortControllerRef.current?.abort();
      };
    }, []);

    const onGenerate = async () => {
      if (
        prompt.length > MAX_PROMPT_LENGTH ||
        prompt.length < MIN_PROMPT_LENGTH ||
        onTextSubmitInProgess ||
        rateLimits?.rateLimitRemaining === 0 ||
        // means this is not a text-to-diagram dialog (needed for TS only)
        "__fallback" in rest
      ) {
        if (prompt.length < MIN_PROMPT_LENGTH) {
          setError(
            new Error(
              `Prompt is too short (min ${MIN_PROMPT_LENGTH} characters)`,
            ),
          );
        }
        if (prompt.length > MAX_PROMPT_LENGTH) {
          setError(
            new Error(
              `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`,
            ),
          );
        }

        return;
      }

      // abort any previous in-flight request before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 30 s hard timeout — AI responses should never take longer than this
      const timeoutId = setTimeout(() => {
        controller.abort(new Error("Request timed out after 30 seconds"));
      }, 30_000);

      try {
        setOnTextSubmitInProgess(true);

        trackEvent("ai", "generate", "ttd");

        const { generatedResponse, error, rateLimit, rateLimitRemaining } =
          await rest.onTextSubmit(prompt);

        if (typeof generatedResponse === "string") {
          setTtdGeneration((s) => ({
            generatedResponse,
            prompt: s?.prompt ?? null,
          }));
        }

        if (isFiniteNumber(rateLimit) && isFiniteNumber(rateLimitRemaining)) {
          setRateLimits({ rateLimit, rateLimitRemaining });
          persistRateLimits(rateLimit, rateLimitRemaining);
        }

        if (error) {
          setError(error);
          return;
        }
        if (!generatedResponse) {
          setError(new Error("Generation failed"));
          return;
        }

        try {
          await convertMermaidToExcalidraw({
            canvasRef: someRandomDivRef,
            data,
            mermaidToExcalidrawLib,
            setError,
            mermaidDefinition: generatedResponse,
          });
          trackEvent("ai", "mermaid parse success", "ttd");
        } catch (error: any) {
          console.info(
            `%cTTD mermaid render error: ${error.message}`,
            "color: red",
          );
          trackEvent("ai", "mermaid parse failed", "ttd");
          setError(
            new Error(
              "Generated an invalid diagram :(. You may also try a different prompt.",
            ),
          );
        }
      } catch (error: any) {
        // swallow aborts triggered by unmount or a new request replacing this one
        if (error?.name === "AbortError") {
          return;
        }
        const message: string =
          error?.message && error.message !== "Failed to fetch"
            ? error.message
            : "Request failed";
        setError(new Error(message));
      } finally {
        clearTimeout(timeoutId);
        setOnTextSubmitInProgess(false);
      }
    };

    const refOnGenerate = useRef(onGenerate);
    refOnGenerate.current = onGenerate;

    const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] =
      useState<MermaidToExcalidrawLibProps>({
        loaded: false,
        api: import("@excalidraw/mermaid-to-excalidraw"),
      });

    useEffect(() => {
      const fn = async () => {
        await mermaidToExcalidrawLib.api;
        setMermaidToExcalidrawLib((prev) => ({ ...prev, loaded: true }));
      };
      fn();
    }, [mermaidToExcalidrawLib.api]);

    const data = useRef<{
      elements: readonly NonDeletedExcalidrawElement[];
      files: BinaryFiles | null;
    }>({ elements: [], files: null });

    const [error, setError] = useState<Error | null>(null);

    return (
      <Dialog
        className="ttd-dialog"
        onCloseRequest={() => {
          app.setOpenDialog(null);
        }}
        size={1200}
        title={false}
        {...rest}
        autofocus={false}
      >
        <TTDDialogTabs dialog="ttd" tab={tab}>
          {"__fallback" in rest && rest.__fallback ? (
            <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          ) : (
            <TTDDialogTabTriggers>
              <TTDDialogTabTrigger tab="text-to-diagram">
                <div style={{ display: "flex", alignItems: "center" }}>
                  {t("labels.textToDiagram")}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1px 6px",
                      marginLeft: "10px",
                      fontSize: 10,
                      borderRadius: "12px",
                      background: "var(--color-promo)",
                      color: "var(--color-surface-lowest)",
                    }}
                  >
                    AI Beta
                  </div>
                </div>
              </TTDDialogTabTrigger>
              <TTDDialogTabTrigger tab="mermaid">Mermaid</TTDDialogTabTrigger>
            </TTDDialogTabTriggers>
          )}

          <TTDDialogTab className="ttd-dialog-content" tab="mermaid">
            <MermaidToExcalidraw
              mermaidToExcalidrawLib={mermaidToExcalidrawLib}
            />
          </TTDDialogTab>
          {!("__fallback" in rest) && (
            <TTDDialogTab className="ttd-dialog-content" tab="text-to-diagram">
              <div className="ttd-dialog-desc">
                Currently we use Mermaid as a middle step, so you'll get best
                results if you describe a diagram, workflow, flow chart, and
                similar.
              </div>
              <TTDDialogPanels>
                <TTDDialogPanel
                  label={t("labels.prompt")}
                  panelAction={{
                    action: onGenerate,
                    label: "Generate",
                    icon: ArrowRightIcon,
                  }}
                  onTextSubmitInProgess={onTextSubmitInProgess}
                  panelActionDisabled={
                    prompt.length > MAX_PROMPT_LENGTH ||
                    rateLimits?.rateLimitRemaining === 0
                  }
                  renderTopRight={() => {
                    if (!rateLimits) {
                      return null;
                    }

                    return (
                      <div
                        className="ttd-dialog-rate-limit"
                        style={{
                          fontSize: 12,
                          marginLeft: "auto",
                          color:
                            rateLimits.rateLimitRemaining === 0
                              ? "var(--color-danger)"
                              : undefined,
                        }}
                      >
                        {rateLimits.rateLimitRemaining} requests left today
                      </div>
                    );
                  }}
                  renderSubmitShortcut={() => <TTDDialogSubmitShortcut />}
                  renderBottomRight={() => {
                    if (typeof ttdGeneration?.generatedResponse === "string") {
                      return (
                        <div
                          className="excalidraw-link"
                          style={{ marginLeft: "auto", fontSize: 14 }}
                          onClick={() => {
                            if (
                              typeof ttdGeneration?.generatedResponse ===
                              "string"
                            ) {
                              saveMermaidDataToStorage(
                                ttdGeneration.generatedResponse,
                              );
                              setAppState({
                                openDialog: { name: "ttd", tab: "mermaid" },
                              });
                            }
                          }}
                        >
                          View as Mermaid
                          <InlineIcon icon={ArrowRightIcon} />
                        </div>
                      );
                    }
                    const ratio = prompt.length / MAX_PROMPT_LENGTH;
                    if (ratio > 0.8) {
                      return (
                        <div
                          style={{
                            marginLeft: "auto",
                            fontSize: 12,
                            fontFamily: "monospace",
                            color:
                              ratio > 1 ? "var(--color-danger)" : undefined,
                          }}
                        >
                          Length: {prompt.length}/{MAX_PROMPT_LENGTH}
                        </div>
                      );
                    }

                    return null;
                  }}
                >
                  <TTDDialogInput
                    onChange={handleTextChange}
                    input={text}
                    placeholder={"Describe what you want to see..."}
                    onKeyboardSubmit={() => {
                      refOnGenerate.current();
                    }}
                  />
                </TTDDialogPanel>
                <TTDDialogPanel
                  label="Preview"
                  panelAction={{
                    action: () => {
                      console.info("Panel action clicked");
                      insertToEditor({ app, data });
                    },
                    label: "Insert",
                    icon: ArrowRightIcon,
                  }}
                >
                  <TTDDialogOutput
                    canvasRef={someRandomDivRef}
                    error={error}
                    loaded={mermaidToExcalidrawLib.loaded}
                  />
                </TTDDialogPanel>
              </TTDDialogPanels>
            </TTDDialogTab>
          )}
        </TTDDialogTabs>
      </Dialog>
    );
  },
);
