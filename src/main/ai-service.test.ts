import { describe, it, expect } from "vitest";
import { convertToExcalidraw } from "./ai-service";

describe("convertToExcalidraw", () => {
  it("converts a rectangle with label to shape + text", () => {
    const input = [
      { type: "rectangle", x: 10, y: 20, width: 200, height: 80, label: "Hello" },
    ];
    const result = convertToExcalidraw(input);

    expect(result).toHaveLength(2); // shape + label text
    expect(result[0].type).toBe("rectangle");
    expect(result[0].x).toBe(10);
    expect(result[0].y).toBe(20);
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBe(80);
    expect(result[0].id).toBeDefined();
    expect(result[0].strokeColor).toBe("#1e1e1e");

    // Label text element
    expect(result[1].type).toBe("text");
    expect(result[1].text).toBe("Hello");
  });

  it("converts an ellipse without label to single shape", () => {
    const input = [
      { type: "ellipse", x: 0, y: 0, width: 100, height: 100 },
    ];
    const result = convertToExcalidraw(input);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("ellipse");
  });

  it("converts a diamond with color", () => {
    const input = [
      { type: "diamond", x: 50, y: 50, width: 120, height: 120, color: "#ff0000" },
    ];
    const result = convertToExcalidraw(input);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("diamond");
    expect(result[0].backgroundColor).toBe("#ff0000");
  });

  it("converts an arrow with dx/dy to points", () => {
    const input = [
      { type: "arrow", x: 10, y: 20, dx: 160, dy: 0 },
    ];
    const result = convertToExcalidraw(input);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("arrow");
    expect(result[0].points).toEqual([[0, 0], [160, 0]]);
    expect(result[0].endArrowhead).toBe("arrow");
  });

  it("converts a text element", () => {
    const input = [
      { type: "text", x: 100, y: 200, label: "Some text" },
    ];
    const result = convertToExcalidraw(input);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("text");
    expect(result[0].text).toBe("Some text");
    expect(result[0].fontSize).toBe(14);
    expect(result[0].textAlign).toBe("center");
  });

  it("skips elements without type", () => {
    const input = [
      { x: 10, y: 20 },
      { type: "rectangle", x: 0, y: 0 },
    ];
    const result = convertToExcalidraw(input);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("rectangle");
  });

  it("returns empty array for empty input", () => {
    expect(convertToExcalidraw([])).toEqual([]);
  });

  it("applies defaults when dimensions are missing", () => {
    const input = [{ type: "rectangle" }];
    const result = convertToExcalidraw(input);

    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
    expect(result[0].width).toBe(160);
    expect(result[0].height).toBe(60);
  });

  it("generates unique ids for each element", () => {
    const input = [
      { type: "rectangle", x: 0, y: 0 },
      { type: "rectangle", x: 200, y: 0 },
    ];
    const result = convertToExcalidraw(input);

    expect(result[0].id).not.toBe(result[1].id);
  });

  it("includes all required Excalidraw fields", () => {
    const input = [{ type: "rectangle", x: 0, y: 0 }];
    const result = convertToExcalidraw(input);
    const el = result[0];

    expect(el).toHaveProperty("angle", 0);
    expect(el).toHaveProperty("fillStyle", "solid");
    expect(el).toHaveProperty("strokeWidth", 2);
    expect(el).toHaveProperty("strokeStyle", "solid");
    expect(el).toHaveProperty("roughness", 1);
    expect(el).toHaveProperty("opacity", 100);
    expect(el).toHaveProperty("isDeleted", false);
    expect(el).toHaveProperty("groupIds");
    expect(el).toHaveProperty("locked", false);
    expect(el).toHaveProperty("seed");
  });
});
