
import { z } from 'zod';

// Google Schemas
export const GoogleModelSchema = z.object({
    name: z.string(),
    displayName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    outputTokenLimit: z.number().nullable().optional(),
    supportedGenerationMethods: z.array(z.string()).optional(),
    version: z.string().optional(),
});

export const GoogleModelListSchema = z.object({
    models: z.array(GoogleModelSchema).optional(),
});

// OpenAI Schemas
export const OpenAIModelSchema = z.object({
    id: z.string(),
    object: z.literal('model'),
    created: z.number(),
    owned_by: z.string(),
});

export const OpenAIModelListSchema = z.object({
    object: z.literal('list').optional(),
    data: z.array(OpenAIModelSchema),
});

export const OpenAIErrorSchema = z.object({
    error: z.object({
        message: z.string(),
        type: z.string().optional(),
        code: z.string().nullable().optional(),
    }).optional(),
});
