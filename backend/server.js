require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ===== XAVFSIZLIK QATLAMLARI =====
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Umumiy so'rovlar cheklovi: 15 daqiqada 300 tadan ortiq so'rov qabul qilinmaydi
const umumiyLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api/', umumiyLimit);

// Login/ro'yxatdan o'tishga alohida qattiqroq cheklov (parolni "urib ko'rish"dan himoya)
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { xato: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urinib ko'ring." }
});
app.use('/api/auth/login', authLimit);
app.use('/api/auth/register', authLimit);

// ===== YO'NALISHLAR (ROUTES) =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/mahallalar', require('./routes/mahallalar'));
app.use('/api/turlari', require('./routes/turlari'));
app.use('/api/users', require('./routes/users'));
app.use('/api/appeals', require('./routes/appeals'));
app.use('/api/history', require('./routes/history'));

app.get('/', (req, res) => {
  res.send('Yakkasaroy Yoshlar Markazi API ishlamoqda.');
});

// Umumiy xatoliklarni ushlab olish
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ xato: 'Kutilmagan server xatoligi yuz berdi.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} manzilida ishga tushdi.`);
});