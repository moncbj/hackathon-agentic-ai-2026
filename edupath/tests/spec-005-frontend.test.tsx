import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const slot = state.cursor++;
      if (!(slot in state.slots)) state.slots[slot] = typeof initial === "function" ? (initial as () => T)() : initial;
      const setValue = (value: T | ((previous: T) => T)) => {
        const previous = state.slots[slot] as T;
        state.slots[slot] = typeof value === "function" ? (value as (previous: T) => T)(previous) : value;
      };
      return [state.slots[slot] as T, setValue] as const;
    },
  };
});

import { NotebooksView, ProgressView, TutorView } from "@/components/spec005/spec005-views";

type Props = Record<string, unknown>;
type Predicate = (element: ReactElement<Props>) => boolean;

function render(Component: () => ReactElement) {
  state.cursor = 0;
  return Component();
}

function visit(node: ReactNode, predicate: Predicate): ReactElement<Props>[] {
  if (!node || typeof node !== "object" || !("type" in node)) return [];
  const element = node as ReactElement<Props>;
  const resolved = typeof element.type === "function" && element.type.name !== "TextField" && element.type.name !== "TextAreaField"
    ? element.type(element.props) as ReactElement<Props>
    : element;
  const matches = predicate(resolved) ? [resolved] : [];
  const children = resolved.props.children;
  return matches.concat(Array.isArray(children) ? children.flatMap((child) => visit(child, predicate)) : visit(children, predicate));
}

function find(root: ReactElement, predicate: Predicate) {
  const item = visit(root, predicate)[0];
  if (!item) throw new Error("Expected element was not rendered");
  return item;
}

afterEach(() => { state.slots = []; state.cursor = 0; vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("SPEC-005 frontend fixtures", () => {
  it("renders tutor controls and adds a mocked tutor response after a suggested question", () => {
    vi.stubGlobal("window", { setTimeout: (callback: () => void) => { callback(); return 0; } });
    let tree = render(TutorView);
    const suggestion = find(tree, (element) => element.type === "button" && element.props.children === "What should I do this week?");
    (suggestion.props.onClick as () => void)();
    tree = render(TutorView);
    expect(visit(tree, (element) => typeof element.props.children === "string" && element.props.children.includes("What should I do this week?")).length).toBeGreaterThan(0);
    tree = render(TutorView);
    expect((state.slots[0] as Array<{ text: string }>).at(-1)?.text).toContain("SQL filtering mission");
  });

  it("renders progress blocks and prepends a locally generated report", () => {
    let tree = render(ProgressView);
    expect(visit(tree, (element) => element.type === "h2" && element.props.children === "Acquired")).toHaveLength(1);
    const generate = find(tree, (element) => element.type === "button" && element.props.children === "Generate report");
    (generate.props.onClick as () => void)();
    tree = render(ProgressView);
    expect(visit(tree, (element) => element.props.children === "Just now")).toHaveLength(1);
  });

  it("renders notebook fixtures, opens the local creation form, and deletes a notebook locally", () => {
    let tree = render(NotebooksView);
    expect(visit(tree, (element) => element.type === "h2" && element.props.children === "SQL joins cheat sheet")).toHaveLength(1);
    const create = find(tree, (element) => element.type === "button" && element.props.children === "+ New notebook");
    (create.props.onClick as () => void)();
    tree = render(NotebooksView);
    expect(visit(tree, (element) => element.type === "h2" && element.props.children === "Create notebook")).toHaveLength(1);

    state.slots = [];
    tree = render(NotebooksView);
    const remove = find(tree, (element) => element.type === "button" && element.props.children === "Delete");
    (remove.props.onClick as () => void)();
    tree = render(NotebooksView);
    expect(visit(tree, (element) => element.type === "h2" && element.props.children === "SQL joins cheat sheet")).toHaveLength(0);
  });
});
