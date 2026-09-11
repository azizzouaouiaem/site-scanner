import { z } from 'zod';

export const scanRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'invalid_url'),
  email: z.string().trim().toLowerCase().email().max(320),
  language: z.enum(['en', 'fr']),
  scanType: z.enum(['accessibility', 'seo', 'performance']),
});

export type ScanRequestInput = z.infer<typeof scanRequestSchema>;
