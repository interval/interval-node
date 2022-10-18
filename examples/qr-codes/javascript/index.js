const { Interval, io, ctx } = require('@interval/sdk');
require('dotenv').config(); // loads environment variables from .env
import QRCode from 'qrcode';

const interval = new Interval({
  apiKey: process.env.INTERVAL_KEY,
  actions: {
    generate_qr_code: async () => {
      const url = await io.input.url('URL for the QR code to link to', {
        placeholder: 'https://example.com',
      });

      const buffer = await QRCode.toBuffer(url.toString());

      await io.display.image('Generated QR code', { buffer });

      return 'All done!';
    },
  },
});

interval.listen();
