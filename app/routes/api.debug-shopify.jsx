import { json } from "@remix-run/node";
import { authenticate, apiVersion } from "../shopify.server";
import axios from "axios";

// Enhanced CORS headers for extension compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

// Handle CORS preflight
export const loader = ({ request }) => {
  console.log("🔄 CORS preflight request received for debug-shopify");
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

// Debug Shopify API access
export const action = async ({ request }) => {
  console.log("🔍 Debug Shopify API request received");

  if (request.method !== "POST") {
    return json(
      { error: `Method ${request.method} not allowed` },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Parse request body
    const { orderId } = await request.json();
    
    if (!orderId) {
      return json(
        { error: "orderId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("🔐 Authenticating request...");
    
    // Authenticate the session
    const { session } = await authenticate.admin(request);
    const { shop, accessToken } = session;
    
    console.log("✅ Authentication successful for shop:", shop);
    console.log("🔗 Using API version:", apiVersion);
    console.log("🔑 Access token length:", accessToken?.length || 0);
    
    // Test different API endpoints to see what works
    const testEndpoints = [
      `/admin/api/${apiVersion}/orders.json?limit=1`,
      `/admin/api/${apiVersion}/orders/${orderId}.json`,
      `/admin/api/2024-07/orders/${orderId}.json`,
      `/admin/api/2024-01/orders/${orderId}.json`,
    ];

    const results = [];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`🧪 Testing endpoint: ${endpoint}`);
        
        const response = await axios.get(
          `https://${shop}${endpoint}`,
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            timeout: 5000,
          }
        );

        results.push({
          endpoint,
          status: response.status,
          success: true,
          dataKeys: Object.keys(response.data || {}),
        });
        
        console.log(`✅ ${endpoint} - SUCCESS (${response.status})`);
        
      } catch (error) {
        results.push({
          endpoint,
          status: error.response?.status || 'NETWORK_ERROR',
          success: false,
          error: error.message,
          details: error.response?.data,
        });
        
        console.log(`❌ ${endpoint} - FAILED (${error.response?.status || 'NETWORK_ERROR'}): ${error.message}`);
      }
    }

    return json(
      {
        success: true,
        shop,
        apiVersion,
        orderId,
        accessTokenLength: accessToken?.length || 0,
        results,
      },
      { 
        status: 200,
        headers: corsHeaders 
      }
    );

  } catch (err) {
    console.error("❌ Debug error:", err);
    return json(
      { 
        success: false,
        error: "Debug failed",
        details: err.message 
      },
      { status: 500, headers: corsHeaders }
    );
  }
};