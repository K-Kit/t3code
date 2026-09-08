import { diffArrays } from "diff";
import { documentParagraphs } from "@t3tools/shared/documentText";
export function paragraphChanges(before: string, after: string) {
  const changes = diffArrays(
    documentParagraphs(before).map((part) => part.text),
    documentParagraphs(after).map((part) => part.text),
    { maxEditLength: 256 },
  );
  if (!changes) return null;
  return {
    removed: changes.filter((change) => change.removed).flatMap((change) => change.value),
    added: changes.filter((change) => change.added).flatMap((change) => change.value),
  };
}
