const express = require('express');
const router = express.Router();
const pool = require('../db');
const { talabQilinganKirish, faqatAdmin } = require('../middleware/auth');

// Barcha yoshlar yetakchilarini olish (holat bo'yicha filtrlab)
router.get('/', talabQilinganKirish, faqatAdmin, async (req, res) => {
  const { holat } = req.query;
  let sql = `SELECT f.*, m.nomi AS mahalla_nomi FROM foydalanuvchilar f
             LEFT JOIN mahallalar m ON f.mahalla_id = m.id
             WHERE f.rol = 'leader'`;
  const params = [];
  if (holat) {
    params.push(holat);
    sql += ` AND f.holat = $${params.length}`;
  }
  sql += ' ORDER BY f.created_at DESC';
  const natija = await pool.query(sql, params);
  natija.rows.forEach(r => delete r.parol_hash);
  res.json(natija.rows);
});

router.put('/:id/approve', talabQilinganKirish, faqatAdmin, async (req, res) => {
  await pool.query(`UPDATE foydalanuvchilar SET holat='tasdiqlangan', rad_sababi=NULL WHERE id=$1`, [req.params.id]);
  await pool.query(`INSERT INTO harakatlar_tarixi (foydalanuvchi_id, amal, tafsilot) VALUES ($1,$2,$3)`,
    [req.foydalanuvchi.id, 'Foydalanuvchi tasdiqlandi', 'ID: ' + req.params.id]);
  res.json({ xabar: 'Tasdiqlandi.' });
});

router.put('/:id/reject', talabQilinganKirish, faqatAdmin, async (req, res) => {
  const { sabab } = req.body;
  await pool.query(`UPDATE foydalanuvchilar SET holat='rad_etilgan', rad_sababi=$1 WHERE id=$2`, [sabab || '', req.params.id]);
  await pool.query(`INSERT INTO harakatlar_tarixi (foydalanuvchi_id, amal, tafsilot) VALUES ($1,$2,$3)`,
    [req.foydalanuvchi.id, 'Foydalanuvchi rad etildi', sabab || '']);
  res.json({ xabar: 'Rad etildi.' });
});

router.put('/:id/block', talabQilinganKirish, faqatAdmin, async (req, res) => {
  await pool.query(`UPDATE foydalanuvchilar SET holat='bloklangan' WHERE id=$1`, [req.params.id]);
  await pool.query(`INSERT INTO harakatlar_tarixi (foydalanuvchi_id, amal, tafsilot) VALUES ($1,$2,$3)`,
    [req.foydalanuvchi.id, 'Foydalanuvchi bloklandi', 'ID: ' + req.params.id]);
  res.json({ xabar: 'Bloklandi.' });
});

router.put('/:id/reactivate', talabQilinganKirish, faqatAdmin, async (req, res) => {
  await pool.query(`UPDATE foydalanuvchilar SET holat='tasdiqlangan' WHERE id=$1`, [req.params.id]);
  await pool.query(`INSERT INTO harakatlar_tarixi (foydalanuvchi_id, amal, tafsilot) VALUES ($1,$2,$3)`,
    [req.foydalanuvchi.id, 'Foydalanuvchi qayta faollashtirildi', 'ID: ' + req.params.id]);
  res.json({ xabar: 'Qayta faollashtirildi.' });
});

// O'z profilini olish/yangilash
router.get('/men', talabQilinganKirish, async (req, res) => {
  const natija = await pool.query(
    `SELECT f.*, m.nomi AS mahalla_nomi FROM foydalanuvchilar f
     LEFT JOIN mahallalar m ON f.mahalla_id = m.id WHERE f.id=$1`, [req.foydalanuvchi.id]);
  const u = natija.rows[0];
  if (u) delete u.parol_hash;
  res.json(u);
});

router.put('/men/profil', talabQilinganKirish, async (req, res) => {
  const { telefon, email } = req.body;
  await pool.query('UPDATE foydalanuvchilar SET telefon=$1, email=$2 WHERE id=$3', [telefon, email, req.foydalanuvchi.id]);
  res.json({ xabar: 'Yangilandi.' });
});

router.put('/men/parol', talabQilinganKirish, async (req, res) => {
  const bcrypt = require('bcrypt');
  const { eski_parol, yangi_parol } = req.body;
  const natija = await pool.query('SELECT parol_hash FROM foydalanuvchilar WHERE id=$1', [req.foydalanuvchi.id]);
  const mos = await bcrypt.compare(eski_parol, natija.rows[0].parol_hash);
  if (!mos) return res.status(400).json({ xato: "Joriy parol noto'g'ri." });
  if (!yangi_parol || yangi_parol.length < 6) return res.status(400).json({ xato: 'Yangi parol kamida 6 belgi.' });
  const yangi_hash = await bcrypt.hash(yangi_parol, 10);
  await pool.query('UPDATE foydalanuvchilar SET parol_hash=$1 WHERE id=$2', [yangi_hash, req.foydalanuvchi.id]);
  res.json({ xabar: "Parol o'zgartirildi." });
});

module.exports = router;