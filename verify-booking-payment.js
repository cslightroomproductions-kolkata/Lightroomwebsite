const crypto = require("crypto");
const { json, supabaseFetch } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      return json(res, 500, {
        success: false,
        error:
          "Razorpay environment variables are missing."
      });
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(res, 500, {
        success: false,
        error:
          "Supabase environment variables are missing."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const bookingId =
      String(body.booking_id || "").trim();

    const razorpayOrderId =
      String(
        body.razorpay_order_id || ""
      ).trim();

    const razorpayPaymentId =
      String(
        body.razorpay_payment_id || ""
      ).trim();

    const razorpaySignature =
      String(
        body.razorpay_signature || ""
      ).trim();

    if (
      !bookingId ||
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return json(res, 400, {
        success: false,
        error:
          "Incomplete Razorpay payment verification data."
      });
    }

    // --------------------------------------------------
    // GET BOOKING
    // --------------------------------------------------

    const bookingResponse =
      await supabaseFetch(
        `wedding_bookings?booking_id=eq.${encodeURIComponent(
          bookingId
        )}&select=*`,
        {
          method: "GET"
        }
      );

    const booking =
      Array.isArray(bookingResponse)
        ? bookingResponse[0]
        : bookingResponse;

    if (!booking) {
      return json(res, 404, {
        success: false,
        error:
          "Booking record was not found."
      });
    }

    // --------------------------------------------------
    // VERIFY ORDER ID
    // --------------------------------------------------

    if (
      booking.razorpay_order_id &&
      booking.razorpay_order_id !==
        razorpayOrderId
    ) {
      return json(res, 400, {
        success: false,
        error:
          "Razorpay order does not match this booking."
      });
    }

    // --------------------------------------------------
    // VERIFY RAZORPAY SIGNATURE
    // --------------------------------------------------

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(
          `${razorpayOrderId}|${razorpayPaymentId}`
        )
        .digest("hex");

    const signaturesMatch =
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpaySignature)
      );

    if (!signaturesMatch) {
      return json(res, 400, {
        success: false,
        error:
          "Razorpay payment signature verification failed."
      });
    }

    // --------------------------------------------------
    // FETCH RAZORPAY ORDER
    //
    // This lets us determine whether the customer
    // actually paid 30% or 100%.
    // --------------------------------------------------

    const auth =
      Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString("base64");

    const orderResponse =
      await fetch(
        `https://api.razorpay.com/v1/orders/${encodeURIComponent(
          razorpayOrderId
        )}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Basic ${auth}`
          }
        }
      );

    const orderText =
      await orderResponse.text();

    let order = {};

    try {
      order = orderText
        ? JSON.parse(orderText)
        : {};
    } catch {
      order = {};
    }

    if (!orderResponse.ok) {
      return json(
        res,
        orderResponse.status,
        {
          success: false,
          error:
            order?.error?.description ||
            "Unable to verify Razorpay order."
        }
      );
    }

    // --------------------------------------------------
    // DETERMINE PAYMENT TYPE FROM ACTUAL ORDER AMOUNT
    // --------------------------------------------------

    const packagePrice =
      Number(booking.package_price || 0);

    const fullAmountPaise =
      Math.round(
        packagePrice * 100
      );

    const advanceAmountPaise =
      Math.round(
        packagePrice * 0.30 * 100
      );

    const paidAmount =
      Number(order.amount || 0);

    let paymentType = "advance";

    if (
      paidAmount === fullAmountPaise
    ) {
      paymentType = "full";
    } else if (
      paidAmount === advanceAmountPaise
    ) {
      paymentType = "advance";
    } else {
      return json(res, 400, {
        success: false,
        error:
          "The Razorpay payment amount does not match the booking amount."
      });
    }

    // --------------------------------------------------
    // UPDATE BOOKING
    // --------------------------------------------------

    const isFullPayment =
      paymentType === "full";

    const newBalance =
      isFullPayment
        ? 0
        : Number(
            booking.balance_amount || 0
          );

    const updateData = {
      razorpay_payment_id:
        razorpayPaymentId,

      payment_status:
        isFullPayment
          ? "full_paid"
          : "advance_paid",

      booking_status:
        "confirmed",

      balance_amount:
        newBalance,

      updated_at:
        new Date().toISOString()
    };

    await supabaseFetch(
      `wedding_bookings?booking_id=eq.${encodeURIComponent(
        bookingId
      )}`,
      {
        method: "PATCH",

        headers: {
          Prefer: "return=minimal"
        },

        body: JSON.stringify(updateData)
      }
    );

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return json(res, 200, {
      success: true,

      bookingId,

      paymentId:
        razorpayPaymentId,

      orderId:
        razorpayOrderId,

      paymentType,

      amount:
        paidAmount / 100,

      paymentStatus:
        isFullPayment
          ? "full_paid"
          : "advance_paid",

      bookingStatus:
        "confirmed",

      balance:
        newBalance
    });

  } catch (error) {
    console.error(
      "verify-booking-payment:",
      error
    );

    return json(res, 500, {
      success: false,
      error:
        error?.message ||
        "Payment verification failed."
    });
  }
};
