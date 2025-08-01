import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-details.action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { close, data } = useApi(TARGET);
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (data?.selected?.[0]?.id) {
      const gid = data.selected[0].id;
      const id = gid.split('/').pop(); // Extract numeric ID from GID
      setOrderId(id);
    }
  }, [data]);

  useEffect(() => {
    if (orderId) {
      setIsLoading(true);

      // 👇 Replace with your current tunnel URL or use relative path
      fetch("/resources/order-details", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ orderId }),
})

        .then((res) => res.json())
        .then((data) => {
          if (data.order?.customer) {
            const { first_name, last_name } = data.order.customer;
            setCustomerName(`${first_name} ${last_name}`);
              console.log(data);

          } else {
            setCustomerName("Customer info not found");
          }
        })
        .catch((err) => {
          console.error("Fetch error:", err);
          setCustomerName("Error fetching order");
        })
        .finally(() => setIsLoading(false));
    }
  }, [orderId]);

  return (
    <AdminAction
      primaryAction={
        <Button loading={isLoading} disabled={!orderId}>
          Move to App
        </Button>
      }
      secondaryAction={<Button onPress={close}>Cancel</Button>}
    >
      <BlockStack spacing="tight">
        <Text fontWeight="bold">Order Details</Text>
        <Text>Order ID: {orderId || "Loading..."}</Text>
        <Text>Customer Name: {customerName || "Loading..."}</Text>
      </BlockStack>
    </AdminAction>
  );
}
