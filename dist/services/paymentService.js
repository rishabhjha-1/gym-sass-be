"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
// src/services/paymentService.ts
const client_1 = require("@prisma/client");
const moment_1 = __importDefault(require("moment"));
const whatsappService_1 = require("./whatsappService");
const textLocalService_1 = require("./textLocalService");
const notificationService_1 = require("./notificationService");
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
        // Generate unique invoice number with retry logic
        let invoiceNumber;
        let retryCount = 0;
        const maxRetries = 5;
        do {
            // Get current timestamp for uniqueness
            const timestamp = Date.now();
            const year = new Date().getFullYear();
            // Get payment count for this gym in current year
            const paymentCount = await prisma.payment.count({
                where: {
                    member: {
                        gymId: paymentData.gymId
                    },
                    createdAt: {
                        gte: new Date(year, 0, 1), // Start of current year
                        lt: new Date(year + 1, 0, 1) // Start of next year
                    }
                }
            });
            // Create invoice number with timestamp to ensure uniqueness
            invoiceNumber = `INV-${year}-${paymentData.memberId}-${(paymentCount + 1).toString().padStart(4, '0')}-${timestamp.toString().slice(-6)}`;
            // Check if this invoice number already exists
            const existingPayment = await prisma.payment.findUnique({
                where: { invoiceNumber }
            });
            if (!existingPayment) {
                break; // Invoice number is unique, proceed
            }
            retryCount++;
            if (retryCount >= maxRetries) {
                throw new Error('Failed to generate unique invoice number after maximum retries');
            }
            // Wait a bit before retrying to avoid race conditions
            await new Promise(resolve => setTimeout(resolve, 100));
        } while (true);
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
        const updatedPayment = await prisma.payment.update({
            where: { id },
            data: {
                status,
                paidDate: status === client_1.PaymentStatus.PAID ? new Date() : undefined
            },
            include: {
                member: true // Include member data for notification
            }
        });
        // Send WhatsApp notification if payment is marked as PAID
        if (status === client_1.PaymentStatus.PAID && updatedPayment.member) {
            try {
                console.log('sending payment confirmation to', updatedPayment.member.phone);
                await whatsappService_1.WhatsAppService.sendPaymentConfirmation(updatedPayment.member, updatedPayment);
                await notificationService_1.NotificationService.sendPaymentConfirmation(updatedPayment.member, updatedPayment);
            }
            catch (error) {
                console.error('Failed to send payment confirmation via WhatsApp:', error);
                // Don't throw error here as the payment was already updated successfully
            }
        }
        return updatedPayment;
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
    static async getPaidOrUpcomingPayments(gymId) {
        const today = (0, moment_1.default)().startOf('day');
        const fiveDaysFromNow = (0, moment_1.default)().add(5, 'days').endOf('day');
        return prisma.payment.findMany({
            where: {
                OR: [
                    {
                        status: client_1.PaymentStatus.PAID
                    },
                    {
                        status: client_1.PaymentStatus.PENDING,
                        dueDate: {
                            gte: today.toDate(),
                            lte: fiveDaysFromNow.toDate()
                        }
                    },
                    {
                        status: client_1.PaymentStatus.OVERDUE,
                        dueDate: {
                            gte: (0, moment_1.default)().subtract(5, 'days').startOf('day').toDate(),
                            lt: today.toDate()
                        }
                    }
                ],
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
        // Update the payment amount
        return prisma.payment.update({
            where: { id },
            data: { amount }
        });
    }
    static async deletePayment(id, gymId) {
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
        // Delete the payment
        await prisma.payment.delete({
            where: { id }
        });
    }
    static async recordPayment(paymentId, paymentMethod) {
        try {
            const payment = await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    status: client_1.PaymentStatus.PAID,
                    paidDate: new Date(),
                    paymentMethod
                },
                include: {
                    member: true
                }
            });
            // Try WhatsApp first, then fallback to SMS
            try {
                console.log('Sending payment confirmation via WhatsApp to', payment.member.phone);
                await whatsappService_1.WhatsAppService.sendPaymentConfirmation(payment.member, payment);
            }
            catch (whatsappError) {
                console.error('WhatsApp failed, trying SMS fallback:', whatsappError);
                try {
                    await textLocalService_1.TextLocalService.sendPaymentConfirmation(payment.member, payment);
                }
                catch (smsError) {
                    console.error('Both WhatsApp and SMS failed:', smsError);
                    // Don't throw error as payment was recorded successfully
                }
            }
            return payment;
        }
        catch (error) {
            console.error('Failed to record payment:', error);
            throw new Error('Failed to record payment');
        }
    }
}
exports.PaymentService = PaymentService;
