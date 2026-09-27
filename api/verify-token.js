/**
 * Vercel Serverless Function - Token Verification
 *
 * This function handles token verification by proxying the request
 * to the Salla exchange authority service.
 */

// Environment-based API URLs
const VERIFY_API_URLS = {
  dev: "https://exchange-authority-service-dev-62.merchants.workers.dev/exchange-authority/v1/verify",
  prod: "https://api.salla.dev/exchange-authority/v1/verify",
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse request body (Vercel parses JSON bodies automatically)
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};
    const { token, iss, subject, appId } = body;

    // Validate required fields
    if (!token) {
      return res
        .status(400)
        .json({ success: false, error: "Token is required" });
    }

    // Validate app ID
    if (!appId) {
      return res
        .status(400)
        .json({ success: false, error: "App ID is required" });
    }

    // Determine environment (default to 'prod'; set ENV=dev to use Salla's internal dev service)
    const environment = process.env.ENV || "prod";

    // Get API URL based on environment
    const apiUrl = VERIFY_API_URLS[environment];
    if (!apiUrl) {
      return res.status(400).json({
        success: false,
        error: `Invalid environment: ${environment}. Must be 'dev' or 'prod'`,
      });
    }

    // Debug log request details
    console.log("Verifying token with Salla API", {
      apiUrl: apiUrl,
      appId,
      token: token ? "[REDACTED]" : undefined,
      iss: iss || "merchant-dashboard",
      subject: subject || "embedded-page",
      env: environment,
    });

    // Make request to Salla API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "s-source": appId, // APP ID (dynamic)
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        iss: iss || "merchant-dashboard",
        subject: subject || "embedded-page",
        env: environment,
      }),
    });

    // Debug log response status
    console.log("Salla API response status:", response.status);

    // Salla may answer with a non-JSON body (e.g. an HTML error page)
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      console.error("Non-JSON response from Salla API:", text.slice(0, 200));
      return res.status(502).json({
        success: false,
        error: `Salla verify API (${environment}) returned a non-JSON response with status ${response.status}`,
      });
    }

    // Return the result with appropriate status code
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow CORS
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(response.status).json(result);
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
