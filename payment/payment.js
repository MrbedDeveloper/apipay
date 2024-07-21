const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

// Инициализация базы данных SQLite
const db = new sqlite3.Database('database.db');

// Создание таблицы платежей
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, amount REAL, status TEXT, created_at TEXT, api_key TEXT)');
});

// Инициализация базы данных пользователей
const userDb = new sqlite3.Database('users.db');



// Middleware для проверки ключа API
function authenticateApiKey(req, res, next) {
  const apiKey = req.query.apiKey;
  userDb.get('SELECT * FROM users WHERE apiKey = ?', [apiKey], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to authenticate API key' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }
    next();
  });
}

// Middleware для обработки JSON-запросов
app.use(bodyParser.json());

// Защищенный маршрут для создания платежа
app.post('/api/pay', authenticateApiKey, (req, res) => {
  const { amount } = req.body;
  const apiKey = req.query.apiKey;
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  const id = uuidv4();
  const status = 'pending';
  const createdAt = new Date().toISOString();

  db.run('INSERT INTO payments (id, amount, status, created_at, api_key) VALUES (?, ?, ?, ?, ?)', [id, amount, status, createdAt, apiKey], function (err) {
    if (err) {
      console.error('Error inserting payment:', err.message);
      return res.status(500).json({ error: 'Failed to create payment' });
    }
    res.json({ paymentUrl: `https://13jns6qx-3000.euw.devtunnels.ms/payment?id=${id}`, id });
  });
});

// Маршрут для отображения информации о платеже
app.get('/payment', (req, res) => {
  const id = req.query.id;

  db.get('SELECT * FROM payments WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to retrieve payment' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Проверка, истек ли срок действия платежа
    const now = new Date();
    const createdAt = new Date(row.created_at);
    const fifteenMinutesInMilliseconds = 15 * 60 * 1000;
    const isExpired = now - createdAt > fifteenMinutesInMilliseconds;

    if (isExpired) {
      row.status = 'expired';
      db.run('UPDATE payments SET status = ? WHERE id = ?', ['expired', id]);
      res.send('<h1>Payment Information</h1><p>This payment link has expired.</p>');
    } else {
      res.sendFile(path.join(__dirname, 'payment.html'));
    }
  });
});

// Маршрут для получения информации о платеже
app.get('/api/payments/:id', (req, res) => {
  const id = req.params.id;

  db.get('SELECT * FROM payments WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to retrieve payment' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Проверка, истек ли срок действия платежа
    const now = new Date();
    const createdAt = new Date(row.created_at);
    const fifteenMinutesInMilliseconds = 15 * 60 * 1000;
    const isExpired = now - createdAt > fifteenMinutesInMilliseconds;

    if (isExpired) {
      row.status = 'expired';
      db.run('UPDATE payments SET status = ? WHERE id = ?', ['expired', id]);
      res.json({ error: 'This payment link has expired.' });
    } else {
      res.json(row);
    }
  });
});

// Новый маршрут для обработки успешного платежа
app.post('/api/payments/:id/success', (req, res) => {
  const id = req.params.id;

  db.run('UPDATE payments SET status = ? WHERE id = ?', ['completed', id], function (err) {
    if (err) {
      console.error('Error updating payment status:', err.message);
      return res.status(500).json({ error: 'Failed to update payment status' });
    }
    res.json({ success: true });
  });
});

// Новый маршрут для получения статуса платежа
app.get('/api/payments/:id/status', (req, res) => {
  const id = req.params.id;

  db.get('SELECT status FROM payments WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to retrieve payment status' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ status: row.status });
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
