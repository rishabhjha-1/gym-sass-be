// src/types/index.ts
export enum MembershipType {
    MONTHLY = 'MONTHLY',
    QUARTERLY = 'QUARTERLY',
    ANNUAL = 'ANNUAL',
    DAILY_PASS = 'DAILY_PASS'
  }
  
  export enum MemberStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    FROZEN = 'FROZEN',
    EXPIRED = 'EXPIRED'
  }
  
  export enum PaymentStatus {
    PENDING = 'PENDING',
    PAID = 'PAID',
    OVERDUE = 'OVERDUE',
    REFUNDED = 'REFUNDED',
    CANCELLED = 'CANCELLED'
  }
  
  export enum AttendanceType {
    CHECK_IN = 'CHECK_IN',
    CHECK_OUT = 'CHECK_OUT'
  }
  
  export enum GenderType {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    OTHER = 'OTHER'
  }
  
  export enum TrainingGoal {
    STRENGTH = 'STRENGTH',
    CARDIO = 'CARDIO',
    WEIGHT_LOSS = 'WEIGHT_LOSS',
    MUSCLE_GAIN = 'MUSCLE_GAIN',
    GENERAL_FITNESS = 'GENERAL_FITNESS'
  }
  
  export interface PaginatedResponse<T> {
    data: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
  
  export type DateRangeFilter = {
    startDate?: Date;
    endDate?: Date;
  };
  
  export type MemberFilter = {
    status?: MemberStatus;
    membershipType?: MembershipType;
    searchTerm?: string;
  } & DateRangeFilter;
  
  export type RevenueFilter = {
    category?: string;
    paymentMethod?: string;
  } & DateRangeFilter;
  
  export type AttendanceFilter = {
    memberId?: string;
  } & DateRangeFilter;