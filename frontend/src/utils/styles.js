/**
 * 样式工具 - Nature学术风格
 */

// Nature主色调
export const NATURE_COLORS = {
  // 主色
  primary: {
    main: '#8B0000',      // Nature深红
    light: '#B22222',     // 浅红
    dark: '#5C0000',      // 深红
    accent: '#D4AF37',    // 金色
  },
  // 文字
  text: {
    primary: '#212529',   // 主文字
    secondary: '#6C757D', // 次要
    muted: '#ADB5BD',     // 辅助
    inverse: '#FFFFFF',   // 反色
  },
  // 背景
  background: {
    main: '#FFFFFF',
    secondary: '#F8F9FA',
    tertiary: '#E9ECEF',
    code: '#F5F5F5',
  },
  // 边框
  border: {
    light: '#E9ECEF',
    DEFAULT: '#DEE2E6',
    dark: '#ADB5BD',
  },
  // 状态
  state: {
    error: '#DC3545',
    warning: '#FFC107',
    success: '#28A745',
    info: '#17A2B8',
  },
  // 学术
  academic: {
    nature: '#8B0000',
    science: '#003366',
    cell: '#0077CC',
    gold: '#D4AF37',
  }
}

// Nature字体
export const NATURE_FONTS = {
  sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
  mono: ['SF Mono', 'Monaco', 'monospace'],
}

// Nature阴影
export const NATURE_SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 2px 4px rgba(139, 0, 0, 0.1)',
  md: '0 4px 6px rgba(139, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(139, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(139, 0, 0, 0.15)',
}

// 动画
export const NATURE_ANIMATIONS = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: '300ms',
  },
  slideUp: {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
    duration: '300ms',
  },
  scale: {
    from: { transform: 'scale(0.95)' },
    to: { transform: 'scale(1)' },
    duration: '200ms',
  },
}

// 工具类
export const getButtonClass = (variant = 'primary', size = 'md') => {
  const variants = {
    primary: 'bg-nature-red text-white hover:bg-nature-red-dark',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    outline: 'border border-nature-red text-nature-red hover:bg-nature-red/5',
    ghost: 'text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return `rounded-nature font-medium transition-all duration-200 ${variants[variant]} ${sizes[size]}`
}

export const getCardClass = (elevation = 'DEFAULT') => {
  const elevations = {
    none: '',
    sm: 'shadow-sm',
    DEFAULT: 'shadow-card',
    md: 'shadow-card-hover',
    lg: 'shadow-lg',
  }

  return `bg-white rounded-nature border border-gray-200 ${elevations[elevation]}`
}

// CSS变量注入
export const injectNatureStyles = () => {
  const style = document.createElement('style')
  style.textContent = `
    :root {
      --nature-red: ${NATURE_COLORS.primary.main};
      --nature-red-light: ${NATURE_COLORS.primary.light};
      --nature-red-dark: ${NATURE_COLORS.primary.dark};
      --nature-gold: ${NATURE_COLORS.primary.accent};
      --nature-text: ${NATURE_COLORS.text.primary};
      --nature-text-secondary: ${NATURE_COLORS.text.secondary};
      --nature-bg: ${NATURE_COLORS.background.main};
      --nature-bg-secondary: ${NATURE_COLORS.background.secondary};
    }
  `
  document.head.appendChild(style)
}
