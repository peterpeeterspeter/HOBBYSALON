import * as z from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2, { message: "Vul een naam in" }),
  email: z.string().email({ message: "Ongeldig e-mailadres" }),
  password: z.string()
    .min(12, { message: "minstens 12 tekens" })
    .regex(/[a-z]/, { message: "minstens één kleine letter" })
    .regex(/[A-Z]/, { message: "minstens één hoofdletter" })
    .regex(/[0-9]/, { message: "minstens één cijfer" })
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/, { message: "minstens één speciaal teken" }),
  confirmPassword: z.string()
})  .refine((data) => data.password === data.confirmPassword, {
  message: "de wachtwoorden zijn niet gelijk",
  path: ['confirmPassword'],
});