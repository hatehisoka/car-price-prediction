import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8001';
const HISTORY_KEY = 'car-price-history';
const HISTORY_MAX = 5;

// Курси (приблизні, станом на 2026). Для курсової — статика; для прод-апки
// варто тягти з НБУ-API.
const RATES = { USD: 1, UAH: 41, EUR: 0.92 };
const CURRENCY_SYMBOL = { USD: '$', UAH: '₴', EUR: '€' };
const fmt = (price, ccy) => {
  const v = Math.round(price * RATES[ccy]);
  return `${CURRENCY_SYMBOL[ccy]} ${v.toLocaleString('en-US')}`;
};

/* ───── Icons ───── */
const Icon = {
  Car: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 17h14M6 17v2M18 17v2M5 11l1.5-4A2 2 0 0 1 8.4 5.5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
    <path d="M3 17v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3z" /><circle cx="7.5" cy="14.5" r="1" /><circle cx="16.5" cy="14.5" r="1" />
  </svg>),
  Search: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>),
  Chevron: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>),
  Check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12.5 10 17l9-10" /></svg>),
  Sparkles: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M5.5 18.5l2.8-2.8M15.7 8.3l2.8-2.8" /></svg>),
  Reset: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>),
  Alert: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></svg>),
  Fuel: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13" /><path d="M15 9h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2V8l-3-3" /></svg>),
  Calendar: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>),
  Engine: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 9h6V6h4l2 3h2v6h-2l-2 3h-4v-3H7v3H4v-9h3z" /></svg>),
  Road: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 21 8 3M19 21l-3-18M12 6v2M12 12v2M12 18v2" /></svg>),
  Coin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" /></svg>),
  Drive: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 6h7M8.5 18h7M6 8.5v7M18 8.5v7" />
  </svg>),
  Chart: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v18h18" /><path d="M7 14l3-3 4 4 5-7" /></svg>),
  History: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></svg>),
  Trash: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></svg>),
};

