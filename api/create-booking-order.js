const crypto = require("crypto");
const { json, supabaseFetch } = require("./_supabase");

// =====================================================
// CANONICAL WEDDING PACKAGES
// Server does NOT depend on packages.js anymore.
// =====================================================

const PACKAGES = {
  "Shubh Aarambh": 34999,
  "Mangal Milan": 44999,
  "Rajsi Vivaah": 54999,
  "Royal Utsav": 64999,
  "Swarna Mahotsav": 74999,
  "Maharaja Signature": 84999,
  "Imperial Dynasty": 99999,
  "Raj Mahal Elite": 124999,
  "Crown Legacy": 149999,

  "Royal Sangam": 89999,
  "Maharaja Sangam": 109999,
  "Rajwada Heritage": 129999,
  "Imperial Vivaah": 149999,
  "Maharani Collection": 174999,
  "Royal Dynasty": 199999
};

// =====================================================
// HELPERS
// =====================================================

function clean(value, max = 1000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value)
  );
}

function money(value) {
  return Math.round(
    Number(value) * 100
  ) / 100;
}

// =====================================================
// HANDLER
// =====================================================

module.exports = async function handler(req, res) {

  // Always return JSON
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).json({
      success: true
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    // =================================================
    // ENVIRONMENT CHECK
    // =================================================

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      return res.status(500).json({
        success: false,
        error:
          "Razorpay environment variables are missing."
      });
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({
        success: false,
        error:
          "Supabase server environment variables are missing."
      });
    }

    // =================================================
    // REQUEST BODY
    // =================================================

    let payload = req.body;

    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        return res.status(400).json({
          success: false,
          error: "Invalid JSON request."
        });
      }
    }

    payload = payload || {};

    // =================================================
    // PACKAGE
    // =================================================

    const packageName = clean(
      payload.package?.name,
      150
    );

    const packagePrice =
      PACKAGES[packageName];

    if (!packagePrice) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid wedding package: " +
          packageName
      });
    }

    // =================================================
    // DATES
    // =================================================

    const start = clean(
      payload.dates?.start,
      10
    );

    const end = clean(
      payload.dates?.end || start,
      10
    );

    if (
      !validDate(start) ||
      !validDate(end)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please select valid wedding dates."
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        error:
          "End date cannot be before start date."
      });
    }

    // =================================================
    // CUSTOMER
    // =================================================

    const bride = clean(
      payload.client?.bride,
      150
    );

    const groom = clean(
      payload.client?.groom,
      150
    );

    const phone = clean(
      payload.client?.phone,
      40
    );

    const email = clean(
      payload.client?.email,
      180
    );

    if (
      !bride ||
      !phone ||
      !email
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please complete the customer details."
      });
    }

    // =================================================
    // VENUE
    // =================================================

    const venue = clean(
      payload.venue?.name,
      250
    );

    const city = clean(
      payload.venue?.city,
      120
    );

    const address = clean(
      payload.venue?.address,
      1500
    );

    if (
      !venue ||
      !city ||
      !address
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please complete the venue details."
      });
    }

    // =================================================
    // FUNCTIONS
    // =================================================

    const functions =
      Array.isArray(payload.functions)
        ? payload.functions
            .map(
              item =>
                clean(item, 250)
            )
            .filter(Boolean)
            .slice(0, 30)
        : [];

    // =================================================
    // OTHER DETAILS
    // =================================================

    const guests = Math.max(
      0,
      Math.min(
        100000,
        Number(payload.guests) || 0
      )
    );

    const requirements = clean(
      payload.requirements,
      1500
    );

    // =================================================
    // PAYMENT TYPE
    //
    // advance = 30%
    // full    = 100%
    // =================================================

    const paymentType =
      payload.paymentType === "full"
        ? "full"
        : "advance";

    // =================================================
    // PAYMENT CALCULATION
    // =================================================

    const total =
      money(packagePrice);

    const advance =
      money(total * 0.30);

    const eventEnd =
      money(total * 0.50);

    const deliverables =
      money(
        total -
        advance -
        eventEnd
      );

    const remainingBalance =
      money(
        total -
        advance
      );

    const payableNow =
      paymentType === "full"
        ? total
        : advance;

    // =================================================
    // BOOKING ID
    // =================================================

    const bookingId =
      "LPW-" +
      new Date()
        .getFullYear() +
      "-" +
      crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();

    // =================================================
    // CREATE SUPABASE BOOKING
    //
    // IMPORTANT:
    // NO DATE CONFLICT CHECK.
    //
    // Multiple bookings on same date are allowed.
    // =================================================

    const bookingData = {

      booking_id:
        bookingId,

      customer_name:
        bride,

      customer_phone:
        phone,

      customer_email:
        email,

      package_name:
        packageName,

      package_price:
        total,

      wedding_start_date:
        start,

      wedding_end_date:
        end,

      functions:
        functions.join(" • "),

      venue_name:
        venue,

      venue_address:
        address,

      city:
        city,

      guest_count:
        guests || null,

      special_requirements:
        requirements,

      advance_amount:
        advance,

      balance_amount:
        paymentType === "full"
          ? 0
          : remainingBalance,

      payment_status:
        "pending",

      booking_status:
        "pending"
    };

    console.log(
      "Creating wedding booking:",
      bookingId
    );

    const bookingResponse =
      await supabaseFetch(
        "wedding_bookings",
        {
          method: "POST",

          headers: {
            Prefer:
              "return=representation"
          },

          body:
            JSON.stringify(
              bookingData
            )
        }
      );

    const booking =
      Array.isArray(
        bookingResponse
      )
        ? bookingResponse[0]
        : bookingResponse;

    if (
      !booking ||
      !booking.booking_id
    ) {
      console.error(
        "Supabase booking response:",
        bookingResponse
      );

      return res.status(500).json({
        success: false,
        error:
          "Supabase did not create the booking."
      });
    }

    // =================================================
    // CREATE RAZORPAY ORDER
    // =================================================

    const auth =
      Buffer.from(
        process.env.RAZORPAY_KEY_ID +
        ":" +
        process.env.RAZORPAY_KEY_SECRET
      ).toString("base64");

    const razorpayResponse =
      await fetch(
        "https://api.razorpay.com/v1/orders",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              "Basic " + auth
          },

          body:
            JSON.stringify({

              amount:
                Math.round(
                  payableNow * 100
                ),

              currency:
                "INR",

              receipt:
                bookingId
                  .replace(
                    /[^A-Za-z0-9_-]/g,
                    ""
                  )
                  .slice(0, 40),

              notes: {

                source:
                  "Lightroom Productions",

                booking_id:
                  bookingId,

                package:
                  packageName,

                payment_type:
                  paymentType,

                event_start:
                  start,

                event_end:
                  end

              }

            })
        }
      );

    const razorpayText =
      await razorpayResponse.text();

    let razorpayOrder = {};

    try {
      razorpayOrder =
        razorpayText
          ? JSON.parse(
              razorpayText
            )
          : {};
    } catch {
      razorpayOrder = {};
    }

    if (
      !razorpayResponse.ok ||
      !razorpayOrder.id
    ) {

      console.error(
        "Razorpay error:",
        razorpayOrder
      );

      return res.status(
        razorpayResponse.status || 500
      ).json({
        success: false,
        error:
          razorpayOrder?.error
            ?.description ||
          "Razorpay order creation failed."
      });
    }

    // =================================================
    // SAVE RAZORPAY ORDER ID
    // =================================================

    await supabaseFetch(
      "wedding_bookings?booking_id=eq." +
        encodeURIComponent(
          bookingId
        ),
      {
        method: "PATCH",

        headers: {
          Prefer:
            "return=minimal"
        },

        body:
          JSON.stringify({

            razorpay_order_id:
              razorpayOrder.id,

            updated_at:
              new Date().toISOString()

          })
      }
    );

    // =================================================
    // FINAL RESPONSE
    // =================================================

    return res.status(200).json({

      success: true,

      bookingId:
        bookingId,

      orderId:
        razorpayOrder.id,

      amount:
        razorpayOrder.amount,

      currency:
        "INR",

      packageName:
        packageName,

      packagePrice:
        total,

      paymentType:
        paymentType,

      payableAmount:
        payableNow,

      paymentSchedule: {

        total:
          total,

        advance:
          advance,

        eventEnd:
          eventEnd,

        deliverables:
          deliverables,

        balance:
          paymentType === "full"
            ? 0
            : remainingBalance

      },

      options: {

        key:
          process.env.RAZORPAY_KEY_ID,

        amount:
          razorpayOrder.amount,

        currency:
          "INR",

        name:
          "Lightroom Productions",

        description:
          paymentType === "full"
            ? "Full Wedding Payment - " +
              packageName
            : "Wedding Booking Advance - " +
              packageName,

        order_id:
          razorpayOrder.id,

        prefill: {

          name:
            groom
              ? bride +
                " & " +
                groom
              : bride,

          email:
            email,

          contact:
            phone

        },

        notes: {

          booking_id:
            bookingId,

          package:
            packageName,

          payment_type:
            paymentType

        },

        theme: {

          color:
            "#D4AF37"

        }

      }

    });

  } catch (error) {

    console.error(
      "CREATE BOOKING ERROR:",
      error
    );

    // IMPORTANT:
    // Always return JSON, never an HTML error page.
    return res.status(500).json({

      success: false,

      error:
        error?.message ||
        "Unable to create wedding booking."

    });

  }

};
