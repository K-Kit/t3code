import { useMemo, useState } from "react";
import { paragraphChanges } from "./paragraphChanges";
import { DocumentEditor } from "./DocumentEditor";
export function ParagraphChanges({
  before,
  after,
}: {
  readonly before: string;
  readonly after: string;
}) {
  const changes = useMemo(() => paragraphChanges(before, after), [before, after]);
  const [open, setOpen] = useState(false);
  if (!changes)
    return (
      <p className="my-3 text-sm text-muted-foreground">
        This is a substantial rewrite. Compare the full saved and proposed versions.
      </p>
    );
  return (
    <details
      className="my-3 rounded-lg border border-border p-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium">
        {changes.added.length} paragraphs added · {changes.removed.length} removed
      </summary>
      {open && (
        <div className="mt-3 space-y-3">
          {changes.removed.length > 0 && (
            <section>
              <h4 className="text-sm font-medium">Removed</h4>
              <DocumentEditor content={changes.removed.join("\n\n")} readOnly />
            </section>
          )}
          {changes.added.length > 0 && (
            <section>
              <h4 className="text-sm font-medium">Added</h4>
              <DocumentEditor content={changes.added.join("\n\n")} readOnly />
            </section>
          )}
        </div>
      )}
    </details>
  );
}
