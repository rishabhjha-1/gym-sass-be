// src/services/memberService.ts
import { PrismaClient, Member, Prisma, MemberStatus, MembershipType, GenderType, TrainingGoal } from '@prisma/client';
import { MemberFilter, PaginatedResponse } from '../type';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export class MemberService {
  static async createMember(memberData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: GenderType;
    dateOfBirth: string | Date;
    address?: string;
    emergencyContact?: string;
    membershipType: MembershipType;
    status?: MemberStatus;
    trainingGoal?: TrainingGoal;
    height?: number;
    weight?: number;
    notes?: string;
    photoUrl?: string;
    gymId: string;
  }) {
    try {
      // Check if member with email already exists
      const existingMember = await prisma.member.findUnique({
        where: { email: memberData.email }
      });

      if (existingMember) {
        throw new Error('Member with this email already exists');
      }

      // Generate a unique memberId using UUID
      const memberId = `MEM${uuidv4().split('-')[0]}`;

      // Create member
      const member = await prisma.member.create({
        data: {
          ...memberData,
          memberId,
          dateOfBirth: new Date(memberData.dateOfBirth),
          joinDate: new Date(),
          status: memberData.status || MemberStatus.ACTIVE
        }
      });

      // Create initial membership
      const endDate = this.calculateMembershipEndDate(
        new Date(),
        memberData.membershipType
      );

      await prisma.membership.create({
        data: {
          memberId: member.id,
          startDate: new Date(),
          endDate,
          type: memberData.membershipType,
          price: this.getMembershipPrice(memberData.membershipType),
          isActive: true
        }
      });

      return member;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('A member with this email already exists');
        }
        throw new Error('Database error occurred while creating member');
      }
      throw error;
    }
  }

  static async getMembers(
    filter: MemberFilter & { gymId: string },
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<Member>> {
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: any = {
      gymId: filter.gymId
    };
    
    if (filter.status) {
      where.status = filter.status;
    }
    
    if (filter.membershipType) {
      where.membershipType = filter.membershipType;
    }
    
    if (filter.searchTerm) {
      where.OR = [
        { firstName: { contains: filter.searchTerm, mode: 'insensitive' } },
        { lastName: { contains: filter.searchTerm, mode: 'insensitive' } },
        { email: { contains: filter.searchTerm, mode: 'insensitive' } },
        { memberId: { contains: filter.searchTerm, mode: 'insensitive' } },
        { phone: { contains: filter.searchTerm } }
      ];
    }
    
    if (filter.startDate) {
      where.joinDate = {
        ...(where.joinDate || {}),
        gte: new Date(filter.startDate)
      };
    }
    
    if (filter.endDate) {
      where.joinDate = {
        ...(where.joinDate || {}),
        lte: new Date(filter.endDate)
      };
    }

    // Get total count for pagination
    const total = await prisma.member.count({ where });

    // Get members
    const members = await prisma.member.findMany({
      where,
      include: {
        memberships: {
          where: { isActive: true },
          orderBy: { endDate: 'desc' },
          take: 1
        }
      },
      skip,
      take: limit,
      orderBy: { joinDate: 'desc' }
    });

    return {
      data: members,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getMemberById(id: string, gymId: string): Promise<Member | null> {
    try {
      const member = await prisma.member.findFirst({
        where: { 
          id,
          gymId
        }
      });

      if (!member) {
        throw new Error('Member not found');
      }

      return member;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to retrieve member');
    }
  }

  static async updateMember(
    id: string,
    memberData: Partial<Omit<Prisma.MemberUpdateInput, 'gym'>> & { gymId: string }
  ): Promise<Member> {
    try {
      const member = await prisma.member.findFirst({
        where: { 
          id,
          gymId: memberData.gymId
        }
      });

      if (!member) {
        throw new Error('Member not found');
      }

      const { gymId, ...updateData } = memberData;
      return await prisma.member.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('A member with this email already exists');
        }
        throw new Error('Database error occurred while updating member');
      }
      throw error;
    }
  }

  static async getMembershipGrowth() {
    const today = new Date();
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);
    
    const twoMonthsAgo = new Date(oneMonthAgo);
    twoMonthsAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Get current month new members
    const currentMonthMembers = await prisma.member.count({
      where: {
        joinDate: {
          gte: oneMonthAgo,
          lt: today
        }
      }
    });

    // Get previous month new members
    const previousMonthMembers = await prisma.member.count({
      where: {
        joinDate: {
          gte: twoMonthsAgo,
          lt: oneMonthAgo
        }
      }
    });

    // Calculate growth stats
    const growth = currentMonthMembers - previousMonthMembers;
    const growthPercentage = previousMonthMembers > 0 
      ? (growth / previousMonthMembers) * 100 
      : 0;
    
    // Get monthly member counts for the last 6 months
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - i);
      startDate.setDate(1);
      
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      
      const count = await prisma.member.count({
        where: {
          joinDate: {
            gte: startDate,
            lt: endDate
          }
        }
      });
      
      monthlyData.push({
        month: moment(startDate).format('MMM'),
        count
      });
    }

    // Get member status distribution
    const activeMembers = await prisma.member.count({
      where: { status: 'ACTIVE' }
    });
    
    const inactiveMembers = await prisma.member.count({
      where: { status: 'INACTIVE' }
    });
    
    const frozenMembers = await prisma.member.count({
      where: { status: 'FROZEN' }
    });
    
    const expiredMembers = await prisma.member.count({
      where: { status: 'EXPIRED' }
    });

    return {
      currentMonthMembers,
      previousMonthMembers,
      growth,
      growthPercentage,
      monthlyData,
      statusDistribution: {
        active: activeMembers,
        inactive: inactiveMembers,
        frozen: frozenMembers,
        expired: expiredMembers
      }
    };
  }

  static async deleteMember(id: string, gymId: string): Promise<void> {
    try {
      const member = await prisma.member.findFirst({
        where: { 
          id,
          gymId
        }
      });

      if (!member) {
        throw new Error('Member not found');
      }

      await prisma.member.delete({
        where: { id }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new Error('Database error occurred while deleting member');
      }
      throw error;
    }
  }

  private static calculateMembershipEndDate(startDate: Date, type: MembershipType): Date {
    const endDate = new Date(startDate);
    switch (type) {
      case MembershipType.MONTHLY:
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case MembershipType.QUARTERLY:
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case MembershipType.ANNUAL:
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case MembershipType.DAILY_PASS:
        endDate.setDate(endDate.getDate() + 1);
        break;
      default:
        throw new Error('Invalid membership type');
    }
    return endDate;
  }

  private static getMembershipPrice(type: MembershipType): number {
    switch (type) {
      case MembershipType.MONTHLY:
        return 50;
      case MembershipType.QUARTERLY:
        return 135;
      case MembershipType.ANNUAL:
        return 500;
      case MembershipType.DAILY_PASS:
        return 10;
      default:
        throw new Error('Invalid membership type');
    }
  }
}