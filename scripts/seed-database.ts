import { PrismaClient, MembershipType, MemberStatus, GenderType, TrainingGoal } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create gym
    console.log('Creating gym...');
    const gym = await prisma.gym.create({
      data: {
        name: 'FitLife Gym',
        address: '123 Fitness Street, Health City, HC 12345',
        phone: '+1-555-0123',
        email: 'info@fitlifegym.com',
        isActive: true
      }
    });
    console.log('✅ Gym created:', gym.name);

    // Hash password for owner
    const hashedPassword = await bcrypt.hash('mypassword123', 10);

    // Create owner user
    console.log('Creating owner user...');
    const owner = await prisma.user.create({
      data: {
        email: 'rishabhjha0@gmail.com',
        password: hashedPassword,
        firstName: 'Rishabh',
        lastName: 'Jha',
        role: 'OWNER',
        phone: '+1-555-0124',
        isActive: true,
        gymId: gym.id
      }
    });
    console.log('✅ Owner created:', owner.email);

    // Sample members data
    const sampleMembers = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0001',
        gender: GenderType.MALE,
        dateOfBirth: new Date('1990-05-15'),
        address: '456 Main St, City, ST 12345',
        emergencyContact: '+1-555-0002',
        membershipType: MembershipType.MONTHLY,
        status: MemberStatus.ACTIVE,
        trainingGoal: TrainingGoal.STRENGTH,
        height: 180,
        weight: 75,
        notes: 'Prefers morning workouts'
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@example.com',
        phone: '+1-555-0003',
        gender: GenderType.FEMALE,
        dateOfBirth: new Date('1988-12-20'),
        address: '789 Oak Ave, City, ST 12345',
        emergencyContact: '+1-555-0004',
        membershipType: MembershipType.ANNUAL,
        status: MemberStatus.ACTIVE,
        trainingGoal: TrainingGoal.WEIGHT_LOSS,
        height: 165,
        weight: 60,
        notes: 'Vegetarian diet'
      },
      {
        firstName: 'Mike',
        lastName: 'Wilson',
        email: 'mike.wilson@example.com',
        phone: '+1-555-0005',
        gender: GenderType.MALE,
        dateOfBirth: new Date('1995-08-10'),
        address: '321 Pine Rd, City, ST 12345',
        emergencyContact: '+1-555-0006',
        membershipType: MembershipType.QUARTERLY,
        status: MemberStatus.ACTIVE,
        trainingGoal: TrainingGoal.CARDIO,
        height: 175,
        weight: 70,
        notes: 'Runs marathons'
      },
      {
        firstName: 'Emily',
        lastName: 'Brown',
        email: 'emily.brown@example.com',
        phone: '+1-555-0007',
        gender: GenderType.FEMALE,
        dateOfBirth: new Date('1992-03-25'),
        address: '654 Elm St, City, ST 12345',
        emergencyContact: '+1-555-0008',
        membershipType: MembershipType.MONTHLY,
        status: MemberStatus.ACTIVE,
        trainingGoal: TrainingGoal.MUSCLE_GAIN,
        height: 170,
        weight: 65,
        notes: 'Loves yoga classes'
      },
      {
        firstName: 'David',
        lastName: 'Miller',
        email: 'david.miller@example.com',
        phone: '+1-555-0009',
        gender: GenderType.MALE,
        dateOfBirth: new Date('1985-11-05'),
        address: '987 Cedar Ln, City, ST 12345',
        emergencyContact: '+1-555-0010',
        membershipType: MembershipType.ANNUAL,
        status: MemberStatus.ACTIVE,
        trainingGoal: TrainingGoal.GENERAL_FITNESS,
        height: 182,
        weight: 80,
        notes: 'Works out 5 days a week'
      },
      {
        firstName: 'Lisa',
        lastName: 'Garcia',
        email: 'lisa.garcia@example.com',
        phone: '+1-555-0011',
        gender: GenderType.FEMALE,
        dateOfBirth: new Date('1993-07-18'),
        address: '147 Maple Dr, City, ST 12345',
        emergencyContact: '+1-555-0012',
        membershipType: MembershipType.MONTHLY,
        status: MemberStatus.ACTIVE,
        trainingGoal: TrainingGoal.STRENGTH,
        height: 168,
        weight: 62,
        notes: 'Powerlifting enthusiast'
      },
      {
        firstName: 'Alex',
        lastName: 'Taylor',
        email: 'alex.taylor@example.com',
        phone: '+1-555-0013',
        gender: GenderType.OTHER,
        dateOfBirth: new Date('1991-09-30'),
        address: '258 Birch Way, City, ST 12345',
        emergencyContact: '+1-555-0014',
        membershipType: MembershipType.QUARTERLY,
        status: MemberStatus.ACTIVE,
        trainingGoal: TrainingGoal.CARDIO,
        height: 172,
        weight: 68,
        notes: 'CrossFit athlete'
      },
      {
        firstName: 'Maria',
        lastName: 'Rodriguez',
        email: 'maria.rodriguez@example.com',
        phone: '+1-555-0015',
        gender: GenderType.FEMALE,
        dateOfBirth: new Date('1989-04-12'),
        address: '369 Spruce Ct, City, ST 12345',
        emergencyContact: '+1-555-0016',
        membershipType: MembershipType.ANNUAL,
        status: MemberStatus.ACTIVE,
        trainingGoal: TrainingGoal.WEIGHT_LOSS,
        height: 163,
        weight: 58,
        notes: 'Pilates instructor'
      }
    ];

    // Create members
    console.log('Creating members...');
    const createdMembers: any[] = [];
    
    for (const memberData of sampleMembers) {
      const memberId = `MEM${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      
      const member = await prisma.member.create({
        data: {
          ...memberData,
          memberId,
          gymId: gym.id,
          joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random join date within last year
          lastVisit: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null // 70% chance of recent visit
        }
      });

      // Create membership for each member
      const membershipEndDate = new Date();
      switch (memberData.membershipType) {
        case MembershipType.MONTHLY:
          membershipEndDate.setMonth(membershipEndDate.getMonth() + 1);
          break;
        case MembershipType.QUARTERLY:
          membershipEndDate.setMonth(membershipEndDate.getMonth() + 3);
          break;
        case MembershipType.ANNUAL:
          membershipEndDate.setFullYear(membershipEndDate.getFullYear() + 1);
          break;
      }

      await prisma.membership.create({
        data: {
          memberId: member.id,
          startDate: member.joinDate,
          endDate: membershipEndDate,
          type: memberData.membershipType,
          price: getMembershipPrice(memberData.membershipType),
          isActive: true
        }
      });

      createdMembers.push(member);
      console.log(`✅ Member created: ${member.firstName} ${member.lastName} (${member.memberId})`);
    }

    // Create some sample payments
    console.log('Creating sample payments...');
    for (const member of createdMembers) {
      // Create 1-3 payments per member
      const numPayments = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < numPayments; i++) {
        const paymentDate = new Date(member.joinDate);
        paymentDate.setMonth(paymentDate.getMonth() + i);
        
        await prisma.payment.create({
          data: {
            invoiceNumber: `INV-${new Date().getFullYear()}-${member.memberId}-${(i + 1).toString().padStart(4, '0')}-${Date.now().toString().slice(-6)}`,
            memberId: member.id,
            amount: getMembershipPrice(member.membershipType),
            dueDate: paymentDate,
            paidDate: Math.random() > 0.2 ? paymentDate : null, // 80% chance of being paid
            status: Math.random() > 0.2 ? 'PAID' : 'PENDING',
            paymentMethod: ['CASH', 'CARD', 'BANK_TRANSFER'][Math.floor(Math.random() * 3)]
          }
        });
      }
    }

    // Create some sample attendance records
    console.log('Creating sample attendance records...');
    for (const member of createdMembers) {
      if (member.lastVisit) {
        // Create attendance record for last visit
        await prisma.attendance.create({
          data: {
            memberId: member.id,
            timestamp: member.lastVisit,
            type: 'CHECK_IN',
            notes: 'Regular workout session'
          }
        });
      }
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Gym: ${gym.name} (ID: ${gym.id})`);
    console.log(`- Owner: ${owner.firstName} ${owner.lastName} (${owner.email})`);
    console.log(`- Members: ${createdMembers.length} created`);
    console.log('\n🔑 Login Credentials:');
    console.log(`Email: ${owner.email}`);
    console.log(`Password: mypassword123`);
    console.log(`Role: OWNER`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function getMembershipPrice(type: MembershipType): number {
  switch (type) {
    case MembershipType.MONTHLY:
      return 49.99;
    case MembershipType.QUARTERLY:
      return 129.99;
    case MembershipType.ANNUAL:
      return 449.99;
    case MembershipType.DAILY_PASS:
      return 9.99;
    default:
      return 49.99;
  }
}

// Run the seeding
seedDatabase()
  .then(() => {
    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }); 