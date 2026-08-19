# Prime Market — Master Design Brief for Claude Design

Status: ready to hand off · Author: prepared from the live repository and architecture
history, 2026-08-19

This is the prompt to paste into Claude Design, verbatim. The short rationale below it
is for us, not for Claude Design — don't paste that part.

---

## The prompt

```
You are acting as Senior Product Designer, UX Architect, and Design Systems Lead
for Prime Market.

Prime Market is a real, live internal operations platform — not a prototype, not a
concept exploration. It is being built to run an actual commerce business and will
be used every working day by real staff under real time pressure. Design accordingly:
this has to hold up to repetitive daily use by people who did not choose this tool
and will not read a manual, not just look good in a first impression.

Your job is to think as an expert product designer, not to fill in a template. Use
the context below to understand the business deeply, then apply your own judgment
about information architecture, navigation, workflows, interaction patterns, and
visual language. The context describes the problem. It does not prescribe the
solution. Challenge our framing where you think it's wrong, simplify where we've
overcomplicated something, and surface workflows we may not have thought to ask for.


## What Prime Market is

Prime Market buys and resells physical goods across a wide range of categories —
cosmetics, small electronics and "TV shop"-style items, computer hardware and
accessories, household products, and more added over time. This is a broad,
multi-category catalog, not a boutique with a handful of SKUs — assume hundreds of
products with real variation in how they're described and searched for (a shade of
lipstick and a graphics card are both "products" but nobody looks for them the same
way).

Orders arrive through several completely different paths that all have to converge
on the same operational reality:
 - customers messaging the business directly on social media, handled by a person
 - the business's own website/storefront integration, arriving automatically
 - marketplaces (Amazon, noon), which run under their own rules, their own fees, and
   their own settlement timelines
Every one of these needs to become one order, worked the same way, regardless of
where it came from.

Delivery runs through a third-party courier. For a meaningful share of orders,
payment is collected in cash at the door, not in advance — which means "delivered"
and "we actually have the money" are two different moments in time, sometimes days
apart, and both matter to different people for different reasons. Failed deliveries
and returns are a normal, expected part of the operation, not an edge case.

Money, goods, and information are constantly reconciled against outside sources of
truth: what a marketplace says it paid, what the courier says it collected, what
inventory should physically be on the shelf. None of these are guaranteed to agree,
and part of what makes this business hard today is finding out where they disagree.


## Who uses it

Two roles exist today, and more will be added later — do not hard-code the idea of
exactly two.

**Moderators** spend their day working orders: contacting customers to confirm what
they actually want (this is real, frequent, and time-sensitive — a large share of
their job is phone/social conversations, not clicking through a UI), creating orders
that came in over social media by hand, and moving their own assigned orders through
the operational stages toward shipment. An order belongs to one moderator at a time
by default. A moderator's world is deliberately narrow: their own work, done well and
fast, not the whole business.

**Admins/managers** see and run the whole operation: every order regardless of who
it's assigned to, assigning and reassigning work, the product catalog, staff, and
(as the product grows) inventory, financial visibility, and marketplace/reconciliation
workflows. Their job is oversight and exception-handling — noticing what's stuck,
what's wrong, what needs a decision — not re-doing the moderators' work.

Design for both as real jobs, not as "user roles" in the abstract. A moderator having
a good day should mean they moved through their queue with almost no friction. An
admin having a good day should mean the one thing that actually needed their
attention found them, instead of them hunting for it.


## What's already real (design around this, don't contradict it)

These are committed decisions in the running system, not open questions:

 - Orders move through a defined lifecycle with specific named stages reflecting the
   realities above — including a stage for "physically delivered" that is distinct
   from "money is actually in our account," because for cash-on-delivery those are
   genuinely different moments, and a stage for a cancellation that a person can
   still walk back if it was a mistake. Not every stage can move to every other
   stage — this is a real, enforced state machine, not a free-text field or a
   simple linear progress bar. Whatever you design for representing and changing
   status needs to work for a state machine with roughly ten states and
   state-dependent legal moves, not a generic 3-5 step tracker.
 - What one moderator can see and act on is genuinely restricted by the system, not
   just hidden in the UI — an admin and a moderator looking at "orders" are not
   looking at the same data, and that's enforced underneath, not cosmetic.
 - The same physical product can be listed on multiple channels (the website,
   Amazon, noon, social) under different names, prices and identifiers, and all of
   those listings resolve back to one internal product. A sale on any channel is
   understood to affect the same underlying item. Don't design a catalog that
   assumes one product = one listing = one channel.
 - Order assignment has a history — who held an order and when is kept, not
   overwritten, because reassignment is a real, ordinary event.
 - Courier (Bosta) API access is confirmed working; the live shipment-tracking
   integration itself is upcoming, not wired into the product surface yet. Design
   for it as near-term reality, not as a hypothetical someday.

## What's coming, but isn't built yet

Design the information architecture so these have an obvious, natural home later —
without building screens for them now:

 - Real inventory: on-hand stock, movement history, valuation, and eventually
   awareness that stock can physically live in more than one place (own warehouse,
   and potentially marketplace-fulfilled stock at Amazon/noon).
 - A financial picture: cash, cost of goods, marketplace fees, profit — investigated
   in depth already, still being decided, and eventually a real part of what admins
   look at regularly.
 - Deeper marketplace workflows: importing and reconciling Amazon and noon
   settlement/fee data against what the business expects, surfacing where they
   disagree.
 - Broader staff/role management as the org grows past two roles.

Treat this as "leave the door open," not "design it now." We'd rather have three
excellent surfaces today than ten mediocre placeholders.


## Product philosophy

We want a very specific reaction: "this is incredibly simple, clean, polished, and
thoughtfully designed" — not "wow, look at all these UI ideas." The product should
be impressive because of the quality of its decisions — hierarchy, spacing,
proportion, wording, what's on screen and what correctly isn't — not because of
visual tricks.

Sit deliberately between two failure modes: a generic, forgettable AI-generated
admin template on one side, and a design that's novel or "futuristic" for its own
sake on the other. Familiar enough that someone is productive in it on day one.
Distinctive enough that it's obviously not a template — it was built for this
business, by people who understood the work.

Simplicity is a top priority, but it has to come from clarity, not from removing
real capability. The underlying business is genuinely complex — multi-channel,
multi-stage, reconciled against outside systems. The product's job is to absorb that
complexity so the person using it doesn't have to carry it. Push complexity into
good defaults, smart grouping, and progressive disclosure — not onto the user.

An experienced retailer built this for themselves, deliberately, and it shows. Not a
generic admin template. Not an experimental design showcase. Not a dated,
form-heavy ERP either.


## Visual direction

Light mode is the primary and intended experience — design it as such, not as an
afterthought to a dark theme. Elegant, calm, modern, premium, highly readable,
effortless. Win on typography, spacing, proportion, hierarchy, composition, and
component quality — not on gradients, glow, glassmorphism, oversized illustration,
or decoration that doesn't carry information.

Specifically avoid, because they read as generic-AI-tool defaults rather than
considered choices for this product:
 - a two-panel marketing-style login screen with a big slogan next to the form —
   this is an internal operations tool for a small team who already know what it
   is; the sign-in screen should respect that and just be simple and fast
 - dashboards that are only a grid of floating cards, or charts placed because
   "dashboards have charts" rather than because a chart is the right way to show
   that number
 - decorative illustrations, arbitrary gradients, glassmorphism, heavy animation
 - excessive pills/badges/rounded-card-everywhere as a substitute for real
   hierarchy
 - screens that look individually nice but don't visibly belong to the same
   product as each other

One coherent design language has to hold across authentication, navigation,
list/table views, detail views, forms, dialogs, empty/loading/error states, and
whatever else you decide the product needs. If someone screenshots any two screens
next to each other, it should be obvious they're the same product.


## The UX bar

This is judged on real usability, not on how the first screenshot looks. That means
thinking through, for whatever surfaces you decide to design:
 - what it looks like with zero data, a little data, and a lot of data
 - loading and error states, and what a failed action actually tells the person
 - how destructive or hard-to-reverse actions are confirmed, without making every
   action feel dangerous
 - how someone finds one thing inside hundreds of orders or products — search and
   filtering are not optional for this catalog size
 - dense, tabular, numeric data (money, quantities, dates) rendered so it's fast to
   scan and compare, not just "in a table"
 - what happens when two people's work could conflict (an order someone else just
   reassigned, a status someone else just changed)
 - keyboard and accessibility basics, and reasonable behavior at different window
   sizes — this is used on real office monitors and laptops, not exclusively
   designed for one fixed canvas size

An interaction that's visually interesting but awkward to actually use repeatedly,
all day, is a failure here — no exceptions for how it looks in a mockup.


## Your freedom

Don't treat the business context above as a screen list or a spec to fill in. It's
the problem. You own the solution: the information architecture, the navigation
model, which things live together and which don't, what's primary versus secondary,
what workflows exist that weren't explicitly asked for, and what we described that
turns out to be unnecessary once the real design comes together. If two of our
stated ideas are in tension, say so and make the call. If something we described
should just be removed, remove it and tell us why.

Don't maximize the number of screens you produce. Maximize the quality and coherence
of the product experience — a small number of excellent, well-connected surfaces
that make the whole system legible beats broad, shallow coverage. Establish the
design language and the core navigation/IA first; illustrate it through whichever
workflows best prove the system works, not through an exhaustive checklist.
```

