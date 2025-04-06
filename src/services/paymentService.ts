// src/services/paymentService.ts
import { PrismaClient, Payment, PaymentStatus } from '@prisma/client';
import { RevenueFilter, PaginatedResponse } from '../type';
import moment from 'moment';

const prisma = new PrismaClient();

export class PaymentService {
  static async getPendingPayment(): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        dueDate: {
          lte: new Date() // Only get payments where due date has passed
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
  }): Promise<Payment> {
    // Generate invoice number
    const paymentCount = await prisma.payment.count();
    const invoiceNumber = `INV${new Date().getFullYear()}${(paymentCount + 1).toString().padStart(5, '0')}`;
    
    return prisma.payment.create({
      data: {
        ...paymentData,
        invoiceNumber,
        dueDate: new Date(paymentData.dueDate)
      }
    });
  }
  
  static async getPayments(
    filter: RevenueFilter,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;
    
    // Build filter conditions
    const where: any = {};
    
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
  
  static async updatePaymentStatus(id: string, status: string): Promise<Payment> {
    return prisma.payment.update({
      where: { id },
      data: { 
        status: status as PaymentStatus,
        ...(status === PaymentStatus.PAID ? { paidDate: new Date() } : {})
      }
    });
  }
  
  static async getRevenueStats() {
    // Calculate date ranges
    const today = moment().startOf('day');
    const thisMonth = moment().startOf('month');
    const lastMonth = moment().subtract(1, 'month').startOf('month');
    const lastMonthEnd = moment().subtract(1, 'month').endOf('month');
    
    // Get paid payments for different time periods
    const paidWhere = { status: PaymentStatus.PAID };
    
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
      where: { status: PaymentStatus.PENDING },
      _sum: { amount: true },
      _count: true
    });
    
    // Get overdue payments
    const overduePayments = await prisma.payment.aggregate({
      where: { 
        status: PaymentStatus.OVERDUE,
        dueDate: { lt: new Date() }
      },
      _sum: { amount: true },
      _count: true
    });
    
    // Monthly revenue data for last 6 months
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const startDate = moment().subtract(i, 'months').startOf('month');
      const endDate = moment().subtract(i, 'months').endOf('month');
      
      const revenue = await prisma.payment.aggregate({
        where: {
          ...paidWhere,
          paidDate: {
            gte: startDate.toDate(),
            lt: endDate.toDate()
          }
        },
        _sum: { amount: true }
      });
      
      monthlyData.push({
        month: startDate.format('MMM'),
        revenue: revenue._sum.amount || 0
      });
    }
    
    // Calculate revenue forecast based on historical data and trend
    const forecastData = [];
    const trendFactor = (thisMonthRevenue._sum?.amount || 0) > 0 && (lastMonthRevenue._sum?.amount || 0) > 0 
      ? (thisMonthRevenue._sum?.amount || 0) / (lastMonthRevenue._sum?.amount || 1)
      : 1.05; // Default 5% growth if no data
    
    let prevMonth = (thisMonthRevenue._sum.amount || 0);
    
    for (let i = 1; i <= 3; i++) {
      const projectedRevenue = prevMonth * trendFactor;
      prevMonth = projectedRevenue;
      
      forecastData.push({
        month: moment().add(i, 'months').format('MMM'),
        projected: Math.round(projectedRevenue * 100) / 100
      });
    }
    
    return {
      revenue: {
        today: todayRevenue._sum?.amount || 0,
        thisMonth: thisMonthRevenue._sum?.amount || 0,
        lastMonth: lastMonthRevenue._sum?.amount || 0,
        growth: lastMonthRevenue._sum?.amount 
          ? ((thisMonthRevenue._sum?.amount || 0) - (lastMonthRevenue._sum?.amount || 0)) / (lastMonthRevenue._sum?.amount || 1) * 100
          : 0
      },
      paymentMethods: paymentMethods.map((method) => ({
        method: method.paymentMethod || 'Other',
        amount: method._sum?.amount || 0
      })),
      pending: {
        amount: pendingPayments._sum?.amount || 0,
        count: pendingPayments._count
      },
      overdue: {
        amount: overduePayments._sum?.amount || 0,
        count: overduePayments._count
      },
      monthlyData,
      forecast: forecastData
    };
  }

  static async getPendingPayments(): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING
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

  static async getPaymentById(id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { id },
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
}

