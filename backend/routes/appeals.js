const express = require('express');
const router = express.Router();
const pool = require('../db');
const { talabQilinganKirish } = require('../middleware/auth');

// ============ MUROJAATLAR RO'YXATI (filtrlash bilan) ============
router.get('/', talabQilinganKirish, async (req, res) => {
  const { mahalla_id, turi_id, holat, bandlik_holati, jins, dan, gacha, qidiruv } = req.query;
  const params = [];
  let sql = `
    SELECT mr.*, m.nomi AS mahalla_nomi, t.nomi AS turi_nomi,
           f.familiya AS yetakchi_familiya, f.ism AS yetakchi_ism
    FROM murojaatlar mr
    LEFT JOIN mahallalar m ON mr.mahalla_id = m.id
    LEFT JOIN murojaat_turlari t ON mr.turi_id = t.id
    LEFT JOIN foydalanuvchilar f ON mr.qabul_qildi_id = f.id
    WHERE 1=1
  `;

  // Yoshlar yetakchisi faqat o'z mahallasini ko'radi
  if (req.foydalanuvchi.rol === 'leader') {
    params.push(req.foydalanuvchi.mahalla_id);
    sql += ` AND mr.mahalla_id = $${params.length}`;
  } else if (mahalla_id) {
    params.push(mahalla_id);
    sql += ` AND mr.mahalla_id = $${params.length}`;
  }

  if (turi_id) { params.push(turi_id); sql += ` AND mr.turi_id = $${params.length}`; }
  if (holat) { params.push(holat); sql += ` AND mr.holat = $${params.length}`; }
  if (bandlik_holati) { params.push(bandlik_holati); sql += ` AND mr.bandlik_holati = $${params.length}`; }
  if (jins) { params.push(jins); sql += ` AND mr.m_jinsi = $${params.length}`; }
  if (dan) { params.push(dan); sql += ` AND mr.sana >= $${params.length}`; }
  if (gacha) { params.push(gacha + ' 23:59:59'); sql += ` AND mr.sana <= $${params.length}`; }
  if (qidiruv) {
    params.push('%' + qidiruv + '%');
    sql += ` AND (mr.m_familiya ILIKE $${params.length} OR mr.m_ism ILIKE $${params.length}
             OR mr.m_telefon ILIKE $${params.length} OR mr.mazmuni ILIKE $${params.length}
             OR mr.m_manzil ILIKE $${params.length})`;
  }

  sql += ' ORDER BY mr.sana DESC';
  const natija = await pool.query(sql, params);
  res.json(natija.rows);
});

// ============ BITTA MUROJAATNI TO'LIQ OLISH (tarix bilan) ============
router.get('/:id', talabQilinganKirish, async (req, res) => {
  const mr = await pool.query(`
    SELECT mr.*, m.nomi AS mahalla_nomi, t.nomi AS turi_nomi
    FROM murojaatlar mr
    LEFT JOIN mahallalar m ON mr.mahalla_id = m.id
    LEFT JOIN murojaat_turlari t ON mr.turi_id = t.id
    WHERE mr.id = $1`, [req.params.id]);

  if (!mr.rows[0]) return res.status(404).json({ xato: 'Murojaat topilmadi.' });

  // Yoshlar yetakchisi faqat o'z mahallasidagi murojaatni ko'ra oladi
  if (req.foydalanuvchi.rol === 'leader' && mr.rows[0].mahalla_id !== req.foydalanuvchi.mahalla_id) {
    return res.status(403).json({ xato: "Bu murojaatni ko'rishga ruxsatingiz yo'q." });
  }

  const tarix = await pool.query(`
    SELECT mt.*, f.familiya, f.ism FROM murojaat_tarixi mt
    LEFT JOIN foydalanuvchilar f ON mt.foydalanuvchi_id = f.id
    WHERE mt.murojaat_id = $1 ORDER BY mt.sana DESC`, [req.params.id]);

  res.json({ ...mr.rows[0], tarix: tarix.rows });
});

