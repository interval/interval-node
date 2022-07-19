import Interval, { io, ctx } from '@interval/sdk';
import 'dotenv/config'; // loads environment variables from .env

async function activeUsers() {
  // replace with a call do your database/metrics store
  return 465;
}

const interval = new Interval({
  apiKey: process.env.INTERVAL_KEY,
  actions: {
    post_metrics: {
      handler: async () => {
        const count = await activeUsers();
        ctx.log('Active user count:', count);
        await ctx.notify({
          message: `As of today, we have *${count}* monthly active users`,
          title: 'Latest active user count 📈',
          delivery: [
            {
              // ensure that you've added the Interval Slack app to this channel
              to: '#metrics',
              method: 'SLACK',
            },
          ],
        });
      },
    },
  },
});

interval.listen();
