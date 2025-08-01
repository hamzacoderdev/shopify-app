import { json } from "@remix-run/node";
import { authenticate } from "../../app/shopify.server";
import axios from "axios";

// Handle GET or CORS preflight OPTIONS request
export const loader = () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};

// Handle POST request from the extension
export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json(
      { error: `Method ${request.method} not allowed` },
      {
        status: 405,
        headers: {
          "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }

  try {
    // Step 1: Authenticate app session
    const { session } = await authenticate.admin(request);
    const { shop, accessToken } = session;

    // Step 2: Parse order ID from request body
    const { orderId } = await request.json();

    if (!orderId) {
      return json(
        { error: "Missing orderId in request body" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // Step 3: GraphQL query to fetch order
    const gqlQuery = {
      query: `
        query getOrder($id: ID!) {
          order(id: $id) {
            id
            name
            createdAt
            customer {
              firstName
              lastName
              email
            }
            lineItems(first: 100) {
              edges {
                node {
                  title
                  quantity
                  sku
                  product {
                    id
                    title
                    vendor
                  }
                }
              }
            }
          }
        }
      `,
      variables: {
        id: `gid://shopify/Order/${orderId}`,
      },
    };

    const response = await axios.post(
      `https://${shop}/admin/api/2024-07/graphql.json`,
      JSON.stringify(gqlQuery),
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    const order = response.data?.data?.order;

    if (!order) {
      console.error("❌ Order not found in Shopify response");
      return json(
        { error: "Order not found" },
        {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // 🪵 Log entire order for debugging
    console.log("✅ Order Fetched:", JSON.stringify(order, null, 2));

    const customer = order.customer;
    const customerName = customer
      ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
      : "Customer info not found";

    return json(
      {
        order,
        orderId: order.id,
        customerName,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (err) {
    console.error("❌ Failed to fetch order:", err.response?.data || err.message);
    return json(
      { error: "Failed to fetch order" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
};
