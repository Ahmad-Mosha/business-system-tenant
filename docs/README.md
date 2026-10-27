# Documentation

The [repository README](../README.md) covers the architecture, the design
decisions and their trade-offs. These go deeper on one topic each.

| File | What it gives you |
|---|---|
| [business-rules.md](business-rules.md) | The rules the system obeys — products, stock, purchasing, orders, returns, money, roles — each marked confirmed or open |
| [frontend.md](frontend.md) | How the web app is put together: where data comes from, where logic lives, the conventions |
| [ui-ux.md](ui-ux.md) | The design principles and the design system: colour, type, page anatomy, money rows, charts |
| [i18n.md](i18n.md) | How every screen speaks Arabic and English, right-to-left included, and the Arabic glossary |
| [deployment.md](deployment.md) | Where it runs (EC2 + Caddy + Neon), how it is deployed, and the encrypted nightly backup |
| [evidence/integrations.md](evidence/integrations.md) | Bosta, Easy Orders and noon as they actually behave — verified against live APIs and dashboards, traps included |
| [evidence/channel-identifiers.md](evidence/channel-identifiers.md) | How each sales channel identifies a product, and why none of them can be the product's identity |
