# Inventory history (do not delete)

Durable backup of the SAP MB51 receiving/consumption history that feeds the Inventory tab.
Gzipped pandas pickles, full range **Jan 2024 → Oct 2026** at time of commit.

- `r.pkl.gz` — MB51 101/102 receipts (202,329 rows)
- `c.pkl.gz` — MB51 201/202 cost-centre issues (61,425 rows)
- `s2.pkl.gz` — Atlas-stock MB52 snapshot used for stock quantities

The live, growing copies live as artifact assets referenced by `ops/mb51` (pkls.r/.c/.s2);
the daily "MB51 inventory update" task replaces only the current month and keeps every older
month, so 2024/2025 history is never dropped. This folder is the floor to re-seed from if ever needed.
The Portal data-sync task never touches this folder (it only writes data/ and src/).
