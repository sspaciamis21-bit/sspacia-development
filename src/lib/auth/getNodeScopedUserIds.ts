import prisma from '@/lib/prisma';

const ACCOUNTANT_EMAIL = 'ssinfrazone21@gmail.com';

/**
 * Determines scoped user IDs for node-based data isolation.
 *
 * - Admin / Super Admin → returns `null` (no filter, sees everything)
 * - Accountant (ssinfrazone21@gmail.com) → returns `null` (sees all invoices)
 * - Community Manager → returns array of userIds that share at least one
 *   assigned location with the current user, plus self and Admin entries.
 *
 * Usage: pass the result as `createdById: { in: scopedIds }` in Prisma `where`.
 * If null, skip the filter entirely.
 */
export async function getNodeScopedUserIds(userId: number): Promise<number[] | null> {
  // Fetch user with role and assigned locations
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: { select: { name: true } },
      assignedLocations: { select: { locationId: true } },
    },
  });

  if (!user) return [userId]; // Fallback: only see own entries

  const roleName = user.role.name.toUpperCase();

  // Admins see everything
  if (roleName === 'ADMIN' || roleName === 'SUPER_ADMIN' || roleName === 'SUPER-ADMIN') {
    return null;
  }

  // Accountant sees everything (for invoice processing)
  if (user.email.toLowerCase() === ACCOUNTANT_EMAIL) {
    return null;
  }

  // Fetch admin user IDs so admin-created entries are visible to CMs
  const adminUsers = await prisma.user.findMany({
    where: {
      role: {
        name: { in: ['ADMIN', 'SUPER_ADMIN', 'SUPER-ADMIN', 'Admin', 'Super Admin'] },
      },
    },
    select: { id: true },
  });
  const adminUserIds = adminUsers.map((u) => u.id);

  // Get the user's assigned location IDs
  const myLocationIds = user.assignedLocations.map((ul) => ul.locationId);

  if (myLocationIds.length === 0) {
    // No locations assigned — can see own entries + admin entries
    const set = new Set([userId, ...adminUserIds]);
    return Array.from(set);
  }

  // Find all users who share at least one location with the current user
  const coLocatedUsers = await prisma.userLocation.findMany({
    where: { locationId: { in: myLocationIds } },
    select: { userId: true },
    distinct: ['userId'],
  });

  const scopedUserIdsSet = new Set([
    userId,
    ...coLocatedUsers.map((ul) => ul.userId),
    ...adminUserIds,
  ]);

  return Array.from(scopedUserIdsSet);
}

/**
 * For Admin filter: given a locationId, return all user IDs assigned to that location.
 * Returns null if locationId is not provided (i.e. "show all").
 */
export async function getUserIdsByLocation(locationId: number | null): Promise<number[] | null> {
  if (!locationId) return null;

  const userLocations = await prisma.userLocation.findMany({
    where: { locationId },
    select: { userId: true },
    distinct: ['userId'],
  });

  // Also include admin user IDs
  const adminUsers = await prisma.user.findMany({
    where: {
      role: {
        name: { in: ['ADMIN', 'SUPER_ADMIN', 'SUPER-ADMIN', 'Admin', 'Super Admin'] },
      },
    },
    select: { id: true },
  });

  const set = new Set([...userLocations.map((ul) => ul.userId), ...adminUsers.map((u) => u.id)]);
  return Array.from(set);
}
