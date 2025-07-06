import axios from 'axios';
import { PrismaClient, Member, Payment } from '@prisma/client';

const prisma = new PrismaClient();

// Validate required environment variables
const TEXTLOCAL_API_KEY = process.env.TEXTLOCAL_API_KEY;
const TEXTLOCAL_SENDER = process.env.TEXTLOCAL_SENDER || "TXTLCL";

if (!TEXTLOCAL_API_KEY) {
  console.warn('⚠️ TextLocal integration is not properly configured. Please set TEXTLOCAL_API_KEY environment variable.');
}

export class TextLocalService {
  private static formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If number starts with 91 (India), remove it
    const number = digits.startsWith('91') ? digits.slice(2) : digits;
    
    // Ensure number is 10 digits
    if (number.length !== 10) {
      throw new Error(`Invalid phone number length: ${number}`);
    }
    
    return number;
  }

  private static async sendSMS(to: string, message: string) {
    try {
      const formattedNumber = this.formatPhoneNumber(to);

      if (!TEXTLOCAL_API_KEY) {
        console.warn('TextLocal SMS integration not configured');
        return;
      }

      const response = await axios.get('https://api.textlocal.in/send/', {
        params: {
          apikey: TEXTLOCAL_API_KEY,
          numbers: formattedNumber,
          message: message,
          sender: TEXTLOCAL_SENDER,
          test: process.env.NODE_ENV !== 'production' ? '1' : '0' // Test mode in development
        }
      });

      console.log('TextLocal SMS API Response:', response.data);
      
      if (response.data.status === 'success') {
        return response.data;
      } else {
        throw new Error(`TextLocal API error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to send SMS via TextLocal:', {
        error: error.message,
        response: error.response?.data,
        phone: to
      });
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  static async sendPaymentConfirmation(member: Member, payment: Payment) {
    try {
      const message = `Dear ${member.firstName}, your payment of $${payment.amount} has been successfully received. Invoice: ${payment.invoiceNumber}. Payment Method: ${payment.paymentMethod}. Membership Type: ${member.membershipType}. Thank you for your payment!`;
      console.log('Sending payment confirmation via TextLocal to', member.phone); 
      
      // Send SMS
      await this.sendSMS(member.phone, message);

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
      const message = `Dear ${member.firstName}, your payment of $${payment.amount} is due on ${new Date(payment.dueDate).toLocaleDateString()}. Please make the payment to continue your membership.`;
      
      // Send SMS
      await this.sendSMS(member.phone, message);

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
      console.error('Failed to send payment due notification:', error);
      throw new Error('Failed to send payment due notification');
    }
  }

  static async sendPaymentOverdueNotification(member: Member, payment: Payment) {
    try {
      const message = `Dear ${member.firstName}, your payment of $${payment.amount} is overdue. Please make the payment immediately to avoid membership suspension.`;
      
      // Send SMS
      await this.sendSMS(member.phone, message);

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
      console.error('Failed to send payment overdue notification:', error);
      throw new Error('Failed to send payment overdue notification');
    }
  }

  static async sendMembershipExpiryNotification(member: Member) {
    try {
      const message = `Dear ${member.firstName}, your ${member.membershipType} membership will expire on ${new Date(member.expiryDate!).toLocaleDateString()}. Please renew to continue your fitness journey.`;
      
      // Send SMS
      await this.sendSMS(member.phone, message);

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
      console.error('Failed to send membership expiry notification:', error);
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
          // Send SMS
          await this.sendSMS(member.phone, message);

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
      console.error('Failed to send broadcast message:', error);
      throw new Error('Failed to send broadcast message');
    }
  }
} 