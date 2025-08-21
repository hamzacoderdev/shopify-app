import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
  Banner,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <BulkOrderAction />);

function BulkOrderAction() {
  const { close, data } = useApi(TARGET);
  const [orderIds, setOrderIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');
  const [results, setResults] = useState([]);

  // Extract order IDs
  useEffect(() => {
    try {
      if (data?.selected?.length > 0) {
        const ids = data.selected
          .map((item) => {
            if (typeof item.id === 'string') {
              return item.id.split('/').pop();
            } else if (item.id && typeof item.id === 'object') {
              return item.id.id ? item.id.id.split('/').pop() : String(item.id);
            } else {
              return String(item.id);
            }
          })
          .filter((id) => id && id !== 'undefined' && id !== 'null');

        setOrderIds(ids);
      } else {
        setOrderIds([]);
      }
    } catch (error) {
      console.error('❌ Error extracting order IDs:', error);
      setResponseMsg('❌ Error extracting order IDs: ' + error.message);
      setOrderIds([]);
    }
  }, [data]);

  // Send orders to backend
  const handleSendToApp = async () => {
    setIsLoading(true);
    setResponseMsg('');
    setResults([]);

    try {
      const requestPayload = { orderIds };

      const remixRes = await fetch('/resources/bulk-order-details', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestPayload),
      });

      // ✅ Handle 401 from Shopify resource
      if (remixRes.status === 401) {
        setResponseMsg('❌ Please first connect your Shopify store.');
        setResults([]);
        setIsLoading(false);
        return;
      }

      const responseText = await remixRes.text();
      let orderDetails;

      try {
        orderDetails = JSON.parse(responseText);
      } catch {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`);
      }

      if (!remixRes.ok) {
        throw new Error(`Remix backend error (${remixRes.status}): ${orderDetails.error || responseText}`);
      }

      if (!orderDetails.orders || orderDetails.orders.length === 0) {
        throw new Error('No orders received from backend');
      }

      if (!orderDetails.token) {
        throw new Error('No API token received. Please configure your Rushrr API token first.');
      }

      let successCount = 0;
      let tempResults = [];

      for (const order of orderDetails.orders) {
        try {
          order.orderReferenceNumber = String(order.order_number);

          const individualPayload = {
            shopifyStoreUrl: `https://${orderDetails.shopifyStoreUrl}`,
            orders: [order],
          };

          const externalRes = await fetch(
            'https://backend.rushr-admin.com/api/orders/create-order',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${orderDetails.token}`,
                'Accept': 'application/json',
              },
              body: JSON.stringify(individualPayload),
            }
          );

          // ✅ Handle 401 from external Rushrr API
          if (externalRes.status === 401) {
            setResponseMsg('❌ Please first connect your Shopify store.');
            setResults([]);
            setIsLoading(false);
            return;
          }

          if (!externalRes.ok) {
            const errorJson = await externalRes.json().catch(() => null);
            let errorMsg = `❌ Order ${order.order_number}: Failed`;

            if (errorJson?.message?.includes('Order already exists')) {
              const match = errorJson.message.match(/Order ID (\d+)/);
              const existingId = match ? match[1] : order.order_number;
              errorMsg = `❌ This order already exists: ${existingId}`;
            } else if (errorJson?.message) {
              errorMsg = `❌ Order ${order.order_number}: ${errorJson.message}`;
            }

            tempResults.push(errorMsg);
            continue;
          }

          await externalRes.json();
          successCount++;
          tempResults.push(`✅ Order ${order.order_number} sent successfully!`);
        } catch (orderError) {
          tempResults.push(`❌ Order ${order.order_number || order.id}: ${orderError.message}`);
        }
      }

      setResults(tempResults);

      if (successCount === orderDetails.orders.length) {
        setResponseMsg('✅ All orders sent successfully!');
      } else if (successCount === 0) {
        setResponseMsg('❌ All orders failed!');
      } else {
        setResponseMsg('Orders processed with some errors.');
      }

    } catch (err) {
      let errorMessage = '❌ Failed to send orders';
      if (err.message.includes('token')) {
        errorMessage = '❌ Authentication error - please configure your API token';
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        errorMessage = '❌ Network error - please check your connection';
      } else if (err.message.includes('Backend error')) {
        errorMessage = `❌ ${err.message}`;
      } else if (err.message.includes('JSON')) {
        errorMessage = '❌ Invalid response from server';
      }
      setResponseMsg(errorMessage);
      setResults([err.message]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminAction
      primaryAction={
        <Button 
          disabled={!orderIds.length || isLoading} 
          loading={isLoading} 
          onPress={handleSendToApp}
          variant="primary"
        >
          {isLoading ? 'Processing...' : `Send ${orderIds.length} Orders to Rushrr`}
        </Button>
      }
      secondaryAction={<Button onPress={close}>Cancel</Button>}
    >
      <BlockStack spacing="tight">
        <Text fontWeight="bold">Rushrr Courier Integration</Text>

        {orderIds.length === 0 ? (
          <Banner status="info">
            <Text>No orders selected. Please select orders to send to Rushrr.</Text>
          </Banner>
        ) : (
          <Banner status="success">
            <Text>
              Ready to send {orderIds.length} order(s):{' '}
              {orderIds.slice(0, 5).join(', ')}
              {orderIds.length > 5 ? '...' : ''}
            </Text>
          </Banner>
        )}

        {responseMsg && (
          <Banner
            status={
              responseMsg.includes('✅')
                ? 'success'
                : responseMsg.includes('❌')
                ? 'critical'
                : 'warning'
            }
          >
            <Text>{responseMsg}</Text>
            {results.length > 0 && (
              <BlockStack spacing="extraTight">
                {results.map((msg, idx) => (
                  <Text key={idx}>{msg}</Text>
                ))}
              </BlockStack>
            )}
          </Banner>
        )}

        <Text size="small" color="subdued">
          This will send the selected orders to Rushrr for processing and courier booking.
        </Text>
      </BlockStack>
    </AdminAction>
  );
}
