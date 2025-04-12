import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class GymService {
  static async createGym(gymData: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
  }) {
    const gym = await prisma.gym.create({
      data: gymData
    });
    return gym;
  }

  static async getGymById(id: string) {
    const gym = await prisma.gym.findUnique({
      where: { id }
    });
    return gym;
  }

  static async getAllGyms() {
    const gyms = await prisma.gym.findMany();
    return gyms;
  }

  static async updateGym(id: string, gymData: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
  }) {
    const gym = await prisma.gym.update({
      where: { id },
      data: gymData
    });
    return gym;
  }

  static async deleteGym(id: string) {
    const gym = await prisma.gym.delete({
      where: { id }
    });
    return gym;
  }
} 