import { z } from 'zod';

/**
 * The shape every error response uses. The API never returns a bare string or an
 * unshaped object, so the web app can render failures without guessing.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Field-level messages, keyed by dotted path, when a request failed validation. */
    details: z.record(z.array(z.string())).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const uuidSchema = z.string().uuid();
