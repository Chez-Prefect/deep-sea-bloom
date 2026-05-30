const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const PRINTIFY_PRODUCT_ID = process.env.PRINTIFY_PRODUCT_ID;

const PRINTIFY_BASE = 'https://api.printify.com/v1';

// GET /api/variants — fetch product variants from Printify
app.get('/api/variants', async (req, res) => {
  try {
    const response = await fetch(
      `${PRINTIFY_BASE}/shops/${PRINTIFY_SHOP_ID}/products/${PRINTIFY_PRODUCT_ID}.json`,
      {
        headers: {
          Authorization: `Bearer ${PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
    const data = await response.json();
    // Return only what the frontend needs — never expose API key or internal IDs beyond variants
    const variants = data.variants.map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      is_available: v.is_available,
    }));
    res.json({ variants });
  } catch (err) {
    console.error('Error fetching variants:', err);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

// POST /api/order — place an order via Printify
app.post('/api/order', async (req, res) => {
  const { variantId, quantity, shippingAddress, email } = req.body;

  if (!variantId || !shippingAddress || !email) {
    return res.status(400).json({ error: 'Missing required fields: variantId, shippingAddress, email' });
  }

  const orderPayload = {
    external_id: `order-${Date.now()}`,
    label: 'Deep Sea Bloom Order',
    line_items: [
      {
        product_id: PRINTIFY_PRODUCT_ID,
        variant_id: variantId,
        quantity: quantity || 1,
      },
    ],
    shipping_method: 1,
    send_shipping_notification: true,
    address_to: {
      first_name: shippingAddress.firstName,
      last_name: shippingAddress.lastName,
      email: email,
      phone: shippingAddress.phone || '',
      country: shippingAddress.country,
      region: shippingAddress.region || '',
      address1: shippingAddress.address1,
      address2: shippingAddress.address2 || '',
      city: shippingAddress.city,
      zip: shippingAddress.zip,
    },
  };

  try {
    const response = await fetch(
      `${PRINTIFY_BASE}/shops/${PRINTIFY_SHOP_ID}/orders.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      }
    );
    if (!response.ok) {
      const err = await response.text();
      console.error('Printify order error:', err);
      return res.status(response.status).json({ error: 'Order failed. Please try again.' });
    }
    const data = await response.json();
    res.json({ success: true, orderId: data.id });
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ error: 'Server error placing order' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Chez Prefect server running on port ${PORT}`);
});