import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getToken } from "../utils/tokenStorage";

// Common CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// 👇 This fixes the OPTIONS error
export const loader = () => {
  return new Response("OK", {
    status: 200,
    headers: CORS_HEADERS
  });
};

// 👇 Your action remains as is (CORS already handled in previous response)
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }



  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: `Method ${request.method} not allowed` }),
      {
        status: 405,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json"
        }
      }
    );
  }

  try {
    console.log("🔐 Trying Shopify session authentication...");
    
    const { session, admin } = await authenticate.admin(request);

    if (!session) {
      console.log("❌ No Shopify session found");
      return json(
        { error: "No valid Shopify session" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    console.log("✅ Shopify session found:", session.shop);
    console.log("🔑 Has accessToken:", !!session.accessToken);

    const apiToken = getToken(session.shop);
    if (!apiToken) {
      console.log("❌ No API token found for shop:", session.shop);
      return json(
        {
          error: "No API token configured for this store",
          details: "Please configure your Rushrr API token first"
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log("🔍 Token retrieved:", !!apiToken);

    const { orderIds } = await request.json();
    console.log("🔁 Processing order IDs:", orderIds);

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return json(
        { error: "No order IDs provided" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const debugInfo = {
      requestedIds: orderIds,
      totalRequested: orderIds.length,
      apiVersion: "2024-10",
      shop: session.shop,
      canAccessOrdersApi: !!admin
    };

    const orders = [];
    let successCount = 0;
    let failCount = 0;

    for (const orderId of orderIds) {
      try {
        console.log(`📡 Fetching order ${orderId}...`);

        const response = await admin.rest.resources.Order.find({
          session,
          id: orderId
        });

        if (!response) {
          console.log(`❌ Order ${orderId} not found`);
          failCount++;
          continue;
        }

        const order = response;

        order.orderReferenceNumber = String(order.order_number || order.number);

        if (!order.shipping_address && order.billing_address) {
          console.log(`📦 Using billing address as shipping for ${order.id}`);
          order.shipping_address = { ...order.billing_address };
        }

        orders.push(order);
        successCount++;

        console.log(`✅ Order ${orderId} fetched`, {
          id: order.id,
          name: order.name,
          email: order.customer?.email
        });
      } catch (orderError) {
        console.error(`❌ Failed to fetch order ${orderId}`, orderError);
        failCount++;
      }
    }

    debugInfo.successfullyFetched = successCount;
    debugInfo.failed = failCount;

    if (orders.length === 0) {
      return json(
        {
          error: "Failed to fetch any orders",
          details: "Check if the order IDs are valid and accessible",
          debugInfo
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Fetched ${orders.length} orders`);
    return json(
      {
        orders,
        token: apiToken,
        shopifyStoreUrl: session.shop,
        debugInfo,
        success: true,
        message: `Successfully fetched ${orders.length} orders`
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("❌ Error in bulk-order-details:", error);
    return json(
      {
        error: "Server error",
        details: error.message,
        debugInfo: {
          errorType: error.constructor.name,
          message: error.message
        }
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
