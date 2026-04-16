import { describe, it, expect } from "vitest";
import { TEMPLATES, getTemplateList, getTemplateById } from "./templates";

describe("templates", () => {
  it("has 6 bundled templates", () => {
    expect(TEMPLATES).toHaveLength(6);
  });

  it("each template has required fields", () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.content).toBeTruthy();
      expect(t.scene.type).toBe("excalidraw");
      expect(t.scene.version).toBe(2);
      expect(t.scene.elements.length).toBeGreaterThan(0);
    }
  });

  it("all template IDs are unique", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("getTemplateList", () => {
    it("returns summary without content or scene", () => {
      const list = getTemplateList();
      expect(list).toHaveLength(6);
      for (const item of list) {
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("description");
        expect(item).toHaveProperty("icon");
        expect(item).not.toHaveProperty("content");
        expect(item).not.toHaveProperty("scene");
      }
    });
  });

  describe("getTemplateById", () => {
    it("finds kanban template", () => {
      const t = getTemplateById("kanban");
      expect(t).toBeDefined();
      expect(t!.name).toBe("Kanban");
    });

    it("finds all templates by ID", () => {
      for (const t of TEMPLATES) {
        expect(getTemplateById(t.id)).toBe(t);
      }
    });

    it("returns undefined for unknown ID", () => {
      expect(getTemplateById("nonexistent")).toBeUndefined();
    });
  });

  describe("template content quality", () => {
    it("kanban has markdown checklists", () => {
      const t = getTemplateById("kanban")!;
      expect(t.content).toContain("- [ ]");
      expect(t.content).toContain("- [x]");
    });

    it("swot has four quadrants", () => {
      const t = getTemplateById("swot")!;
      expect(t.content).toContain("Forcas");
      expect(t.content).toContain("Fraquezas");
      expect(t.content).toContain("Oportunidades");
      expect(t.content).toContain("Ameacas");
    });

    it("flowchart has start and end", () => {
      const t = getTemplateById("flowchart")!;
      expect(t.content).toContain("Inicio");
      expect(t.content).toContain("Fim");
    });

    it("meeting-notes has action items section", () => {
      const t = getTemplateById("meeting-notes")!;
      expect(t.content).toContain("Action Items");
      expect(t.content).toContain("Pauta");
    });

    it("sprint-retro has three retrospective columns", () => {
      const t = getTemplateById("sprint-retro")!;
      expect(t.content).toContain("O que foi bem");
      expect(t.content).toContain("O que melhorar");
    });
  });
});
