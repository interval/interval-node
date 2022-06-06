/* 
  Have a real Stripe account you'd like to use? 
  You can replace this import with: import Stripe from "stripe";
*/
import Stripe from '@interval/fake-stripe';

const stripe = new Stripe(process.env.STRIPE_KEY, {
  apiVersion: '2020-08-27',
});

/*
  This function picks the first Stripe "Customer" with a given email, but Stripe Customers aren't really unique on email. 

  In a later part of the tutorial, we'll modify this function to return all matching customers and use the `io.search` method to allow the person running our action to choose which of the matching Customers they want to refund. 
*/
export async function getCharges(customerEmail: string) {
  const customers = await stripe.customers.list({
    limit: 1,
    email: customerEmail,
  });

  const customer = customers.data[0];

  /*
    You can safely throw from within Interval actions. Interval will display any errors thrown during the course of an action's execution to the person running the action.
  */
  if (!customer) throw new Error(`No customer with email ${customerEmail}`);

  const recentCharges = await stripe.charges.list({
    customer: customer.id,
  });

  /*
    Since Stripe's "Charge" object includes lots of extraneous data, we're mapping over each Charge to return just the fields we need for our `io.select.table`.
  */
  return recentCharges.data.map(charge => ({
    id: charge.id,
    amount: `$${(charge.amount / 100).toFixed(2)}`,
    description: charge.description,
    createdAt: new Date(charge.created * 1000),
    isRefunded: charge.refunded,
  }));
}

export async function refundCharge(id: string) {
  return stripe.refunds.create({
    charge: id,
    reason: 'requested_by_customer',
  });
}