/* ───── Combobox ───── */
function Combobox({ label, icon, value, onChange, options, placeholder, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null), inputRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 10); else { setQuery(''); setHighlight(0); } }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const pick = (val) => { onChange(val); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) pick(filtered[highlight]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border bg-white/80 backdrop-blur text-left text-sm font-medium transition-all
          ${disabled ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400'}
          ${open ? 'ring-2 ring-emerald-400/40 border-emerald-400' : ''}`}>
        {icon && <span className="text-emerald-500 shrink-0">{icon}</span>}
        <span className={`flex-1 truncate ${value ? 'text-slate-800' : 'text-slate-400'}`}>{value || placeholder || '—'}</span>
        <Icon.Chevron className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 overflow-hidden animate-pop-in">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Icon.Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setHighlight(0); }} onKeyDown={onKey} placeholder="Пошук..."
                className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400" />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto scroll-soft py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-400">Нічого не знайдено</div>
            ) : filtered.map((opt, i) => {
              const selected = opt === value, active = i === highlight;
              return (
                <button type="button" key={opt} onMouseEnter={() => setHighlight(i)} onClick={() => pick(opt)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <span className="truncate">{opt}</span>
                  {selected && <Icon.Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-1.5 border-t border-slate-100 text-[11px] text-slate-400 bg-slate-50/60">{filtered.length} з {options.length}</div>
        </div>
      )}
    </div>
  );
}

/* ───── Slider ───── */
function Slider({ label, icon, value, onChange, min, max, step = 1, suffix, format }) {
  const num = Number(value);
  const pct = max === min ? 0 : ((num - min) / (max - min)) * 100;
  const display = format ? format(num) : num;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {icon && <span className="text-emerald-500">{icon}</span>}{label}
        </label>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-slate-800 tabular-nums">{display}</span>
          {suffix && <span className="text-xs font-medium text-slate-500">{suffix}</span>}
        </div>
      </div>
      <input type="range" className="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(e.target.value)} style={{ ['--p']: `${pct}%` }} />
      <div className="flex justify-between mt-1.5 text-[11px] text-slate-400 tabular-nums">
        <span>{min}{suffix ? ` ${suffix}` : ''}</span>
        <span>{max}{suffix ? ` ${suffix}` : ''}</span>
      </div>
    </div>
  );
}

/* ───── Chips ───── */
function Chips({ label, icon, value, onChange, options }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {icon && <span className="text-emerald-500">{icon}</span>}{label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          const active = v === value;
          return (
            <button type="button" key={v} onClick={() => onChange(v)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all
                ${active ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/30'
                         : 'bg-white/70 backdrop-blur text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'}`}>{lbl}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ───── ValueChips (engV дискретні значення) ───── */
function ValueChips({ label, icon, value, onChange, values, suffix, format }) {
  const f = format || ((n) => String(n));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {icon && <span className="text-emerald-500">{icon}</span>}{label}
        </label>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-slate-800 tabular-nums">{f(Number(value))}</span>
          {suffix && <span className="text-xs font-medium text-slate-500">{suffix}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => {
          const active = Number(v) === Number(value);
          return (
            <button type="button" key={v} onClick={() => onChange(v)}
              className={`min-w-[3.25rem] px-3 py-1.5 rounded-lg text-sm font-semibold tabular-nums border transition-all
                ${active ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/30'
                         : 'bg-white/70 backdrop-blur text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'}`}>
              {f(v)}{suffix ? ` ${suffix}` : ''}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        {values.length === 1 ? 'Доступний лише цей варіант для моделі' : `Доступно ${values.length} варіантів з даних`}
      </p>
    </div>
  );
}

/* ───── Анімований лічильник ───── */
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target == null) return;
    const from = prev.current, start = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step); else prev.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ───── BarChart (горизонтальні бари для importance / brands) ───── */
function HBarChart({ items, label, valueKey, valueFmt, max }) {
  const cap = max ?? Math.max(...items.map((x) => x[valueKey]));
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const w = (it[valueKey] / cap) * 100;
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-700 font-medium truncate pr-2">{label(it)}</span>
              <span className="text-slate-500 tabular-nums shrink-0">{valueFmt(it[valueKey])}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-700"
                   style={{ width: `${w}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───── Histogram ───── */
function Histogram({ data, w = 600, h = 200 }) {
  if (!data?.length) return null;
  const maxC = Math.max(...data.map((d) => d.count));
  const bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 28}`} className="w-full">
      {data.map((d, i) => {
        const bh = (d.count / maxC) * h;
        return (
          <g key={i}>
            <rect x={i * bw + 1} y={h - bh} width={bw - 2} height={bh}
                  fill="url(#barGrad)" rx="2" />
            <title>${Math.round(d.low)}–${Math.round(d.high)}: {d.count} авто</title>
          </g>
        );
      })}
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* X labels (every 5th) */}
      {data.map((d, i) => i % 5 === 0 && (
        <text key={`x${i}`} x={i * bw + bw / 2} y={h + 16} fontSize="9" fill="#94a3b8" textAnchor="middle">
          ${Math.round(d.x / 1000)}k
        </text>
      ))}
    </svg>
  );
}

