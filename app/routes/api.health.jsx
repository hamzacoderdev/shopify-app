import { json } from "@remix-run/node";

// Simple health check endpoint
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const loader = () => {
  return json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      message: "Order processing API is running",
      endpoints: {
        "POST /api/process-orders": "Main order processing endpoint",
        "POST /resources/bulk-order-details": "Legacy bulk order details",
        "POST /api/test-order": "Test order processing setup",
        "GET /api/debug-headers": "Debug CORS and headers",
      }
    },
    { headers: corsHeaders }
  );
};

export const action = () => {
  return json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      message: "POST requests working",
    },
    { headers: corsHeaders }
  );
};