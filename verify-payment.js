const crypto = require('crypto');
function json(res, status, body) { res.statusCode=status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)); }
module.exports = async (req,res) => {
  if (req.method !== 'POST') return json(res,405,{error:'Method not allowed'});
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return json(res,400,{error:'Missing Razorpay payment fields.'});
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(razorpay_signature)));
    if (!valid) return json(res,400,{success:false,error:'Payment signature verification failed.'});
    return json(res,200,{success:true,orderId:razorpay_order_id,paymentId:razorpay_payment_id});
  } catch(e) { console.error(e); return json(res,500,{success:false,error:'Payment verification failed.'}); }
};
