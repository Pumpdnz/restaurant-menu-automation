/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        // System colors (mapped in CSS)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        // Brand colors
        'brand-red': {
          DEFAULT: 'hsl(var(--brand-red))',
          'light-1': 'hsl(var(--brand-red-light-1))',
          'light-2': 'hsl(var(--brand-red-light-2))',
          'light-3': 'hsl(var(--brand-red-light-3))',
          'light-4': 'hsl(var(--brand-red-light-4))',
        },
        'brand-green': {
          DEFAULT: 'hsl(var(--brand-green))',
          'light-1': 'hsl(var(--brand-green-light-1))',
          'light-2': 'hsl(var(--brand-green-light-2))',
          'light-3': 'hsl(var(--brand-green-light-3))',
          'light-4': 'hsl(var(--brand-green-light-4))',
        },
        'brand-blue': {
          DEFAULT: 'hsl(var(--brand-blue))',
          'light-1': 'hsl(var(--brand-blue-light-1))',
          'light-2': 'hsl(var(--brand-blue-light-2))',
          'light-3': 'hsl(var(--brand-blue-light-3))',
          'light-4': 'hsl(var(--brand-blue-light-4))',
          'light-5': 'hsl(var(--brand-blue-light-5))',
        },
        'brand-yellow': {
          DEFAULT: 'hsl(var(--brand-yellow))',
          'light-1': 'hsl(var(--brand-yellow-light-1))',
          'light-2': 'hsl(var(--brand-yellow-light-2))',
          'light-3': 'hsl(var(--brand-yellow-light-3))',
          'light-4': 'hsl(var(--brand-yellow-light-4))',
          'dark-1': 'hsl(var(--brand-yellow-dark-1))',
          'dark-2': 'hsl(var(--brand-yellow-dark-2))',
        },
        'brand-purple': {
          DEFAULT: 'hsl(var(--brand-purple))',
          'light-1': 'hsl(var(--brand-purple-light-1))',
          'light-2': 'hsl(var(--brand-purple-light-2))',
          'light-3': 'hsl(var(--brand-purple-light-3))',
        },
        'brand-orange': {
          DEFAULT: 'hsl(var(--brand-orange))',
          'light-1': 'hsl(var(--brand-orange-light-1))',
          'light-2': 'hsl(var(--brand-orange-light-2))',
          'light-3': 'hsl(var(--brand-orange-light-3))',
          'light-4': 'hsl(var(--brand-orange-light-4))',
        },
        'brand-coral': 'hsl(var(--brand-coral))',
        'stripe-purple': 'hsl(var(--stripe-purple))',
        'ubereats-green': 'hsl(var(--ubereats-green))',
        'brand-dark-text': 'hsl(var(--brand-dark-text))',
        'brand-white': 'hsl(var(--brand-white))',
        'brand-grey': 'hsl(var(--brand-grey))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        sans: ['Gabarito', 'Inter', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 0 20px rgba(0, 0, 0, 0.05)',
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.98)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'blur-in': {
          from: { opacity: '0', filter: 'blur(8px)' },
          to: { opacity: '1', filter: 'blur(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.9' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-in': 'slide-in 0.5s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'blur-in': 'blur-in 0.5s ease-out',
        'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
      },
      backdropFilter: {
        'none': 'none',
        'blur': 'blur(8px)',
      },
    }
  },
  plugins: [require("tailwindcss-animate")],
};