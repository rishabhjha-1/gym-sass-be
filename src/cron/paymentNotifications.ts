import { PrismaClient } from '@prisma/client';
import { Message91Service } from '../services/message91Service';
import cron from 'node-cron';

const prisma = new PrismaClient();

// Run every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  try {
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    // Find payments due in the next 3 days
    const duePayments = await prisma.payment.findMany({
      where: {
        dueDate: {
          gte: today,
          lte: threeDaysFromNow
        },
        status: 'PENDING'
      },
      include: {
        member: true
      }
    });

    // Send notifications for due payments
    for (const payment of duePayments) {
      await Message91Service.sendPaymentDueNotification(payment.member, payment);
    }

    // Find overdue payments
    const overduePayments = await prisma.payment.findMany({
      where: {
        dueDate: {
          lt: today
        },
        status: 'PENDING'
      },
      include: {
        member: true
      }
    });

    // Send notifications for overdue payments
    for (const payment of overduePayments) {
      await Message91Service.sendPaymentOverdueNotification(payment.member, payment);
    }

    // Find memberships expiring in the next 7 days
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const expiringMemberships = await prisma.member.findMany({
      where: {
        expiryDate: {
          gte: today,
          lte: sevenDaysFromNow
        },
        status: 'ACTIVE'
      }
    });

    // Send notifications for expiring memberships
    for (const member of expiringMemberships) {
      await Message91Service.sendMembershipExpiryNotification(member);
    }

    console.log('Payment notifications sent successfully');
  } catch (error) {
    console.error('Failed to send payment notifications:', error);
  }
}); 