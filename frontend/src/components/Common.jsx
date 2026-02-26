import { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, Info, HelpCircle, X } from 'lucide-react';

export function RiskBadge({ level }) {
  const badges = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${badges[level] || badges.low}`}>
      {level}
    </span>
  );
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, trendDirection }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          {trend !== undefined && (
            <p className="mt-2 text-sm" style={{ color: trendDirection === 'up' ? 'var(--color-risk-high)' : 'var(--color-risk-low)' }}>
              {trendDirection === 'up' ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 bg-primary-100 rounded-full">
            <Icon className="w-6 h-6 text-primary-600" />
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md', label }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizes[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`} />
      {label && <p className="text-sm text-gray-500 animate-pulse">{label}</p>}
    </div>
  );
}

export function LoadingPage({ label }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" label={label || 'Loading...'} />
    </div>
  );
}

/** Shimmer skeleton row for tables */
export function SkeletonRow({ cols = 4 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className={`h-4 bg-gray-200 rounded ${i === 0 ? 'w-24' : i === cols - 1 ? 'w-16' : 'w-32'}`} />
        </td>
      ))}
    </tr>
  );
}

/** Full skeleton table (header + N shimmer rows) */
export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
      <div className="bg-gray-50 px-6 py-3 flex gap-8 border-b border-gray-200">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded w-20" />
        ))}
      </div>
      <table className="min-w-full">
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Friendly inline dismissible error with optional retry */
export function InlineError({ message, onRetry, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-red-800">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-red-700 hover:text-red-900 underline"
          >
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-red-50 rounded-lg">
      <XCircle className="w-12 h-12 text-red-500 mb-4" />
      <p className="text-red-700 text-center mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action, icon: Icon }) {
  const IconEl = Icon || Info;
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-gray-50 rounded-lg">
      <IconEl className="w-12 h-12 text-gray-400 mb-4" />
      <p className="text-gray-700 font-medium text-center">{title}</p>
      {description && <p className="text-gray-500 text-center mt-2 text-sm max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ type = 'info', title, children }) {
  const styles = {
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', Icon: Info },
    success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', Icon: CheckCircle },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', Icon: AlertCircle },
    error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', Icon: XCircle },
  };
  const style = styles[type] || styles.info;
  const Icon = style.Icon;
  return (
    <div className={`${style.bg} ${style.border} ${style.text} border rounded-lg p-4`}>
      <div className="flex">
        <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
        <div>
          {title && <p className="font-medium">{title}</p>}
          <div className={title ? 'mt-1' : ''}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max = 100, color = 'primary' }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    primary: 'bg-blue-600',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`${colors[color] || colors.primary} h-2 rounded-full transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/** Hover tooltip — wraps any element with a (?) indicator */
export function Tooltip({ text, children, position = 'top' }) {
  const [visible, setVisible] = useState(false);
  const posClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] || 'bottom-full left-1/2 -translate-x-1/2 mb-2';

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={`absolute ${posClass} z-50 w-56 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg pointer-events-none`}
        >
          {text}
          {/* Arrow */}
          <span className={`absolute ${position === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-t-gray-800' : position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800' : ''} border-4 border-transparent`} />
        </span>
      )}
    </span>
  );
}

/** Standalone (?) icon with tooltip */
export function HelpTooltip({ text, position = 'top' }) {
  return (
    <Tooltip text={text} position={position}>
      <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help ml-1 flex-shrink-0" />
    </Tooltip>
  );
}

export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const showPages = 5;
  let startPage = Math.max(1, page - Math.floor(showPages / 2));
  let endPage = Math.min(totalPages, startPage + showPages - 1);
  if (endPage - startPage + 1 < showPages) startPage = Math.max(1, endPage - showPages + 1);
  for (let i = startPage; i <= endPage; i++) pages.push(i);
  return (
    <div className="flex items-center justify-center space-x-2 mt-4">
      <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
        className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">Previous</button>
      {startPage > 1 && (<><button onClick={() => onPageChange(1)} className="px-3 py-1 rounded border hover:bg-gray-100">1</button>{startPage > 2 && <span className="px-2">...</span>}</>)}
      {pages.map((p) => (<button key={p} onClick={() => onPageChange(p)}
        className={`px-3 py-1 rounded border ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'}`}>{p}</button>))}
      {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="px-2">...</span>}<button onClick={() => onPageChange(totalPages)} className="px-3 py-1 rounded border hover:bg-gray-100">{totalPages}</button></>)}
      <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
        className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">Next</button>
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Multi-step loading card for long operations like model training */
export function TrainingProgress({ steps, currentStep, elapsed }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-8 max-w-md mx-auto">
      <div className="flex items-center justify-center mb-6">
        <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
      <h3 className="text-center font-bold text-gray-900 mb-1 text-lg">Training Your Model</h3>
      <p className="text-center text-sm text-gray-500 mb-6">This usually takes 10–30 seconds</p>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const done = idx < currentStep;
          const active = idx === currentStep;
          return (
            <div key={idx} className={`flex items-center gap-3 text-sm transition-all ${done ? 'text-green-700' : active ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>
              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                {done ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : active ? (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                )}
              </span>
              {step}
            </div>
          );
        })}
      </div>
      {elapsed > 0 && (
        <p className="text-center text-xs text-gray-400 mt-6">{elapsed}s elapsed</p>
      )}
    </div>
  );
}
