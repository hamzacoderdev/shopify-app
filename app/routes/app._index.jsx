import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  TextField,
  Button,
  BlockStack,
  Select,
  Box,
  Banner,
  IndexTable,
  useIndexResourceState,
  Spinner,
  Modal,
  Divider,
  Badge,
  Icon,
  InlineStack,
  Tooltip,
} from "@shopify/polaris";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const cities = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Hyderabad",
  "Gujranwala",
  "Bahawalpur",
  "Sargodha",
  "Sukkur",
  "Abbottabad",
  "Mardan",
  "Swat",
  "Dera Ghazi Khan",
  "Sheikhupura",
  "Jhelum",
];

// --- 1. Get shop data from session
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return {
    shopifyStoreName: session.shop.split(".")[0],
    shopifyStoreUrl: `https://${session.shop}`,
  };
};

// Airway Bill PDF Generator
const generateAirwayBill = async (order) => {
  const pdf = new jsPDF();
  const shopifyData = order.shopifyOrderData || {};
  const customer = shopifyData.customer || {};
  const billingAddress = shopifyData.billing_address || {};
  const shippingAddress = shopifyData.shipping_address || {};

  // Generate QR Code with order details
  const qrData = JSON.stringify({
    orderNumber: shopifyData.order_number,
    customer: `${customer.first_name} ${customer.last_name}`,
    city: billingAddress.city,
    amount: shopifyData.total_price,
    currency: shopifyData.currency,
    phone: shippingAddress.phone,
    address: shippingAddress.address1
  });

  try {
    const qrCodeDataURL = await QRCode.toDataURL(qrData, { width: 100, margin: 1 });

    // PDF Design
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    // Header with gradient effect
    pdf.setFillColor(41, 128, 185);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    // Company Logo/Title
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RUSHRR COURIER', pageWidth / 2, 25, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Express Delivery Service', pageWidth / 2, 35, { align: 'center' });

    // Airway Bill Title
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('AIRWAY BILL', pageWidth / 2, 55, { align: 'center' });

    // Order Information Box
    pdf.setDrawColor(52, 73, 94);
    pdf.setLineWidth(1);
    pdf.rect(15, 65, pageWidth - 30, 25);
    
    pdf.setFillColor(236, 240, 241);
    pdf.rect(15, 65, pageWidth - 30, 25, 'F');
    
    pdf.setTextColor(52, 73, 94);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Order #: ${shopifyData.order_number || 'N/A'}`, 20, 75);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, 85);
    
    // Customer Details Section
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(52, 73, 94);
    pdf.text('CUSTOMER DETAILS', 20, 105);
    
    pdf.setDrawColor(52, 73, 94);
    pdf.line(20, 108, pageWidth - 20, 108);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    
    const customerDetails = [
      `Name: ${customer.first_name || ''} ${customer.last_name || ''}`,
      `Email: ${customer.email || 'N/A'}`,
      `Phone: ${shippingAddress.phone || 'N/A'}`,
      `City: ${billingAddress.city || 'N/A'}`
    ];
    
    customerDetails.forEach((detail, index) => {
      pdf.text(detail, 20, 120 + (index * 8));
    });

    // Shipping Address Section
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(52, 73, 94);
    pdf.text('SHIPPING ADDRESS', 20, 160);
    
    pdf.line(20, 163, pageWidth - 20, 163);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(shippingAddress.address1 || 'N/A', 20, 175);
    pdf.text(`${shippingAddress.city || ''}, ${shippingAddress.country || ''}`, 20, 185);
    pdf.text(`Postal Code: ${shippingAddress.zip || 'N/A'}`, 20, 195);

    // Order Summary Section
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(52, 73, 94);
    pdf.text('ORDER SUMMARY', 20, 215);
    
    pdf.line(20, 218, pageWidth - 20, 218);
    
    pdf.setFillColor(241, 196, 15);
    pdf.rect(15, 225, pageWidth - 30, 20, 'F');
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Total Amount: ${shopifyData.total_price || '0.00'} ${shopifyData.currency || 'PKR'}`, 20, 235);
    pdf.text(`COD: ${order.codCollected || 'N/A'}`, 20, 242);

    // QR Code
    pdf.addImage(qrCodeDataURL, 'PNG', pageWidth - 60, 120, 40, 40);
    pdf.setFontSize(10);
    pdf.text('Scan for Details', pageWidth - 55, 170, { align: 'center' });

    // Footer
    pdf.setFillColor(52, 73, 94);
    pdf.rect(0, pageHeight - 30, pageWidth, 30, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.text('© 2025 Rushrr Courier - Express Delivery Service', pageWidth / 2, pageHeight - 15, { align: 'center' });
    pdf.text('For support: support@rushrr.com | Tel: +92-XXX-XXXXXXX', pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Save PDF
    pdf.save(`Airway-Bill-${shopifyData.order_number || order.id}.pdf`);
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    alert('Error generating airway bill. Please try again.');
  }
};

function RushrrDashboard({ token }) {
  const [orders, setOrders] = useState([]);
  const [bookedOrders, setBookedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState(null);
  const [originalOrder, setOriginalOrder] = useState(null);
  const [editedOrder, setEditedOrder] = useState(null);
  console.log(editedOrder)
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("api/orders", { method: "GET" });
        const data = await res.json();
        if (data.success) {
          setOrders(data.orders);
        }
      } catch (err) {
        console.error("Failed to fetch orders", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

 const handleEditClick = (order) => {
  setActiveOrder(order);

  const mapped = mapOrderForEditing(order);
  setEditedOrder(mapped);
  setOriginalOrder(mapped); // Save baseline
};

function getAllowedOrderUpdates(original, edited) {
  const updates = {};

  if (original.customerEmail !== edited.customerEmail) {
    updates.email = edited.customerEmail;
  }

  if (original.currency !== edited.currency) {
    updates.currency = edited.currency;
  }

  if (original.totalPrice !== edited.totalPrice) {
    updates.total_price = edited.totalPrice;
  }

  // SHIPPING ADDRESS CHANGES
  const shippingChangedFields = {};
  if (original.shippingAddress?.city !== edited.shippingAddress?.city) {
    shippingChangedFields.city = edited.shippingAddress.city;
  }
  if (original.shippingAddress?.phone !== edited.shippingAddress?.phone) {
    shippingChangedFields.phone = edited.shippingAddress.phone;
  }
  if (original.shippingAddress?.address1 !== edited.shippingAddress?.address1) {
    shippingChangedFields.address1 = edited.shippingAddress.address1;
  }
  if (Object.keys(shippingChangedFields).length > 0) {
    updates.shipping_address = shippingChangedFields;
  }

  // BILLING ADDRESS CHANGES
  const billingChangedFields = {};
  if (original.billingAddress?.city !== edited.billingAddress?.city) {
    billingChangedFields.city = edited.billingAddress.city;
  }
  if (original.billingAddress?.address1 !== edited.billingAddress?.address1) {
    billingChangedFields.address1 = edited.billingAddress.address1;
  }
  if (Object.keys(billingChangedFields).length > 0) {
    updates.billing_address = billingChangedFields;
  }

  return updates;
}





  const handleSaveEdit = async () => {
  if (!activeOrder?.id || !originalOrder) return;

  const updates = getAllowedOrderUpdates(originalOrder, editedOrder);

  if (Object.keys(updates).length === 0) {
    alert("No changes to save.");
    return;
  }

  try {
    const res = await fetch(`https://backend.rushr-admin.com/api/orders/update?id=${activeOrder.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates),
    });

    const data = await res.json();

    if (res.ok) {
      alert("Order updated successfully!");
      setActiveOrder(null);
    } else {
      alert(data?.message || "Update failed.");
    }
  } catch (err) {
    console.error("Update error:", err);
    alert("An error occurred while updating the order.");
  }
};






  const handleUploadBookings = async () => {
  if (selectedResources.length === 0) {
    alert("Please select at least one order.");
    return;
  }

  setBookingLoading(true);

  try {
    // Filter selected orders
    const selectedOrders = orders.filter(order => selectedResources.includes(order.id));

    // Extract their Shopify Order IDs
    const shopifyOrderIds = selectedOrders.map(order => order.shopifyOrderId);

    const res = await fetch("https://backend.rushr-admin.com/api/orders/book", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId: shopifyOrderIds }), // <-- note: plural
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Generate airway bills
      for (const order of selectedOrders) {
        await generateAirwayBill(order);
      }

      setBookedOrders((prev) => [...prev, ...selectedOrders]);
      const remaining = orders.filter(order => !selectedResources.includes(order.id));
      setOrders(remaining);

      alert(`${selectedOrders.length} order(s) booked successfully! Airway bills have been downloaded.`);
    } else {
      alert(data.message || "Booking failed");
    }
  } catch (err) {
    console.error("Booking failed:", err);
    alert("An error occurred while booking orders.");
  } finally {
    setBookingLoading(false);
  }
};


  const selectedOrders = orders.filter((order) => order.status === "unbooked");

  const rows = selectedOrders.map((order, index) => {
    const shopifyData = order.shopifyOrderData || {};
    const customer = shopifyData.customer || {};
    const billingAddress = shopifyData.billing_address || {};
    const shippingAddress = shopifyData.shipping_address || {};

    return (
      <IndexTable.Row
        id={order.id}
        key={order.id}
        selected={selectedResources.includes(order.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="medium">
            {index + 1}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="info">{shopifyData.order_number || "-"}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="medium">
            {`${customer.first_name || ""} ${customer.last_name || ""}`}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="attention">{billingAddress.city || "-"}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd">{order.codCollected ?? "N/A"}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="warning">{order.status || "Unbooked"}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" color="subdued">
            {shippingAddress.address1 || "N/A"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="semibold" color="success">
            {`${shopifyData.total_price || "0.00"} ${
              shopifyData.currency || "PKR"
            }`}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button size="slim" onClick={() => handleEditClick(order)}>
            Edit
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  if (loading) {
    return (
      <Page fullWidth>
        <Layout>
          <Layout.Section>
            <Card>
              <Box padding="800" textAlign="center">
                <Spinner size="large" />
                <Box paddingBlockStart="400">
                  <Text variant="headingMd">Loading orders...</Text>
                </Box>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page fullWidth>
      <Layout>
        {/* Modern Header */}
        <Layout.Section>
          <Card>
            <Box padding="600">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="400" blockAlign="center">
                  <img
                    src="https://res.cloudinary.com/dgiqiysh5/image/upload/v1750681695/WhatsApp_Image_2025-06-23_at_16.02.36_vyjear.jpg"
                    alt="Rushrr Logo"
                    style={{ 
                      height: "50px", 
                      borderRadius: "8px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                    }}
                  />
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h1">
                      📦 Rushrr Courier Dashboard
                    </Text>
                    <Text variant="bodyMd" color="subdued">
                      Manage and book orders from your Shopify store with automated airway bill generation
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Box>
                  <Badge tone="success" size="large">
                    {selectedOrders.length} Unbooked Orders
                  </Badge>
                </Box>
              </InlineStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Statistics Cards */}
        <Layout.Section>
          <InlineStack gap="400">
            <div style={{ flex: 1 }}>
              <Card>
                <Box padding="400" textAlign="center">
                  <Text variant="headingXl" color="success">
                    {selectedOrders.length}
                  </Text>
                  <Text variant="bodyMd" color="subdued">
                    Unbooked Orders
                  </Text>
                </Box>
              </Card>
            </div>
            <div style={{ flex: 1 }}>
              <Card>
                <Box padding="400" textAlign="center">
                  <Text variant="headingXl" color="info">
                    {bookedOrders.length}
                  </Text>
                  <Text variant="bodyMd" color="subdued">
                    Booked Orders
                  </Text>
                </Box>
              </Card>
            </div>
           
          </InlineStack>
        </Layout.Section>

        {/* Unbooked Orders Table */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd">Unbooked Orders</Text>
                <Button 
                  variant="primary" 
                  onClick={handleUploadBookings}
                  loading={bookingLoading}
                  disabled={selectedResources.length === 0}
                  size="large"
                >
                  {bookingLoading ? 'Booking & Generating Bills...' : `Book ${selectedResources.length} Orders`}
                </Button>
              </InlineStack>
            </Box>
            
            <IndexTable
              resourceName={{ singular: "order", plural: "orders" }}
              itemCount={selectedOrders.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "#" },
                { title: "Order #" },
                { title: "Customer" },
                { title: "City" },
                { title: "COD" },
                { title: "Status" },
                { title: "Shipping Address" },
                { title: "Amount" },
                { title: "Actions" }
              ]}
              selectable
            >
              {rows}
            </IndexTable>
          </Card>
        </Layout.Section>

        {/* Booked Orders Table */}
        {bookedOrders.length > 0 && (
          <Layout.Section>
            <Card>
              <Box padding="400">
                <Text variant="headingMd">Recently Booked Orders</Text>
              </Box>
              
              <IndexTable
                resourceName={{
                  singular: "booked order",
                  plural: "booked orders"
                }}
                itemCount={bookedOrders.length}
                headings={[
                  { title: "#" },
                  { title: "Order #" },
                  { title: "Customer" },
                  { title: "City" },
                  { title: "COD" },
                  { title: "Status" },
                  { title: "Shipping Address" },
                  { title: "Amount" },
                  { title: "Airway Bill" }
                ]}
                selectable={false}
              >
                {bookedOrders.map((order, index) => {
                  const shopifyData = order.shopifyOrderData || {};
                  const customer = shopifyData.customer || {};
                  const billingAddress = shopifyData.billing_address || {};
                  const shippingAddress = shopifyData.shipping_address || {};

                  return (
                    <IndexTable.Row
                      id={`booked-${order.id}`}
                      key={order.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Text variant="bodyMd" fontWeight="medium">
                          {index + 1}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone="info">{shopifyData.order_number || "-"}</Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodyMd" fontWeight="medium">
                          {`${customer.first_name || ""} ${customer.last_name || ""}`}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone="attention">{billingAddress.city || "-"}</Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodyMd">{order.codCollected ?? "N/A"}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone="success">Booked</Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodyMd" color="subdued">
                          {shippingAddress.address1 || "N/A"}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodyMd" fontWeight="semibold" color="success">
                          {`${shopifyData.total_price || "0.00"} ${
                            shopifyData.currency || "PKR"
                          }`}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Button 
                          size="slim" 
                          onClick={() => generateAirwayBill(order)}
                          tone="success"
                        >
                          Download Bill
                        </Button>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {/* Edit Order Modal */}
      {activeOrder && (
        <Modal
          open
          onClose={() => setActiveOrder(null)}
          title={`Edit Order #${activeOrder.orderNumber}`}
          primaryAction={{
            content: "Save Changes",
            onAction: handleSaveEdit,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setActiveOrder(null) }
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                label="Customer Name"
                value={editedOrder.customerName || ""}
                onChange={(val) => setEditedOrder({ ...editedOrder, customerName: val })}
              />
              <TextField
                label="Customer Email"
                value={editedOrder.customerEmail || ""}
                onChange={(val) => setEditedOrder({ ...editedOrder, customerEmail: val })}
              />
              <Select
                label="City"
                options={cities.map((city) => ({ label: city, value: city }))}
                value={editedOrder.shippingAddress?.city || ""}
                onChange={(val) =>
                  setEditedOrder({
                    ...editedOrder,
                    shippingAddress: {
                      ...editedOrder.shippingAddress,
                      city: val,
                    },
                  })
                }
              />
              <TextField
                label="Billing Address"
                value={editedOrder.billingAddress?.address1 || ""}
                onChange={(val) =>
                  setEditedOrder({
                    ...editedOrder,
                    billingAddress: {
                      ...editedOrder.billingAddress,
                      address1: val,
                    },
                  })
                }
              />
              <TextField
                label="Shipping Address"
                value={editedOrder.shippingAddress?.address1 || ""}
                onChange={(val) =>
                  setEditedOrder({
                    ...editedOrder,
                    shippingAddress: {
                      ...editedOrder.shippingAddress,
                      address1: val,
                    },
                  })
                }
              />
              <TextField
                label="Phone (Shipping)"
                value={editedOrder.shippingAddress?.phone || ""}
                onChange={(val) =>
                  setEditedOrder({
                    ...editedOrder,
                    shippingAddress: {
                      ...editedOrder.shippingAddress,
                      phone: val,
                    },
                  })
                }
              />
              <TextField
                label="Total Price"
                type="number"
                value={editedOrder.totalPrice || ""}
                onChange={(val) => setEditedOrder({ ...editedOrder, totalPrice: val })}
              />
              <TextField
                label="Currency"
                value={editedOrder.currency || ""}
                onChange={(val) => setEditedOrder({ ...editedOrder, currency: val })}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}

function mapOrderForEditing(order) {
  const shopify = order.shopifyOrderData || {};
  const customer = shopify.customer || {};
  const billing = shopify.billing_address || {};
  const shipping = shopify.shipping_address || {};

  return {
    ...order,
    customerName: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
    customerEmail: shopify.email || shopify.contact_email || "",
    billingAddress: {
      address1: billing.address1 || "",
      city: billing.city || "",
      country: billing.country || "",
      zip: billing.zip || "",
    },
    shippingAddress: {
      address1: shipping.address1 || "",
      city: shipping.city || "",
      country: shipping.country || "",
      zip: shipping.zip || "",
      phone: shipping.phone || shopify.phone || "",
    },
    totalPrice: shopify.total_price || "",
    currency: shopify.currency || "",
  };
}


export default function SetupPage() {
  const { shopifyStoreName, shopifyStoreUrl } = useLoaderData();
  const [token, setToken] = useState("");
  const [responseMessage, setResponseMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStoreConnection = async () => {
      try {
        const res = await fetch("https://backend.rushr-admin.com/api/auth/verify-shopify-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopifyStoreUrl }),
        });

        const data = await res.json();
        if (res.ok && data?.success) {
          if (data.token) {
            await saveTokenToSession(data.token);
            setToken(data.token);
          }
          setIsConnected(true);
        }
      } catch (err) {
        console.error("Error checking store status", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkStoreConnection();
  }, [shopifyStoreUrl]);

  const saveTokenToSession = async (apiToken) => {
    try {
      await fetch("/api/save-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: apiToken }),
      });
    } catch (err) {
      console.error("Error saving token to session:", err);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch("https://backend.rushr-admin.com/api/auth/verify-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: token,
          shopifyStoreUrl,
          shopifyStoreName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsConnected(true);
        setResponseMessage({ type: "success", content: "Connection successful!" });
      } else {
        setResponseMessage({ type: "error", content: data?.error || "Failed to verify token." });
      }
    } catch (err) {
      setResponseMessage({ type: "error", content: "Network error or server unavailable." });
    }
  };

  if (isLoading) {
    return (
      <Page fullWidth>
        <Layout>
          <Layout.Section>
            <Card>
              <Box padding="800" textAlign="center">
                <Spinner accessibilityLabel="Checking connection..." size="large" />
                <Box paddingBlockStart="400">
                  <Text variant="headingMd">Checking store connection...</Text>
                </Box>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (isConnected) {
    return <RushrrDashboard token={token} />;
  }

  return (
    <Page fullWidth>
      <Layout>
        {/* Modern Setup Header */}
        <Layout.Section>
          <Card>
            <Box padding="600" textAlign="center">
              <img
                src="https://res.cloudinary.com/dgiqiysh5/image/upload/v1750681695/WhatsApp_Image_2025-06-23_at_16.02.36_vyjear.jpg"
                alt="Rushrr Logo"
                style={{ 
                  height: "80px", 
                  marginBottom: "20px",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                }}
              />
              <Text variant="displayMd" as="h1">
                Welcome to Rushrr Courier
              </Text>
              <Box paddingBlockStart="200">
                <Text variant="bodyLg" color="subdued">
                  Connect your Shopify store to start managing deliveries with automated airway bill generation
                </Text>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineStack gap="600" align="start">
            {/* Setup Guide */}
            <div style={{ flex: 1 }}>
              <Card>
                <Box padding="500">
                  <BlockStack gap="400">
                    <Text variant="headingMd">🚀 Quick Setup Guide</Text>
                    <Divider />
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="start">
                        <Badge tone="info">1</Badge>
                        <Text>Get your API token from your merchant dashboard</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="start">
                        <Badge tone="info">2</Badge>
                        <Text>Enter the token in the form and save settings</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="start">
                        <Badge tone="info">3</Badge>
                        <Text>Access the dashboard after successful verification</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="start">
                        <Badge tone="success">✓</Badge>
                        <Text>Start booking orders with auto airway bill generation</Text>
                      </InlineStack>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </Card>
            </div>

            {/* API Token Setup */}
            <div style={{ flex: 1 }}>
              <Card>
                <Box padding="500">
                  <BlockStack gap="400">
                    <Text variant="headingMd">🔐 API Configuration</Text>
                    <Divider />
                    <TextField
                      label="API Token"
                      value={token}
                      onChange={(val) => setToken(val)}
                      placeholder="Enter your Rushrr API token"
                      helpText="You can find this in your Rushrr merchant dashboard"
                    />
                    <Button 
                      variant="primary" 
                      onClick={handleSave}
                      size="large"
                      fullWidth
                    >
                      🚀 Connect & Verify
                    </Button>
                    
                    <Box>
                      <Text variant="bodyMd" color="subdued">
                        <strong>Default Weight:</strong> 0.5 kg
                      </Text>
                    </Box>

                    {responseMessage && (
                      <Banner
                        title={responseMessage.content}
                        status={responseMessage.type === "success" ? "success" : "critical"}
                      />
                    )}
                  </BlockStack>
                </Box>
              </Card>
            </div>
          </InlineStack>
        </Layout.Section>

        {/* Features Section */}
        <Layout.Section>
          <Card>
            <Box padding="500">
              <Text variant="headingMd" textAlign="center">
                ✨ Features You'll Get
              </Text>
              <Box paddingBlockStart="400">
                <InlineStack gap="600" align="start">
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <Box paddingBlockEnd="300">
                      <Text variant="headingLg">📦</Text>
                    </Box>
                    <Text variant="headingMd">Order Management</Text>
                    <Box paddingBlockStart="200">
                      <Text variant="bodyMd" color="subdued">
                        View, edit, and manage all your Shopify orders in one place
                      </Text>
                    </Box>
                  </div>
                  
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <Box paddingBlockEnd="300">
                      <Text variant="headingLg">📄</Text>
                    </Box>
                    <Text variant="headingMd">Airway Bills</Text>
                    <Box paddingBlockStart="200">
                      <Text variant="bodyMd" color="subdued">
                        Automatically generate professional airway bills with QR codes
                      </Text>
                    </Box>
                  </div>
                  
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <Box paddingBlockEnd="300">
                      <Text variant="headingLg">⚡</Text>
                    </Box>
                    <Text variant="headingMd">Bulk Booking</Text>
                    <Box paddingBlockStart="200">
                      <Text variant="bodyMd" color="subdued">
                        Book multiple orders at once and download all airway bills
                      </Text>
                    </Box>
                  </div>
                </InlineStack>
              </Box>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}