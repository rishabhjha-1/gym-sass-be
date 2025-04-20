"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
// src/services/attendanceService.ts
const client_1 = require("@prisma/client");
const moment_1 = __importDefault(require("moment"));
const prisma = new client_1.PrismaClient();
class AttendanceService {
    static async recordAttendance(attendanceData) {
        const member = await prisma.member.findUnique({
            where: {
                id: attendanceData.memberId,
                gymId: attendanceData.gymId
            }
        });
        if (!member) {
            throw new Error('Member not found');
        }
        // Record attendance
        const attendance = await prisma.attendance.create({
            data: {
                memberId: attendanceData.memberId,
                type: attendanceData.type,
                notes: attendanceData.notes
            }
        });
        // Update member's last visit
        await prisma.member.update({
            where: { id: attendanceData.memberId },
            data: { lastVisit: new Date() }
        });
        return attendance;
    }
    static async getAttendance(filter, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        // Build filter conditions
        const where = {
            member: {
                gymId: filter.gymId
            }
        };
        if (filter.memberId) {
            where.memberId = filter.memberId;
        }
        if (filter.startDate) {
            where.timestamp = {
                ...(where.timestamp || {}),
                gte: new Date(filter.startDate)
            };
        }
        if (filter.endDate) {
            where.timestamp = {
                ...(where.timestamp || {}),
                lte: new Date(filter.endDate)
            };
        }
        // Get total count for pagination
        const total = await prisma.attendance.count({ where });
        // Get attendance records with member information
        const attendance = await prisma.attendance.findMany({
            where,
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            skip,
            take: limit,
            orderBy: { timestamp: 'desc' }
        });
        return {
            data: attendance,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };
    }
    static async getAttendanceStats(gymId) {
        const today = (0, moment_1.default)().startOf('day');
        const yesterday = (0, moment_1.default)().subtract(1, 'days').startOf('day');
        const thisWeekStart = (0, moment_1.default)().startOf('week');
        const lastWeekStart = (0, moment_1.default)().subtract(1, 'week').startOf('week');
        const lastWeekEnd = (0, moment_1.default)().subtract(1, 'week').endOf('week');
        const baseWhere = {
            member: {
                gymId
            }
        };
        // Get today's attendance count
        const todayCount = await prisma.attendance.count({
            where: {
                ...baseWhere,
                timestamp: {
                    gte: today.toDate(),
                    lt: (0, moment_1.default)(today).add(1, 'day').toDate()
                }
            }
        });
        // Get yesterday's attendance count
        const yesterdayCount = await prisma.attendance.count({
            where: {
                ...baseWhere,
                timestamp: {
                    gte: yesterday.toDate(),
                    lt: today.toDate()
                }
            }
        });
        // Get this week's attendance count
        const thisWeekCount = await prisma.attendance.count({
            where: {
                ...baseWhere,
                timestamp: {
                    gte: thisWeekStart.toDate(),
                    lt: (0, moment_1.default)().endOf('day').toDate()
                }
            }
        });
        // Get last week's attendance count
        const lastWeekCount = await prisma.attendance.count({
            where: {
                ...baseWhere,
                timestamp: {
                    gte: lastWeekStart.toDate(),
                    lt: lastWeekEnd.toDate()
                }
            }
        });
        // Get hourly distribution for current day
        const hourlyData = [];
        for (let i = 0; i < 24; i++) {
            const hourStart = (0, moment_1.default)().startOf('day').add(i, 'hours');
            const hourEnd = (0, moment_1.default)().startOf('day').add(i + 1, 'hours');
            const count = await prisma.attendance.count({
                where: {
                    ...baseWhere,
                    timestamp: {
                        gte: hourStart.toDate(),
                        lt: hourEnd.toDate()
                    }
                }
            });
            hourlyData.push({
                hour: i,
                count
            });
        }
        // Get weekday distribution (average over past 4 weeks)
        const weekdayData = [];
        for (let i = 0; i < 7; i++) {
            const dayOfWeek = i;
            const fourWeeksAgo = (0, moment_1.default)().subtract(4, 'weeks').startOf('day');
            const count = await prisma.$queryRaw `
        SELECT AVG(daily_count)::float as average_count
        FROM (
          SELECT COUNT(*) as daily_count
          FROM "Attendance"
          WHERE EXTRACT(DOW FROM "timestamp") = ${dayOfWeek}
          AND "timestamp" >= ${fourWeeksAgo.toDate()}
          GROUP BY DATE_TRUNC('day', "timestamp")
        ) as daily_counts
      `;
            weekdayData.push({
                day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
                count: count[0].average_count || 0
            });
        }
        return {
            today: todayCount,
            yesterday: yesterdayCount,
            thisWeek: thisWeekCount,
            lastWeek: lastWeekCount,
            hourlyDistribution: hourlyData,
            weekdayDistribution: weekdayData,
            change: {
                daily: yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : 0,
                weekly: lastWeekCount > 0 ? ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100 : 0
            }
        };
    }
}
exports.AttendanceService = AttendanceService;
