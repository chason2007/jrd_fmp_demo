import { z } from 'zod';

const optStr = (max) => z.string().trim().max(max).optional();

const issueInput = z
  .object({
    area: optStr(50),
    floor: optStr(50),
    room: optStr(100),
    spotDesc: optStr(2000),
    category: optStr(50),
    subCategory: optStr(50),
    issueType: optStr(100),
    comment: optStr(2000),
    photoIds: z.array(z.number().int().positive()).max(5, 'Max 5 photos per issue').optional(),
  })
  .strict();

export const saveInspectionSchema = z
  .object({
    flatNumber: z.string().trim().min(1, 'Flat number is required').max(100),
    unitNumber: optStr(100),
    ownerName: z.string().trim().min(1, 'Owner name is required').max(255),
    propertyAddress: optStr(1000),
    emirate: optStr(100),
    area: optStr(100),
    draftId: z.number().int().positive().optional(),
    issues: z.array(issueInput).min(1, 'At least one issue is required'),
  })
  .strict();

export const saveDraftSchema = z
  .object({
    draftId: z.number().int().positive().optional(),
    auditCode: optStr(100),
    flatNumber: z.string().trim().min(1, 'Flat number is required').max(100),
    unitNumber: optStr(100),
    ownerName: z.string().trim().min(1, 'Owner name is required').max(255),
    propertyAddress: optStr(1000),
    emirate: optStr(100),
    area: optStr(100),
    issues: z.array(issueInput).default([]),
  })
  .strict();

export const auditCodeParam = z.object({ auditCode: z.string().trim().min(1).max(100) });
export const idParam = z.object({ id: z.coerce.number().int().positive() });
