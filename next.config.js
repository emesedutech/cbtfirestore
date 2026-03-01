/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Izinkan gambar dari domain eksternal (imgur, drive, dll)
  images: {
    domains: ['i.imgur.com', 'drive.google.com', 'lh3.googleusercontent.com'],
    unoptimized: true
  }
}

module.exports = nextConfig
