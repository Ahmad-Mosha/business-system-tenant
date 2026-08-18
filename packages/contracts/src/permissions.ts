/**
 * Permission codes are data, not code branches: they live in the database and are
 * bundled into roles. This file is the shared vocabulary so the API and the web app
 * cannot drift apart on spelling.
 *
 * Only codes that are actually enforced today appear here. Add one when the
 * capability it guards is built, not before.
 */
export const PERMISSIONS = {
  ORDER_READ: 'order:read',
  ORDER_ASSIGN: 'order:assign',
  ORDER_UPDATE_STATUS: 'order:update_status',
  CATALOG_READ: 'catalog:read',
  CATALOG_WRITE: 'catalog:write',
  USER_READ: 'user:read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
