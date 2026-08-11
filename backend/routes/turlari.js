const express = require('express');
const router = express.Router();
const pool = require('../db');
const { talabQilinganKirish, faqatAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const natija = await pool.query('SELECT * FROM murojaat_turlari ORDER BY id');
  res.json(natija.rows);
});

router.post('/', talabQilinganKirish, faqatAdmin, async (req, res) => {
  const { nomi } = req.body;
  if (!nomi) return res.status(400).json({ xato: 'Tur nomini kiriting.' });
  const natija = await pool.query('INSERT INTO murojaat_turlari (nomi) VALUES ($1) RETURNING *', [nomi]);
  res.json(natija.rows[0]);
});

router.put('/:id/toggle', talabQilinganKirish, faqatAdmin, async (req, res) => {
  const natija = await pool.query(
    'UPDATE murojaat_turlari SET faol = NOT faol WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  res.json(natija.rows[0]);
});

router.delete('/:id', talabQilinganKirish, faqatAdmin, async (req, res) => {
  await pool.query('DELETE FROM murojaat_turlari WHERE id = $1', [req.params.id]);
  res.json({ xabar: "O'chirildi." });
});

module.exports = router;