/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        softgray: {
          DEFAULT: "#f5f5f5", // gris claro
          dark: "#3a3a3a",    // gris oscuro
          medium: "#7a7a7a",  // gris medio
        },
      },
    },
  },
};
