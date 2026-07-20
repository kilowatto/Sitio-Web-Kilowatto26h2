-- Esteban: different topics deserve different visual treatment — some illustrations,
-- some infographics, some real photos, some photorealistic AI renders. One-size-fits-all
-- abstract icon logic doesn't fit e.g. Openstack/VMware the same way it fits Curling.
ALTER TABLE brand_topics ADD COLUMN image_style TEXT NOT NULL DEFAULT 'illustration';