/* ───── LineChart (рік↔ціна, пробіг↔ціна) ───── */
function LineChart({ data, xKey, yKey, w = 600, h = 200, xLabel, yLabel, xFmt, yFmt }) {
  if (!data?.length) return null;
  const xs = data.map((d) => d[xKey]);
  const ys = data.map((d) => d[yKey]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const pad = 32;
  const sx = (v) => pad + ((v - xMin) / (xMax - xMin || 1)) * (w - pad * 1.5);
  const sy = (v) => h - pad + 12 - ((v - yMin) / (yMax - yMin || 1)) * (h - pad * 1.6);
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(d[xKey]).toFixed(1)},${sy(d[yKey]).toFixed(1)}`).join(' ');
  const ticksY = 4;
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} className="w-full">
      {/* y-grid */}
      {Array.from({ length: ticksY + 1 }, (_, i) => {
        const y = pad + (i * (h - pad * 1.5)) / ticksY;
        const v = yMax - (i * (yMax - yMin)) / ticksY;
        return (
          <g key={i}>
            <line x1={pad} y1={y} x2={w - pad / 2} y2={y} stroke="#e2e8f0" strokeDasharray="2,4" />
            <text x={pad - 6} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">{yFmt ? yFmt(v) : Math.round(v)}</text>
          </g>
        );
      })}
      {/* line */}
      <path d={path} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* dots */}
      {data.map((d, i) => (
        <circle key={i} cx={sx(d[xKey])} cy={sy(d[yKey])} r="2.5" fill="#10b981">
          <title>{`${xFmt ? xFmt(d[xKey]) : d[xKey]}: ${yFmt ? yFmt(d[yKey]) : d[yKey]}`}</title>
        </circle>
      ))}
      {/* x labels */}
      <text x={pad} y={h + 8} fontSize="9" fill="#94a3b8">{xFmt ? xFmt(xMin) : xMin}</text>
      <text x={w - pad / 2} y={h + 8} fontSize="9" fill="#94a3b8" textAnchor="end">{xFmt ? xFmt(xMax) : xMax}</text>
      {xLabel && <text x={w / 2} y={h + 14} fontSize="10" fill="#64748b" textAnchor="middle">{xLabel}</text>}
    </svg>
  );
}

/* ───── Constants ───── */
const FUEL_LABELS  = { Petrol: 'Бензин', Diesel: 'Дизель', Gas: 'Газ', Other: 'Інше' };
const BODY_LABELS  = { sedan: 'Седан', hatch: 'Хетчбек', crossover: 'Кросовер', vagon: 'Універсал', van: 'Мікроавтобус', other: 'Інше' };
const DRIVE_LABELS = { front: 'Передній', rear: 'Задній', full: 'Повний' };
const FEATURE_LABELS = {
  car: 'Марка', model: 'Модель', body: 'Кузов', engType: 'Паливо', drive: 'Привід',
  mileage: 'Пробіг', engV: 'Об\'єм', year: 'Рік',
};
const CONFIDENCE_BADGE = {
  high:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Висока надійність' },
  medium: { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Середня надійність' },
  low:    { bg: 'bg-rose-100',    text: 'text-rose-700',    label: 'Низька надійність' },
};

const DEFAULT_FORM = {
  car: 'Volkswagen', model: '', year: 2015,
  engType: 'Petrol', body: 'sedan', drive: 'front',
  mileage: 150, engV: 2.0,
};

/* ───── Tabs ───── */
function Tabs({ active, onChange }) {
  const tabs = [
    { id: 'predict', label: 'Прогноз', icon: <Icon.Sparkles className="w-4 h-4" /> },
    { id: 'eda',     label: 'Аналіз даних', icon: <Icon.Chart className="w-4 h-4" /> },
  ];
  return (
    <div className="inline-flex p-1 rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
            ${active === t.id ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md shadow-emerald-500/30' : 'text-slate-600 hover:text-emerald-600'}`}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

