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
      multipleBookings: true,
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
    const end = String(body.end || start).trim();

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

    /*
      Multiple bookings are allowed.

      We intentionally do NOT query existing bookings
      and do NOT reject dates that already have bookings.
    */

    return res.status(200).json({
      success: true,
      available: true,
      multipleBookings: true,
      requestedStart: start,
      requestedEnd: end,
      conflictingBookings: []
    });

  } catch (error) {
    console.error("availability:", error);

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Unable to check wedding date availability."
    });
  }
};
