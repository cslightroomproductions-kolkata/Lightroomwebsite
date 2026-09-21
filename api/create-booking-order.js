const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { json, supabaseRpc, supabaseFetch } = require("./_supabase");

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

  // Read the existing PACKAGE_GROUPS object
  // without requiring packages.js as a Node module.
  const result = vm.runInNewContext(
    `${source}\nPACKAGE_GROUPS;`,
    {}
  );

  if (!result || typeof result !== "object") {
    throw new Error("Unable to read wedding packages.");
  }

  return result;
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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, {
      error: "Method not allowed"
    });
  }

  try {
    // --------------------------------------------------
    // ENVIRONMENT CHECK
    // --------------------------------------------------

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      return json(res, 500, {
        error: "Razorpay environment variables are missing."
      });
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(res, 500, {
        error: "Supabase server environment variables are missing."
      });
    }

    // --------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const pkgName = clean(
      payload.package?.name,
      120
    );

    // --------------------------------------------------
    // SERVER-SIDE PACKAGE VALIDATION
    // --------------------------------------------------

    const packages = allPackages();

    const pkg = packages.find(
      (item) => item.name === pkgName
    );

    if (!pkg) {
      return json(res, 400, {
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

    const functions = Array.isArray(
      payload.functions
    )
      ? payload.functions
          .map((item) => clean(item, 250))
          .slice(0, 30)
      : [];

    // --------------------------------------------------
    // GUESTS / REQUIREMENTS
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
        error:
          "Please complete the customer and venue details."
      });
    }

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
    // CREATE BOOKING + RESERVE DATES
    // --------------------------------------------------

    const rpcResult = await supabaseRpc(
      "create_wedding_booking",
      {
        p_booking_id: bookingId,

        p_customer_name: bride,

        p_customer_phone: phone,

        p_customer_email: email,

        p_package_name: pkg.name,

        p_package_price: total,

        p_wedding_start_date: start,

        p_wedding_end_date: end,

        p_functions:
          functions.join(" • "),

        p_venue_name: venue,

        p_venue_address: address,

        p_city: city,

        p_guest_count:
          guests || null,

        p_special_requirements:
          requirements,

        p_advance_amount:
          advance,

        p_event_end_amount:
          eventEnd,

        p_deliverables_amount:
          deliverables,

        p_balance_amount:
          balance,

        p_expires_minutes: 30
      }
    );

    const booking =
      Array.isArray(rpcResult)
        ? rpcResult[0]
        : rpcResult;

    if (!booking?.booking_id) {
      return json(res, 409, {
        error:
          "Those dates are currently unavailable. Please choose different dates."
      });
    }

    // --------------------------------------------------
    // CREATE RAZORPAY ORDER
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
                advance * 100
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

              payment_stage:
                "30_percent_booking_advance"
            }
          })
        }
      );

    const orderText =
      await razorpayResponse.text();

    let order;

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
    // RETURN CHECKOUT DATA
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

      paymentSchedule: {
        advance,
        eventEnd,
        deliverables
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
          `Wedding booking advance — ${pkg.name}`,

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
            pkg.name
        }
      }
    });

  } catch (error) {
    console.error(
      "create-booking-order:",
      error
    );

    const status =
      error?.status === 409
        ? 409
        : 500;

    return json(res, status, {
      error:
        error?.message ||
        "Unable to create wedding booking."
    });
  }
};
