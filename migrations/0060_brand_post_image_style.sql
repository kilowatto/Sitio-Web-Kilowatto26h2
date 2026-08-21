-- Tracks what kind of image (if any) a brand post carries -- 'infographic' |
-- 'illustration' | 'photorealistic' | 'real_photo' | NULL (no image, or an
-- older post generated before this column existed and whose style was never
-- persisted). Lets the admin calendar show what type of media a post has
-- instead of just "tiene imagen sí/no".
ALTER TABLE brand_posts ADD COLUMN image_style TEXT;
