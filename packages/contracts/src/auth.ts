import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z
    .string()
    .min(12, 'Use at least 12 characters')
    .max(200, 'Use at most 200 characters'),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

/**
 * Scope answers "which rows", separately from "which actions".
 * ALL          - every row in the organization
 * ASSIGNED     - only rows assigned to the acting user
 */
export const permissionScopeSchema = z.enum(['ALL', 'ASSIGNED']);
export type PermissionScope = z.infer<typeof permissionScopeSchema>;

export const grantSchema = z.object({
  permission: z.string(),
  scope: permissionScopeSchema,
});
export type Grant = z.infer<typeof grantSchema>;

/**
 * What the web app needs to render the shell. `grants` drives which controls are
 * shown - it never decides access. The API re-checks every request.
 */
export const currentUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  roles: z.array(z.string()),
  grants: z.array(grantSchema),
  mustChangePassword: z.boolean(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
