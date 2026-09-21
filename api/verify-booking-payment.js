const crypto = require('crypto');
const { json, supabaseFetch } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(res, 400, { success: false, error: 'Missing booking/payment fields.' });
    }
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected); const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(res, 400, { success: false, error: 'Payment signature verification failed.' });

    const rows = await supabaseFetch(`wedding_bookings?select=booking_id,razorpay_order_id,wedding_start_date,wedding_end_date,advance_amount,expires_at,booking_status&booking_id=eq.${encodeURIComponent(booking_id)}&limit=1`);
    const booking = rows?.[0];
    if (!booking) return json(res, 404, { success: false, error: 'Booking not found.' });
    if (booking.razorpay_order_id !== razorpay_order_id) return json(res, 400, { success: false, error: 'Razorpay order does not match this booking.' });
    if (booking.booking_status === 'pending' && booking.expires_at && new Date(booking.expires_at).getTime() <= Date.now()) return json(res, 409, { success: false, error: 'This booking hold has expired. Please start the booking again.' });
    if (booking.booking_status === 'confirmed' && booking.razorpay_payment_id === razorpay_payment_id) return json(res, 200, { success: true, bookingId: booking_id });

    await supabaseFetch(`wedding_bookings?booking_id=eq.${encodeURIComponent(booking_id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        razorpay_payment_id,
        payment_status: 'advance_paid',
        booking_status: 'confirmed',
        advance_paid_amount: booking.advance_amount,
        updated_at: new Date().toISOString(),
        expires_at: null
      })
    });
    return json(res, 200, { success: true, bookingId: booking_id, paymentId: razorpay_payment_id });
  } catch (e) {
    console.error('verify-booking-payment', e);
    return json(res, 500, { success: false, error: 'Unable to confirm the wedding booking.' });
  }
};
