-- Weekly private/business monitoring (beyond the public press pipeline). is_family_private is a
-- hard structural guard, not just a UI convention — the approve endpoint refuses to publish any
-- row with this flag set to 1, regardless of admin token, so a family-name hit can never
-- accidentally reach the public /prensa page. watch_entity records which monitored term matched,
-- for admin visibility.
ALTER TABLE press_mentions ADD COLUMN is_family_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE press_mentions ADD COLUMN watch_entity TEXT;
