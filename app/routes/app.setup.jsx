// routes/setup.jsx or where your SetupPage component is defined
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server"; // adjust path if needed

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const body = await request.json();
  const { token } = body;

  // Store the token in session
  session.set("rushrr_token", token);

  return json(
    { success: true },
    {
      headers: {
        "Set-Cookie": await session.commit(), // commit the session
      },
    }
  );
};
