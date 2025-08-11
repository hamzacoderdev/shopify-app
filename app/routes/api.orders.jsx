// routes/api/orders.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getToken } from "../utils/tokenStorage"; // ✅ This is the function that retrieves token for a shop

export async function loader({ request }) {
  try {
    // 🔒 Authenticate the session
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    // 🔑 Get token for current shop from memory store
    const token = getToken(shop);

    if (!token) {
      return json({ success: false, error: "Token not found for this store" }, { status: 401 });
    }

    // 📨 Fetch orders from external API
    const res = await fetch("https://backend.rushr-admin.com/api/orders", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    return json({ success: true, orders: data.orders || [] });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    return json({ success: false, error: "Failed to fetch orders" }, { status: 500 });
  }
}