/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.169.255.3', 'localhost'],
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },
};
export default nextConfig;
