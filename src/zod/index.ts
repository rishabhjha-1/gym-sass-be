// src/schemas/index.ts
import { z } from 'zod';
import { 
  MembershipType, 
  MemberStatus, 
  PaymentStatus, 
  AttendanceType, 
  GenderType,
  TrainingGoal 
} from '../type/index';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const UserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  role: z.string().optional(),
  phone: z.string().optional()
});

export const MemberSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  gender: z.nativeEnum(GenderType),
  dateOfBirth: z.string().or(z.date()),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  membershipType: z.nativeEnum(MembershipType),
  status: z.nativeEnum(MemberStatus).optional(),
  trainingGoal: z.nativeEnum(TrainingGoal).optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  notes: z.string().optional(),
  photoUrl: z.string().optional()
});

export const MembershipSchema = z.object({
  memberId: z.string().uuid(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  type: z.nativeEnum(MembershipType),
  price: z.number().positive(),
  discount: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional()
});

export const PaymentSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().positive(),
  dueDate: z.string().or(z.date()),
  status: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.string(), // Made required
  notes: z.string().optional()
});

export const AttendanceSchema = z.object({
  memberId: z.string().uuid(),
  type: z.nativeEnum(AttendanceType).optional(),
  notes: z.string().optional()
});

export const ClassSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  capacity: z.number().int().positive(),
  trainer: z.string().optional(),
  location: z.string().optional()
});

export const ClassAttendanceSchema = z.object({
  classId: z.string().uuid(),
  memberId: z.string().uuid()
});

export const ExpenseSchema = z.object({
  title: z.string().min(2),
  amount: z.number().positive(),
  date: z.string().or(z.date()),
  category: z.string(),
  notes: z.string().optional()
});

export const PaginationSchema = z.object({
  page: z.string().or(z.number()).transform(Number).optional().default(1),
  limit: z.string().or(z.number()).transform(Number).optional().default(10),
});