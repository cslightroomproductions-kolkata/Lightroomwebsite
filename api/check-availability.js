module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ success: true });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      service: "Lightroom Productions Wedding Availability API",
      status: "online",
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

    const start = String(body.start || "").trim();
    const end = String(body.end || body.start || "").trim();

    if (!start) {
      return res.status(400).json({
        success: false,
        error: "Wedding start date is required."
      });
    }

    if (!end) {
      return res.status(400).json({
        success: false,
        error: "Wedding end date is required."
      });
    }

    // Clean Supabase environment variables
    let supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
    let serviceKey = String(
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    ).trim();

    // Remove accidental quotes copied into Vercel
    supabaseUrl = supabaseUrl.replace(/^["']|["']$/g, "");
    serviceKey = serviceKey.replace(/^["']|["']$/g, "");

    // Remove trailing slash
    supabaseUrl = supabaseUrl.replace(/\/+$/, "");

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is missing in Vercel.");
    }

    if (!serviceKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is missing in Vercel."
      );
    }

    // Validate Supabase URL
    let baseUrl;

    try {
      baseUrl = new URL(supabaseUrl);
    } catch (error) {
      throw new Error(
        "SUPABASE_URL is invalid. Check the Vercel environment variable."
      );
    }

    // Build Supabase REST URL safely
    const apiUrl = new URL(
      "/rest/v1/wedding_bookings",
      baseUrl
    );

    apiUrl.searchParams.set(
      "select",
      "id,booking_id,wedding_start_date,wedding_end_date,booking_status"
    );

    // Date overlap:
    // existing start <= requested end
    // existing end >= requested start
    apiUrl.searchParams.set(
      "wedding_start_date",
      `lte.${end}`
    );

    apiUrl.searchParams.set(
      "wedding_end_date",
      `gte.${start}`
    );

    apiUrl.searchParams.set(
      "booking_status",
      "in.(pending,confirmed,hold,held,reserved,processing,payment_pending)"
    );

    apiUrl.searchParams.set("limit", "100");

    const response = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json"
      }
    });

    const responseText = await response.text();

    let data = [];

    try {
      data = responseText ? JSON.parse(responseText) : [];
    } catch {
      throw new Error(
        `Supabase returned an invalid response: ${responseText.slice(0, 500)}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.error_description ||
        data?.hint ||
        data?.error ||
        `Supabase request failed with status ${response.status}`
      );
    }

    const bookings = Array.isArray(data) ? data : [];

    return res.status(200).json({
      success: true,
      available: bookings.length === 0,
      requestedStart: start,
      requestedEnd: end,
      conflictingBookings: bookings.map((booking) => ({
        booking_id: booking.booking_id,
        wedding_start_date: booking.wedding_start_date,
        wedding_end_date: booking.wedding_end_date,
        booking_status: booking.booking_status
      }))
    });

  } catch (error) {
    console.error("CHECK AVAILABILITY ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Unable to check wedding date availability."
    });
  }
};
