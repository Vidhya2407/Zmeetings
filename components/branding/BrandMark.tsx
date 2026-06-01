import Image from 'next/image';

type BrandMarkProps = {
  alt?: string;
  className?: string;
  size?: number | string;
};

export default function BrandMark({ alt = 'Z Meetings logo', className = '', size }: BrandMarkProps) {
  const inlineSize = typeof size === 'number' ? `${size}px` : size;
  const defaultClassName = className.trim() ? className : 'inline-block h-[1em] w-[1em]';
  const numericSize = typeof size === 'number' ? size : 64;

  return (
    <Image
      alt={alt}
      className={defaultClassName}
      src="/logo-z.svg"
      width={numericSize}
      height={numericSize}
      style={inlineSize ? { height: inlineSize, width: inlineSize } : undefined}
      unoptimized
    />
  );
}