// ============ YANGI MUROJAAT QO'SHISH ============
router.post('/', talabQilinganKirish, async (req, res) => {
  const b = req.body;
  if (!b.m_familiya || !b.m_ism || !b.m_tugilgan_sana || !b.m_telefon || !b.mazmuni || !b.turi_id) {
    return res.status(400).json({ xato: "Majburiy maydonlarni to'ldiring." });
  }

  const mahalla_id = req.foydalanuvchi.mahalla_id; // leader faqat o'z mahallasiga qo'sha oladi

  const natija = await pool.query(`
    INSERT INTO murojaatlar
    (m_familiya, m_ism, m_otasining_ismi, m_tugilgan_sana, m_jinsi, m_telefon, m_manzil, mahalla_id,
     bandlik_holati, bandlik_izoh, turi_id, mazmuni, qabul_qildi_id, masul_tashkilot,
     korib_chiqish_muddati, holat, fayl_nomi)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'yangi',$16)
    RETURNING *`,
    [b.m_familiya, b.m_ism, b.m_otasining_ismi, b.m_tugilgan_sana, b.m_jinsi, b.m_telefon, b.m_manzil, mahalla_id,
     b.bandlik_holati, b.bandlik_izoh, b.turi_id, b.mazmuni, req.foydalanuvchi.id, b.masul_tashkilot,
     b.korib_chiqish_muddati || null, b.fayl_nomi]
  );

  const yangiMurojaat = natija.rows[0];

  await pool.query(
    `INSERT INTO murojaat_tarixi (murojaat_id, foydalanuvchi_id, holat, izoh) VALUES ($1,$2,'yangi',$3)`,
    [yangiMurojaat.id, req.foydalanuvchi.id, "Murojaat ro'yxatga olindi"]
  );
  await pool.query(
    `INSERT INTO harakatlar_tarixi (foydalanuvchi_id, amal, tafsilot) VALUES ($1,$2,$3)`,
    [req.foydalanuvchi.id, 'Yangi murojaat ro\'yxatga olindi', '№' + yangiMurojaat.tartib_raqami]
  );

  res.json(yangiMurojaat);
});

// ============ MUROJAAT HOLATINI / MA'LUMOTLARINI YANGILASH ============
router.put('/:id', talabQilinganKirish, async (req, res) => {
  const { holat, amalga_oshirilgan_ishlar, yakuniy_natija, izoh } = req.body;

  const mavjud = await pool.query('SELECT * FROM murojaatlar WHERE id=$1', [req.params.id]);
  if (!mavjud.rows[0]) return res.status(404).json({ xato: 'Murojaat topilmadi.' });

  if (req.foydalanuvchi.rol === 'leader' && mavjud.rows[0].mahalla_id !== req.foydalanuvchi.mahalla_id) {
    return res.status(403).json({ xato: 'Ruxsat yo\'q.' });
  }

  await pool.query(
    `UPDATE murojaatlar SET holat=$1, amalga_oshirilgan_ishlar=$2, yakuniy_natija=$3 WHERE id=$4`,
    [holat, amalga_oshirilgan_ishlar, yakuniy_natija, req.params.id]
  );

  if (holat !== mavjud.rows[0].holat || izoh) {
    await pool.query(
      `INSERT INTO murojaat_tarixi (murojaat_id, foydalanuvchi_id, holat, izoh) VALUES ($1,$2,$3,$4)`,
      [req.params.id, req.foydalanuvchi.id, holat, izoh || '']
    );
  }
  await pool.query(
    `INSERT INTO harakatlar_tarixi (foydalanuvchi_id, amal, tafsilot) VALUES ($1,$2,$3)`,
    [req.foydalanuvchi.id, 'Murojaat holati yangilandi', '№' + mavjud.rows[0].tartib_raqami]
  );

  res.json({ xabar: 'Saqlandi.' });
});

module.exports = router;