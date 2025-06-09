// src/services/notificationService.ts
import nodemailer from 'nodemailer';
// import twilio from 'twilio';
import { Payment, Member } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class NotificationService {
  private static emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // private static twilioClient = twilio(
  //   process.env.TWILIO_ACCOUNT_SID || '',
  //   process.env.TWILIO_AUTH_TOKEN || ''
  // );

  static async sendPaymentReminder(memberId: string, paymentId: string) {
    try {
      const member = await prisma.member.findUnique({
        where: { id: memberId }
      });

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!member || !payment) {
        throw new Error('Member or payment not found');
      }

      await this.sendEmailNotification(member, payment);
      // await this.sendSmsNotification(member, payment);
      // await this.sendWhatsAppNotification(member, payment);

      return { success: true };
    } catch (error:any) {
      console.error('Failed to send notification:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  static async sendEmailNotification(member: Member, payment: Payment) {
    const emailBody = `
      Dear ${member.firstName},

      This is a reminder that your gym membership payment of $${payment.amount} is due on ${new Date(payment.dueDate).toLocaleDateString()}.
      
      Invoice Number: ${payment.invoiceNumber}
      
      Please make your payment to continue enjoying your gym membership benefits.
      
      If you have already made this payment, please disregard this message.
      
      Best regards,
      Gym Management Team
    `;

    await this.emailTransporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@yourgym.com',
      to: member.email,
      subject: 'Payment Reminder - Your Gym Membership',
      text: emailBody
    });
  }

  // static async sendSmsNotification(member: Member, payment: Payment) {
  //   if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  //     console.log('Twilio credentials not set up. SMS would have been sent to:', member.phone);
  //     return;
  //   }

  //   await this.twilioClient.messages.create({
  //     body: `Hi ${member.firstName}, this is a reminder that your gym membership payment of $${payment.amount} is due on ${new Date(payment.dueDate).toLocaleDateString()}. Please pay to continue your membership.`,
  //     from: process.env.TWILIO_PHONE_NUMBER || '',
  //     to: member.phone
  //   });
  // }

  // static async sendWhatsAppNotification(member: Member, payment: Payment) {
  //   if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  //     console.log('Twilio credentials not set up. WhatsApp would have been sent to:', member.phone);
  //     return;
  //   }

  //   // Using Twilio's WhatsApp sandbox or business API
  //   await this.twilioClient.messages.create({
  //     body: `Hi ${member.firstName}, this is a reminder that your gym membership payment of $${payment.amount} is due on ${new Date(payment.dueDate).toLocaleDateString()}. Please pay to continue your membership.`,
  //     from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || ''}`,
  //     to: `whatsapp:${member.phone}`
  //   });
  // }
  
  static async sendExpiredMembershipNotifications() {
    const today = new Date();
    
    // Find memberships expiring in the next 3 days
    const expiringMemberships = await prisma.membership.findMany({
      where: {
        isActive: true,
        endDate: {
          gte: today,
          lt: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        member: true
      }
    });
    
    const notifications = [];
    
    for (const membership of expiringMemberships) {
      try {
        const daysRemaining = Math.ceil(
          (membership.endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        );
        
        await this.emailTransporter.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@yourgym.com',
          to: membership.member.email,
          subject: 'Your Gym Membership Is Expiring Soon',
          text: `
            Dear ${membership.member.firstName},
            
            Your gym membership will expire in ${daysRemaining} day(s) on ${membership.endDate.toLocaleDateString()}.
            
            Please renew your membership to continue enjoying our gym facilities and services.
            
            Best regards,
            Gym Management Team
          `
        });
        
        notifications.push({
          memberId: membership.memberId,
          success: true,
          daysRemaining
        });
      } catch (error:any) {
        notifications.push({
          memberId: membership.memberId,
          success: false,
          error: error.message
        });
      }
    }
    
    return notifications;
  }
}