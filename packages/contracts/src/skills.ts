import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

export const SkillSummary = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.optional(Schema.String),
  version: Schema.optional(TrimmedNonEmptyString),
  source: Schema.optional(TrimmedNonEmptyString),
  sourceUrl: Schema.optional(TrimmedNonEmptyString),
  sourceType: Schema.optional(TrimmedNonEmptyString),
  installedAt: Schema.optional(TrimmedNonEmptyString),
  updatedAt: Schema.optional(TrimmedNonEmptyString),
  allowedTools: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  enabled: Schema.Boolean,
});
export type SkillSummary = typeof SkillSummary.Type;

export const SkillsListResult = Schema.Struct({
  skills: Schema.Array(SkillSummary),
});
export type SkillsListResult = typeof SkillsListResult.Type;

export const SkillsSetEnabledInput = Schema.Struct({
  name: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
});
export type SkillsSetEnabledInput = typeof SkillsSetEnabledInput.Type;

export const SkillsSetEnabledResult = Schema.Struct({
  skill: SkillSummary,
});
export type SkillsSetEnabledResult = typeof SkillsSetEnabledResult.Type;
