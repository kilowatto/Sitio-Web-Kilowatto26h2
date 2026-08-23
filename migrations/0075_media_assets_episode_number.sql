-- The episode number is spoken aloud by the announcer in the intro, so it has to be pinned to
-- the asset rather than derived at read time: a number that shifts later would leave the audio
-- announcing "episodio uno" while every listing calls it something else.
ALTER TABLE media_assets ADD COLUMN episode_number INTEGER;
