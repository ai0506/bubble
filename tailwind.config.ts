import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        paper: "#f7f3ec",
        chat: "#f4efe7",
        admin: "#e7f0ff",
        user: "#d8f7df",
      },
      boxShadow: {
        phone: "0 24px 70px rgba(31, 41, 51, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