---

## Why it's built this way (for us, not Claude Design)

**Grounded in the real, committed data model, not a generic "ops dashboard" brief.**
The ten-state order lifecycle, scope-based permissions, and the one-product/many-listings
catalog model are already live and enforced in the running system. A design brief
that didn't mention them risks Claude Design inventing a simpler status tracker or a
one-listing-per-product catalog that would then have to be forced to fit reality
later. Calling these out as fixed constraints — while leaving *how to represent them*
entirely open — is the highest-leverage thing this brief does.

**COLLECTED vs. DELIVERED is explained by *why*, not just named.** Handing over a raw
enum would read as arbitrary. Explaining that COD payment lags physical delivery
gives Claude Design the actual reasoning, so it can design the representation well
instead of just rendering a label.

**"What's coming" is separated from "what's real" on purpose.** Inventory and
finance are extensively designed on paper already, but building UI for them now
would be premature — the brief asks only for an IA that has room for them later,
which is a materially smaller and more honest ask.

**The anti-pattern list is specific to this product, not a generic banned-words
list.** The split-screen marketing login page is called out by name because it's the
single most common tell of an ungrounded AI-generated internal tool, and this is
explicitly an internal tool for people who already know what it is.

**No screen inventory, deliberately.** The brief repeats "don't maximize screen
count, maximize coherence" twice, and asks Claude Design to prove the system through
whichever workflows demonstrate it best — because the instruction was explicit that
a rigid checklist would suppress the judgment we're actually paying for.
