@AGENTS.md

## Data conventions

- **`treatments.aftercare_sent_at` is the source of truth** for whether aftercare was sent (never the boolean `aftercare_sent` alone). All reads (UI badges, cron filters, insights counts, secretary context) check `aftercare_sent_at IS NOT NULL`. Writes must always set both `aftercare_sent = true` AND `aftercare_sent_at = <timestamp>` together so the boolean stays consistent for any future query that still uses it.