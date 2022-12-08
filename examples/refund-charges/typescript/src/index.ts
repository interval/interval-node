import Interval, { Page, Layout, io, ctx } from '@interval/sdk';
import 'dotenv/config'; // loads environment variables from .env
import { getCharges, refundCharge, getRefunds } from './payments';

const interval = new Interval({
  apiKey: 'ryan_dev_NT2O4q3jpj2FxMP3Ew60csbaEy8UG97KVKNoLaLkU6w7IlzS',
  endpoint: 'ws://localhost:3000/websocket',

  routes: {
    refunds: new Page({
      name: 'Refunds',
      handler: async () => {
        const refunds = await getRefunds();

        return new Layout({
          title: 'Refunds',
          description: 'View and create refunds for our customers.',
          menuItems: [
            {
              label: 'Create refund',
              route: 'refunds/refund_user',
            },
          ],
          children: [
            io.display.metadata('', {
              layout: 'card',
              data: [
                {
                  label: 'Total refunds',
                  value: refunds.length,
                },
              ],
            }),
            io.display.table('Refunds', {
              data: refunds,
            }),
          ],
        });
      },
      routes: {
        refund_user: {
          unlisted: true,
          name: 'Create refund',
          handler: async () => {
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
      },
    }),
  },
});

// Establishes a persistent connection between Interval and your app.
interval.listen();
