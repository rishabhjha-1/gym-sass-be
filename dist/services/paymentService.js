"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
// src/services/paymentService.ts
const client_1 = require("@prisma/client");
const moment_1 = __importDefault(require("moment"));
const prisma = new client_1.PrismaClient();
class PaymentService {
    static async getPendingPayment(gymId) {
        return prisma.payment.findMany({
            where: {
                status: client_1.PaymentStatus.PENDING,
                dueDate: {
                    lte: new Date() // Only get payments where due date has passed
                },
                member: {
                    gymId
                }
            },
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                    }
                }
            },
            orderBy: {
                dueDate: 'asc'
            }
        });
    }
    static async createPayment(paymentData) {
        // Verify member belongs to the gym
        const member = await prisma.member.findUnique({
            where: {
                id: paymentData.memberId,
                gymId: paymentData.gymId
            }
        });
        if (!member) {
            throw new Error('Member not found in this gym');
        }
        // Generate invoice number
        const paymentCount = await prisma.payment.count({
            where: {
                member: {
                    gymId: paymentData.gymId
                }
            }
        });
        const invoiceNumber = `INV+ ${paymentData.memberId}-${new Date().getFullYear()}${(paymentCount + 1).toString().padStart(5, '0')}`;
        // Remove gymId from the payment data since it's not needed in the Payment model
        const { gymId, ...paymentDataWithoutGymId } = paymentData;
        return prisma.payment.create({
            data: {
                ...paymentDataWithoutGymId,
                invoiceNumber,
                dueDate: new Date(paymentData.dueDate)
            }
        });
    }
    static async getPayments(filter, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        // Build filter conditions
        const where = {
            member: {
                gymId: filter.gymId
            }
        };
        if (filter.paymentMethod) {
            where.paymentMethod = filter.paymentMethod;
        }
        if (filter.startDate) {
            where.createdAt = {
                ...(where.createdAt || {}),
                gte: new Date(filter.startDate)
            };
        }
        if (filter.endDate) {
            where.createdAt = {
                ...(where.createdAt || {}),
                lte: new Date(filter.endDate)
            };
        }
        // Get total count for pagination
        const total = await prisma.payment.count({ where });
        // Get payments with member information
        const payments = await prisma.payment.findMany({
            where,
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' }
        });
        return {
            data: payments,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };
    }
    static async getRevenueStats(gymId) {
        // Calculate date ranges
        const today = (0, moment_1.default)().startOf('day');
        const thisMonth = (0, moment_1.default)().startOf('month');
        const lastMonth = (0, moment_1.default)().subtract(1, 'month').startOf('month');
        const lastMonthEnd = (0, moment_1.default)().subtract(1, 'month').endOf('month');
        const baseWhere = {
            member: {
                gymId
            }
        };
        // Get paid payments for different time periods
        const paidWhere = {
            ...baseWhere,
            status: client_1.PaymentStatus.PAID
        };
        // Today's revenue
        const todayRevenue = await prisma.payment.aggregate({
            where: {
                ...paidWhere,
                paidDate: {
                    gte: today.toDate(),
                    lt: (0, moment_1.default)(today).add(1, 'day').toDate()
                }
            },
            _sum: { amount: true }
        });
        // This month's revenue
        const thisMonthRevenue = await prisma.payment.aggregate({
            where: {
                ...paidWhere,
                paidDate: {
                    gte: thisMonth.toDate(),
                    lt: (0, moment_1.default)().endOf('day').toDate()
                }
            },
            _sum: { amount: true }
        });
        // Last month's revenue
        const lastMonthRevenue = await prisma.payment.aggregate({
            where: {
                ...paidWhere,
                paidDate: {
                    gte: lastMonth.toDate(),
                    lt: lastMonthEnd.toDate()
                }
            },
            _sum: { amount: true }
        });
        // Get payment method distribution
        const paymentMethods = await prisma.payment.groupBy({
            by: ['paymentMethod'],
            where: {
                ...paidWhere,
                paidDate: {
                    gte: thisMonth.toDate()
                }
            },
            _sum: { amount: true }
        });
        // Get pending payments
        const pendingPayments = await prisma.payment.aggregate({
            where: {
                ...baseWhere,
                status: client_1.PaymentStatus.PENDING
            },
            _sum: { amount: true },
            _count: true
        });
        // Get overdue payments
        const overduePayments = await prisma.payment.aggregate({
            where: {
                ...baseWhere,
                status: client_1.PaymentStatus.OVERDUE,
                dueDate: { lt: new Date() }
            },
            _sum: { amount: true },
            _count: true
        });
        return {
            today: todayRevenue._sum.amount || 0,
            thisMonth: thisMonthRevenue._sum.amount || 0,
            lastMonth: lastMonthRevenue._sum.amount || 0,
            paymentMethods,
            pending: {
                amount: pendingPayments._sum.amount || 0,
                count: pendingPayments._count
            },
            overdue: {
                amount: overduePayments._sum.amount || 0,
                count: overduePayments._count
            }
        };
    }
    static async getPendingPayments(gymId) {
        return prisma.payment.findMany({
            where: {
                status: client_1.PaymentStatus.PENDING,
                member: {
                    gymId
                }
            },
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            orderBy: { dueDate: 'asc' }
        });
    }
    static async getPaymentById(id, gymId) {
        return prisma.payment.findFirst({
            where: {
                id,
                member: {
                    gymId
                }
            },
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
    }
    static async updatePaymentStatus(id, gymId, status) {
        // First verify the payment exists and belongs to the gym
        const payment = await prisma.$queryRaw `
      SELECT p.id, m."gymId" as member_gym_id
      FROM "Payment" p
      JOIN "Member" m ON p."memberId" = m.id
      WHERE p.id = ${id}
    `;
        if (!payment || payment.length === 0) {
            throw new Error('Payment not found');
        }
        if (payment[0].member_gym_id !== gymId) {
            throw new Error('Payment not found in this gym');
        }
        // Update the payment status
        return prisma.payment.update({
            where: { id },
            data: {
                status,
                paidDate: status === client_1.PaymentStatus.PAID ? new Date() : undefined
            }
        });
    }
    static async updatePaymentMethod(id, gymId, paymentMethod) {
        // First verify the payment exists and belongs to the gym
        const payment = await prisma.$queryRaw `
      SELECT p.id, m."gymId" as member_gym_id
      FROM "Payment" p
      JOIN "Member" m ON p."memberId" = m.id
      WHERE p.id = ${id}
    `;
        if (!payment || payment.length === 0) {
            throw new Error('Payment not found');
        }
        if (payment[0].member_gym_id !== gymId) {
            throw new Error('Payment not found in this gym');
        }
        // Update the payment method
        return prisma.payment.update({
            where: { id },
            data: { paymentMethod }
        });
    }
    static async updatePaymentAmount(id, gymId, amount) {
        // First verify the payment exists and belongs to the gym
        const payment = await prisma.$queryRaw `
      SELECT p.id, m."gymId" as member_gym_id
      FROM "Payment" p
      JOIN "Member" m ON p."memberId" = m.id
      WHERE p.id = ${id}
    `;
        if (!payment || payment.length === 0) {
            throw new Error('Payment not found');
        }
        if (payment[0].member_gym_id !== gymId) {
            throw new Error('Payment not found in this gym');
        }
        // Validate amount
        if (amount <= 0) {
            throw new Error('Payment amount must be greater than zero');
        }
        // Update the payment amount
        return prisma.payment.update({
            where: { id },
            data: { amount }
        });
    }
}
exports.PaymentService = PaymentService;
