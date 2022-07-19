import 'dotenv/config';
import Interval from '@interval/sdk';

const interval = new Interval({
  apiKey: process.env.INTERVAL_KEY,
  actions: {},
});

interval.listen();
