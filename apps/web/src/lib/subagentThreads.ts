import type { OrchestrationThreadActivity, TurnId } from "@t3tools/contracts";

export interface SubagentThread {
  taskId: string;
  taskType: string | null;
  description: string | null;
  latestSummary: string | null;
  status: "running" | "completed" | "failed" | "stopped";
  startedAt: string;
  completedAt: string | null;
  progressActivities: ReadonlyArray<OrchestrationThreadActivity>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compareActivitiesByOrder(
  left: OrchestrationThreadActivity,
  right: OrchestrationThreadActivity,
): number {
  if (left.sequence !== undefined && right.sequence !== undefined) {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
  } else if (left.sequence !== undefined) {
    return 1;
  } else if (right.sequence !== undefined) {
    return -1;
  }

  const createdAtComparison = left.createdAt.localeCompare(right.createdAt);
  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  const lifecycleRankComparison =
    compareActivityLifecycleRank(left.kind) - compareActivityLifecycleRank(right.kind);
  if (lifecycleRankComparison !== 0) {
    return lifecycleRankComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareActivityLifecycleRank(kind: string): number {
  if (kind.endsWith(".started")) {
    return 0;
  }
  if (kind.endsWith(".progress") || kind.endsWith(".updated")) {
    return 1;
  }
  if (kind.endsWith(".completed") || kind.endsWith(".resolved")) {
    return 2;
  }
  return 1;
}

function extractTaskId(payload: Record<string, unknown> | null): string | null {
  return asTrimmedString(payload?.taskId);
}

/**
 * Derives SubagentThread objects from a flat list of orchestration activities.
 *
 * Filters to the latest turn when `latestTurnId` is provided, groups `task.*`
 * activities by `payload.taskId`, and assembles per-task lifecycle state from
 * `task.started`, `task.progress`, and `task.completed` events. Running tasks
 * appear before settled tasks; within each group activities are sorted by
 * sequence/createdAt/lifecycle rank (ascending).
 */
export function deriveSubagentThreads(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
  latestTurnId: TurnId | undefined,
): SubagentThread[] {
  const ordered = [...activities].toSorted(compareActivitiesByOrder);

  const turnFiltered = latestTurnId
    ? ordered.filter((activity) => activity.turnId === latestTurnId)
    : ordered;

  const taskActivities = turnFiltered.filter((activity) => activity.kind.startsWith("task."));

  const byTaskId = new Map<
    string,
    {
      started: OrchestrationThreadActivity | null;
      progress: OrchestrationThreadActivity[];
      completed: OrchestrationThreadActivity | null;
    }
  >();

  for (const activity of taskActivities) {
    const payload = asRecord(activity.payload);
    const taskId = extractTaskId(payload);
    if (!taskId) {
      continue;
    }

    if (!byTaskId.has(taskId)) {
      byTaskId.set(taskId, { started: null, progress: [], completed: null });
    }

    const bucket = byTaskId.get(taskId)!;

    if (activity.kind === "task.started") {
      bucket.started = activity;
    } else if (activity.kind === "task.progress") {
      bucket.progress.push(activity);
    } else if (activity.kind === "task.completed") {
      bucket.completed = activity;
    }
  }

  const threads: SubagentThread[] = [];

  for (const [taskId, bucket] of byTaskId) {
    const startedActivity = bucket.started;
    if (!startedActivity) {
      continue;
    }

    const startedPayload = asRecord(startedActivity.payload);
    const taskType = asTrimmedString(startedPayload?.taskType);
    const description = asTrimmedString(startedPayload?.description);

    const latestProgress = bucket.progress.at(-1);
    const completedPayload = asRecord(bucket.completed?.payload ?? null);

    let latestSummary: string | null = null;
    if (completedPayload) {
      latestSummary =
        asTrimmedString(completedPayload.summary) ?? asTrimmedString(completedPayload.detail);
    }
    if (!latestSummary && latestProgress) {
      const progressPayload = asRecord(latestProgress.payload);
      latestSummary =
        asTrimmedString(progressPayload?.summary) ??
        asTrimmedString(progressPayload?.description) ??
        null;
    }

    let status: SubagentThread["status"] = "running";
    let completedAt: string | null = null;

    if (bucket.completed) {
      const rawStatus = asTrimmedString(completedPayload?.status);
      if (rawStatus === "completed" || rawStatus === "failed" || rawStatus === "stopped") {
        status = rawStatus;
      } else {
        status = "completed";
      }
      completedAt = bucket.completed.createdAt;
    }

    const progressActivities: ReadonlyArray<OrchestrationThreadActivity> = bucket.progress;

    threads.push({
      taskId,
      taskType,
      description,
      latestSummary,
      status,
      startedAt: startedActivity.createdAt,
      completedAt,
      progressActivities,
    });
  }

  return threads.toSorted((left, right) => {
    const leftRunning = left.status === "running" ? 0 : 1;
    const rightRunning = right.status === "running" ? 0 : 1;
    if (leftRunning !== rightRunning) {
      return leftRunning - rightRunning;
    }
    return left.startedAt.localeCompare(right.startedAt);
  });
}

/**
 * Returns true if any thread has status "running".
 */
export function hasActiveSubagentThreads(threads: SubagentThread[]): boolean {
  return threads.some((thread) => thread.status === "running");
}

/**
 * Returns counts of threads by status for badge display.
 */
export function countSubagentThreadsByStatus(threads: SubagentThread[]): {
  running: number;
  completed: number;
  failed: number;
  stopped: number;
} {
  let running = 0;
  let completed = 0;
  let failed = 0;
  let stopped = 0;

  for (const thread of threads) {
    switch (thread.status) {
      case "running":
        running += 1;
        break;
      case "completed":
        completed += 1;
        break;
      case "failed":
        failed += 1;
        break;
      case "stopped":
        stopped += 1;
        break;
    }
  }

  return { running, completed, failed, stopped };
}
