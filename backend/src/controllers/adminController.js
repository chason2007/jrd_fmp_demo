import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { writeAudit } from '../lib/audit.js';
import argon2 from 'argon2';
import crypto from 'node:crypto';

// ── Privilege boundaries ─────────────────────────────────────────────────────
// An ADMIN may only manage AUDITORs and may only ever assign the AUDITOR role.
// Only a SUPERADMIN may create/modify ADMIN or SUPERADMIN accounts or grant
// those roles. This closes the escalation path where an ADMIN could mint or take
// over a SUPERADMIN via create/role/password/status.

/** Reject an actor granting a role above their own authority. */
function assertCanAssignRole(actorRole, targetRole) {
  if (targetRole === 'SUPERADMIN') {
    throw new HttpError(400, 'New superadmins cannot be created.');
  }
  if (targetRole === 'ADMIN' && actorRole !== 'SUPERADMIN') {
    throw new HttpError(403, 'Only a superadmin can assign admin roles.');
  }
}

/** Load a target user and reject an ADMIN acting on a non-AUDITOR. */
async function loadManageableTarget(actor, targetId) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new HttpError(404, 'User not found.');
  if (actor.role !== 'SUPERADMIN' && target.role !== 'AUDITOR') {
    throw new HttpError(403, 'You do not have permission to manage this user.');
  }
  return target;
}

// Get all users
export async function getUsers(req, res) {
  const users = await prisma.user.findMany({
    where: {
      role: { not: 'SUPERADMIN' }
    },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
      name: true,
      idNumber: true,
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: { users } });
}

// Create a new user
export async function createUser(req, res) {
  const { username, password, role, name, idNumber } = req.body; // validated + length-checked by createUserSchema

  // An ADMIN can only ever create AUDITORs; only a SUPERADMIN may create ADMIN/SUPERADMIN.
  assertCanAssignRole(req.user.role, role || 'AUDITOR');

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new HttpError(409, 'Username already exists.');
  }

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: role || 'AUDITOR',
      name,
      idNumber,
    },
    select: { id: true, username: true, role: true, isActive: true, name: true, idNumber: true }
  });

  await writeAudit({ userId: req.user.id, action: 'CREATE_USER', entityType: 'user', entityId: user.id.toString(), ip: req.ip });
  res.status(201).json({ success: true, data: { user } });
}

// Toggle user active status
export async function toggleUserStatus(req, res) {
  const { id } = req.params; // coerced int by idParam
  const { isActive } = req.body; // boolean by updateStatusSchema

  if (Number.parseInt(id, 10) === req.user.id) {
    throw new HttpError(400, 'Cannot toggle your own status.');
  }
  const target = await loadManageableTarget(req.user, id); // ADMIN cannot disable ADMIN/SUPERADMIN
  
  if (target.role === 'SUPERADMIN' && isActive === false) {
    throw new HttpError(400, 'Cannot suspend a superadmin.');
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, username: true, isActive: true }
  });

  await writeAudit({ userId: req.user.id, action: 'TOGGLE_USER_STATUS', entityType: 'user', entityId: String(id), ip: req.ip, metadata: { isActive } });
  res.json({ success: true, data: { user } });
}

