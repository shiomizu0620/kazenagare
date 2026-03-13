import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep dev rebuilds responsive; enable React Compiler for production builds.
  reactCompiler: process.env.NODE_ENV === "production",
};

export default nextConfig;
