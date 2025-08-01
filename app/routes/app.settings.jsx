import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  // Example API token; in practice, fetch from your backend securely
  const apiToken = "example-api-token-abcdef123456";
  return { apiToken };
};

export default function Settings() {
  const { apiToken } = useLoaderData();

  return (
    <main style={{ padding: 20 }}>
      <h2>Account Settings</h2>
      <p><strong>API Token:</strong></p>
      <code style={{ wordBreak: "break-all", backgroundColor: "#f5f5f5", padding: 8, borderRadius: 4 }}>
        {apiToken}
      </code>
      <p>You can copy this API token and paste it into your Shopify app to connect your store.</p>
    </main>
  );
}
