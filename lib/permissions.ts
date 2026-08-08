// Central place for all role-hierarchy decisions, so permission rules live
// in one file instead of being scattered/duplicated across API routes.
//
// Hierarchy: SUPER_ADMIN > SUB_ADMIN > TEACHER > STUDENT
// Permission flows top -> bottom only; a lower role never gets a higher
// role's permissions.

export type AppRole = "SUPER_ADMIN" | "SUB_ADMIN" | "TEACHER" | "STUDENT";

export const ROLE_RANK: Record<AppRole, number> = {
  SUPER_ADMIN: 4,
  SUB_ADMIN: 3,
  TEACHER: 2,
  STUDENT: 1,
};

// Any of the three staff roles — can open the admin panel at all.
export function isAdminTier(role: AppRole): boolean {
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN" || role === "TEACHER";
}

// Sub Admin or Super Admin — approve/publish tests, manage users, curate
// system-wide config (rank predictor data, security policy view, etc).
export function isManagerTier(role: AppRole): boolean {
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN";
}

// Only Super Admin touches true system-level settings (multi-login policy,
// permanent delete, creating other Sub Admins).
export function isSuperAdmin(role: AppRole): boolean {
  return role === "SUPER_ADMIN";
}

// Rule 1 + Rule 2 from the RBAC spec: exactly one Super Admin ever exists,
// and nobody can create a peer or superior role.
export function canCreateRole(actorRole: AppRole, targetRole: AppRole): boolean {
  if (targetRole === "SUPER_ADMIN") return false; // singleton, seeded only
  if (actorRole === "SUPER_ADMIN") return targetRole === "SUB_ADMIN" || targetRole === "TEACHER" || targetRole === "STUDENT";
  if (actorRole === "SUB_ADMIN") return targetRole === "TEACHER" || targetRole === "STUDENT";
  return false; // Teacher/Student cannot create accounts
}

// Rule 3: a Teacher only ever operates within their own assigned subject.
export function canAccessSubject(role: AppRole, userSubject: string | null, targetSubject: string): boolean {
  if (role !== "TEACHER") return true; // managers see everything
  return userSubject === targetSubject;
}

// Ownership check used for "edit own test/question only" rules.
export function ownsOrManages(
  role: AppRole,
  userId: string,
  createdById: string | null | undefined
): boolean {
  if (isManagerTier(role)) return true;
  return createdById === userId;
}
