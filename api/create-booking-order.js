const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { json, supabaseFetch } = require("./_supabase");

function readPackages() {
  const filePath = path.join(
    process.cwd(),
    "assets",
    "packages.js"
  );

  if (!fs.existsSync(filePath)) {
    throw new Error("Package file not found: assets/packages.js");
  }

  const source = fs.readFileSync(filePath, "utf8");

  const context = {};
  vm.runInNewContext(
    `${source}\nPACKAGE_GROUPS;`,
    context
  );

  return context.PACKAGE_GROUPS;
}

function allPackages() {
  const groups = readPackages();

  return Object.values(groups)
    .flat()
    .filter(
      (pkg) =>
        pkg &&
        typeof pkg.name === "string" &&
        typeof pkg.price === "number"
    );
}

function clean(value, max = 1000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function rupees(value) {
  return Math.round(Number(value) * 100) / 100;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    // --------------------------------------------------
    // ENVIRONMENT
    // --------------------------------------------------

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      return json(res, 500, {
        success: false,
        error: "Razorpay environment variables are missing."
      });
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(res, 500, {
        success: false,
        error: "Supabase server environment variables are missing."
      });
    }

    // --------------------------------------------------
    // REQUEST
    // --------------------------------------------------

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    // --------------------------------------------------
    // PACKAGE
    // --------------------------------------------------

    const packageName = clean(
      payload.package?.name,
      120
    );

    const packages = allPackages();

    const pkg = packages.find(
      (item) => item.name === packageName
    );

    if (!pkg) {
      return json(res, 400, {
        success: false,
        error: "Invalid wedding package."
      });
    }

    // --------------------------------------------------
    // DATES
    // --------------------------------------------------

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
      !validDate(end) ||
      start > end
    ) {
      return json(res, 400, {
        success: false,
        error:
          "Please select a valid event start and end date."
      });
    }

    // --------------------------------------------------
    // CUSTOMER
    // --------------------------------------------------

    const bride = clean(
      payload.client?.bride,
      120
    );

    const groom = clean(
      payload.client?.groom,
      120
    );

    const phone = clean(
      payload.client?.phone,
      30
    );

    const email = clean(
      payload.client?.email,
      160
    );

    // --------------------------------------------------
    // VENUE
    // --------------------------------------------------

    const venue = clean(
      payload.venue?.name,
      200
    );

    const city = clean(
      payload.venue?.city,
      100
    );

    const address = clean(
      payload.venue?.address,
      1200
    );

    // --------------------------------------------------
    // FUNCTIONS
    // --------------------------------------------------

    const functions =
      Array.isArray(payload.functions)
        ? payload.functions
            .map((item) => clean(item, 250))
            .slice(0, 30)
        : [];

    // --------------------------------------------------
    // GUESTS
    // --------------------------------------------------

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

    if (
      !bride ||
      !phone ||
      !email ||
      !venue ||
      !city ||
      !address
    ) {
      return json(res, 400, {
        success: false,
        error:
          "Please complete the customer and venue details."
      });
    }

    // --------------------------------------------------
    // PAYMENT TYPE
    //
    // advance = 30%
    // full    = 100%
    // --------------------------------------------------

    const paymentType =
      payload.paymentType === "full"
        ? "full"
        : "advance";

    // --------------------------------------------------
    // PAYMENT CALCULATION
    // --------------------------------------------------

    const total = rupees(pkg.price);

    const advance = rupees(
      total * 0.30
    );

    const eventEnd = rupees(
      total * 0.50
    );

    const deliverables = rupees(
      total - advance - eventEnd
    );

    const balance = rupees(
      total - advance
    );

    const payableAmount =
      paymentType === "full"
        ? total
        : advance;

    // --------------------------------------------------
    // BOOKING ID
    // --------------------------------------------------

    const bookingId =
      `LPW-${new Date().getFullYear()}-` +
      crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();

    // --------------------------------------------------
    // DIRECT SUPABASE INSERT
    //
    // IMPORTANT:
    // There is NO date conflict check.
    //
    // Multiple bookings on the same date are allowed.
    // --------------------------------------------------

    const bookingResponse =
      await supabaseFetch(
        "wedding_bookings",
        {
          method: "POST",

          headers: {
            Prefer: "return=representation"
          },

          body: JSON.stringify({
            booking_id: bookingId,

            customer_name: bride,

            customer_phone: phone,

            customer_email: email,

            package_name: pkg.name,

            package_price: total,

            wedding_start_date: start,

            wedding_end_date: end,

            functions:
              functions.join(" • "),

            venue_name: venue,

            venue_address: address,

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
                : balance,

            payment_status:
              "pending",

            booking_status:
              "pending"
          }
        }
      );

    const booking =
      Array.isArray(bookingResponse)
        ? bookingResponse[0]
        : bookingResponse;

    if (!booking?.booking_id) {
      throw new Error(
        "Booking could not be created in Supabase."
      );
    }

    // --------------------------------------------------
    // RAZORPAY ORDER
    // --------------------------------------------------

    const receipt =
      booking.booking_id
        .replace(/[^A-Za-z0-9_-]/g, "")
        .slice(0, 40);

    const auth =
      Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
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
              `Basic ${auth}`
          },

          body: JSON.stringify({
            amount:
              Math.round(
                payableAmount * 100
              ),

            currency: "INR",

            receipt,

            notes: {
              source:
                "Lightroom Productions Wedding Booking",

              booking_id:
                booking.booking_id,

              package:
                pkg.name,

              event_start:
                start,

              event_end:
                end,

              payment_type:
                paymentType,

              payment_stage:
                paymentType === "full"
                  ? "100_percent_full_payment"
                  : "30_percent_booking_advance"
            }
          })
        }
      );

    const orderText =
      await razorpayResponse.text();

    let order = {};

    try {
      order = orderText
        ? JSON.parse(orderText)
        : {};
    } catch {
      order = {};
    }

    if (!razorpayResponse.ok) {
      return json(
        res,
        razorpayResponse.status,
        {
          success: false,
          error:
            order?.error?.description ||
            "Razorpay order creation failed."
        }
      );
    }

    // --------------------------------------------------
    // SAVE RAZORPAY ORDER ID
    // --------------------------------------------------

    await supabaseFetch(
      `wedding_bookings?booking_id=eq.${encodeURIComponent(
        booking.booking_id
      )}`,
      {
        method: "PATCH",

        headers: {
          Prefer: "return=minimal"
        },

        body: JSON.stringify({
          razorpay_order_id:
            order.id,

          updated_at:
            new Date().toISOString()
        })
      }
    );

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return json(res, 200, {
      success: true,

      bookingId:
        booking.booking_id,

      orderId:
        order.id,

      amount:
        order.amount,

      currency:
        order.currency,

      packageName:
        pkg.name,

      packagePrice:
        total,

      paymentType,

      payableAmount,

      paymentSchedule: {
        total,
        advance,
        eventEnd,
        deliverables,

        balance:
          paymentType === "full"
            ? 0
            : balance
      },

      options: {
        key:
          process.env.RAZORPAY_KEY_ID,

        amount:
          order.amount,

        currency:
          order.currency,

        name:
          "Lightroom Productions",

        description:
          paymentType === "full"
            ? `Full wedding payment — ${pkg.name}`
            : `Wedding booking advance — ${pkg.name}`,

        order_id:
          order.id,

        prefill: {
          name:
            groom
              ? `${bride} & ${groom}`
              : bride,

          email,

          contact:
            phone
        },

        notes: {
          booking_id:
            booking.booking_id,

          package:
            pkg.name,

          payment_type:
            paymentType
        },

        theme: {
          color: "#D4AF37"
        }
      }
    });

  } catch (error) {
    console.error(
      "create-booking-order:",
      error
    );

    return json(res, 500, {
      success: false,
      error:
        error?.message ||
        "Unable to create wedding booking."
    });
  }
};
