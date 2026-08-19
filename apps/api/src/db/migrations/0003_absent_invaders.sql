ALTER TYPE "public"."order_status" ADD VALUE 'DELIVERED' BEFORE 'ON_HOLD';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'COLLECTED' BEFORE 'ON_HOLD';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'RETURNED' BEFORE 'ON_HOLD';