const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 3001;
const saltRounds = 10;

// Инициализация базы данных SQLite для пользователей
const userDb = new sqlite3.Database('users.db');

// Инициализация базы данных SQLite для платежей
const paymentDb = new sqlite3.Database('database.db');

// Создание таблицы пользователей
userDb.serialize(() => {
  userDb.run('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, password TEXT, apiKey TEXT)');
});


// Middleware для обработки JSON-запросов и form-urlencoded
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Установка EJS как шаблонизатор
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Установка статической папки для стилей и скриптов
app.use(express.static(path.join(__dirname, 'public')));

// Маршрут для отображения страницы регистрации
app.get('/register', (req, res) => {
  res.render('register');
});

// Маршрут для обработки регистрации
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('register', { error: 'Все поля должны быть заполнены' });
  }

  // Хеширование пароля
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      return res.render('register', { error: 'Ошибка при хешировании пароля' });
    }

    const id = uuidv4();
    const apiKey = uuidv4().replace(/-/g, '').substring(0, 16);

    // Сохранение пользователя в базе данных
    userDb.run('INSERT INTO users (id, username, password, apiKey) VALUES (?, ?, ?, ?)', [id, username, hash, apiKey], (err) => {
      if (err) {
        return res.render('register', { error: 'Ошибка при сохранении пользователя' });
      }

      res.redirect('/login');
    });
  });
});

// Маршрут для отображения страницы входа
app.get('/login', (req, res) => {
  res.render('login');
});

// Маршрут для обработки входа
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { error: 'Все поля должны быть заполнены' });
  }

  // Проверка пользователя в базе данных
  userDb.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.render('login', { error: 'Неверное имя пользователя или пароль' });
    }

    // Сравнение паролей
    bcrypt.compare(password, user.password, (err, result) => {
      if (err || !result) {
        return res.render('login', { error: 'Неверное имя пользователя или пароль' });
      }

      // Получение транзакций пользователя
      paymentDb.all('SELECT * FROM payments WHERE api_key = ?', [user.apiKey], (err, transactions) => {
        if (err) {
          return res.render('dashboard', { error: 'Ошибка при получении транзакций', username: user.username, apiKey: user.apiKey, transactions: [] });
        }

        // Рендеринг личного кабинета с транзакциями
        res.render('dashboard', { username: user.username, apiKey: user.apiKey, transactions });
      });
    });
  });
});

// Маршрут для отображения информации о платеже


// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});