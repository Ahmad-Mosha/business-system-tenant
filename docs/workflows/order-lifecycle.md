# Order lifecycle

## States

```
NEW ──▶ CONTACTED ──▶ CONFIRMED ──▶ READY_TO_SHIP ──▶ SHIPPED
 │           │             │              │
 └───────────┴─────────────┴──────────────┴──▶ ON_HOLD ──▶ (back to any active state)
 │
 └──────────────────────────────────────────────────────▶ CANCELLED (terminal)
```

| State | Meaning |
|---|---|
| `NEW` | Arrived, nobody has worked it yet |
| `CONTACTED` | A moderator has reached out to the customer |
| `CONFIRMED` | The customer confirmed what they want |
| `READY_TO_SHIP` | Packed and waiting for the courier |
| `SHIPPED` | Handed to the courier |
| `ON_HOLD` | Blocked - waiting on the customer, stock, or a decision |
| `CANCELLED` | Terminal. Requires a reason |

## Why `DELIVERED` and `RETURNED` are missing

They are facts a **courier** reports, and the courier integration does not exist yet.
Letting a moderator type them today would create a second source of truth for the same
event, and reconciling the two later is far more expensive than waiting.

`SHIPPED` is included because the handover genuinely happens in the warehouse. Today a
moderator sets it; when Bosta is integrated, the courier becomes the authority for that
same state. The state survives - only who may set it changes.

## What is built

The states exist as a Postgres enum and orders can hold any of them. **Transitions are
not yet enforced** - that arrives with the status-update step, together with status
history and per-role transition rules.

## Cancellation reasons

Modelled as a closed, configurable set rather than free text, so cancellations stay
analysable. The values are business data and can change without touching the order
model. Not yet implemented.
