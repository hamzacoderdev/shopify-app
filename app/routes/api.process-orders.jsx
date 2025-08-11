import { json } from "@remix-run/node";
import { authenticate, apiVersion } from "../shopify.server";
import { getToken } from "../utils/tokenStorage";
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
  console.log("🔄 CORS preflight request received for process-orders");
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

// Main order processing endpoint
export const action = async ({ request }) => {
  console.log("📨 Process orders request received");
  console.log("Method:", request.method);
  console.log("URL:", request.url);
  console.log("Headers:", Object.fromEntries(request.headers.entries()));

  if (request.method !== "POST") {
    console.log("❌ Method not allowed:", request.method);
    return json(
      { error: `Method ${request.method} not allowed` },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Parse request body first
    let requestBody;
    try {
      requestBody = await request.json();
      console.log("📦 Request body:", requestBody);
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      return json(
        {
          success: false,
          error: "Invalid JSON in request body",
          details: parseError.message
        },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const { orderIds } = requestBody;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return json(
        { 
          success: false,
          error: "Invalid or missing orderIds. Expected array of order IDs." 
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("🔐 Authenticating request...");
    
    // Authenticate the session
    const { session } = await authenticate.admin(request);
    const { shop, accessToken } = session;
    
    console.log("✅ Authentication successful for shop:", shop);
    
    // Get Rushrr API token
    const rushrrApiToken = getToken(shop);
    
    if (!rushrrApiToken) {
      console.log("❌ No Rushrr API token found");
      return json(
        { 
          success: false,
          error: "Rushrr API token not found. Please configure your token in the app settings." 
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("🔑 Token found, processing orders:", orderIds);

    // Process each order
    const results = [];
    const errors = [];

    for (const orderId of orderIds) {
      try {
        console.log(`📥 Fetching order ${orderId} from Shopify...`);
        console.log(`🔗 Using API version: ${apiVersion}`);

        let shopifyResponse;
        let order;

        // 🔍 DEBUG: Try REST API FIRST to see actual data structure
        console.log(`🔄 Trying REST API for order ${orderId}...`);
        
        try {
          shopifyResponse = await axios.get(
            `https://${shop}/admin/api/${apiVersion}/orders/${orderId}.json`,
            {
              headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
              },
              timeout: 10000,
            }
          );

          order = shopifyResponse.data.order;
          console.log(`✅ REST API successful for order ${orderId}`);
          
          // 🔍 DEBUG: Log actual REST response structure
          console.log("🔍 DEBUG - RAW ORDER DATA:", {
            id: order.id,
            name: order.name,
            order_number: order.order_number,
            number: order.number,
            email: order.email,
            phone: order.phone,
            total_price: order.total_price,
            currency: order.currency,
            customer: order.customer ? {
              id: order.customer.id,
              first_name: order.customer.first_name,
              last_name: order.customer.last_name,
              email: order.customer.email,
              phone: order.customer.phone,
            } : "NO CUSTOMER DATA",
            billing_address: order.billing_address ? {
              first_name: order.billing_address.first_name,
              last_name: order.billing_address.last_name,
              name: order.billing_address.name,
            } : "NO BILLING ADDRESS",
            shipping_address: order.shipping_address ? {
              first_name: order.shipping_address.first_name,
              last_name: order.shipping_address.last_name,
              name: order.shipping_address.name,
            } : "NO SHIPPING ADDRESS",
          });

        } catch (restError) {
          console.log(`❌ REST API failed for order ${orderId}: ${restError.message}`);
          
          // If REST fails, try GraphQL
          console.log(`🔄 Trying GraphQL API for order ${orderId}...`);

          const graphqlQuery = {
            query: `
              query getOrder($id: ID!) {
                order(id: $id) {
                  id
                  name
                  createdAt
                  updatedAt
                  email
                  phone
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  customer {
                    id
                    firstName
                    lastName
                    email
                    phone
                  }
                  shippingAddress {
                    firstName
                    lastName
                    address1
                    address2
                    city
                    province
                    country
                    zip
                    phone
                  }
                  billingAddress {
                    firstName
                    lastName
                    address1
                    address2
                    city
                    province
                    country
                    zip
                    phone
                  }
                  lineItems(first: 100) {
                    edges {
                      node {
                        id
                        title
                        quantity
                        variant {
                          id
                          title
                          sku
                          price
                        }
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

          try {
            shopifyResponse = await axios.post(
              `https://${shop}/admin/api/${apiVersion}/graphql.json`,
              JSON.stringify(graphqlQuery),
              {
                headers: {
                  "X-Shopify-Access-Token": accessToken,
                  "Content-Type": "application/json",
                },
                timeout: 10000,
              }
            );

            if (shopifyResponse.data.data?.order) {
              console.log(`✅ GraphQL API successful for order ${orderId}`);
              const gqlOrder = shopifyResponse.data.data.order;

              // 🔍 DEBUG: Log GraphQL response structure
              console.log("🔍 DEBUG - GRAPHQL ORDER DATA:", {
                id: gqlOrder.id,
                name: gqlOrder.name,
                email: gqlOrder.email,
                phone: gqlOrder.phone,
                totalPriceSet: gqlOrder.totalPriceSet,
                customer: gqlOrder.customer,
                billingAddress: gqlOrder.billingAddress,
                shippingAddress: gqlOrder.shippingAddress,
              });

              // Convert GraphQL to REST format
              order = {
                id: orderId,
                order_number: gqlOrder.name?.replace('#', '') || orderId,
                name: gqlOrder.name,
                email: gqlOrder.email || "",
                phone: gqlOrder.phone || "",
                total_price: gqlOrder.totalPriceSet?.shopMoney?.amount || "0.00",
                currency: gqlOrder.totalPriceSet?.shopMoney?.currencyCode || "USD",
                created_at: gqlOrder.createdAt,
                updated_at: gqlOrder.updatedAt,
                customer: gqlOrder.customer ? {
                  id: gqlOrder.customer.id,
                  first_name: gqlOrder.customer.firstName || "",
                  last_name: gqlOrder.customer.lastName || "",
                  email: gqlOrder.customer.email || "",
                  phone: gqlOrder.customer.phone || "",
                } : null,
                shipping_address: gqlOrder.shippingAddress || null,
                billing_address: gqlOrder.billingAddress || null,
                line_items: gqlOrder.lineItems?.edges?.map(edge => ({
                  id: edge.node.id,
                  title: edge.node.title,
                  quantity: edge.node.quantity,
                  variant_id: edge.node.variant?.id,
                  variant_title: edge.node.variant?.title,
                  sku: edge.node.variant?.sku,
                  price: edge.node.variant?.price,
                  product_id: edge.node.product?.id,
                  product_title: edge.node.product?.title,
                  vendor: edge.node.product?.vendor,
                })) || [],
              };
            } else {
              throw new Error('Order not found in GraphQL response');
            }
          } catch (graphqlError) {
            console.log(`❌ Both GraphQL and REST failed for order ${orderId}`);
            throw new Error(`Failed to fetch order ${orderId}: REST: ${restError.message}, GraphQL: ${graphqlError.message}`);
          }
        }
        
        if (!order) {
          throw new Error(`Order ${orderId} not found`);
        }

        console.log(`✅ Order ${orderId} fetched successfully`);

        // 🔍 DEBUG: Final order object before processing
        console.log("🔍 DEBUG - FINAL ORDER OBJECT:", {
          id: order.id,
          order_number: order.order_number,
          name: order.name,
          total_price: order.total_price,
          currency: order.currency,
          customer: order.customer,
          billing_address: order.billing_address,
          shipping_address: order.shipping_address,
        });

        // 🔍 DEBUG: Test customer name logic step by step
        let customerName = "TEST - NO NAME FOUND";
        let nameSource = "NONE";

        // Try customer first
        if (order.customer && (order.customer.first_name || order.customer.last_name)) {
          const firstName = (order.customer.first_name || "").trim();
          const lastName = (order.customer.last_name || "").trim();
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) {
            customerName = fullName;
            nameSource = "CUSTOMER";
          }
        }
        
        // Try billing address if customer failed
        if (customerName === "TEST - NO NAME FOUND" && order.billing_address && (order.billing_address.first_name || order.billing_address.last_name)) {
          const firstName = (order.billing_address.first_name || "").trim();
          const lastName = (order.billing_address.last_name || "").trim();
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) {
            customerName = fullName;
            nameSource = "BILLING";
          }
        }
        
        // Try shipping address if both failed
        if (customerName === "TEST - NO NAME FOUND" && order.shipping_address && (order.shipping_address.first_name || order.shipping_address.last_name)) {
          const firstName = (order.shipping_address.first_name || "").trim();
          const lastName = (order.shipping_address.last_name || "").trim();
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) {
            customerName = fullName;
            nameSource = "SHIPPING";
          }
        }
        
        // Fallback
        if (customerName === "TEST - NO NAME FOUND") {
          customerName = "Guest Customer";
          nameSource = "FALLBACK";
        }

        console.log("🔍 DEBUG - CUSTOMER NAME RESOLUTION:", {
          finalName: customerName,
          source: nameSource,
          customerData: order.customer,
          billingData: order.billing_address,
          shippingData: order.shipping_address,
        });

        // Prepare payload for external API
        const orderPayload = {
          shopifyStoreUrl: `https://${shop}`,
          orders: [{
            ...order,
            orderReferenceNumber: String(order.order_number || order.name?.replace('#', '') || orderId),
            customerName: customerName,
          }],
        };

        console.log(`📤 Final payload for order ${orderId}:`);
        console.log(JSON.stringify(orderPayload, null, 2));
        
        // Send to external API
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

        console.log(`✅ Order ${orderId} sent successfully`);
        console.log("📤 External API Response:", externalResponse.data);
        
        results.push({
          orderId,
          success: true,
          orderNumber: order.order_number || order.name?.replace('#', '') || orderId,
          customerName: customerName,
          nameSource: nameSource,
          externalResponse: externalResponse.data,
        });

      } catch (error) {
        console.error(`❌ Error processing order ${orderId}:`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
          url: error.config?.url,
        });
        errors.push({
          orderId,
          error: error.message,
          details: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
          },
        });
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;
    
    console.log(`📊 Processing complete: ${successCount} success, ${errorCount} errors`);

    return json(
      {
        success: successCount > 0,
        message: `Processed ${orderIds.length} orders: ${successCount} successful, ${errorCount} failed`,
        results: {
          successful: results,
          failed: errors,
          summary: {
            total: orderIds.length,
            successful: successCount,
            failed: errorCount,
          }
        }
      },
      { 
        status: 200,
        headers: corsHeaders 
      }
    );

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return json(
      { 
        success: false,
        error: "Internal server error",
        details: err.message 
      },
      { status: 500, headers: corsHeaders }
    );
  }
};