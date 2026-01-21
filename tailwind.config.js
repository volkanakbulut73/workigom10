/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx"
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#10b77f", // Emerald-500
        "background-light": "#f6f8f7",
        "background-dark": "#020617", // Slate-950
        "card-dark": "#0f172a", // Slate-900
        "accent-purple": "#7c3aed",
        "accent-blue": "#2563eb",
        // Keeping legacy colors for compatibility with other pages
        secondary: '#334155', 
        surface: '#f8fafc', 
        dark: '#020617', 
      },
      fontFamily: {
        "display": ["Space Grotesk", "sans-serif"],
        sans: ['Space Grotesk', 'Inter', 'sans-serif'], // Updated default sans
      },
      borderRadius: {
        "3xl": "2rem",
      }
    },
  },
  plugins: [],
}