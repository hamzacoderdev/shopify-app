import { json } from "@remix-run/node";
import { authenticate, apiVersion } from "../shopify.server";
import { getToken } from "../utils/tokenStorage";

// Simple test endpoint to verify order processing setup
export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json(
      { error: `Method ${request.method} not allowed` },
      { status: 405 }
    );
  }

  try {
    console.log("🧪 Testing order processing setup...");
    
    // Step 1: Test authentication
    const { session } = await authenticate.admin(request);
    const { shop, accessToken } = session;
    
    console.log("✅ Authentication successful for shop:", shop);
    
    // Step 2: Test token retrieval
    const rushrrApiToken = getToken(shop);
    
    const tokenStatus = rushrrApiToken ? "✅ Found" : "❌ Missing";
    console.log(`🔑 Rushrr API token status: ${tokenStatus}`);
    
    // Step 3: Parse test order ID
    const { orderIds } = await request.json();
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return json({
        success: false,
        error: "Please provide orderIds array for testing",
        setup: {
          authentication: "✅ Working",
          shop: shop,
          token: tokenStatus,
        }
      });
    }

    // Step 4: Test Shopify API access
    const testOrderId = orderIds[0];
    console.log(`🔍 Testing Shopify API access with order ID: ${testOrderId}`);
    
    try {
      const shopifyResponse = await fetch(
        `https://${shop}/admin/api/${apiVersion}/orders/${testOrderId}.json`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      const shopifyResult = await shopifyResponse.json();
      
      if (shopifyResponse.ok && shopifyResult.order) {
        console.log("✅ Shopify API access successful");
        
        return json({
          success: true,
          message: "All systems working correctly!",
          setup: {
            authentication: "✅ Working",
            shop: shop,
            token: tokenStatus,
            shopifyApi: "✅ Working",
            testOrder: {
              id: shopifyResult.order.id,
              number: shopifyResult.order.order_number,
              customer: shopifyResult.order.customer?.first_name || "N/A",
            }
          },
          nextSteps: rushrrApiToken 
            ? ["You can now process orders normally"]
            : ["Please configure your Rushrr API token in the app settings"]
        });
      } else {
        throw new Error(`Shopify API error: ${shopifyResponse.status}`);
      }
    } catch (shopifyError) {
      console.error("❌ Shopify API test failed:", shopifyError.message);
      
      return json({
        success: false,
        error: "Shopify API access failed",
        setup: {
          authentication: "✅ Working",
          shop: shop,
          token: tokenStatus,
          shopifyApi: "❌ Failed",
          shopifyError: shopifyError.message,
        },
        troubleshooting: [
          "Check if the order ID exists",
          "Verify app permissions include order read access",
          "Ensure the app is properly installed"
        ]
      });
    }

  } catch (err) {
    console.error("❌ Test failed:", err);
    return json(
      { 
        success: false,
        error: "Test failed",
        details: err.message,
        troubleshooting: [
          "Check if the app is properly authenticated",
          "Verify the Shopify app is installed correctly",
          "Check server logs for more details"
        ]
      },
      { status: 500 }
    );
  }
};

// Handle GET requests with basic info
export const loader = async ({ request }) => {
  return json({
    endpoint: "/api/test-order",
    method: "POST",
    description: "Test endpoint for debugging order processing",
    usage: {
      body: { orderIds: ["5920323403859"] },
      headers: { "Content-Type": "application/json" }
    }
  });
};