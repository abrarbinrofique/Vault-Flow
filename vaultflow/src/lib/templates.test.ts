import { describe, expect, it } from "vitest";
import { isTemplatePath, substituteTemplate } from "./templates";

const NOW = new Date("2026-09-08T13:45:00");

describe("isTemplatePath", () => {
  it("recognises the Templates folder and its children", () => {
    expect(isTemplatePath("Templates")).toBe(true);
    expect(isTemplatePath("Templates/Meeting")).toBe(true);
    expect(isTemplatePath("Templates/Nested/Deep")).toBe(true);
  });
  it("rejects lookalikes and empty paths", () => {
    expect(isTemplatePath("")).toBe(false);
    expect(isTemplatePath(undefined)).toBe(false);
    expect(isTemplatePath(null)).toBe(false);
    expect(isTemplatePath("Template")).toBe(false); // singular, not the reserved folder
    expect(isTemplatePath("TemplatesOther/x")).toBe(false);
    expect(isTemplatePath("Notes/Templates")).toBe(false);
  });
});

describe("substituteTemplate", () => {
  it("replaces {{title}}", () => {
    const r = substituteTemplate("# {{title}}\n", { title: "Hello", now: NOW });
    expect(r.content).toBe("# Hello\n");
    expect(r.cursor).toBeNull();
  });

  it("replaces {{date}} with the default yyyy-MM-dd", () => {
    const r = substituteTemplate("{{date}}", { title: "x", now: NOW });
    expect(r.content).toBe("2026-09-08");
  });

  it("replaces {{time}} with the default HH:mm", () => {
    const r = substituteTemplate("{{time}}", { title: "x", now: NOW });
    expect(r.content).toBe("13:45");
  });

  it("respects a custom date/time format string", () => {
    const r = substituteTemplate(
      "{{date:EEEE, MMM d}} at {{time:h:mm a}}",
      { title: "x", now: NOW },
    );
    expect(r.content).toBe("Tuesday, Sep 8 at 1:45 PM");
  });

  it("leaves unknown variables untouched", () => {
    const r = substituteTemplate("hello {{unknown}} world", {
      title: "x",
      now: NOW,
    });
    expect(r.content).toBe("hello {{unknown}} world");
  });

  it("tolerates whitespace inside braces", () => {
    const r = substituteTemplate("{{ title }} {{ date }}", {
      title: "Y",
      now: NOW,
    });
    expect(r.content).toBe("Y 2026-09-08");
  });

  it("strips {{cursor}} and reports its offset", () => {
    const r = substituteTemplate("# {{title}}\n\n{{cursor}}\n", {
      title: "Foo",
      now: NOW,
    });
    expect(r.content).toBe("# Foo\n\n\n");
    expect(r.cursor).toBe("# Foo\n\n".length);
  });

  it("only removes the first {{cursor}} occurrence", () => {
    const r = substituteTemplate("{{cursor}} and {{cursor}}", {
      title: "x",
      now: NOW,
    });
    expect(r.content).toBe(" and {{cursor}}");
    expect(r.cursor).toBe(0);
  });
});
