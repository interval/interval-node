const { Interval, io, ctx } = require('@interval/sdk');
require('dotenv').config(); // loads environment variables from .env
const { faker } = require('@faker-js/faker');

const users = [...Array(10)].map((_, i) => {
  return {
    name: faker.name.findName(),
    email: faker.internet.email(),
    avatar: faker.image.avatar(),
    address: faker.address.streetAddress(),
    subscriptionPlan: faker.helpers.arrayElement(['free', 'pro', 'enterprise']),
    emailVerified: faker.datatype.boolean(),
  };
});

function resetUserPassword(user) {
  // replace with database update and a call to send a password reset email
  ctx.log('Resetting password for', user.email);
}

const interval = new Interval({
  apiKey: process.env.INTERVAL_KEY,
  routes: {
    user_settings: async () => {
      const user = await io.search('Search for user by name or email', {
        initialResults: users,
        renderResult: user => ({
          label: user.name,
          description: user.email,
          imageUrl: user.avatar,
        }),
        onSearch: async query => {
          return users.filter(user => {
            return (
              user.name.toLowerCase().includes(query.toLowerCase()) ||
              user.email.toLowerCase().includes(query.toLowerCase())
            );
          });
        },
      });

      ctx.log(`User selected: ${user.name}`);

      const [_, name, email, subscriptionPlan, resetPassword] = await io.group([
        io.display.heading('Update user details'),
        io.input.text('Name', {
          defaultValue: user.name,
        }),
        io.input.email('Email', {
          defaultValue: user.email,
          helpText: `Existing email (${user.email}) is ${
            user.emailVerified ? 'verified' : 'not verified'
          }`,
        }),
        io.select.single('Subscription plan', {
          options: ['free', 'pro', 'enterprise'],
          defaultValue: user.subscriptionPlan,
        }),
        io.input.boolean('Reset password?', {
          helpText: 'This will log the user out of all current sessions',
        }),
      ]);

      const messages = ['update the user'];
      let helpText;
      if (resetPassword) {
        messages.push('reset their password');
        helpText = 'This will log the user out all current sessions.';
      }
      const confirmed = await io.confirm(
        `Are you sure you want to ${messages.join(' and ')}?`,
        {
          helpText,
        }
      );

      if (!confirmed) {
        return 'No confirmation, did not update the user';
      }

      const updatedUser = {
        ...user,
        name,
        email,
        subscriptionPlan,
      };
      users[users.indexOf(user)] = updatedUser;

      if (resetPassword) resetUserPassword(updatedUser);

      return updatedUser;
    },
  },
});

interval.listen();
