const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Variable", ...fontFamily.sans],
      },
      colors: {
        primary: {
          DEFAULT: "#20e3c2",
          50: "#f0fdfb",
          100: "#ccfbf4",
          200: "#99f6ea",
          300: "#5eecdb",
          400: "#2dd8c5",
          500: "#20e3c2",
          600: "#0db89e",
          700: "#0c9280",
          800: "#0d7568",
          900: "#0e6057",
        },
      },
    },
  },
};

