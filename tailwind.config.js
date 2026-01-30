import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        overlay: 'hsl(var(--overlay))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
          muted: 'hsl(var(--success-muted))',
          'soft-foreground': 'hsl(var(--success-soft-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          soft: 'hsl(var(--info-soft))',
          muted: 'hsl(var(--info-muted))',
          'soft-foreground': 'hsl(var(--info-soft-foreground))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))',
          soft: 'hsl(var(--danger-soft))',
          muted: 'hsl(var(--danger-muted))',
          'soft-foreground': 'hsl(var(--danger-soft-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
          'soft-foreground': 'hsl(var(--warning-soft-foreground))',
        },
        neutral: {
          25: 'hsl(var(--neutral-25))',
          50: 'hsl(var(--neutral-50))',
          75: 'hsl(var(--neutral-75))',
          100: 'hsl(var(--neutral-100))',
          150: 'hsl(var(--neutral-150))',
          200: 'hsl(var(--neutral-200))',
          250: 'hsl(var(--neutral-250))',
          300: 'hsl(var(--neutral-300))',
          350: 'hsl(var(--neutral-350))',
          500: 'hsl(var(--neutral-500))',
          600: 'hsl(var(--neutral-600))',
          650: 'hsl(var(--neutral-650))',
          700: 'hsl(var(--neutral-700))',
          800: 'hsl(var(--neutral-800))',
        },
        heat: {
          0: 'hsl(var(--heat-0))',
          1: 'hsl(var(--heat-1))',
          2: 'hsl(var(--heat-2))',
          3: 'hsl(var(--heat-3))',
          4: 'hsl(var(--heat-4))',
          5: 'hsl(var(--heat-5))',
        },
        kakao: {
          DEFAULT: 'hsl(var(--kakao))',
          foreground: 'hsl(var(--kakao-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate],
}
