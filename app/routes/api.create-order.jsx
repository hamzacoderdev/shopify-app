import { json } from "@remix-run/node";
import { authenticate, apiVersion } from "../shopify.server";
import { getToken } from "../utils/tokenStorage";
import axios from "axios";

// CORS HEADERS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight (OPTIONS)
export const loader = () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

// Handle POST request to create orders
export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json(
      { error: `Method ${request.method} not allowed` },
      {
        status: 405,
        headers: corsHeaders,
      }
    );
  }

  try {
    console.log("🚀 Starting order creation process...");
    
    // Step 1: Authenticate the session
    const { session } = await authenticate.admin(request);
    const { shop, accessToken } = session;
    
    console.log("🏪 Processing request for shop:", shop);
    
    // Step 2: Get the saved Rushrr API token
    const rushrrApiToken = getToken(shop);
    
    if (!rushrrApiToken) {
      console.log("❌ No Rushrr API token found for shop:", shop);
      return json(
        { 
          success: false,
          error: "Rushrr API token not found. Please setup the token first in the app settings." 
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }
    
    console.log("🔑 Using Rushrr API token for shop:", shop);

    // Step 3: Parse request body
    const { orderIds } = await request.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return json(
        { 
          success: false,
          error: "Invalid or missing orderIds. Expected array of order IDs." 
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    console.log("📦 Processing orders:", orderIds);

    // Step 4: Fetch orders from Shopify
    const orderResults = [];
    const errors = [];

    for (const orderId of orderIds) {
      try {
        console.log(`📥 Fetching order ${orderId} from Shopify...`);
        
        const shopifyResponse = await axios.get(
          `https://${shop}/admin/api/${apiVersion}/orders/${orderId}.json`,
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        const order = shopifyResponse.data.order;
        
        if (!order) {
          throw new Error(`Order ${orderId} not found`);
        }

        // Step 5: Prepare order for external API
        const orderPayload = {
          shopifyStoreUrl: `https://${shop}`,
          orders: [{
            ...order,
            orderReferenceNumber: String(order.order_number),
          }],
        };

        console.log(`📤 Sending order ${orderId} to external API...`);
        
        // Step 6: Send to external API
        const externalResponse = await axios.post(
          'https://backend.rushr-admin.com/api/orders/create-order',
          orderPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${rushrrApiToken}`,
            },
            timeout: 15000,
          }
        );

        console.log(`✅ Successfully processed order ${orderId}`);
        orderResults.push({
          orderId,
          success: true,
          shopifyOrder: order,
          externalResponse: externalResponse.data,
        });

      } catch (error) {
        console.error(`❌ Error processing order ${orderId}:`, {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
        
        errors.push({
          orderId,
          error: error.message,
          details: error.response?.data || null,
        });
      }
    }

    // Step 7: Return results
    const successCount = orderResults.length;
    const errorCount = errors.length;
    
    console.log(`📊 Processing complete: ${successCount} success, ${errorCount} errors`);

    return json(
      {
        success: successCount > 0,
        message: `Processed ${orderIds.length} orders: ${successCount} successful, ${errorCount} failed`,
        results: {
          successful: orderResults,
          failed: errors,
          summary: {
            total: orderIds.length,
            successful: successCount,
            failed: errorCount,
          }
        }
      },
      { 
        status: successCount > 0 ? 200 : 400,
        headers: corsHeaders 
      }
    );

  } catch (err) {
    console.error("❌ Unexpected error in order creation:", err);
    return json(
      { 
        success: false,
        error: "Internal server error occurred while processing orders",
        details: err.message 
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
};