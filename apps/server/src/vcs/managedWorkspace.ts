import type * as Path from "effect/Path";

export function managedWorkspaceRoot(
  path: Path.Path,
  stateDir: string,
  cwd: string,
): string | null {
  const workspacesDir = path.join(stateDir, "workspaces");
  const relative = path.relative(workspacesDir, cwd);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return path.join(workspacesDir, relative.split(path.sep)[0]!);
}