/* ───── PredictView ───── */
function PredictView({ options, optionsError, currency, history, addHistory, clearHistory }) {
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [result, setResult] = useState(null);   // { price, interval, confidence, warning }
  const [similar, setSimilar] = useState([]);
  const [importance, setImportance] = useState(null);
  const [metricsInfo, setMetricsInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Завантажуємо importance і metrics один раз
  useEffect(() => {
    fetch(`${API_BASE}/feature-importance`).then((r) => r.ok ? r.json() : null).then((d) => d && setImportance(d.items));
    fetch(`${API_BASE}/metrics`).then((r) => r.ok ? r.json() : null).then((d) => d && setMetricsInfo(d));
  }, []);

  const limits = options?.limits ?? { year: { min: 1980, max: 2026 }, mileage: { min: 0, max: 999 }, engV: { min: 0.1, max: 10 } };
  const cars = options?.cars ?? [];
  const modelsForCar = useMemo(() => (options ? options.models_by_car[formData.car] ?? [] : []), [options, formData.car]);
  const modelSpec = options?.specs_by_model?.[formData.car]?.[formData.model] ?? null;
  const allEngTypes = options?.engTypes ?? ['Petrol', 'Diesel', 'Gas', 'Other'];
  const allBodies   = options?.bodies   ?? ['sedan', 'hatch', 'crossover', 'vagon', 'van', 'other'];
  const allDrives   = options?.drives   ?? ['front', 'rear', 'full'];
  const engTypes = modelSpec?.engTypes?.length ? modelSpec.engTypes : allEngTypes;
  const bodies   = modelSpec?.bodies?.length   ? modelSpec.bodies   : allBodies;
  const drives   = modelSpec?.drives?.length   ? modelSpec.drives   : allDrives;
  const engVValues = modelSpec?.engV_values?.length ? modelSpec.engV_values : null;
  const yearMin = modelSpec?.year_range ? modelSpec.year_range[0] : limits.year.min;
  const yearMax = 2026;

  // Початкова модель після завантаження options
  useEffect(() => {
    if (!options) return;
    if (!formData.model) {
      const first = options.models_by_car[formData.car]?.[0] ?? '';
      if (first) setFormData((p) => ({ ...p, model: first }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  // Auto-fix недійсних значень при зміні моделі
  useEffect(() => {
    if (!modelSpec) return;
    const fix = {};
    if (modelSpec.bodies?.length && !modelSpec.bodies.includes(formData.body)) fix.body = modelSpec.bodies[0];
    if (modelSpec.engTypes?.length && !modelSpec.engTypes.includes(formData.engType)) fix.engType = modelSpec.engTypes[0];
    if (modelSpec.drives?.length && !modelSpec.drives.includes(formData.drive)) fix.drive = modelSpec.drives[0];
    if (modelSpec.engV_values?.length) {
      const v = Number(formData.engV), allowed = modelSpec.engV_values;
      if (!allowed.some((x) => Math.abs(x - v) < 1e-6)) {
        fix.engV = allowed.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
      }
    }
    if (modelSpec.year_range) {
      const lo = modelSpec.year_range[0], y = Number(formData.year);
      if (y < lo) fix.year = lo;
    }
    if (Object.keys(fix).length) setFormData((p) => ({ ...p, ...fix }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.car, formData.model, options]);

  const set = (patch) => setFormData((p) => ({ ...p, ...patch }));
  const handleCar = (car) => set({ car, model: options?.models_by_car[car]?.[0] ?? '' });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null); setSimilar([]);
    try {
      const payload = {
        car: formData.car, model: formData.model,
        year: parseInt(formData.year), engType: formData.engType,
        body: formData.body, drive: formData.drive,
        mileage: parseFloat(formData.mileage), engV: parseFloat(formData.engV),
      };
      const r = await fetch(`${API_BASE}/predict`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        const detail = Array.isArray(err.detail) ? err.detail.map((d) => d.msg).join('; ') : err.detail || 'Помилка сервера';
        throw new Error(detail);
      }
      const data = await r.json();
      setResult({
        price: data.predicted_price_usd,
        interval: data.interval,
        confidence: data.confidence,
        warning: data.extrapolation_warning,
        nSimilar: data.n_similar_in_dataset,
      });
      addHistory({ ...formData, ...data, ts: Date.now() });

      // Паралельно завантажуємо схожі авто
      fetch(`${API_BASE}/similar-cars`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          car: formData.car, model: formData.model,
          year: parseInt(formData.year), engV: parseFloat(formData.engV),
          mileage: parseFloat(formData.mileage), limit: 5,
        }),
      }).then((r) => r.ok ? r.json() : null).then((d) => d && setSimilar(d.items));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ ...DEFAULT_FORM, model: options?.models_by_car[DEFAULT_FORM.car]?.[0] ?? '' });
    setResult(null); setSimilar([]); setError(null);
  };

  const animatedPrice = useCountUp(result?.price);

  return (
    <>
      {optionsError && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex gap-2 items-start">
          <Icon.Alert className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{optionsError}. Переконайтеся, що бекенд запущений: <code className="bg-amber-100 px-1.5 py-0.5 rounded">{API_BASE}</code></span>
        </div>
      )}

      <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl shadow-emerald-900/5 ring-1 ring-black/5 overflow-hidden">
        <form onSubmit={submit} className="p-6 sm:p-8 space-y-7">
          {/* Авто */}
          <section>
            <SectionTitle>Авто</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Combobox label="Марка" icon={<Icon.Car className="w-4 h-4" />} value={formData.car} onChange={handleCar}
                options={cars.length ? cars : [formData.car]} placeholder="Оберіть марку" />
              <Combobox label="Модель" icon={<Icon.Sparkles className="w-4 h-4" />} value={formData.model} onChange={(v) => set({ model: v })}
                options={modelsForCar} placeholder={modelsForCar.length ? 'Оберіть модель' : 'Немає моделей'} disabled={modelsForCar.length === 0} />
            </div>
          </section>

          {/* Параметри */}
          <section>
            <SectionTitle>Параметри</SectionTitle>
            <div className="space-y-5">
              <Slider label="Рік випуску" icon={<Icon.Calendar className="w-4 h-4" />} value={formData.year}
                onChange={(v) => set({ year: v })} min={yearMin} max={yearMax} step={1} />
              {engVValues ? (
                <ValueChips label="Об'єм двигуна" icon={<Icon.Engine className="w-4 h-4" />} value={formData.engV}
                  onChange={(v) => set({ engV: v })} values={engVValues} suffix="л" format={(n) => Number(n).toFixed(1)} />
              ) : (
                <Slider label="Об'єм двигуна" icon={<Icon.Engine className="w-4 h-4" />} value={formData.engV}
                  onChange={(v) => set({ engV: v })} min={limits.engV.min} max={limits.engV.max} step={0.1}
                  suffix="л" format={(n) => n.toFixed(1)} />
              )}
              <Slider label="Пробіг" icon={<Icon.Road className="w-4 h-4" />} value={formData.mileage}
                onChange={(v) => set({ mileage: v })} min={limits.mileage.min} max={limits.mileage.max} step={1} suffix="тис. км" />
            </div>
          </section>

          {/* Конфігурація */}
          <section className="space-y-5">
            <SectionTitle>{modelSpec ? `Конфігурація — за даними ${formData.car} ${formData.model}` : 'Конфігурація'}</SectionTitle>
            <Chips label="Тип палива" icon={<Icon.Fuel className="w-4 h-4" />} value={formData.engType} onChange={(v) => set({ engType: v })}
              options={engTypes.map((t) => ({ value: t, label: FUEL_LABELS[t] || t }))} />
            <Chips label="Кузов" icon={<Icon.Car className="w-4 h-4" />} value={formData.body} onChange={(v) => set({ body: v })}
              options={bodies.map((b) => ({ value: b, label: BODY_LABELS[b] || b }))} />
            <Chips label="Привід" icon={<Icon.Drive className="w-4 h-4" />} value={formData.drive} onChange={(v) => set({ drive: v })}
              options={drives.map((d) => ({ value: d, label: DRIVE_LABELS[d] || d }))} />
          </section>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading || !formData.model}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0">
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin-slow" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Розраховуємо...
                </>
              ) : (<><Icon.Sparkles className="w-5 h-5" />Оцінити вартість</>)}
            </button>
            <button type="button" onClick={handleReset} title="Скинути"
              className="px-4 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all">
              <Icon.Reset className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Result + warning + interval */}
        {(result || error) && (
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-4">
            {error && (
              <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 p-4 flex gap-3 items-start animate-shake">
                <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0"><Icon.Alert className="w-5 h-5" /></div>
                <div><p className="font-semibold text-rose-700">Помилка</p><p className="text-sm text-rose-600">{error}</p></div>
              </div>
            )}
            {result && !error && (
              <>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 p-[1px] animate-pop-in">
                  <div className="rounded-2xl bg-white p-6 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white mb-3 shadow-md shadow-emerald-500/30">
                      <Icon.Coin className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Прогнозована ринкова ціна</p>
                    <p className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-emerald-600 to-teal-600 bg-clip-text text-transparent tabular-nums">
                      {fmt(animatedPrice, currency)}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 tabular-nums">
                      Інтервал 95%: {fmt(result.interval.low, currency)} — {fmt(result.interval.high, currency)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${CONFIDENCE_BADGE[result.confidence].bg} ${CONFIDENCE_BADGE[result.confidence].text}`}>
                        {CONFIDENCE_BADGE[result.confidence].label}
                      </span>
                      <span className="text-xs text-slate-400">{result.nSimilar} схожих авто в базі</span>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      {formData.year} {formData.car} {formData.model} · {Number(formData.engV).toFixed(1)} л · {formData.mileage} тис. км
                    </p>
                  </div>
                </div>

                {result.warning && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2 items-start">
                    <Icon.Alert className="w-4 h-4 shrink-0 mt-0.5" /><span>{result.warning}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Importance + Similar + History */}
      {result && !error && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {importance && (
            <Card title="Що впливає на ціну (вся модель)" icon={<Icon.Chart className="w-4 h-4" />}>
              <HBarChart items={importance} valueKey="importance"
                label={(it) => FEATURE_LABELS[it.feature] || it.feature}
                valueFmt={(v) => `${(v * 100).toFixed(1)}%`} max={1} />
            </Card>
          )}
          {similar.length > 0 && (
            <Card title="Схожі авто з бази" icon={<Icon.Car className="w-4 h-4" />}>
              <div className="space-y-2">
                {similar.map((c, i) => (
                  <div key={i} className="flex justify-between items-baseline text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{c.car} {c.model} <span className="text-slate-400">·</span> {c.year}</p>
                      <p className="text-xs text-slate-500">{c.engV} л · {c.mileage} тис. км · {FUEL_LABELS[c.engType] || c.engType}</p>
                    </div>
                    <p className="font-bold text-emerald-700 tabular-nums shrink-0 ml-2">{fmt(c.price, currency)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Метрики моделі (постійно) */}
      {metricsInfo && (
        <Card title="Точність моделі" icon={<Icon.Sparkles className="w-4 h-4" />} className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Metric label="MAE" value={`$${Math.round(metricsInfo.holdout.mae)}`} hint="середня абс. похибка" />
            <Metric label="MAPE" value={`${metricsInfo.holdout.mape_percent.toFixed(1)}%`} hint="середня % похибка" />
            <Metric label="R²"  value={metricsInfo.holdout.r2.toFixed(3)} hint="коеф. детермінації" />
            <Metric label="Алгоритм" value={metricsInfo.winner} hint={`${metricsInfo.holdout.n_train}/${metricsInfo.holdout.n_test}`} />
          </div>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card title="Історія останніх запитів" icon={<Icon.History className="w-4 h-4" />} className="mt-4"
              action={
                <button onClick={clearHistory} className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors">
                  <Icon.Trash className="w-3.5 h-3.5" /> очистити
                </button>
              }>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex justify-between items-baseline text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{h.year} {h.car} {h.model}</p>
                  <p className="text-xs text-slate-500">{Number(h.engV).toFixed(1)} л · {h.mileage} тис. км · {new Date(h.ts).toLocaleString('uk-UA')}</p>
                </div>
                <p className="font-bold text-emerald-700 tabular-nums shrink-0 ml-2">{fmt(h.predicted_price_usd, currency)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

/* ───── EDA View ───── */
function EDAView({ currency }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/stats`).then((r) => r.ok ? r.json() : Promise.reject('500'))
      .then(setStats).catch((e) => setError(String(e)));
  }, []);

  if (error) return (
    <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
      Не вдалося завантажити статистику. Бекенд запущено?
    </div>
  );
  if (!stats) return <div className="p-6 text-slate-500 text-sm">Завантаження...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Записів у базі" value={stats.totals.rows.toLocaleString('en-US')} />
        <StatCard label="Брендів" value={stats.totals.brands} />
        <StatCard label="Моделей" value={stats.totals.models} />
      </div>

      <Card title="Розподіл цін у базі" icon={<Icon.Chart className="w-4 h-4" />}>
        <Histogram data={stats.price_histogram} />
        <p className="text-xs text-slate-400 mt-2 text-center">
          По осі X — ціна в тисячах USD, по Y — кількість оголошень.
        </p>
      </Card>

      <Card title="Топ-15 марок за середньою ціною" icon={<Icon.Coin className="w-4 h-4" />}>
        <HBarChart items={stats.avg_price_by_brand} valueKey="avg_price"
          label={(it) => `${it.car} (${it.count})`}
          valueFmt={(v) => fmt(v, currency)} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Залежність ціни від року" icon={<Icon.Calendar className="w-4 h-4" />}>
          <LineChart data={stats.price_by_year} xKey="year" yKey="median"
            xFmt={(v) => Math.round(v)} yFmt={(v) => `$${Math.round(v / 1000)}k`} />
        </Card>
        <Card title="Залежність ціни від пробігу" icon={<Icon.Road className="w-4 h-4" />}>
          <LineChart data={stats.price_by_mileage} xKey="mileage" yKey="mean"
            xFmt={(v) => `${Math.round(v)}k`} yFmt={(v) => `$${Math.round(v / 1000)}k`} />
        </Card>
      </div>
    </div>
  );
}

