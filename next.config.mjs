/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev only: lets the LAN address load the dev server (Next blocks other origins for dev assets).
  allowedDevOrigins: ['192.168.1.6'],
};
export default nextConfig;
