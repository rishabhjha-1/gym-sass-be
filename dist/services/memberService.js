"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberService = void 0;
// src/services/memberService.ts
const client_1 = require("@prisma/client");
const moment_1 = __importDefault(require("moment"));
const uuid_1 = require("uuid");
const faceRecognitionService_1 = __importDefault(require("./faceRecognitionService"));
const prisma = new client_1.PrismaClient();
class MemberService {
    static async createMember(memberData) {
        try {
            // Check if member with email already exists
            const existingMember = await prisma.member.findUnique({
                where: { email: memberData.email }
            });
            if (existingMember) {
                throw new Error('Member with this email already exists');
            }
            // Generate a unique memberId using UUID
            const memberId = `MEM${(0, uuid_1.v4)().split('-')[0]}`;
            let photoUrl = memberData.photoUrl;
            // If photoUrl is a base64 string, upload it to Cloudinary
            if (photoUrl && photoUrl.startsWith('data:image')) {
                try {
                    // Convert base64 to buffer
                    const base64Data = photoUrl.replace(/^data:image\/\w+;base64,/, '');
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    // Upload to Cloudinary
                    photoUrl = await this.uploadFaceImage(imageBuffer);
                    // Index the face for future recognition
                    await this.indexFace(imageBuffer, memberId);
                }
                catch (error) {
                    console.error('Failed to upload member photo:', error);
                    // Continue without photo if upload fails
                    photoUrl = undefined;
                }
            }
            // Create member
            const member = await prisma.member.create({
                data: {
                    ...memberData,
                    memberId,
                    photoUrl,
                    dateOfBirth: new Date(memberData.dateOfBirth),
                    joinDate: new Date(),
                    status: memberData.status || client_1.MemberStatus.ACTIVE
                }
            });
            // Create initial membership
            const endDate = this.calculateMembershipEndDate(new Date(), memberData.membershipType);
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
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new Error('A member with this email already exists');
                }
                throw new Error('Database error occurred while creating member');
            }
            throw error;
        }
    }
    static async getMembers(filter, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        // Build filter conditions
        const where = {
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
    static async getMemberById(id, gymId) {
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to retrieve member');
        }
    }
    static async updateMember(id, memberData) {
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
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
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
                month: (0, moment_1.default)(startDate).format('MMM'),
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
    static async deleteMember(id, gymId) {
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
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                throw new Error('Database error occurred while deleting member');
            }
            throw error;
        }
    }
    static calculateMembershipEndDate(startDate, type) {
        const endDate = new Date(startDate);
        switch (type) {
            case client_1.MembershipType.MONTHLY:
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case client_1.MembershipType.QUARTERLY:
                endDate.setMonth(endDate.getMonth() + 3);
                break;
            case client_1.MembershipType.ANNUAL:
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
            case client_1.MembershipType.DAILY_PASS:
                endDate.setDate(endDate.getDate() + 1);
                break;
            default:
                throw new Error('Invalid membership type');
        }
        return endDate;
    }
    static getMembershipPrice(type) {
        switch (type) {
            case client_1.MembershipType.MONTHLY:
                return 50;
            case client_1.MembershipType.QUARTERLY:
                return 135;
            case client_1.MembershipType.ANNUAL:
                return 500;
            case client_1.MembershipType.DAILY_PASS:
                return 10;
            default:
                throw new Error('Invalid membership type');
        }
    }
    static async uploadFaceImage(imageBuffer) {
        const faceService = faceRecognitionService_1.default.getInstance();
        return faceService.indexFace(imageBuffer, (0, uuid_1.v4)());
    }
    static async indexFace(imageBuffer, memberId) {
        const faceService = faceRecognitionService_1.default.getInstance();
        return faceService.indexFace(imageBuffer, memberId);
    }
}
exports.MemberService = MemberService;
