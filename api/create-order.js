const fs = require('fs');
const path = require('path');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function loadProducts() {
  const file = path.join(process.cwd(), 'assets', 'products.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return json(res, 500, { error: 'Razorpay environment variables are missing.' });
    }
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) return json(res, 400, { error: 'No items in order.' });

    const products = loadProducts();
    let total = 0;
    const cleanItems = [];
    for (const item of items) {
      const handle = String(item.handle || '');
      const variantIndex = Number.isInteger(Number(item.variantIndex)) ? Number(item.variantIndex) : 0;
      const qty = Math.max(1, Math.min(50, Number(item.qty) || 1));
      const product = products.find(p => p.handle === handle);
      if (!product) return json(res, 400, { error: `Product not found: ${handle}` });
      const variant = product.variants[variantIndex] || product.variants[0];
      if (!variant || typeof variant.price !== 'number') return json(res, 400, { error: 'Invalid product variant.' });
      total += Number(variant.price) * qty;
      cleanItems.push({ handle, title: product.title, variantIndex, options: variant.options || [], price: variant.price, qty });
    }

    if (total <= 0) return json(res, 400, { error: 'Invalid order total.' });

    const couponCode = String(payload.couponCode || '').trim().toUpperCase();
    const COUPONS = {
      VOWSHOT10: { type: 'percent', value: 10, max: 1000, min: 4999 },
      WELCOME500: { type: 'fixed', value: 500, min: 2999 },
      FRAME500: { type: 'fixed', value: 500, min: 4999 }
    };
    let discount = 0;
    if (couponCode) {
      const coupon = COUPONS[couponCode];
      if (!coupon) return json(res, 400, { error: 'Invalid or unavailable coupon code.' });
      if (total < coupon.min) return json(res, 400, { error: `Minimum order value for ${couponCode} is ₹${coupon.min.toLocaleString('en-IN')}.` });
      discount = coupon.type === 'percent' ? total * coupon.value / 100 : coupon.value;
      if (coupon.max) discount = Math.min(discount, coupon.max);
      discount = Math.min(discount, total);
      discount = Math.round(discount * 100) / 100;
    }
    const finalTotal = Math.round((total - discount) * 100) / 100;
    if (finalTotal <= 0) return json(res, 400, { error: 'Invalid discounted order total.' });
    const receipt = `LP_${Date.now()}`;
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({ amount: Math.round(finalTotal * 100), currency: 'INR', receipt, notes: { source: 'Lightroom Productions Vowshot', customer_name: String(payload.customer?.name || '').slice(0, 200), customer_phone: String(payload.customer?.phone || '').slice(0, 50), coupon_code: couponCode, coupon_discount: discount } })
    });
    const order = await r.json();
    if (!r.ok) return json(res, r.status, { error: order?.error?.description || 'Razorpay order creation failed.' });

    return json(res, 200, {
      orderId: order.id,
      amount: order.amount,
      pricing: { originalTotal: total, discount, total: finalTotal, couponCode: couponCode || null },
      currency: order.currency,
      options: {
        key: process.env.RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Lightroom Productions',
        description: 'Vowshot Product Order',
        order_id: order.id,
        prefill: {
          name: String(payload.customer?.name || ''),
          email: String(payload.customer?.email || ''),
          contact: String(payload.customer?.phone || '')
        },
        notes: { receipt }
      },
      items: cleanItems,
      customer: payload.customer || {}
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Unable to create Razorpay order.' });
  }
};
