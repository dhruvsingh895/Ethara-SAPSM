import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Ethara SAPSM brand mark.
 *
 * The source asset (public/logo.png) is a black glyph on transparent
 * background. On dark mode we invert it to white via CSS so we don't
 * need two files. `filter: invert(1)` also flips hue on colored assets;
 * for our monochrome logo it's a clean black->white swap.
 */
export function Logo({
  className,
  size = 28,
  alt = "Ethara SAPSM logo",
  priority = false,
}: {
  className?: string;
  size?: number;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn(
        "select-none object-contain dark:invert",
        className,
      )}
    />
  );
}
