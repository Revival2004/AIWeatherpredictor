import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Whitespace-nowrap: badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate ",
  {
    variants: {
      variant: {
        default:
          // Keep the subtle shadow while hover elevation is handled globally.
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary:
          // Hover elevation is handled by the shared utility class.
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          // Keep the subtle shadow while hover elevation is handled globally.
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
        // Use the badge outline token for consistent borders.
        outline: "text-foreground border [border-color:var(--badge-outline)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
