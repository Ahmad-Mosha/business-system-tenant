# ADR-001: Modular monolith on NestJS

**Status:** Accepted · 2026-08-18

## Context

An integration-heavy operations system: several marketplaces, a courier, background
processing, strict authorization, and years of expected change. The team is one to three
engineers, mostly mid-level. Hono was the considered alternative.

## Decision

A modular monolith on NestJS, with the domain kept in framework-free TypeScript.

## Why

The difficulty here is *organisational* - many modules, many provider adapters, heavy
background work, authorization that must not be forgotten - not latency. NestJS supplies
module boundaries, dependency injection that makes adapters swappable and testable, and
first-class queue and scheduling integration. Its conventions remove decisions, which is
worth more than flexibility for a small mixed-seniority team maintaining this for years.

Hono's real advantages - tiny footprint, edge runtimes, fast cold start - buy nothing
for a workload of queue workers and multi-statement Postgres transactions.

Microservices were never a candidate: there is no scaling or team-topology problem that
would justify distributed transactions across orders, inventory and finance.

## Trade-offs accepted

Decorator and DI indirection has a learning curve. More ceremony per endpoint. Slower
startup. Occasional friction on unusual wiring.

## What keeps this reversible

Business rules live in plain TypeScript classes and functions. Nest provides HTTP, DI
and jobs; it does not appear in domain logic. `AuthContext` and scope resolution are
plain objects with unit tests that import no framework code. Replacing the framework
would be a week's work on the edges, not a rewrite.

## What would change it

The backend becoming a thin gateway over other services; a move to edge or
serverless-first deployment; or the team becoming a single senior engineer who prefers
explicit composition - in which case Hono with a hand-written composition root is a
perfectly good answer.
