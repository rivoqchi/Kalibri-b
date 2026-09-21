export type UserRole = 'user' | 'admin' | 'super_admin';

export const USER_ROLES: UserRole[] = ['user', 'admin', 'super_admin'];

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'super_admin';
}

export function parseUserRole(value: unknown): UserRole {
  if (value === 'super_admin' || value === 'admin') return value;
  return 'user';
}