/* ───── Common UI ───── */
function Card({ title, icon, children, className = '', action }) {
  return (
    <div className={`rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm ring-1 ring-black/5 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-600">
          <span className="text-emerald-600">{icon}</span>{title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 p-3">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm ring-1 ring-black/5 p-4 text-center">
      <p className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-br from-emerald-600 to-green-600 bg-clip-text text-transparent tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-3 flex items-center gap-2">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200" />
      {children}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200" />
    </h2>
  );
}

function CurrencyToggle({ value, onChange }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-white/70 backdrop-blur border border-white/60 shadow-sm">
      {Object.keys(RATES).map((c) => (
        <button key={c} onClick={() => onChange(c)}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all
            ${value === c ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-emerald-600'}`}>
          {CURRENCY_SYMBOL[c]} {c}
        </button>
      ))}
    </div>
  );
}

/* ───── App ───── */
function App() {
  const [view, setView] = useState('predict');
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    fetch(`${API_BASE}/options`).then((r) => r.ok ? r.json() : Promise.reject('Не вдалося завантажити дані'))
      .then(setOptions).catch((e) => setOptionsError(String(e)));
  }, []);

  const addHistory = useCallback((entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const clearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY); setHistory([]);
  }, []);

  return (
    <div className="min-h-full flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <header className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 mb-3">
            <Icon.Car className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-emerald-700 to-green-600 bg-clip-text text-transparent">
            Оцінка вартості авто
          </h1>
          <p className="mt-2 text-slate-500 text-sm sm:text-base">
            ML-прогноз з довірчим інтервалом, аналіз даних і сенситивність.
          </p>
        </header>

        <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
          <Tabs active={view} onChange={setView} />
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </div>

        {view === 'predict' ? (
          <PredictView options={options} optionsError={optionsError} currency={currency}
                       history={history} addHistory={addHistory} clearHistory={clearHistory} />
        ) : (
          <EDAView currency={currency} />
        )}

        <footer className="mt-6 text-center text-xs text-slate-400">
          Прогноз — оціночний; для прийняття рішення зважайте на ринок і стан авто.
        </footer>
      </div>
    </div>
  );
}

export default App;
