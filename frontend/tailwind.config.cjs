/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    fontFamily: {
      sans: ["Inter", "sans-serif"],
      serif: ["serif"],
    },
  },
  plugins: [],
};
