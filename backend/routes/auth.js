const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// ============ RO'YXATDAN O'TISH (Yoshlar yetakchisi) ============
router.post('/register', async (req, res) => {
  const { familiya, ism, otasining_ismi, telefon, email, mahalla_id, lavozim, login, parol } = req.body;

  if (!familiya || !ism || !telefon || !mahalla_id || !lavozim || !login || !parol) {
    return res.status(400).json({ xato: "Barcha majburiy maydonlarni to'ldiring." });
  }
  if (parol.length < 6) {
    return res.status(400).json({ xato: "Parol kamida 6 belgidan iborat bo'lishi kerak." });
  }

  try {
    const mavjud = await pool.query('SELECT id FROM foydalanuvchilar WHERE login = $1', [login]);
    if (mavjud.rows.length > 0) {
      return res.status(400).json({ xato: 'Bu login band. Boshqa login tanlang.' });
    }

    const parol_hash = await bcrypt.hash(parol, 10);

    await pool.query(
      `INSERT INTO foydalanuvchilar
       (familiya, ism, otasining_ismi, telefon, email, mahalla_id, lavozim, login, parol_hash, rol, holat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'leader','kutilmoqda')`,
      [familiya, ism, otasining_ismi, telefon, email, mahalla_id, lavozim, login, parol_hash]
    );

    res.json({ xabar: 'Arizangiz yuborildi. Administrator tasdiqlashini kuting.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ xato: 'Server xatoligi yuz berdi.' });
  }
});

// ============ TIZIMGA KIRISH ============
router.post('/login', async (req, res) => {
  const { login, parol } = req.body;
  if (!login || !parol) {
    return res.status(400).json({ xato: 'Login va parolni kiriting.' });
  }

  try {
    const natija = await pool.query('SELECT * FROM foydalanuvchilar WHERE login = $1', [login]);
    const foydalanuvchi = natija.rows[0];

    if (!foydalanuvchi) {
      return res.status(401).json({ xato: "Login yoki parol noto'g'ri." });
    }

    const mosMi = await bcrypt.compare(parol, foydalanuvchi.parol_hash);
    if (!mosMi) {
      return res.status(401).json({ xato: "Login yoki parol noto'g'ri." });
    }

    if (foydalanuvchi.holat === 'bloklangan') {
      return res.status(403).json({ xato: "Hisobingiz bloklangan. Administrator bilan bog'laning." });
    }

    const token = jwt.sign(
      { id: foydalanuvchi.id, rol: foydalanuvchi.rol, mahalla_id: foydalanuvchi.mahalla_id, holat: foydalanuvchi.holat },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    delete foydalanuvchi.parol_hash;
    res.json({ token, foydalanuvchi });
  } catch (err) {
    console.error(err);
    res.status(500).json({ xato: 'Server xatoligi yuz berdi.' });
  }
});

module.exports = router;