import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { saveToken, getAllTokens } from "../utils/tokenStorage";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json(
      { error: `Method ${request.method} not allowed` },
      { status: 405 }
    );
  }

  try {
    console.log("🔄 Starting token save process...");
    
    const { session } = await authenticate.admin(request);
    console.log("✅ Session authenticated for shop:", session.shop);
    
    const requestBody = await request.json();
    console.log("📝 Request body:", requestBody);
    
    const { token } = requestBody;

    if (!token) {
      console.log("❌ No token provided in request");
      return json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    console.log("🔑 Attempting to save token for shop:", session.shop);
    console.log("🔑 Token to save:", token);
    
    // 🔑 Save the API token in memory
    const success = saveToken(session.shop, token);
    
    if (success) {
      console.log("✅ Token saved successfully for shop:", session.shop);
      
      // Log all tokens for debugging
      getAllTokens();
      
      return json({ 
        success: true, 
        message: "Token saved successfully",
        shop: session.shop
      });
    } else {
      console.log("❌ Failed to save token");
      throw new Error("saveToken function returned false");
    }
  } catch (err) {
    console.error("❌ Error in save-token action:", err);
    console.error("❌ Error stack:", err.stack);
    return json(
      { 
        error: "Failed to save token", 
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      },
      { status: 500 }
    );
  }
};