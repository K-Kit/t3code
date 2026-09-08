export function connectedAppReference(app: { readonly id: string; readonly name: string }) {
  const label = app.name
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("\n", " ");
  return `[${label}](app://${encodeURIComponent(app.id)})`;
}

/** Converts explicit app links to provider mentions without changing account permissions. */
export function connectedAppMentions(prompt: string) {
  const seen = new Set<string>();
  return [
    ...prompt.matchAll(/\[((?:\\.|[^\]\\\r\n]){1,200})\]\(app:\/\/([A-Za-z0-9_%.-]{1,600})\)/g),
  ].flatMap((match) => {
    let id: string;
    try {
      id = decodeURIComponent(match[2]!);
    } catch {
      return [];
    }
    if (!/^[A-Za-z0-9_.-]{1,200}$/.test(id) || seen.has(id) || seen.size >= 10) return [];
    seen.add(id);
    return [
      { type: "mention" as const, name: match[1]!.replace(/\\(.)/g, "$1"), path: `app://${id}` },
    ];
  });
}
