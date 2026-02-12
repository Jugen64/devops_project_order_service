const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');

const index = express();
index.use(cors());
index.use(express.json());

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ecommerce',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    port: 5432,
});

// Health check
index.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Get all orders
index.get('/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create order
index.post('/orders', async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        // Verify product exists (call product service)
        const productResponse = await axios.get(`http://product-service:3001/products/${productId}`);
        const product = productResponse.data;

        const totalPrice = product.price * quantity;

        const result = await pool.query(
            'INSERT INTO orders (product_id, quantity, total_price, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [productId, quantity, totalPrice, 'pending']
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.response && err.response.status === 404) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(500).json({ error: 'Error creating order' });
    }
});

// Update order status
index.patch('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

const PORT = process.env.PORT || 3002;
index.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});