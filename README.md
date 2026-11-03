# CR inbox

Holding branch for CR / CC presentations uploaded from the VA/CR Idea Register on the portal.
The `CR inbox` workflow copies pending uploads from the private Supabase bucket into `files/<upload id>/`.
Claude reads them on the Atlas refresh schedule, updates `data/cr_ideas.json` on `main`, and records the
result in the `cr_uploads` table. Nothing here is served by the portal.
