import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDuplicateInvoiceNumbers() {
  try {
    console.log('🔍 Checking for duplicate invoice numbers...');

    // Find all payments with their invoice numbers
    const payments = await prisma.payment.findMany({
      select: {
        id: true,
        invoiceNumber: true,
        memberId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Group by invoice number to find duplicates
    const invoiceGroups = payments.reduce((acc, payment) => {
      if (!acc[payment.invoiceNumber]) {
        acc[payment.invoiceNumber] = [];
      }
      acc[payment.invoiceNumber].push(payment);
      return acc;
    }, {} as Record<string, typeof payments>);

    // Find duplicates
    const duplicates = Object.entries(invoiceGroups).filter(([_, payments]) => payments.length > 1);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate invoice numbers found!');
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate invoice numbers:`);

    // Fix each duplicate
    for (const [invoiceNumber, payments] of duplicates) {
      console.log(`\n📝 Fixing duplicate: ${invoiceNumber} (${payments.length} payments)`);
      
      // Keep the first payment as is, update the rest
      const [firstPayment, ...duplicatePayments] = payments;
      
      for (let i = 0; i < duplicatePayments.length; i++) {
        const payment = duplicatePayments[i];
        const timestamp = Date.now() + i; // Ensure unique timestamp
        const year = new Date(payment.createdAt).getFullYear();
        
        // Generate new unique invoice number
        const newInvoiceNumber = `INV-${year}-${payment.memberId}-${(i + 1).toString().padStart(4, '0')}-${timestamp.toString().slice(-6)}`;
        
        console.log(`  Updating payment ${payment.id}: ${invoiceNumber} → ${newInvoiceNumber}`);
        
        await prisma.payment.update({
          where: { id: payment.id },
          data: { invoiceNumber: newInvoiceNumber }
        });
      }
    }

    console.log('\n✅ All duplicate invoice numbers have been fixed!');
  } catch (error) {
    console.error('❌ Error fixing duplicate invoice numbers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  fixDuplicateInvoiceNumbers()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { fixDuplicateInvoiceNumbers }; 