import { PrismaClient, Member, Payment } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

export class WhatsAppService {
  private static async sendWhatsAppMessage(to: string, message: string) {
    try {
      await axios.post(
        WHATSAPP_API_URL,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      throw new Error('Failed to send WhatsApp message');
    }
  }

  static async sendPaymentConfirmation(member: Member, payment: Payment) {
    try {
      const message = `*Payment Confirmation*\n\n` +
        `Dear ${member.firstName},\n\n` +
        `Thank you for your payment. Here are your payment details:\n\n` +
        `*Invoice Number:* ${payment.invoiceNumber}\n` +
        `*Date:* ${new Date(payment.paidDate!).toLocaleDateString()}\n` +
        `*Amount Paid:* $${payment.amount}\n` +
        `*Payment Method:* ${payment.paymentMethod}\n` +
        `*Membership Type:* ${member.membershipType}\n\n` +
        `*Payment Status:* ✅ PAID\n\n` +
        `Thank you for your business!\n` +
        `Your Gym Team`;

      await this.sendWhatsAppMessage(member.phone, message);

      // Log the notification
      await prisma.notification.create({
        data: {
          memberId: member.id,
          type: 'PAYMENT_CONFIRMATION',
          message,
          status: 'SENT'
        }
      });
    } catch (error) {
      console.error('Failed to send payment confirmation:', error);
      throw new Error('Failed to send payment confirmation');
    }
  }

  static async sendPaymentDueNotification(member: Member, payment: Payment) {
    try {
      const message = `Dear ${member.firstName},\n\n` +
        `Your payment of $${payment.amount} for ${member.membershipType} membership is due on ${new Date(payment.dueDate).toLocaleDateString()}.\n\n` +
        `Please make the payment to continue enjoying our services.\n\n` +
        `Thank you,\n` +
        `Your Gym Team`;

      await this.sendWhatsAppMessage(member.phone, message);

      // Log the notification
      await prisma.notification.create({
        data: {
          memberId: member.id,
          type: 'PAYMENT_DUE',
          message,
          status: 'SENT'
        }
      });
    } catch (error) {
      console.error('Failed to send WhatsApp notification:', error);
      throw new Error('Failed to send payment due notification');
    }
  }

  static async sendPaymentOverdueNotification(member: Member, payment: Payment) {
    try {
      const message = `Dear ${member.firstName},\n\n` +
        `Your payment of $${payment.amount} for ${member.membershipType} membership is overdue.\n\n` +
        `Please make the payment immediately to avoid any service interruptions.\n\n` +
        `Thank you,\n` +
        `Your Gym Team`;

      await this.sendWhatsAppMessage(member.phone, message);

      // Log the notification
      await prisma.notification.create({
        data: {
          memberId: member.id,
          type: 'PAYMENT_OVERDUE',
          message,
          status: 'SENT'
        }
      });
    } catch (error) {
      console.error('Failed to send WhatsApp notification:', error);
      throw new Error('Failed to send payment overdue notification');
    }
  }

  static async sendMembershipExpiryNotification(member: Member) {
    try {
      const message = `Dear ${member.firstName},\n\n` +
        `Your ${member.membershipType} membership will expire on ${new Date(member.expiryDate!).toLocaleDateString()}.\n\n` +
        `Please renew your membership to continue enjoying our services.\n\n` +
        `Thank you,\n` +
        `Your Gym Team`;

      await this.sendWhatsAppMessage(member.phone, message);

      // Log the notification
      await prisma.notification.create({
        data: {
          memberId: member.id,
          type: 'MEMBERSHIP_EXPIRY',
          message,
          status: 'SENT'
        }
      });
    } catch (error) {
      console.error('Failed to send WhatsApp notification:', error);
      throw new Error('Failed to send membership expiry notification');
    }
  }

  static async broadcastMessage(message: string, gymId: string) {
    try {
      // Get all active members for the gym
      const members = await prisma.member.findMany({
        where: {
          gymId,
          status: 'ACTIVE',
          phone: { not: '' }  // Filter out empty phone numbers
        }
      });

      const results = {
        total: members.length,
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Send message to each member
      for (const member of members) {
        try {
          await this.sendWhatsAppMessage(member.phone, message);

          // Log the notification
          await prisma.notification.create({
            data: {
              memberId: member.id,
              type: 'BROADCAST',
              message,
              status: 'SENT'
            }
          });

          results.successful++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Failed to send to ${member.firstName} ${member.lastName}: ${error.message}`);
          
          // Log the failed notification
          await prisma.notification.create({
            data: {
              memberId: member.id,
              type: 'BROADCAST',
              message,
              status: 'FAILED'
            }
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to broadcast message:', error);
      throw new Error('Failed to broadcast message');
    }
  }
} 