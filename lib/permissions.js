// Permission Resolution Library
// Resolves permissions for a user: Role defaults ∪ User overrides (granted) − User overrides (revoked)

import { prisma } from "@/lib/prisma";

// All permission keys used in the system
export const PERMISSIONS = {
  // Tickets
  TICKET_CREATE:    'ticket.create',
  TICKET_VIEW:      'ticket.view',
  TICKET_VIEW_ALL:  'ticket.view_all',
  TICKET_REPLY:     'ticket.reply',
  TICKET_EDIT:      'ticket.edit',
  TICKET_EDIT_ALL:  'ticket.edit_all',
  TICKET_DELETE:    'ticket.delete',
  TICKET_ASSIGN:    'ticket.assign',
  TICKET_SLA:       'ticket.sla',
  // Meetings
  MEETING_CREATE:   'meeting.create',
  MEETING_EDIT:     'meeting.edit',
  MEETING_VIEW_ALL: 'meeting.view_all',
  // Knowledge Base
  KB_CREATE:        'kb.create',
  KB_EDIT_ALL:      'kb.edit_all',
  KB_DELETE:        'kb.delete',
  // Reports
  REPORT_VIEW:      'report.view',
  REPORT_EXPORT:    'report.export',
  // Team
  TEAM_MANAGE:      'team.manage',
  TEAM_SCHEDULE:    'team.schedule',
  // Settings
  SETTINGS_MANAGE:  'settings.manage',
  SETTINGS_FIELDS:  'settings.fields',
  SETTINGS_BACKUP:  'settings.backup',
};

/**
 * Resolve all effective permissions for a user from DB.
 * Final = (Role permissions) ∪ (User granted) − (User revoked)
 * @param {number} userId
 * @returns {Promise<string[]>} Array of permission key strings
 */
export async function resolvePermissions(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: {
          permissions: {
            select: { permission: { select: { key: true } } }
          }
        }
      },
      userPermissions: {
        select: {
          granted: true,
          permission: { select: { key: true } }
        }
      }
    }
  });

  if (!user) return [];

  // Start with role defaults
  const permSet = new Set(
    user.role.permissions.map(rp => rp.permission.key)
  );

  // Apply user overrides
  for (const up of user.userPermissions) {
    if (up.granted) {
      permSet.add(up.permission.key);
    } else {
      permSet.delete(up.permission.key);
    }
  }

  return Array.from(permSet);
}

/**
 * Check if session has a specific permission.
 * Uses the permissions array stored in session.user.permissions
 * @param {object} session - NextAuth session
 * @param {string} key - Permission key to check
 * @returns {boolean}
 */
export function hasPermission(session, key) {
  if (!session?.user?.permissions) return false;
  return session.user.permissions.includes(key);
}

/**
 * Check if session has ANY of the given permissions (OR).
 * @param {object} session
 * @param {string[]} keys
 * @returns {boolean}
 */
export function hasAny(session, keys) {
  if (!session?.user?.permissions) return false;
  return keys.some(k => session.user.permissions.includes(k));
}

/**
 * Check if session has ALL of the given permissions (AND).
 * @param {object} session
 * @param {string[]} keys
 * @returns {boolean}
 */
export function hasAll(session, keys) {
  if (!session?.user?.permissions) return false;
  return keys.every(k => session.user.permissions.includes(k));
}
