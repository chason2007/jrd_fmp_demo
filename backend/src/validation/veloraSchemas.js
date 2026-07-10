import { z } from 'zod';

const optStr = (max) => z.string().trim().max(max).optional().nullable();

export const saveAuditSchema = z
  .object({
    serviceTypeId: z.number().int().positive(),
    serviceCategory: z.enum(['hard', 'soft']),
    auditDate: z.string().min(1),
    auditorName: optStr(100),
    locations: z.array(z.any()).default([]),
    responses: z.any().default({}),
    notes: optStr(2000),
    draftId: z.number().int().positive().optional().nullable(),
  })
  .strict();

export const saveDraftSchema = z
  .object({
    draftId: z.number().int().positive().optional().nullable(),
    auditNumber: optStr(50),
    serviceTypeId: z.number().int().positive().optional().nullable(),
    serviceCategory: optStr(20),
    auditDate: z.string().optional().nullable(),
    auditorName: optStr(100),
    locations: z.array(z.any()).optional().nullable(),
    responses: z.any().optional().nullable(),
  })
  .strict();

export const saveServiceReportSchema = z
  .object({
    reportTypeId: z.number().int().positive(),
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: optStr(2000),
    reportDate: z.string().min(1),
    createdBy: optStr(100),
    content: z.string().optional().nullable(),
  })
  .strict();

export const saveComplianceSchema = z
  .object({
    complianceItemId: z.number().int().positive(),
    deliveryDate: z.string().min(1),
    status: z.enum(['compliant', 'partial', 'non_compliant']),
    evidence: optStr(2000),
    verifiedBy: optStr(100),
    verificationDate: z.string().optional().nullable(),
  })
  .strict();

export const savePdfReportSchema = z
  .object({
    pdfData: z.string().min(1, 'PDF data is required'),
    auditNumber: z.string().min(1).max(50),
    auditId: z.number().int().positive().optional().nullable(),
    title: z.string().max(200).optional().nullable(),
  })
  .strict();

export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const auditNumberParam = z.object({ auditNumber: z.string().trim().min(1).max(50) });
