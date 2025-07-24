import Stripe from 'stripe';




class SubscriptionService {
  
  constructor() {
    // Initialize Stripe (will be imported dynamically)
    this.stripe = null;
    this.initStripe();
  }
  
  async initStripe() {
    try {
      const { default: Stripe } = await import('stripe');
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16'
      });
      console.log('✅ Stripe initialized');
    } catch (error) {
      console.warn('⚠️ Stripe not available:', error.message);
    }
  }
  
  // Create a new customer in Stripe
  async createCustomer(email, userId) {
    if (!this.stripe) throw new Error('Stripe not initialized');
    
    try {
      const customer = await this.stripe.customers.create({
        email,
        metadata: { userId }
      });
      
      return {
        customerId: customer.id,
        email: customer.email
      };
    } catch (error) {
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }
  
  // Create subscription checkout session with user ID for webhook
  async createCheckoutSession(customerId, priceId, successUrl, cancelUrl, userId = null, planName = null) {
    if (!this.stripe) throw new Error('Stripe not initialized');
    
    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId, // ✅ User ID for webhook identification
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
          address: 'auto',
          name: 'auto'
        },
        metadata: {
          userId: userId,
          source: 'framesense_app',
          planName: planName
        }
      });
      
      return {
        sessionId: session.id,
        url: session.url
      };
    } catch (error) {
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }
  
  // Handle Stripe webhook events
  async handleWebhook(body, signature) {
    if (!this.stripe) throw new Error('Stripe not initialized');
    
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    
    try {
      event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
    
    console.log(`🎯 Stripe webhook received: ${event.type}`);
    
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return await this.handleSubscriptionChange(event.data.object);
        
      case 'customer.subscription.deleted':
        return await this.handleSubscriptionCancellation(event.data.object);
        
      case 'invoice.payment_succeeded':
        return await this.handlePaymentSuccess(event.data.object);
        
      case 'invoice.payment_failed':
        return await this.handlePaymentFailure(event.data.object);
        
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        return { received: true };
    }
  }
  
  // Handle subscription changes
  async handleSubscriptionChange(subscription) {
    const customerId = subscription.customer;
    const status = subscription.status;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    
    // Determine tier based on price ID
    const tier = this.determineTierFromSubscription(subscription);
    
    // Update user subscription in database (you'll implement this)
    const updateData = {
      customerId,
      subscriptionId: subscription.id,
      tier,
      status,
      currentPeriodEnd,
      updatedAt: new Date()
    };
    
    console.log(`📊 Subscription updated:`, updateData);
    
    // TODO: Update user in database
    // await this.updateUserSubscription(customerId, updateData);
    
    return { processed: true, tier, status };
  }
  
  // Handle subscription cancellation
  async handleSubscriptionCancellation(subscription) {
    const customerId = subscription.customer;
    
    console.log(`❌ Subscription cancelled for customer: ${customerId}`);
    
    // TODO: Update user to free tier in database
    // await this.updateUserSubscription(customerId, { tier: 'free', status: 'cancelled' });
    
    return { processed: true, tier: 'free' };
  }
  
  // Handle successful payment
  async handlePaymentSuccess(invoice) {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    
    console.log(`✅ Payment succeeded for customer: ${customerId}`);
    
    // Import UserService to update user tier
    const { default: UserService } = await import('./user-service.js');
    
    // Find user by Stripe customer ID and ensure they have correct tier
    const user = await UserService.getUserByStripeCustomerId(customerId);
    if (user && user.tier === 'free') {
      // User still has free tier, update to premium (fallback)
      await UserService.updateUserTier(user.email, 'premium', 'active');
      console.log(`✅ User ${user.email} tier updated to premium via invoice payment`);
    }
    
    return { processed: true };
  }
  
  // Handle failed payment
  async handlePaymentFailure(invoice) {
    const customerId = invoice.customer;
    
    console.log(`❌ Payment failed for customer: ${customerId}`);
    
    // TODO: Handle payment failure (email notification, etc.)
    
    return { processed: true };
  }
  
  // Determine user tier from Stripe subscription
  determineTierFromSubscription(subscription) {
    if (!subscription.items || subscription.items.data.length === 0) {
      return 'free';
    }
    
    const priceId = subscription.items.data[0].price.id;
    
    // Map price IDs to tiers (you'll set these in Stripe dashboard)
    const tierMapping = {
      'price_premium_monthly': 'premium',
      'price_premium_yearly': 'premium',
      'price_pro_monthly': 'pro',
      'price_pro_yearly': 'pro'
    };
    
    return tierMapping[priceId] || 'free';
  }
  
  // Get customer's current subscription
  async getCustomerSubscription(customerId) {
    if (!this.stripe) throw new Error('Stripe not initialized');
    
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1
      });
      
      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        return {
          tier: this.determineTierFromSubscription(subscription),
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          subscriptionId: subscription.id
        };
      }
      
      return { tier: 'free', status: 'none' };
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return { tier: 'free', status: 'error' };
    }
  }
  
  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    if (!this.stripe) throw new Error('Stripe not initialized');
    
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
      
      return {
        success: true,
        cancelAt: new Date(subscription.cancel_at * 1000)
      };
    } catch (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }
  
  // Create customer portal session
  async createPortalSession(customerId, returnUrl) {
    if (!this.stripe) throw new Error('Stripe not initialized');
    
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      });
      
      return { url: session.url };
    } catch (error) {
      throw new Error(`Failed to create portal session: ${error.message}`);
    }
  }
  
  // Validate subscription status
  isValidSubscription(subscription) {
    if (!subscription) return false;
    
    const validStatuses = ['active', 'trialing'];
    return validStatuses.includes(subscription.status) && 
           new Date() < subscription.currentPeriodEnd;
  }
}

export { SubscriptionService }; 