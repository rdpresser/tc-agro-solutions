import { z } from 'zod';

const numericString = z.union([z.number(), z.string().transform(Number)]).pipe(z.number());
const optionalNumeric = z.union([z.number(), z.string().transform(Number), z.undefined(), z.literal('')]).pipe(z.number().optional());

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(1, 'Password is required').min(6, 'Min 6 characters'),
});

export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').min(2, 'Min 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(1, 'Password is required').min(6, 'Min 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const propertySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  ownerId: z.string().min(1, 'Owner is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  areaHectares: z.number().positive('Area must be positive'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const plotSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  propertyId: z.string().min(1, 'Property is required'),
  cropType: z.string().min(1, 'Crop type is required'),
  plantingDate: z.string().min(1, 'Planting date is required'),
  expectedHarvestDate: z.string().min(1, 'Expected harvest date is required'),
  irrigationType: z.string().min(1, 'Irrigation type is required'),
  areaHectares: z.number().positive('Area must be positive'),
  temperatureMin: z.number().optional(),
  temperatureMax: z.number().optional(),
  humidityMin: z.number().optional(),
  humidityMax: z.number().optional(),
  soilMoistureMin: z.number().optional(),
  soilMoistureMax: z.number().optional(),
});

export const sensorSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.string().min(1, 'Type is required'),
  plotId: z.string().min(1, 'Plot is required'),
});

export const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  role: z.string().min(1, 'Role is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type PropertyFormData = z.infer<typeof propertySchema>;
export type PlotFormData = z.infer<typeof plotSchema>;
export type SensorFormData = z.infer<typeof sensorSchema>;
export type UserFormData = z.infer<typeof userSchema>;
