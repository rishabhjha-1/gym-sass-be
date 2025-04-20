"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GymSchema = exports.PaginationSchema = exports.ExpenseSchema = exports.ClassAttendanceSchema = exports.ClassSchema = exports.AttendanceSchema = exports.PaymentSchema = exports.MembershipSchema = exports.MemberSchema = exports.UserSchema = exports.LoginSchema = void 0;
// src/schemas/index.ts
const zod_1 = require("zod");
const index_1 = require("../type/index");
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters')
});
exports.UserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    firstName: zod_1.z.string().min(2, 'First name must be at least 2 characters'),
    lastName: zod_1.z.string().min(2, 'Last name must be at least 2 characters'),
    role: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    gymId: zod_1.z.string().uuid('Invalid gym ID format')
});
exports.MemberSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2, 'First name must be at least 2 characters'),
    lastName: zod_1.z.string().min(2, 'Last name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email format'),
    phone: zod_1.z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
    gender: zod_1.z.nativeEnum(index_1.GenderType),
    dateOfBirth: zod_1.z.string().or(zod_1.z.date()),
    address: zod_1.z.string().optional(),
    emergencyContact: zod_1.z.string().optional(),
    membershipType: zod_1.z.nativeEnum(index_1.MembershipType),
    status: zod_1.z.nativeEnum(index_1.MemberStatus).optional(),
    trainingGoal: zod_1.z.nativeEnum(index_1.TrainingGoal).optional(),
    height: zod_1.z.number().positive().optional(),
    weight: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().optional(),
    photoUrl: zod_1.z.string().optional()
});
exports.MembershipSchema = zod_1.z.object({
    memberId: zod_1.z.string().uuid(),
    startDate: zod_1.z.string().or(zod_1.z.date()),
    endDate: zod_1.z.string().or(zod_1.z.date()),
    type: zod_1.z.nativeEnum(index_1.MembershipType),
    price: zod_1.z.number().positive(),
    discount: zod_1.z.number().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().optional()
});
exports.PaymentSchema = zod_1.z.object({
    memberId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    dueDate: zod_1.z.string().or(zod_1.z.date()),
    status: zod_1.z.nativeEnum(index_1.PaymentStatus).optional(),
    paymentMethod: zod_1.z.string(), // Made required
    notes: zod_1.z.string().optional()
});
exports.AttendanceSchema = zod_1.z.object({
    memberId: zod_1.z.string().uuid(),
    type: zod_1.z.nativeEnum(index_1.AttendanceType).optional(),
    notes: zod_1.z.string().optional()
});
exports.ClassSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    startTime: zod_1.z.string().or(zod_1.z.date()),
    endTime: zod_1.z.string().or(zod_1.z.date()),
    capacity: zod_1.z.number().int().positive(),
    trainer: zod_1.z.string().optional(),
    location: zod_1.z.string().optional()
});
exports.ClassAttendanceSchema = zod_1.z.object({
    classId: zod_1.z.string().uuid(),
    memberId: zod_1.z.string().uuid()
});
exports.ExpenseSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    amount: zod_1.z.number().positive(),
    date: zod_1.z.string().or(zod_1.z.date()),
    category: zod_1.z.string(),
    notes: zod_1.z.string().optional()
});
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.string().or(zod_1.z.number()).transform(Number).optional().default(1),
    limit: zod_1.z.string().or(zod_1.z.number()).transform(Number).optional().default(10),
});
exports.GymSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Gym name must be at least 2 characters'),
    address: zod_1.z.string().min(5, 'Address must be at least 5 characters'),
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
    email: zod_1.z.string().email('Invalid email format').optional(),
    isActive: zod_1.z.boolean().optional().default(true)
});
