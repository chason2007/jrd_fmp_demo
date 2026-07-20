import { z } from 'zod';

const optStr = (max) => z.string().trim().max(max).optional();

const responseItem = z
  .object({
    answer: z.enum(['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']).nullable().optional(),
    comment: z.string().trim().max(2000).optional(),
    photoIds: z.array(z.number().int().positive()).max(3, 'Max 3 photos per checklist item').optional(),
  })
  .strict();

// responses is keyed by `${sectionKey}:${itemIndex}` (see apartmentChecklists.js).
const responsesShape = z.record(z.string().max(120), responseItem);

const apartmentFields = {
  auditCode: optStr(100),
  tenantName: optStr(150),
  apartmentType: optStr(100),
  roomNo: optStr(50),
  location: optStr(255),
  moveInDate: z.coerce.date().optional().nullable(),
  landlordName: optStr(150),
  auditDate: z.coerce.date(),
  inspectorName: optStr(150),
  bedroomCount: z.coerce.number().int().min(0).max(20).default(1),
  bathroomCount: z.coerce.number().int().min(0).max(20).default(1),
  responses: responsesShape,
};

export const saveApartmentAuditSchema = z
  .object({
    draftId: z.number().int().positive().optional(),
    ...apartmentFields,
  })
  .strict();

export const saveApartmentDraftSchema = z
  .object({
    draftId: z.number().int().positive().optional(),
    ...apartmentFields,
    auditDate: z.coerce.date().optional(),
    responses: responsesShape.default({}),
  })
  .strict();

export const auditCodeParam = z.object({ auditCode: z.string().trim().min(1).max(100) });
export const idParam = z.object({ id: z.coerce.number().int().positive() });
