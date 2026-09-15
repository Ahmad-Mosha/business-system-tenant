/**
 * The body of an error a person will read. `code` is stable — the web app
 * puts it in the reader's language (apps/web/src/messages → `errors.api`) —
 * `params` are the values its sentence needs, and `message` stays the English
 * for logs and anyone reading the API directly. A code the web doesn't know
 * yet falls back to `message`, so adding one never breaks a screen.
 *
 *   throw new BadRequestException(problem('order.phone', 'enter a valid …'));
 */
export const problem = (code: string, message: string, params?: Record<string, string | number>) => ({
  code,
  message,
  ...(params && { params }),
});
