/**
 * Lightroom Productions
 * Wedding Date Availability API
 *
 * Endpoint:
 * POST /api/check-availability
 *
 * Checks whether the requested wedding dates overlap
 * with an existing booking in Supabase.
 */

module.exports = async function handler(req, res) {

  /* =====================================================
     ALWAYS RETURN JSON
  ===================================================== */

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );


  /* =====================================================
     CORS
  ===================================================== */

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );


  /* =====================================================
     OPTIONS
  ===================================================== */

  if (req.method === "OPTIONS") {

    return res.status(200).json({
      success: true
    });

  }


  /* =====================================================
     GET = API HEALTH CHECK
  ===================================================== */

  if (req.method === "GET") {

    return res.status(200).json({

      success: true,

      service:
        "Lightroom Productions Wedding Availability API",

      status:
        "online",

      timestamp:
        new Date().toISOString()

    });

  }


  /* =====================================================
     ONLY POST FOR ACTUAL AVAILABILITY CHECK
  ===================================================== */

  if (req.method !== "POST") {

    return res.status(405).json({

      success: false,

      error:
        "Method not allowed. Use POST."

    });

  }


  try {

    /* ===================================================
       ENVIRONMENT VARIABLES
    =================================================== */

    const SUPABASE_URL =
      process.env.SUPABASE_URL;

    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY;


    if (!SUPABASE_URL) {

      console.error(
        "Missing SUPABASE_URL"
      );

      return res.status(500).json({

        success: false,

        error:
          "SUPABASE_URL is not configured on Vercel."

      });

    }


    if (!SUPABASE_SERVICE_ROLE_KEY) {

      console.error(
        "Missing SUPABASE_SERVICE_ROLE_KEY"
      );

      return res.status(500).json({

        success: false,

        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured on Vercel."

      });

    }


    /* ===================================================
       REQUEST BODY
    =================================================== */

    let body = req.body;


    if (
      typeof body === "string"
    ) {

      try {

        body =
          JSON.parse(body);

      } catch (error) {

        return res.status(400).json({

          success: false,

          error:
            "Request body is not valid JSON."

        });

      }

    }


    body =
      body || {};


    /* ===================================================
       ACCEPT MULTIPLE POSSIBLE FIELD NAMES
    =================================================== */

    const start =
      body.start ||
      body.startDate ||
      body.wedding_start_date ||
      body.eventDate;


    const end =
      body.end ||
      body.endDate ||
      body.wedding_end_date ||
      body.eventEndDate ||
      start;


    /* ===================================================
       VALIDATE DATES
    =================================================== */

    if (!start) {

      return res.status(400).json({

        success: false,

        error:
          "Wedding start date is required."

      });

    }


    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid start date. Expected YYYY-MM-DD."

      });

    }


    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid end date. Expected YYYY-MM-DD."

      });

    }


    if (end < start) {

      return res.status(400).json({

        success: false,

        error:
          "End date cannot be before start date."

      });

    }


    /* ===================================================
       SUPABASE REST API
       
       We deliberately use the Supabase REST endpoint
       directly instead of depending on an npm package.
       This makes the Vercel function more reliable.
    =================================================== */

    const supabaseEndpoint =
      SUPABASE_URL.replace(/\/$/, "") +
      "/rest/v1/wedding_bookings";


    const query =
      new URLSearchParams({

        select:
          "id,booking_id,wedding_start_date,wedding_end_date,booking_status",

        wedding_start_date:
          `lte.${end}`,

        wedding_end_date:
          `gte.${start}`,

        limit:
          "100"

      });


    const response =
      await fetch(
        `${supabaseEndpoint}?${query.toString()}`,
        {

          method: "GET",

          headers: {

            apikey:
              SUPABASE_SERVICE_ROLE_KEY,

            Authorization:
              `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

            Accept:
              "application/json"

          }

        }
      );


    /* ===================================================
       READ SUPABASE RESPONSE
    =================================================== */

    const responseText =
      await response.text();


    let rows;


    try {

      rows =
        responseText
          ? JSON.parse(responseText)
          : [];

    } catch (error) {

      console.error(
        "Supabase returned non-JSON:",
        responseText
      );

      return res.status(502).json({

        success: false,

        error:
          "Supabase returned an invalid response."

      });

    }


    /* ===================================================
       SUPABASE ERROR
    =================================================== */

    if (!response.ok) {

      console.error(
        "Supabase availability error:",
        rows
      );


      return res.status(500).json({

        success: false,

        error:
          rows &&
          (
            rows.message ||
            rows.error ||
            rows.hint
          )
            ? (
                rows.message ||
                rows.error ||
                rows.hint
              )
            : "Unable to query wedding bookings.",

        supabaseStatus:
          response.status

      });

    }


    /* ===================================================
       ACTIVE BOOKING STATUSES
       
       Pending bookings are included because a pending
       booking can represent a temporary date hold.

       Confirmed bookings are obviously included.

       Hold / reserved / processing are included if they
       are used by the booking system.
    =================================================== */

    const activeStatuses = [

      "pending",
      "confirmed",
      "hold",
      "held",
      "reserved",
      "processing",
      "payment_pending"

    ];


    /* ===================================================
       FIND OVERLAPPING ACTIVE BOOKINGS
    ===================================================== */

    const bookings =
      Array.isArray(rows)
        ? rows
        : [];


    const conflictingBookings =
      bookings.filter(
        function (booking) {

          const status =
            String(
              booking.booking_status || ""
            ).toLowerCase();


          /*
           * If booking_status is empty, do not treat the
           * row as an active booking automatically.
           */

          if (
            status &&
            !activeStatuses.includes(status)
          ) {

            return false;

          }


          const bookingStart =
            booking.wedding_start_date;


          const bookingEnd =
            booking.wedding_end_date ||
            booking.wedding_start_date;


          if (!bookingStart) {

            return false;

          }


          /*
           * Overlap rule:
           *
           * Existing Start <= Requested End
           * AND
           * Existing End >= Requested Start
           */

          return (
            bookingStart <= end &&
            bookingEnd >= start
          );

        }
      );


    /* ===================================================
       AVAILABLE
    ===================================================== */

    if (
      conflictingBookings.length === 0
    ) {

      return res.status(200).json({

        success: true,

        available: true,

        startDate:
          start,

        endDate:
          end,

        conflicts: [],

        message:
          "Wedding date is available."

      });

    }


    /* ===================================================
       NOT AVAILABLE
    ===================================================== */

    return res.status(200).json({

      success: true,

      available: false,

      startDate:
        start,

      endDate:
        end,

      conflicts:
        conflictingBookings.map(
          function (booking) {

            return {

              bookingId:
                booking.booking_id ||
                null,

              startDate:
                booking.wedding_start_date,

              endDate:
                booking.wedding_end_date ||
                booking.wedding_start_date,

              status:
                booking.booking_status ||
                "pending"

            };

          }
        ),

      message:
        "The requested wedding date overlaps with an existing booking."

    });


  } catch (error) {

    /* ===================================================
       FINAL ERROR HANDLER
    ===================================================== */

    console.error(
      "CHECK AVAILABILITY ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error &&
        error.message
          ? error.message
          : "Unable to check wedding date availability."

    });

  }

};