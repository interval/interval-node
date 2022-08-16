import Interval, { io, ctx } from '@interval/sdk';
import 'dotenv/config'; // loads environment variables from .env
import { getCharges, refundCharge } from './payments';

const interval = new Interval({
  apiKey: process.env.INTERVAL_KEY,
  actions: {
    refund_user: async () => {
      const customerEmail = await io.input.email(
        'Email of the customer to refund:'
      );
      console.log('Email:', customerEmail);
      const charges = await getCharges(customerEmail);

      const chargesToRefund = await io.select.table(
        'Select one or more charges to refund',
        {
          data: charges,
        }
      );

      await ctx.loading.start({
        title: 'Refunding charges',
        // Because we specified `itemsInQueue`, Interval will render a progress bar versus an indeterminate loading indicator.
        itemsInQueue: chargesToRefund.length,
      });

      for (const charge of chargesToRefund) {
        await refundCharge(charge.id);
        await ctx.loading.completeOne();
      }

      // Values returned from actions are automatically stored with Interval transaction logs
      return { chargesRefunded: chargesToRefund.length };
    },
  },
});

// Establishes a persistent connection between Interval and your app.
interval.listen();
