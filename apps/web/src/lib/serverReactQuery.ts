import { queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

export const serverQueryKeys = {
  all: ["server"] as const,
  config: () => ["server", "config"] as const,
};

export function serverConfigQueryOptions() {
  return queryOptions({
    queryKey: serverQueryKeys.config(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.server.getConfig();
    },
    staleTime: Infinity,
  });
}

export const skillsQueryKeys = {
  all: ["skills"] as const,
  list: () => ["skills", "list"] as const,
};

export function skillsListQueryOptions() {
  return queryOptions({
    queryKey: skillsQueryKeys.list(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.skills.list();
    },
    staleTime: 30_000,
  });
}
