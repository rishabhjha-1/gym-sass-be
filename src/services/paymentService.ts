// src/services/paymentService.ts
import { PrismaClient, Payment, PaymentStatus } from '@prisma/client';
import { RevenueFilter, PaginatedResponse } from '../type';
import moment from 'moment';

const prisma = new PrismaClient();

export class PaymentService {
  static async getPendingPayment(gymId: string): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
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

  static async createPayment(paymentData: {
    amount: number;
    paymentMethod: string;
    memberId: string;
    dueDate: string | Date;
    status?: PaymentStatus;
    gymId: string;
  }): Promise<Payment> {
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
  
  static async getPayments(
    filter: RevenueFilter & { gymId: string },
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;
    
    // Build filter conditions
    const where: any = {
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
  
  static async getRevenueStats(gymId: string) {
    // Calculate date ranges
    const today = moment().startOf('day');
    const thisMonth = moment().startOf('month');
    const lastMonth = moment().subtract(1, 'month').startOf('month');
    const lastMonthEnd = moment().subtract(1, 'month').endOf('month');
    
    const baseWhere = {
      member: {
        gymId
      }
    };
    
    // Get paid payments for different time periods
    const paidWhere = { 
      ...baseWhere,
      status: PaymentStatus.PAID 
    };
    
    // Today's revenue
    const todayRevenue = await prisma.payment.aggregate({
      where: {
        ...paidWhere,
        paidDate: {
          gte: today.toDate(),
          lt: moment(today).add(1, 'day').toDate()
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
          lt: moment().endOf('day').toDate()
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
        status: PaymentStatus.PENDING 
      },
      _sum: { amount: true },
      _count: true
    });
    
    // Get overdue payments
    const overduePayments = await prisma.payment.aggregate({
      where: { 
        ...baseWhere,
        status: PaymentStatus.OVERDUE,
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

  static async getPendingPayments(gymId: string): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
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

  static async getPaymentById(id: string, gymId: string): Promise<Payment | null> {
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

  static async updatePaymentStatus(id: string, gymId: string, status: PaymentStatus): Promise<Payment> {
    // First verify the payment exists and belongs to the gym
    const payment = await prisma.$queryRaw<{ id: string, member_gym_id: string }[]>`
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
        paidDate: status === PaymentStatus.PAID ? new Date() : undefined
      }
    });
  }

  static async updatePaymentMethod(id: string, gymId: string, paymentMethod: string): Promise<Payment> {
    // First verify the payment exists and belongs to the gym
    const payment = await prisma.$queryRaw<{ id: string, member_gym_id: string }[]>`
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
}

