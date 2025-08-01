// app/routes/app._index.server.js
import { json } from "@remix-run/node";
import { authenticate, sessionStorage } from "../shopify.server";

// --- LOADER --- //
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const loadedSession = await sessionStorage.loadSession(session.id);
  const savedToken = loadedSession?.rushrrToken;

  return json({
    shopifyStoreName: session.shop.split(".")[0],
    shopifyStoreUrl: `https://${session.shop}`,
    savedToken,
  });
};

// --- ACTION --- //
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const contentType = request.headers.get("content-type");
  let body;

  if (contentType?.includes("application/json")) {
    body = await request.json();
  } else {
    const formData = await request.formData();
    body = Object.fromEntries(formData);
  }

  const { shopifyStoreUrl, apiKey, action: actionType } = body;
  const loadedSession = await sessionStorage.loadSession(session.id);
  if (!loadedSession) return json({ success: false, error: "No session." });

  try {
    if (actionType === "saveToken") {
      loadedSession.rushrrToken = apiKey;
      await sessionStorage.storeSession(loadedSession);
      return json({ success: true });
    }

    const res = await fetch("https://52b99a056051.ngrok-free.app/api/auth/verify-shopify-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopifyStoreUrl }),
    });

    const data = await res.json();
    if (res.ok && data?.success && data?.token) {
      loadedSession.rushrrToken = data.token;
      await sessionStorage.storeSession(loadedSession);
      return json({ success: true });
    }

    return json({ success: false, error: data?.error || "Verification failed." });
  } catch (err) {
    console.error("Action error:", err);
    return json({ success: false, error: "Internal error." });
  }
};
