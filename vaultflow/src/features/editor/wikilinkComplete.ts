import { autocompletion, type CompletionSource } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { useVaultStore } from "../../stores/useVaultStore";

const OPEN_BRACKETS_BEFORE = /\[\[([^[\]\n]*)$/;

const wikilinkSource: CompletionSource = (ctx) => {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);
  const m = OPEN_BRACKETS_BEFORE.exec(textBefore);
  if (!m) return null;

  const query = m[1];
  const from = ctx.pos - query.length;

  const notes = Object.values(useVaultStore.getState().notes);
  const options = notes.map((n) => ({
    label: n.title,
    type: "text",
    apply: `${n.title}]]`,
  }));

  return { from, options, validFor: /^[^\]\n]*$/ };
};

export function wikilinkAutocomplete(): Extension {
  return autocompletion({
    override: [wikilinkSource],
    activateOnTyping: true,
  });
}
