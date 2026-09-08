import { useMemo, useState } from "react";
import { View } from "react-native";
import type { DocumentSource, EnvironmentId, ProjectId } from "@t3tools/contracts";
import { documentCitations } from "@t3tools/shared/documentText";
import { AppText as Text } from "../../components/AppText";
import { documentEnvironment } from "../../state/documents";
import { useEnvironmentQuery } from "../../state/query";
import { DocumentAction } from "./DocumentAction";

export function DocumentCitations({
  environmentId,
  projectId,
  content,
  sources,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly content: string;
  readonly sources: readonly (typeof DocumentSource.Type)[];
}) {
  const citations = useMemo(
    () =>
      documentCitations(content)
        .filter((citation) => citation.paragraph > 0 && sources[citation.source - 1])
        .slice(0, 100),
    [content, sources],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const citation = citations.find((item) => item.label === selected);
  const source = citation && sources[citation.source - 1];
  const excerpt = useEnvironmentQuery(
    source && citation
      ? documentEnvironment.sourceExcerpt({
          environmentId,
          input: {
            projectId,
            documentId: source.documentId,
            revisionId: source.revisionId,
            paragraph: citation.paragraph,
          },
        })
      : null,
  );
  if (!citations.length) return null;
  return (
    <View className="gap-2 border-t border-input-border pt-3">
      <Text className="text-sm font-medium">Cited sources</Text>
      {citations.map((item) => (
        <DocumentAction
          key={item.label}
          title={`${selected === item.label ? "Hide" : "Read"} ${item.label} · ${sources[item.source - 1]?.title ?? "Source"}`}
          onPress={() => setSelected(selected === item.label ? null : item.label)}
        />
      ))}
      {selected && (
        <View className="gap-2 rounded-xl border border-input-border p-3">
          {excerpt.error && <Text accessibilityRole="alert">{excerpt.error}</Text>}
          {excerpt.isPending && !excerpt.data && <Text>Loading source passage…</Text>}
          {excerpt.data && (
            <>
              <Text className="text-sm font-medium">
                {excerpt.data.title} · {excerpt.data.label}
              </Text>
              <Text selectable>{excerpt.data.text}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}
