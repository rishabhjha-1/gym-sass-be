"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GymService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class GymService {
    static async createGym(gymData) {
        const gym = await prisma.gym.create({
            data: gymData
        });
        return gym;
    }
    static async getGymById(id) {
        const gym = await prisma.gym.findUnique({
            where: { id }
        });
        return gym;
    }
    static async getAllGyms() {
        const gyms = await prisma.gym.findMany();
        return gyms;
    }
    static async updateGym(id, gymData) {
        const gym = await prisma.gym.update({
            where: { id },
            data: gymData
        });
        return gym;
    }
    static async deleteGym(id) {
        const gym = await prisma.gym.delete({
            where: { id }
        });
        return gym;
    }
}
exports.GymService = GymService;
