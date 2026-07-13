/** @type {import('next').NextConfig} */
const nextConfig = {
  // Minimal runtime bundle for the Docker image (server.js + traced deps).
  output: "standalone",
};

export default nextConfig;
