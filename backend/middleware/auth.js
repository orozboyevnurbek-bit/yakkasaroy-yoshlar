const jwt = require('jsonwebtoken');

// Foydalanuvchi tizimga kirganligini tekshiradi (token orqali)
function talabQilinganKirish(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ xato: 'Kirish uchun token talab qilinadi.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, foydalanuvchi) => {
    if (err) {
      return res.status(403).json({ xato: 'Token yaroqsiz yoki muddati tugagan.' });
    }
    req.foydalanuvchi = foydalanuvchi; // { id, rol, mahalla_id }
    next();
  });
}

// Faqat administrator kira oladigan yo'llar uchun
function faqatAdmin(req, res, next) {
  if (req.foydalanuvchi.rol !== 'admin') {
    return res.status(403).json({ xato: 'Bu amal faqat administrator uchun ruxsat etilgan.' });
  }
  next();
}

module.exports = { talabQilinganKirish, faqatAdmin };