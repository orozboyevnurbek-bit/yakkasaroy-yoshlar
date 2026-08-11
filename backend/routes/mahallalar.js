const express = require('express');
const router = express.Router();
const pool = require('../db');
const { talabQilinganKirish, faqatAdmin } = require('../middleware/auth');

// Hammaga ochiq — ro'yxatdan o'tish formasida kerak
router.get('/', async (req, res) => {
  const natija = await pool.query('SELECT * FROM mahallalar ORDER BY nomi');
  res.json(natija.rows);
});

// Faqat admin qo'sha oladi
router.post('/', talabQilinganKirish, faqatAdmin, async (req, res) => {
  const { nomi } = req.body;
  if (!nomi) return res.status(400).json({ xato: 'Mahalla nomini kiriting.' });
  const natija = await pool.query('INSERT INTO mahallalar (nomi) VALUES ($1) RETURNING *', [nomi]);
  res.json(natija.rows[0]);
});

router.delete('/:id', talabQilinganKirish, faqatAdmin, async (req, res) => {
  await pool.query('DELETE FROM mahallalar WHERE id = $1', [req.params.id]);
  res.json({ xabar: "O'chirildi." });
});

module.exports = router;