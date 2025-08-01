import { json } from "@remix-run/node";
import { authenticate } from "../../app/shopify.server";
import { getToken } from "../utils/tokenStorage";
import axios from "axios";

// CORS HEADERS
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
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

// Helper to fetch a product by ID
const fetchProductById = async (shop, accessToken, productId) => {
  try {
    const res = await axios.get(
      `https://${shop}/admin/api/2024-01/products/${productId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data.product;
  } catch (err) {
    console.warn(`⚠️ Failed to fetch product ${productId}`);
    return null;
  }
};

// const fetchProductById = async (shop, accessToken, productId) => {
//   const gqlQuery = {
//     query: `
//       query getProduct($id: ID!) {
//         product(id: $id) {
//           id
//           title
//           handle
//           vendor
//           tags
//           images(first: 1) {
//             edges {
//               node {
//                 originalSrc
//               }
//             }
//           }
//         }
//       }`,
//     variables: {
//       id: `gid://shopify/Product/${productId}`,
//     },
//   };

//   try {
//     const res = await axios.post(
//       `https://${shop}/admin/api/2024-07/graphql.json`,
//       JSON.stringify(gqlQuery),
//       {
//         headers: {
//           "X-Shopify-Access-Token": accessToken,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const product = res.data.data.product;
//     return {
//       ...product,
//       image: product.images.edges[0]?.node.originalSrc || null,
//     };
//   } catch (err) {
//     console.warn(`⚠️ Failed to fetch product ${productId}`, err.response?.data || err.message);
//     return null;
//   }
// };

// const fetchOrderById = async (shop, accessToken, orderId) => {
//   const gqlQuery = {
//     query: `
//       query getOrder($id: ID!) {
//         order(id: $id) {
//           id
//           name
//           createdAt
//           totalPriceSet {
//             shopMoney {
//               amount
//               currencyCode
//             }
//           }
//           lineItems(first: 100) {
//             edges {
//               node {
//                 id
//                 title
//                 quantity
//                 product {
//                   id
//                   title
//                 }
//               }
//             }
//           }
//         }
//       }
//     `,
//     variables: {
//       id: `gid://shopify/Order/${orderId}`,
//     },
//   };

//   try {
//     const res = await axios.post(
//       `https://${shop}/admin/api/2024-07/graphql.json`,
//       JSON.stringify(gqlQuery),
//       {
//         headers: {
//           "X-Shopify-Access-Token": accessToken,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     return res.data.data.order;
//   } catch (err) {
//     console.error(`❌ Failed to fetch order ${orderId}`, err.response?.data || err.message);
//     return null;
//   }
// };



// Handle POST to fetch bulk orders
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
    const { session } = await authenticate.admin(request);
    const { shop, accessToken } = session;
    
    console.log("🏪 Processing request for shop:", shop);
    
    // 🔑 Get the saved Rushrr API token from memory store
    const rushrrApiToken = getToken(shop);
    
    if (!rushrrApiToken) {
      console.log("❌ No Rushrr API token found for shop:", shop);
      return json(
        { error: "Rushrr API token not found. Please setup the token first." },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }
    
    console.log("🔑 Using Rushrr API token:", rushrrApiToken);

    const { orderIds } = await request.json();

    if (!orderIds || !Array.isArray(orderIds)) {
      return json(
        { error: "Invalid or missing orderIds" },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    console.log("🔁 Fetching orders:", orderIds);
    console.log("🔑 Using Rushrr API token:", rushrrApiToken);

    // Step 1: Fetch all orders (using Shopify access token for Shopify API)
    const orders = await Promise.all(
      orderIds.map(async (id) => {
        try {
          const res = await axios.get(
            `https://${shop}/admin/api/2024-01/orders/${id}.json`,
            {
              headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
              },
            }
          );
          return res.data.order;
        } catch (error) {
          console.error(`❌ Order ${id} failed:`, error?.response?.data || error.message);
          return null;
        }
      })
    );

    const filteredOrders = orders.filter(Boolean);

    // Step 2: Collect unique product IDs
    const productIdSet = new Set();
    filteredOrders.forEach((order) => {
      order.line_items.forEach((item) => {
        if (item.product_id) {
          productIdSet.add(item.product_id);
        }
      });
    });

    const uniqueProductIds = Array.from(productIdSet);

    // Step 3: Fetch product info for each unique product (using Shopify access token)
    const productMap = {};
    const productResults = await Promise.all(
      uniqueProductIds.map(async (pid) => {
        const product = await fetchProductById(shop, accessToken, pid);
        if (product) productMap[pid] = product;
        return product;
      })
    );

    // Step 4: Enrich line_items with product data (e.g., image, vendor, etc.)
    const enrichedOrders = filteredOrders.map((order) => {
      const enrichedLineItems = order.line_items.map((item) => {
        const product = productMap[item.product_id];
        return {
          ...item,
          product_details: product
            ? {
                title: product.title,
                vendor: product.vendor,
                image: product.image?.src || null,
                handle: product.handle,
                tags: product.tags,
              }
            : null,
        };
      });

      return {
        ...order,
        line_items: enrichedLineItems,
      };
    });

    // ✅ Return the data with Rushrr API token instead of Shopify access token
    return json(
      {
        shopifyStoreUrl: shop, // e.g., rushrr.myshopify.com
        orders: enrichedOrders,
        token: rushrrApiToken, // 👈 Return the Rushrr API token instead of Shopify access token
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    return json(
      { error: "Bulk fetch failed" },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
};