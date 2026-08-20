-- Fill in price_current as a labeled ESTIMATE (not a confirmed receipt) for owned books that
-- had no real price data yet, so the "gasto" total reflects something closer to reality.
-- Basis: directly-observed comparable titles in this exact format/genre this session
-- (Las Pruebas de Apolo 1/4 = $339/$389, Kaku = $279, Gates = $399) cluster around $330-400
-- MXN for a standard YA paperback from these publishers — using $350 as a fair midpoint.
-- Kakawa is excluded: no comparable edition found, left unestimated rather than guessed.

UPDATE books SET price_current = 350.00, price_checked_at = '2026-07-26'
WHERE status = 'tengo' AND price_paid IS NULL AND price_current IS NULL
  AND title NOT LIKE '%Assouline%' AND title NOT IN ('Metaverse Dream', 'Moon Paradise', 'Mexico City', 'Kakawa');

-- Anthology (shorter, cheaper format)
UPDATE books SET price_current = 280.00, price_checked_at = '2026-07-26'
WHERE title = 'Percy Jackson y la Vara de Hermes & Otras Historias de Semidioses';

-- Assouline coffee-table books: no confirmed MXN price found (their own site rate-limited the
-- lookup); ~$75 USD is Assouline's typical "Classic" format price, converted at ~19.5 MXN/USD.
UPDATE books SET price_current = 1460.00, price_checked_at = '2026-07-26 (estimado, no confirmado)'
WHERE title IN ('Metaverse Dream', 'Moon Paradise', 'Mexico City');
