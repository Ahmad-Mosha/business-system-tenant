import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  const t = useTranslations("table")
  return (
    <nav
      role="navigation"
      aria-label={t("pages")}
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

// A Next <Link>, so paging is a client navigation that keeps scroll and state.
type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<typeof Link>

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      asChild
      variant={isActive ? "outline" : "ghost"}
      size={size}
      className={cn(className)}
    >
      <Link
        scroll={false}
        aria-current={isActive ? "page" : undefined}
        data-slot="pagination-link"
        data-active={isActive}
        {...props}
      />
    </Button>
  )
}

function PaginationPrevious({
  className,
  text,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  const t = useTranslations()
  return (
    <PaginationLink
      aria-label={t("table.previousPage")}
      size="default"
      className={cn("ps-1.5!", className)}
      {...props}
    >
      <ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
      <span className="hidden sm:block">{text ?? t("common.previous")}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  text,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  const t = useTranslations()
  return (
    <PaginationLink
      aria-label={t("table.nextPage")}
      size="default"
      className={cn("pe-1.5!", className)}
      {...props}
    >
      <span className="hidden sm:block">{text ?? t("common.next")}</span>
      <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const t = useTranslations("table")
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon
      />
      <span className="sr-only">{t("morePages")}</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
