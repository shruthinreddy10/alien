import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(150),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const TransactionCreateSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  // Minor units: integer cents/paise (e.g. 1050 for $10.50). Reject floats.
  amount: z.number().int('Amount must be an integer in minor units (cents/paise)').positive('Amount must be positive'),
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().min(1, 'Description is required').max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  paymentMethod: z.enum(['Card', 'Bank', 'Cash', 'Crypto']).default('Card'),
  notes: z.string().max(500).optional().nullable(),
});

export const TransactionUpdateSchema = TransactionCreateSchema.partial();

export const BudgetSchema = z.object({
  categoryId: z.string().nullable().optional(), // NULL for overall monthly budget
  amount: z.number().int('Budget amount must be an integer in minor units (cents)').positive('Budget amount must be positive'),
  period: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});

export const CategoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  icon: z.string().min(1).default('Tag'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid 6-character hex code').default('#3B82F6'),
});

export const AiChatSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(2000),
  provider: z.enum(['mock', 'openai', 'anthropic', 'gemini']).default('mock'),
});

export const AiKeySaveSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini']),
  apiKey: z.string().min(10, 'Invalid API key length').max(200),
});
