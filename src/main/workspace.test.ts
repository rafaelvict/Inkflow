import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Mock electron's app module before importing workspace
vi.mock("electron", () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
}));

// Mock store to return our test workspace path
let testWorkspace = "";
vi.mock("./store", () => ({
  DEFAULT_WORKSPACE: "/tmp/test-workspace",
  getStoredWorkspacePath: async () => testWorkspace,
}));

// Import after mocks are set up
const workspace = await import("./workspace");

describe("workspace", () => {
  beforeEach(async () => {
    testWorkspace = path.join(os.tmpdir(), `inkflow-test-${Date.now()}`);
    await fs.mkdir(testWorkspace, { recursive: true });
    // Warm up the workspace path cache
    await workspace.refreshWorkspacePath();
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it("getWorkspacePath returns cached path after refresh", () => {
    expect(workspace.getWorkspacePath()).toBe(testWorkspace);
  });

  it("ensureWorkspace creates directory if missing", async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
    await workspace.ensureWorkspace();
    const stat = await fs.stat(testWorkspace);
    expect(stat.isDirectory()).toBe(true);
  });

  describe("createNote", () => {
    it("creates note directory with meta, content, and scene files", async () => {
      const { id, dir } = await workspace.createNote();

      expect(id).toHaveLength(12);
      expect(dir).toContain(id);

      const meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf-8"));
      expect(meta.id).toBe(id);
      expect(meta.title).toBe("Sem título");
      expect(meta.tags).toEqual([]);
      expect(meta.pinned).toBe(false);

      const text = await fs.readFile(path.join(dir, "content.md"), "utf-8");
      expect(text).toBe("");

      const scene = JSON.parse(await fs.readFile(path.join(dir, "scene.excalidraw"), "utf-8"));
      expect(scene.type).toBe("excalidraw");
      expect(scene.elements).toEqual([]);

      const assetsStat = await fs.stat(path.join(dir, "assets"));
      expect(assetsStat.isDirectory()).toBe(true);
    });
  });

  describe("loadNote", () => {
    it("loads meta, text, and scene from note directory", async () => {
      const { id } = await workspace.createNote();
      const data = await workspace.loadNote(id);

      expect(data.meta.id).toBe(id);
      expect(data.text).toBe("");
      expect(data.scene.type).toBe("excalidraw");
    });
  });

  describe("saveNote", () => {
    it("saves text and updates meta", async () => {
      const { id, dir } = await workspace.createNote();

      await workspace.saveNote(id, { text: "# Hello", title: "Hello" });

      const text = await fs.readFile(path.join(dir, "content.md"), "utf-8");
      expect(text).toBe("# Hello");

      const meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf-8"));
      expect(meta.title).toBe("Hello");
    });

    it("saves scene data", async () => {
      const { id, dir } = await workspace.createNote();
      const sceneData = JSON.stringify({ type: "excalidraw", elements: [{ id: "1" }] });

      await workspace.saveNote(id, { scene: sceneData });

      const scene = await fs.readFile(path.join(dir, "scene.excalidraw"), "utf-8");
      expect(JSON.parse(scene).elements).toHaveLength(1);
    });
  });

  describe("deleteNote", () => {
    it("removes the note directory entirely", async () => {
      const { id, dir } = await workspace.createNote();
      await workspace.deleteNote(id);

      await expect(fs.access(dir)).rejects.toThrow();
    });
  });

  describe("togglePinNote", () => {
    it("toggles pinned state", async () => {
      const { id } = await workspace.createNote();

      const pinned1 = await workspace.togglePinNote(id);
      expect(pinned1).toBe(true);

      const pinned2 = await workspace.togglePinNote(id);
      expect(pinned2).toBe(false);
    });
  });

  describe("saveTags", () => {
    it("updates tags in meta", async () => {
      const { id, dir } = await workspace.createNote();

      await workspace.saveTags(id, ["work", "important"]);

      const meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf-8"));
      expect(meta.tags).toEqual(["work", "important"]);
    });
  });

  describe("listNotesRecent", () => {
    it("returns notes sorted by pinned then date", async () => {
      const { id: id1 } = await workspace.createNote();
      await workspace.saveNote(id1, { title: "First" });

      // Small delay for distinct timestamps
      await new Promise((r) => setTimeout(r, 20));

      const { id: id2 } = await workspace.createNote();
      await workspace.saveNote(id2, { title: "Second" });

      await workspace.togglePinNote(id1); // pin first

      const list = await workspace.listNotesRecent();
      expect(list.length).toBeGreaterThanOrEqual(2);
      // Pinned note should be first
      expect(list[0].id).toBe(id1);
      expect(list[0].pinned).toBe(true);
    });
  });

  describe("getAllTags", () => {
    it("returns unique sorted tags across all notes", async () => {
      const { id: id1 } = await workspace.createNote();
      await workspace.saveTags(id1, ["beta", "alpha"]);

      const { id: id2 } = await workspace.createNote();
      await workspace.saveTags(id2, ["alpha", "gamma"]);

      const tags = await workspace.getAllTags();
      expect(tags).toEqual(["alpha", "beta", "gamma"]);
    });
  });

  describe("searchNotes", () => {
    it("finds notes by title", async () => {
      const { id } = await workspace.createNote();
      await workspace.saveNote(id, { title: "Meeting notes", text: "agenda here" });

      const results = await workspace.searchNotes("meeting");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Meeting notes");
    });

    it("finds notes by text content", async () => {
      const { id } = await workspace.createNote();
      await workspace.saveNote(id, { title: "Untitled", text: "The quick brown fox" });

      const results = await workspace.searchNotes("brown fox");
      expect(results).toHaveLength(1);
      expect(results[0].snippet).toContain("brown fox");
    });

    it("finds notes by tag", async () => {
      const { id } = await workspace.createNote();
      await workspace.saveTags(id, ["projeto-x"]);

      const results = await workspace.searchNotes("projeto");
      expect(results).toHaveLength(1);
    });

    it("returns empty for no matches", async () => {
      await workspace.createNote();
      const results = await workspace.searchNotes("xyznonexistent");
      expect(results).toEqual([]);
    });
  });
});
