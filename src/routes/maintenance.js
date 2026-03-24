import { Hono } from 'hono'
import pool from '../db.js'

const maintenance = new Hono()

// POST /api/maintenance/replace-project
maintenance.post('/replace-project', async (c) => {
  const body = await c.req.json()
  const from_id  = Number(body.from_id)
  const to_id    = Number(body.to_id)
  const dry_run  = body.dry_run

  // Validations
  if (!from_id || !to_id) return c.json({ error: 'from_id e to_id são obrigatórios' }, 400)
  if (from_id === to_id)  return c.json({ error: 'from_id e to_id devem ser diferentes' }, 400)
  if (typeof dry_run !== 'boolean') return c.json({ error: 'dry_run deve ser boolean' }, 400)

  // Check both projects exist
  const [[fromRow]] = await pool.query('SELECT id FROM projeto WHERE id = ?', [from_id])
  if (!fromRow) return c.json({ error: 'Projeto de origem não encontrado' }, 400)

  const [[toRow]] = await pool.query('SELECT id FROM projeto WHERE id = ?', [to_id])
  if (!toRow) return c.json({ error: 'Projeto de destino não encontrado' }, 400)

  if (dry_run) {
    const [rows] = await pool.query(
      `SELECT r.id,
              DATE_FORMAT(r.data_hora, '%d/%m/%Y, %H:%i') AS data_fmt,
              COALESCE(GROUP_CONCAT(DISTINCT p.nome ORDER BY p.nome SEPARATOR ', '), '—') AS participantes_nomes
       FROM reuniao r
       JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
       LEFT JOIN reuniao_participante rpart ON rpart.reuniao_id = r.id
       LEFT JOIN participante p ON p.id = rpart.participante_id
       WHERE rp.projeto_id = ?
       GROUP BY r.id
       ORDER BY r.data_hora DESC`,
      [from_id]
    )
    return c.json({ affected: rows, count: rows.length })
  }

  // Execute atomic replacement
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Step 1: delete associations for meetings that already have the destination project (avoid duplicate key)
    await conn.query(
      `DELETE rp FROM reuniao_projeto rp
       INNER JOIN reuniao_projeto rp2 ON rp2.reuniao_id = rp.reuniao_id AND rp2.projeto_id = ?
       WHERE rp.projeto_id = ?`,
      [to_id, from_id]
    )

    // Step 2: remap remaining associations
    const [result] = await conn.query(
      'UPDATE reuniao_projeto SET projeto_id = ? WHERE projeto_id = ?',
      [to_id, from_id]
    )

    await conn.commit()
    return c.json({ updated: result.affectedRows })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
})

export default maintenance
