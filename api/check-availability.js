module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

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
    const { start, end } = req.body || {};

    if (!start) {
      return res.status(400).json({
        success: false,
        error: "Start date is required"
      });
    }

    const weddingEnd = end || start;

    let supabaseUrl = String(
      process.env.SUPABASE_URL || ""
    ).trim();

    let serviceKey = String(
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    ).trim();

    supabaseUrl = supabaseUrl
      .replace(/^["']|["']$/g, "")
      .replace(/\/+$/, "");

    serviceKey = serviceKey
      .replace(/^["']|["']$/g, "");

    if (!supabaseUrl) {
      return res.status(500).json({
        success: false,
        error: "SUPABASE_URL is missing"
      });
    }

    if (!serviceKey) {
      return res.status(500).json({
        success: false,
        error: "SUPABASE_SERVICE_ROLE_KEY is missing"
      });
    }

    const apiUrl =
      `${supabaseUrl}/rest/v1/wedding_bookings` +
      `?select=id,booking_id,wedding_start_date,wedding_end_date,booking_status` +
      `&wedding_start_date=lte.${encodeURIComponent(weddingEnd)}` +
      `&wedding_end_date=gte.${encodeURIComponent(start)}` +
      `&booking_status=in.(pending,confirmed,hold,held,reserved,processing,payment_pending)` +
      `&limit=100`;

    let response;

    try {
      response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json"
        }
      });
    } catch (fetchError) {
      return res.status(500).json({
        success: false,
        error: "Supabase connection failed",
        details: fetchError?.message || String(fetchError),
        supabaseHost: (() => {
          try {
            return new URL(supabaseUrl).host;
          } catch {
            return "INVALID_URL";
          }
        })()
      });
    }

    const text = await response.text();

    let data;

    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      return res.status(500).json({
        success: false,
        error: "Supabase returned invalid JSON",
        status: response.status,
        response: text.slice(0, 1000)
      });
    }

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: "Supabase API returned an error",
        status: response.status,
        details: data
      });
    }

    const bookings = Array.isArray(data) ? data : [];

    return res.status(200).json({
      success: true,
      available: bookings.length === 0,
      requestedStart: start,
      requestedEnd: weddingEnd,
      conflictingBookings: bookings
    });

  } catch (error) {
    console.error("Availability error:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Unknown server error",
      name: error?.name || "Error"
    });
  }
};
