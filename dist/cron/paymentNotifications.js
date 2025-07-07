"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const whatsappService_1 = require("../services/whatsappService");
const node_cron_1 = __importDefault(require("node-cron"));
const notificationService_1 = require("../services/notificationService");
const prisma = new client_1.PrismaClient();
// Run every day at 9 AM
node_cron_1.default.schedule('0 9 * * *', async () => {
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
            await whatsappService_1.WhatsAppService.sendPaymentDueNotification(payment.member, payment);
            await notificationService_1.NotificationService.sendPaymentReminder(payment.member.id, payment.id);
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
            await whatsappService_1.WhatsAppService.sendPaymentOverdueNotification(payment.member, payment);
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
            await whatsappService_1.WhatsAppService.sendMembershipExpiryNotification(member);
        }
        console.log('Payment notifications sent successfully');
    }
    catch (error) {
        console.error('Failed to send payment notifications:', error);
    }
});
