import { z } from 'zod';

const optStr = (max) => z.string().trim().max(max).optional();

const responseItem = z
  .object({
    answer: z.enum(['yes', 'no']).nullable().optional(),
    comment: z.string().trim().max(2000).optional(),
    photoIds: z.array(z.number().int().positive()).max(3, 'Max 3 photos per checklist item').optional(),
  })
  .strict();

// responses is keyed by checklist item name (free-form, comes from wvChecklists.js).
const responsesShape = z.record(z.string().max(300), responseItem);

const wvFields = {
  auditCode: optStr(100),
  auditType: z.string().trim().min(1).max(30).default('rooms'),
  cluster: optStr(50),
  building: optStr(50),
  floor: optStr(20),
  room: optStr(100),
  staffName: optStr(150),
  staffNo: optStr(50),
  auditDate: z.coerce.date(),
  inspectorName: optStr(150),
  responses: responsesShape,
};

export const saveWvAuditSchema = z
  .object({
    draftId: z.number().int().positive().optional(),
    ...wvFields,
  })
  .strict();

export const saveWvDraftSchema = z
  .object({
    draftId: z.number().int().positive().optional(),
    ...wvFields,
    auditDate: z.coerce.date().optional(),
    responses: responsesShape.default({}),
  })
  .strict();

export const auditCodeParam = z.object({ auditCode: z.string().trim().min(1).max(100) });
export const idParam = z.object({ id: z.coerce.number().int().positive() });
