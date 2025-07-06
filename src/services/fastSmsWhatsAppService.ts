import { PrismaClient, Member, Payment } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// FastSMS WhatsApp API Configuration
const FASTSMS_API_KEY = process.env.FASTSMS_API_KEY || 'DJ4Up5EHRwYWgNermxtAFaOC2Pzid7XhIGuKoM9s8BnQkTj3bfoVDqyfgnBGFlhvEILZKT4S23JRwM8b';
const FASTSMS_WHATSAPP_API_URL = 'https://api.fastsms.com/api/v1/whatsapp/send';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!FASTSMS_API_KEY) {
  console.warn('⚠️ FastSMS WhatsApp integration is not properly configured. Please set FASTSMS_API_KEY environment variable.');
}

export class FastSmsWhatsAppService {
  private static formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If number starts with 91 (India), remove it
    const number = digits.startsWith('91') ? digits.slice(2) : digits;
    
    // Ensure number is 10 digits
    if (number.length !== 10) {
      throw new Error(`Invalid phone number length: ${number}`);
    }
    
    // Add country code for India
    return `91${number}`;
  }

  private static async sendWhatsAppMessage(to: string, message: string) {
    let formattedNumber = to; // Initialize with original number
    try {
      // Format phone number
      formattedNumber = this.formatPhoneNumber(to);

      // Check if FastSMS integration is configured
      if (!FASTSMS_API_KEY) {
        console.warn('FastSMS WhatsApp message not sent - integration not configured');
        return;
      }

      console.log('Sending FastSMS WhatsApp message to:', formattedNumber);
      
      const requestBody = {
        to: formattedNumber,
        message: message,
        type: 'text'
      };

      console.log('Message content:', requestBody);

      const response = await axios.post(
        FASTSMS_WHATSAPP_API_URL,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${FASTSMS_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('FastSMS WhatsApp API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });

      // Check if the message was sent successfully
      if (response.data?.status === 'success' || response.data?.message_id) {
        console.log('Message sent successfully:', response.data);
        return response.data;
      } else {
        console.warn('Message might not have been sent. Response:', response.data);
        return null;
      }
    } catch (error: any) {
      console.error('Failed to send FastSMS WhatsApp message:', {
        error: error.message,
        response: error.response?.data,
        phone: to,
        requestData: {
          url: FASTSMS_WHATSAPP_API_URL,
          to: formattedNumber,
          message: message
        }
      });
      throw new Error(`Failed to send FastSMS WhatsApp message: ${error.message}`);
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

  // Add new public method for overdue payment alerts
  static async sendOverduePaymentAlert(gymOwnerPhone: string, member: any, payments: any[]) {
    try {
      const message = `⚠️ *Overdue Payment Alert*\n\n` +
        `Member ${member.firstName} ${member.lastName} (ID: ${member.memberId}) is trying to mark attendance but has overdue payments:\n\n` +
        payments.map(payment => 
          `• Amount: $${payment.amount}\n` +
          `• Due Date: ${new Date(payment.dueDate).toLocaleDateString()}\n` +
          `• Invoice: ${payment.invoiceNumber}\n`
        ).join('\n') +
        `\nMember's Photo: ${member.photoUrl || 'No photo available'}`;

      await this.sendWhatsAppMessage(gymOwnerPhone, message);

      // Log the notification
      await prisma.notification.create({
        data: {
          memberId: member.id,
          type: 'OVERDUE_PAYMENT_ALERT',
          message,
          status: 'SENT'
        }
      });
    } catch (error) {
      console.error('Failed to send overdue payment alert:', error);
      throw new Error('Failed to send overdue payment alert');
    }
  }
} 