// Get all audits globally
export async function getAudits(req, res) {
  // Villa audits
  const audits = await prisma.audit.findMany({
    include: {
      villa: true,
      auditor: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  // Velora audits
  const veloraAudits = await prisma.veloraAudit.findMany({
    include: {
      auditor: { select: { id: true, username: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Velora service reports
  const serviceReports = await prisma.veloraServiceReport.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // Compliance deliveries
  const complianceDeliveries = await prisma.veloraComplianceDelivery.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // Map compliance deliveries with static item names
  const items = [
    { id: 1, categoryId: 1, categoryName: 'Resources', itemName: 'Adequate Staffing Levels' },
    { id: 2, categoryId: 1, categoryName: 'Resources', itemName: 'Equipment Availability' },
    { id: 3, categoryId: 1, categoryName: 'Resources', itemName: 'PPE Availability' },
    { id: 4, categoryId: 1, categoryName: 'Resources', itemName: 'Consumables Stock' },
    { id: 5, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Safety Briefings' },
    { id: 6, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Hazard Reporting' },
    { id: 7, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Emergency Drills' },
    { id: 8, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Safety Signage' },
    { id: 9, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Incident Reporting' },
    { id: 10, categoryId: 3, categoryName: 'Training and Certification', itemName: 'Safety Training' },
    { id: 11, categoryId: 3, categoryName: 'Training and Certification', itemName: 'Technical Certifications' },
    { id: 12, categoryId: 3, categoryName: 'Training and Certification', itemName: 'First Aid Certification' },
    { id: 13, categoryId: 3, categoryName: 'Training and Certification', itemName: 'Fire Safety Training' },
    { id: 14, categoryId: 3, categoryName: 'Training and Certification', itemName: 'Equipment Operation Training' },
  ];
  const itemMap = new Map(items.map(i => [i.id, i]));
  const formattedCompliance = complianceDeliveries.map(d => {
    const item = itemMap.get(d.complianceItemId);
    return {
      ...d,
      item_name: item ? item.itemName : 'Unknown Item',
      category_name: item ? item.categoryName : 'Unknown Category',
    };
  });

  res.json({
    success: true,
    data: {
      audits,
      veloraAudits,
      serviceReports,
      complianceDeliveries: formattedCompliance
    }
  });
}

// Get password reset requests
export async function getResetRequests(req, res) {
  const requests = await prisma.passwordResetRequest.findMany({
    where: { status: 'PENDING' },
    include: {
      user: { select: { id: true, username: true } }
    },
    orderBy: { requestedAt: 'asc' }
  });
  res.json({ success: true, data: { requests } });
}

// Approve a password reset request and generate temporary password
export async function approveResetRequest(req, res) {
  const { id } = req.params;
  
  const request = await prisma.passwordResetRequest.findUnique({
    where: { id: Number.parseInt(id, 10) },
    include: { user: true }
  });

  if (request?.status !== 'PENDING') {
    throw new HttpError(404, 'Pending request not found.');
  }

  // Generate a random temporary password (e.g. 8 chars)
  // Strong temporary password (~72 bits) rather than 32-bit hex. The admin
  // shares it with the user out-of-band; it should be changed on next login.
  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await argon2.hash(tempPassword);

  await prisma.$transaction(async (tx) => {
    // Update user's password
    await tx.user.update({
      where: { id: request.userId },
      data: { passwordHash }
    });

    // Mark request as approved
    await tx.passwordResetRequest.update({
      where: { id: Number.parseInt(id, 10) },
      data: { 
        status: 'APPROVED',
        resolvedAt: new Date()
      }
    });
    
    // Invalidate all active sessions for this user so they must log in with new password
    await tx.refreshToken.updateMany({
      where: { userId: request.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  });

  await writeAudit({ userId: req.user.id, action: 'APPROVE_PASSWORD_RESET', entityType: 'user', entityId: request.userId.toString(), ip: req.ip });
  
  // Return the temporary password to the admin so they can share it with the user
  res.json({ success: true, data: { tempPassword, username: request.user.username } });
}

// Change user role
export async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body; // validated by updateRoleSchema

  if (Number.parseInt(id, 10) === req.user.id) {
    throw new HttpError(400, 'Cannot change your own role.');
  }
  // ADMIN may only act on AUDITORs, and may only assign the AUDITOR role — so an
  // ADMIN can neither promote anyone to ADMIN/SUPERADMIN nor demote a SUPERADMIN.
  await loadManageableTarget(req.user, Number.parseInt(id, 10));
  assertCanAssignRole(req.user.role, role);

  const user = await prisma.user.update({
    where: { id: Number.parseInt(id, 10) },
    data: { role },
    select: { id: true, username: true, role: true }
  });

  await writeAudit({ userId: req.user.id, action: 'UPDATE_USER_ROLE', entityType: 'user', entityId: String(id), ip: req.ip, metadata: { role } });
  res.json({ success: true, data: { user } });
}

// Reset password directly
export async function resetUserPassword(req, res) {
  const { id } = req.params;
  const { password } = req.body; // length-checked by resetPasswordSchema

  // ADMIN cannot reset an ADMIN/SUPERADMIN password (account-takeover path).
  await loadManageableTarget(req.user, Number.parseInt(id, 10));

  const passwordHash = await argon2.hash(password);
  await prisma.user.update({
    where: { id: Number.parseInt(id, 10) },
    data: { passwordHash }
  });

  // Invalidate sessions
  await prisma.refreshToken.updateMany({
    where: { userId: Number.parseInt(id, 10), revokedAt: null },
    data: { revokedAt: new Date() }
  });

  await writeAudit({ userId: req.user.id, action: 'RESET_USER_PASSWORD_ADMIN', entityType: 'user', entityId: String(id), ip: req.ip });
  res.json({ success: true, message: 'Password reset successfully.' });
}

// Delete Velora audit
export async function deleteVeloraAudit(req, res) {
  const { id } = req.params;
  await prisma.veloraAudit.delete({
    where: { id: Number.parseInt(id, 10) }
  });
  await writeAudit({ userId: req.user.id, action: 'DELETE_VELORA_AUDIT', entityType: 'velora_audit', entityId: String(id), ip: req.ip });
  res.json({ success: true, message: 'Velora audit deleted.' });
}

// Delete Velora service report
export async function deleteVeloraServiceReport(req, res) {
  const { id } = req.params;
  await prisma.veloraServiceReport.delete({
    where: { id: Number.parseInt(id, 10) }
  });
  await writeAudit({ userId: req.user.id, action: 'DELETE_VELORA_SERVICE_REPORT', entityType: 'velora_service_report', entityId: String(id), ip: req.ip });
  res.json({ success: true, message: 'Velora service report deleted.' });
}

// Delete Velora compliance record
export async function deleteVeloraComplianceDelivery(req, res) {
  const { id } = req.params;
  await prisma.veloraComplianceDelivery.delete({
    where: { id: Number.parseInt(id, 10) }
  });
  await writeAudit({ userId: req.user.id, action: 'DELETE_VELORA_COMPLIANCE', entityType: 'velora_compliance', entityId: String(id), ip: req.ip });
  res.json({ success: true, message: 'Velora compliance record deleted.' });
}

// Helper to verify superadmin password for destructive actions
async function verifySuperadminPassword(req) {
  const confirmPassword = req.body?.confirmPassword || req.headers['x-confirm-password'];
  if (!confirmPassword) {
    throw new HttpError(400, 'Password confirmation is required for destructive actions.');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const passwordOk = await argon2.verify(user.passwordHash, confirmPassword);
  if (!passwordOk) {
    throw new HttpError(401, 'Incorrect confirmation password.');
  }
}

// Delete user account
export async function deleteUser(req, res) {
  const { id } = req.params;
  
  if (Number.parseInt(id, 10) === req.user.id) {
    throw new HttpError(400, 'Cannot delete your own account.');
  }

  // ADMIN may only delete AUDITORs; SUPERADMIN may delete anyone (with confirm).
  await loadManageableTarget(req.user, Number.parseInt(id, 10));

  // Superadmins must confirm with password to delete users
  if (req.user.role === 'SUPERADMIN') {
    await verifySuperadminPassword(req);
  }

  const deleted = await prisma.user.delete({
    where: { id: Number.parseInt(id, 10) },
    select: { id: true, username: true }
  });

  await writeAudit({ userId: req.user.id, action: 'DELETE_USER', entityType: 'user', entityId: String(id), ip: req.ip, metadata: { username: deleted.username } });
  res.json({ success: true, message: `User ${deleted.username} deleted.` });
}

// Purge all users except current superadmin
export async function purgeAllUsers(req, res) {
  if (req.user.role !== 'SUPERADMIN') {
    throw new HttpError(403, 'Only superadmins can perform database maintenance.');
  }

  await verifySuperadminPassword(req);

  const result = await prisma.user.deleteMany({
    where: {
      id: { not: req.user.id }
    }
  });

  await writeAudit({ userId: req.user.id, action: 'PURGE_ALL_USERS', entityType: 'system', entityId: 'all', ip: req.ip, metadata: { count: result.count } });
  res.json({ success: true, message: `Successfully deleted ${result.count} users.` });
}

// Purge all inspections/reports
export async function purgeAllRecords(req, res) {
  if (req.user.role !== 'SUPERADMIN') {
    throw new HttpError(403, 'Only superadmins can perform database maintenance.');
  }

  await verifySuperadminPassword(req);

  const deletedVillas = await prisma.audit.deleteMany({});
  const deletedVeloraAudits = await prisma.veloraAudit.deleteMany({});
  const deletedService = await prisma.veloraServiceReport.deleteMany({});
  const deletedCompliance = await prisma.veloraComplianceDelivery.deleteMany({});

  const total = deletedVillas.count + deletedVeloraAudits.count + deletedService.count + deletedCompliance.count;

  await writeAudit({ userId: req.user.id, action: 'PURGE_ALL_RECORDS', entityType: 'system', entityId: 'all', ip: req.ip, metadata: { count: total } });
  res.json({ success: true, message: `Successfully purged ${total} total inspection records.` });
}

// Purge module records
export async function purgeModuleRecords(req, res) {
  if (req.user.role !== 'SUPERADMIN') {
    throw new HttpError(403, 'Only superadmins can perform database maintenance.');
  }

  await verifySuperadminPassword(req);

  const { moduleName } = req.params;
  let count = 0;

  if (moduleName === 'villa') {
    const deleted = await prisma.audit.deleteMany({});
    count = deleted.count;
  } else if (moduleName === 'velora-audits') {
    const deleted = await prisma.veloraAudit.deleteMany({});
    count = deleted.count;
  } else if (moduleName === 'service-reports') {
    const deleted = await prisma.veloraServiceReport.deleteMany({});
    count = deleted.count;
  } else if (moduleName === 'compliance') {
    const deleted = await prisma.veloraComplianceDelivery.deleteMany({});
    count = deleted.count;
  } else {
    throw new HttpError(400, 'Invalid module name.');
  }

  await writeAudit({ userId: req.user.id, action: `PURGE_MODULE_${moduleName.toUpperCase()}`, entityType: 'system', entityId: moduleName, ip: req.ip, metadata: { count } });
  res.json({ success: true, message: `Successfully purged ${count} records from ${moduleName}.` });
}

// Update user details (name, username, idNumber)
export async function updateUser(req, res) {
  const { id } = req.params;
  const { username, name, idNumber } = req.body;

  // Verify authorization boundary
  await loadManageableTarget(req.user, Number.parseInt(id, 10));

  // Check if username is already taken by another user
  const existing = await prisma.user.findFirst({
    where: {
      username,
      id: { not: Number.parseInt(id, 10) }
    }
  });
  if (existing) {
    throw new HttpError(409, 'Username already exists.');
  }

  const user = await prisma.user.update({
    where: { id: Number.parseInt(id, 10) },
    data: { username, name, idNumber },
    select: { id: true, username: true, role: true, isActive: true, name: true, idNumber: true }
  });

  await writeAudit({ userId: req.user.id, action: 'UPDATE_USER', entityType: 'user', entityId: String(id), ip: req.ip, metadata: { username, name, idNumber } });
  res.json({ success: true, data: { user } });
}


