// src/services/notificationService.ts
import nodemailer from 'nodemailer';
// import twilio from 'twilio';
import { Payment, Member, User } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class NotificationService {
  static emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: "letzkhello@gmail.com",
      pass: "bnut rshf sbxu xqrm"
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
    try {
      const result = await this.emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@yourgym.com',
        to: member.email,
        subject: 'Payment Reminder - Your Gym Membership',
        text: emailBody
      });
      console.log(result);
    } catch (error) {
      console.error('Failed to send email:', error);
    }

    
  }

  static async sendMemberEntryNotification(gymId: string, member: Member) {
    try {
      console.log(`Starting member entry notification for gym ${gymId}, member ${member.firstName} ${member.lastName}`);
      
      // Get gym owner's email
      const gymOwner = await prisma.user.findFirst({
        where: {
          gymId: gymId,
          role: 'OWNER'
        }
      });

      console.log('Gym owner found:', gymOwner ? { id: gymOwner.id, email: gymOwner.email, role: gymOwner.role } : 'Not found');

      if (!gymOwner || !gymOwner.email) {
        console.warn('Gym owner not found or no email available for gym:', gymId);
        console.warn('Please create a user with role "OWNER" for this gym to receive email notifications');
        return;
      }
      
      const emailBody = `
        🏋️ MEMBER ENTRY NOTIFICATION 🏋️

        A member has entered the gym with overdue payments.

        MEMBER DETAILS:
        - Name: ${member.firstName} ${member.lastName}
        - Member ID: ${member.memberId}
        - Email: ${member.email}
        - Phone: ${member.phone}
        - Join Date: ${new Date(member.joinDate).toLocaleDateString()}
        - Membership Type: ${member.membershipType}
        - Status: ${member.status}
        - Last Visit: ${member.lastVisit ? new Date(member.lastVisit).toLocaleString() : 'First visit'}

        MEMBER PHOTO: ${member.photoUrl || 'No photo available'}

        Entry Time: ${new Date().toLocaleString()}

        Best regards,
        Gym Management System
      `;

      console.log('Attempting to send email to:', gymOwner.email);
      console.log('Email subject:', `🏋️ Member Entry - ${member.firstName} ${member.lastName} (${member.memberId})`);
      
      const result = await this.emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@yourgym.com',
        to: gymOwner.email,
        subject: `🏋️ Member Entry - ${member.firstName} ${member.lastName} (${member.memberId})`,
        text: emailBody
      });

      console.log('Member entry notification email sent to gym owner:', result);

      // Log the notification
      await prisma.notification.create({
        data: {
          memberId: member.id,
          type: 'MEMBER_ENTRY_NOTIFICATION',
          message: `Member entry notification sent to gym owner`,
          status: 'SENT'
        }
      });

    } catch (error: any) {
      console.error('Failed to send member entry notification email to gym owner:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        gymId,
        memberId: member.id,
        memberEmail: member.email
      });
      
      // Log the failed notification
      try {
        await prisma.notification.create({
          data: {
            memberId: member.id,
            type: 'MEMBER_ENTRY_NOTIFICATION',
            message: `Failed to send member entry notification email to gym owner: ${error.message}`,
            status: 'FAILED'
          }
        });
      } catch (dbError) {
        console.error('Failed to log notification to database:', dbError);
      }
    }
  }

  static async sendPaymentConfirmation(member: Member, payment: Payment) {
    const emailBody = `
      Dear ${member.firstName},

        Thank you for your payment of Rs.${payment.amount} for your gym membership.

      Payment Details:
      -------------------------
      Invoice Number: ${payment.invoiceNumber}
      Amount Paid: Rs.${payment.amount}
      Payment Method: ${payment.paymentMethod || 'N/A'}
      Payment Date: ${payment.paidDate ? new Date(payment.paidDate).toLocaleDateString() : new Date().toLocaleDateString()}
      Due Date: ${new Date(payment.dueDate).toLocaleDateString()}
      Status: ${payment.status}

      If you have any questions, please contact us.

      Best regards,
      Gym Management Team
    `;
    try {
      const result = await this.emailTransporter.sendMail({
        from: "letzkhello@gmail.com",
        to: member.email,
        subject: 'Payment Confirmation - Your Gym Membership',
        text: emailBody
      });
      console.log(result, "payment confirmation email sent");
    } catch (error) {
      console.error('Failed to send payment confirmation email:', error);
    }
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