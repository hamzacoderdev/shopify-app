import { useLoaderData } from "@remix-run/react";

// Sample loader to fetch tracking info
export const loader = async () => {
  // Mock tracking data
  const trackingData = [
    { id: 1, orderNumber: "1001", trackingId: "TRACK12345", status: "In Transit" },
    { id: 2, orderNumber: "1002", trackingId: "TRACK54321", status: "Delivered" },
  ];
  return { trackingData };
};

export default function Tracking() {
  const { trackingData } = useLoaderData();

  return (
    <main style={{ padding: 20 }}>
      <h2>Order Tracking</h2>
      <ul>
        {trackingData.map(({ id, orderNumber, trackingId, status }) => (
          <li key={id} style={{ marginBottom: 10 }}>
            <strong>Order {orderNumber}</strong>: Tracking ID {trackingId} - Status: {status}
          </li>
        ))}
      </ul>
    </main>
  );
}
