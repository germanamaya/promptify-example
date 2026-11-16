import { z } from "zod";
import { idSchema, paginationSchema } from "./common";

export const promptInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().min(1).max(10_000).refine((value) => value.trim().length > 0),
  description: z.string().trim().max(500).optional(),
  categoryIds: z.array(idSchema).min(1).refine((ids) => new Set(ids).size === ids.length),
});

export const promptListQuerySchema = paginationSchema.extend({
  categoryId: z.preprocess((value) => value === "" ? undefined : value, idSchema.optional()),
  q: z.string().trim().max(200).transform((value) => value || undefined).optional(),
});

export type PromptInput = z.infer<typeof promptInputSchema>;
export type PromptListQuery = z.infer<typeof promptListQuerySchema>;
