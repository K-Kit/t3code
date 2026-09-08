import { DocumentError, type DocumentSourceExcerptInput } from "@t3tools/contracts";
import { documentParagraphs } from "@t3tools/shared/documentText";
import * as Effect from "effect/Effect";
import { DocumentStore } from "./DocumentStore.ts";
import { storageError } from "./DocumentBlobs.ts";
export const sourceExcerpt = Effect.fn("DocumentSources.excerpt")(function* (
  input: typeof DocumentSourceExcerptInput.Type,
) {
  const store = yield* DocumentStore;
  const revision = yield* store.revision(input, input.revisionId);
  const text = new TextDecoder().decode(yield* store.blobs.read(revision.contentHash));
  const paragraph = documentParagraphs(text)[input.paragraph - 1];
  if (!paragraph)
    return yield* new DocumentError({
      reason: "not-found",
      message: "This source passage was not found.",
    });
  return { title: revision.title, text: paragraph.text, label: paragraph.label };
}, Effect.mapError(storageError));
