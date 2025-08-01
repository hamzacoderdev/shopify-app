import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <BulkOrderAction />);

function BulkOrderAction() {
  const { close, data } = useApi(TARGET);
  const [orderIds, setOrderIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  // Extract all order IDs from selected orders
 useEffect(() => {
  console.log('🔍 Full data object from useApi:', data); // Add this line

  if (data?.selected?.length > 0) {
    const ids = data.selected.map((item) => item.id.split('/').pop());
    setOrderIds(ids);
  }
}, [data]);


  // Send to app/backend
const handleSendToApp = async () => {
  setIsLoading(true);
  try {
    // Step 1: Call Remix backend to get order details
    const remixRes = await fetch('/resources/bulk-order-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds }),
    });

    const orderDetails = await remixRes.json();
    console.log('✅ Order details received from Remix:', orderDetails);

    // Step 2 & 3: Send each order individually with modified payload
    for (const order of orderDetails.orders) {
      // Add `orderReferenceNumber` (keep `order_number`)
      order.orderReferenceNumber = String(order.order_number);;

      const individualPayload = {
        shopifyStoreUrl: `https://${orderDetails.shopifyStoreUrl}`,
        orders: [order],
      };

      const externalRes = await fetch('https://backend.rushr-admin.com/api/orders/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orderDetails.token}`,
        },
        body: JSON.stringify(individualPayload),
      });

      const result = await externalRes.json();
      console.log('✅ Sent order:', order.id, 'Response:', result);
    }

    setResponseMsg('✅ Orders sent to external app successfully!');
  } catch (err) {
    console.error('❌ Error in sending orders:', err);
    setResponseMsg('❌ Failed to send orders.');
  } finally {
    setIsLoading(false);
  }
};




  return (
    <AdminAction
      primaryAction={
        <Button disabled={!orderIds.length} loading={isLoading} onPress={handleSendToApp}>
          Send to App
        </Button>
      }
      secondaryAction={<Button onPress={close}>Cancel</Button>}
    >
      <BlockStack spacing="tight">
        <Text fontWeight="bold">Selected Orders</Text>
        {orderIds.length === 0 ? (
          <Text>No orders selected.</Text>
        ) : (
          <Text>Orders: {orderIds.join(', ')}</Text>
        )}
        {responseMsg && <Text>{responseMsg}</Text>}
      </BlockStack>
    </AdminAction>
  );
}
