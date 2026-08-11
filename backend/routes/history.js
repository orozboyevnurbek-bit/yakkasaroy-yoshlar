const express = require('express');
const router = express.Router();
const pool = require('../db');
const { talabQilinganKirish, faqatAdmin } = require('../middleware/auth');

router.get('/', talabQilinganKirish, faqatAdmin, async (req, res) => {
  const natija = await pool.query(`
    SELECT h.*, f.familiya, f.ism FROM harakatlar_tarixi h
    LEFT JOIN foydalanuvchilar f ON h.foydalanuvchi_id = f.id
    ORDER BY h.sana DESC LIMIT 300`);
  res.json(natija.rows);
});

module.exports = router;