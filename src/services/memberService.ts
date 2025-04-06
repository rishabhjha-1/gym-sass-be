// src/services/memberService.ts
import { PrismaClient, Member } from '@prisma/client';
import { MemberFilter, PaginatedResponse } from '../type';
import moment from 'moment';

const prisma = new PrismaClient();

export class MemberService {
  static async createMember(memberData: any): Promise<Member> {
    // Generate custom memberId (e.g., MEM001, MEM002)
    const memberCount = await prisma.member.count();
    const memberId = `MEM${(memberCount + 1).toString().padStart(3, '0')}`;

    // Create member
    const member = await prisma.member.create({
      data: {
        ...memberData,
        memberId,
        dateOfBirth: new Date(memberData.dateOfBirth)
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
  }

  static async getMembers(
    filter: MemberFilter,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<Member>> {
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: any = {};
    
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

  static async getMemberById(id: string): Promise<Member | null> {
    return prisma.member.findUnique({
      where: { id },
      include: {
        memberships: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        attendance: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    });
  }

  static async updateMember(id: string, memberData: any): Promise<Member> {
    return prisma.member.update({
      where: { id },
      data: memberData
    });
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

  private static calculateMembershipEndDate(startDate: Date, membershipType: string): Date {
    const endDate = new Date(startDate);
    
    switch (membershipType) {
      case 'DAILY_PASS':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'MONTHLY':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'ANNUAL':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }
    
    return endDate;
  }

  private static getMembershipPrice(membershipType: string): number {
    switch (membershipType) {
      case 'DAILY_PASS':
        return 15;
      case 'MONTHLY':
        return 50;
      case 'QUARTERLY':
        return 135;
      case 'ANNUAL':
        return 480;
      default:
        return 50;
    }
  }
}