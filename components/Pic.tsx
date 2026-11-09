import type { ComponentProps } from 'react';
import Image from 'next/image';

type Props = Omit<ComponentProps<typeof Image>, 'width' | 'height' | 'fill' | 'unoptimized'> & { width?: number; height?: number };

/**
 * `next/image` for pictures that come from the media bucket, blob previews or /public.
 * They are uploaded at any size by the admin, so the optimizer is skipped (`unoptimized`: no resizing, no remotePatterns)
 * and they load at once, as a plain <img> did. When CSS sizes the picture, width/height only reserve its box.
 */
export function Pic({ width = 1000, height = 1000, src, alt, ...rest }: Props) {
  if (src === '') return null; // next/image throws on an empty src (a missing picture)
  // draggable={false}: no picture ghost when a child drags on a child screen (NS3); a caller may override it.
  return <Image loading="eager" draggable={false} {...rest} src={src} alt={alt} width={width} height={height} unoptimized />;
}
