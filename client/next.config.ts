import type { NextConfig } from "next";

// 本地开发时，从局域网 IP 访问需要在此声明允许的来源，否则 Next.js 会拦截 RSC 请求导致页面无法正常工作
// 支持通配符，按实际局域网网段填写（e.g. '192.168.1.*', '10.0.0.*'）
const DEV_ORIGINS = (process.env.NEXT_DEV_ORIGINS ?? '192.168.1.*').split(',').map((s) => s.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === 'development' ? { allowedDevOrigins: DEV_ORIGINS } : {}),
  async redirects() {
    return [
      {
        source: '/apple-touch-icon-precomposed.png',
        destination: '/apple-touch-icon.png',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
