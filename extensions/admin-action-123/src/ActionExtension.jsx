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
  const [errorDetails, setErrorDetails] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  // Extract all order IDs from selected orders with better error handling
  useEffect(() => {
    console.log('🔍 Full data object from useApi:', data);
    
    try {
      if (data?.selected?.length > 0) {
        console.log('📋 Selected items structure:', data.selected.map(item => ({
          id: item.id,
          idType: typeof item.id,
          fullItem: item
        })));

        const ids = data.selected.map((item) => {
          // Handle different ID formats with more detailed logging
          let extractedId;
          
          if (typeof item.id === 'string') {
            extractedId = item.id.split('/').pop();
            console.log(`🔧 String ID: ${item.id} → ${extractedId}`);
          } else if (item.id && typeof item.id === 'object') {
            // GraphQL ID format
            extractedId = item.id.id ? item.id.id.split('/').pop() : String(item.id);
            console.log(`🔧 Object ID: ${JSON.stringify(item.id)} → ${extractedId}`);
          } else {
            extractedId = String(item.id);
            console.log(`🔧 Other ID type: ${item.id} (${typeof item.id}) → ${extractedId}`);
          }
          
          return extractedId;
        }).filter(id => id && id !== 'undefined' && id !== 'null'); // Remove any invalid IDs
        
        console.log('📋 Extracted order IDs:', ids);
        console.log('📋 ID validation:', ids.map(id => ({
          id,
          isNumeric: /^\d+$/.test(id),
          length: id.length
        })));
        
        setOrderIds(ids);
      } else {
        console.log('📋 No selected orders');
        setOrderIds([]);
      }
    } catch (error) {
      console.error('❌ Error extracting order IDs:', error);
      setResponseMsg('❌ Error extracting order IDs: ' + error.message);
      setOrderIds([]);
    }
  }, [data]);

  // Enhanced function to send orders to app
  const handleSendToApp = async () => {
    setIsLoading(true);
    setResponseMsg('');
    setErrorDetails(null);
    setDebugInfo(null);
    
    try {
      console.log('🚀 Starting order processing for IDs:', orderIds);
      console.log('🚀 Order IDs validation:', {
        count: orderIds.length,
        allNumeric: orderIds.every(id => /^\d+$/.test(id)),
        samples: orderIds.slice(0, 3)
      });
      
      // Step 1: Call Remix backend to get order details with better error handling
      console.log('📡 Calling Remix backend...');
      
      const requestPayload = { orderIds };
      console.log('📡 Request payload:', requestPayload);
      
      // FIXED: Remove the invalid X-Shopify-Access-Token header
      // The Shopify session authentication should be handled on the backend
      const remixRes = await fetch('/resources/bulk-order-details', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
          // Removed the problematic X-Shopify-Access-Token header
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('📡 Remix response status:', remixRes.status);
      console.log('📡 Remix response headers:', Object.fromEntries(remixRes.headers.entries()));
      console.log('📡 Remix response ok:', remixRes.ok);

      const responseText = await remixRes.text();
      console.log('📡 Raw response text:', responseText);

      let orderDetails;
      try {
        orderDetails = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse response JSON:', parseError);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`);
      }

      console.log('📡 Parsed response:', orderDetails);

      if (!remixRes.ok) {
        console.error('❌ Remix backend error:', orderDetails);
        
        // Show debug info for failed requests
        setDebugInfo(orderDetails.debugInfo || {
          status: remixRes.status,
          responseText: responseText.substring(0, 500)
        });
        
        throw new Error(`Remix backend error (${remixRes.status}): ${orderDetails.error || responseText}`);
      }
      
      // Check if we got valid data
      if (orderDetails.error) {
        console.error('❌ Backend returned error:', orderDetails);
        setDebugInfo(orderDetails.debugInfo);
        throw new Error(`Backend error: ${orderDetails.error} - ${orderDetails.details || ''}`);
      }
      
      if (!orderDetails.orders || orderDetails.orders.length === 0) {
        console.error('❌ No orders in response:', orderDetails);
        setDebugInfo(orderDetails.debugInfo);
        throw new Error('No orders received from backend');
      }
      
      if (!orderDetails.token) {
        throw new Error('No API token received. Please configure your Rushrr API token first.');
      }

      console.log(`📦 Processing ${orderDetails.orders.length} orders...`);
      console.log('📦 Orders received:', orderDetails.orders.map(order => ({
        id: order.id,
        name: order.name,
        orderReferenceNumber: order.orderReferenceNumber,
        hasShippingAddress: !!order.shipping_address
      })));
      console.log('🔧 Debug info from backend:', orderDetails.debugInfo);
      
      // Step 2: Send each order individually with enhanced error handling
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      
      for (const [index, order] of orderDetails.orders.entries()) {
        try {
          console.log(`📤 Sending order ${index + 1}/${orderDetails.orders.length}:`, {
            id: order.id,
            orderNumber: order.order_number,
            name: order.name
          });
          
          // Add orderReferenceNumber (keep order_number)
          order.orderReferenceNumber = String(order.order_number);

          const individualPayload = {
            shopifyStoreUrl: `https://${orderDetails.shopifyStoreUrl}`,
            orders: [order],
          };

          console.log(`📤 Payload for order ${order.id}:`, {
            shopifyStoreUrl: individualPayload.shopifyStoreUrl,
            orderCount: individualPayload.orders.length,
            orderNumber: order.order_number
          });

          const externalRes = await fetch('https://backend.rushr-admin.com/api/orders/create-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${orderDetails.token}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify(individualPayload),
          });

          console.log(`📤 External API response for order ${order.id}:`, {
            status: externalRes.status,
            ok: externalRes.ok,
            statusText: externalRes.statusText
          });

          if (!externalRes.ok) {
            const errorText = await externalRes.text();
            console.error(`❌ External API error for order ${order.id}:`, {
              status: externalRes.status,
              statusText: externalRes.statusText,
              errorText
            });
            errors.push(`Order ${order.order_number}: ${externalRes.status} - ${errorText}`);
            errorCount++;
            continue;
          }

          const result = await externalRes.json();
          console.log('✅ Successfully sent order:', order.id, 'Response summary:', {
            success: !!result,
            hasData: !!result.data,
            message: result.message
          });
          successCount++;
          
        } catch (orderError) {
          console.error(`❌ Error processing order ${order.id}:`, orderError);
          errors.push(`Order ${order.order_number || order.id}: ${orderError.message}`);
          errorCount++;
        }
      }

      // Set appropriate response message based on results
      if (successCount === orderDetails.orders.length) {
        setResponseMsg(`✅ All ${successCount} orders sent successfully!`);
      } else if (successCount > 0) {
        setResponseMsg(`⚠️ ${successCount} orders sent, ${errorCount} failed`);
        setErrorDetails(errors);
      } else {
        setResponseMsg(`❌ All orders failed to send`);
        setErrorDetails(errors);
      }

      // Set debug info if available
      if (orderDetails.debugInfo) {
        setDebugInfo(orderDetails.debugInfo);
      }
      
    } catch (err) {
      console.error('❌ Error in sending orders:', err);
      
      // Provide more specific error messages
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
      setErrorDetails([err.message]);
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
            <Text>Ready to send {orderIds.length} order(s): {orderIds.slice(0, 5).join(', ')}{orderIds.length > 5 ? '...' : ''}</Text>
          </Banner>
        )}
        
        {responseMsg && (
          <Banner status={responseMsg.includes('✅') ? 'success' : responseMsg.includes('⚠️') ? 'warning' : 'critical'}>
            <Text>{responseMsg}</Text>
          </Banner>
        )}
        
        {errorDetails && errorDetails.length > 0 && (
          <Banner status="critical">
            <BlockStack spacing="extraTight">
              <Text fontWeight="bold">Error Details:</Text>
              {errorDetails.slice(0, 3).map((error, index) => (
                <Text key={index} size="small">{error}</Text>
              ))}
              {errorDetails.length > 3 && (
                <Text size="small">...and {errorDetails.length - 3} more errors</Text>
              )}
            </BlockStack>
          </Banner>
        )}

        {debugInfo && (
          <Banner status="info">
            <BlockStack spacing="extraTight">
              <Text fontWeight="bold">Debug Information:</Text>
              {debugInfo.requestedIds && (
                <Text size="small">Requested IDs: {debugInfo.requestedIds.slice(0, 3).join(', ')}{debugInfo.requestedIds.length > 3 ? '...' : ''}</Text>
              )}
              {debugInfo.totalRequested && (
                <Text size="small">Total Requested: {debugInfo.totalRequested}</Text>
              )}
              {debugInfo.successfullyFetched !== undefined && (
                <Text size="small">Successfully Fetched: {debugInfo.successfullyFetched}</Text>
              )}
              {debugInfo.failed !== undefined && (
                <Text size="small">Failed: {debugInfo.failed}</Text>
              )}
              {debugInfo.apiVersion && (
                <Text size="small">API Version: {debugInfo.apiVersion}</Text>
              )}
              {debugInfo.shop && (
                <Text size="small">Shop: {debugInfo.shop}</Text>
              )}
              {debugInfo.canAccessOrdersApi !== undefined && (
                <Text size="small">Can Access Orders API: {debugInfo.canAccessOrdersApi ? 'Yes' : 'No'}</Text>
              )}
            </BlockStack>
          </Banner>
        )}
        
        <Text size="small" color="subdued">
          This will send the selected orders to Rushrr for processing and courier booking.
        </Text>
      </BlockStack>
    </AdminAction>
  );
}