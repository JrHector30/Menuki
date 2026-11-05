import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

let supabaseHostname = '*.supabase.co';
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch {
    // Keep wildcard if URL parsing fails
  }
}

const remotePatterns: NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> = [
  {
    protocol: 'https',
    hostname: supabaseHostname,
    pathname: '/storage/v1/object/public/**',
  },
];

if (isDev) {
  remotePatterns.push({
    protocol: 'https',
    hostname: 'images.unsplash.com',
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
