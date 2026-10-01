import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudFog,
  CloudSnow,
  CloudLightning,
  Thermometer,
  Droplets,
  Wind,
  RefreshCw,
  MapPin,
  ChevronDown,
  Calendar,
  Sparkles,
  ChevronUp,
  Umbrella,
  X,
} from 'lucide-react';

export interface CurrentWeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  weatherCode: number;
  windSpeed: number;
  time: string;
}

export interface DailyForecastItem {
  dateStr: string;
  dayName: '오늘' | '내일' | '모레' | string;
  dateLabel: string;
  dayOfWeek: string;
  weatherCode: number;
  conditionLabel: string;
  minTemp: number;
  maxTemp: number;
  rainProb: number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  badgeBg: string;
  runnerAdvice: {
    tag: string;
    badgeColor: string;
    tip: string;
  };
}

export interface WeatherContextValue {
  currentWeather: CurrentWeatherData | null;
  dailyForecast: DailyForecastItem[];
  locationName: string;
  isLoading: boolean;
  lastUpdated: Date | null;
  fetchWeather: () => Promise<void>;
}

export interface WeatherConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  badgeBg: string;
}

export function getWeatherConfig(code: number): WeatherConfig {
  if (code === 0) {
    return {
      label: '맑음',
      icon: Sun,
      iconColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/15 border-amber-500/30',
    };
  }
  if (code === 1 || code === 2) {
    return {
      label: '구름 조금',
      icon: CloudSun,
      iconColor: 'text-amber-300',
      badgeBg: 'bg-amber-400/15 border-amber-400/30',
    };
  }
  if (code === 3) {
    return {
      label: '흐림',
      icon: Cloud,
      iconColor: 'text-slate-300',
      badgeBg: 'bg-slate-400/15 border-slate-400/30',
    };
  }
  if (code === 45 || code === 48) {
    return {
      label: '안개',
      icon: CloudFog,
      iconColor: 'text-slate-400',
      badgeBg: 'bg-slate-400/15 border-slate-400/30',
    };
  }
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return {
      label: code >= 80 ? '소나기' : '비',
      icon: CloudRain,
      iconColor: 'text-blue-600',
      badgeBg: 'bg-blue-50 border-blue-200 text-blue-800',
    };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return {
      label: '눈',
      icon: CloudSnow,
      iconColor: 'text-indigo-300',
      badgeBg: 'bg-indigo-500/15 border-indigo-500/30',
    };
  }
  if (code >= 95) {
    return {
      label: '뇌우',
      icon: CloudLightning,
      iconColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/15 border-amber-500/30',
    };
  }
  return {
    label: '맑음',
    icon: Sun,
    iconColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
  };
}

export function getRunningGearAdvice(temp: number): { gear: string; tip: string } {
  if (temp >= 26) {
    return {
      gear: '싱글렛(민소매) + 초경량 쇼츠 + 러닝캡',
      tip: '높은 기온으로 체온 상승이 빠릅니다. 15~20분마다 수분을 섭취하고 그늘 위주로 달려주세요.',
    };
  }
  if (temp >= 20) {
    return {
      gear: '싱글렛 또는 기능성 반팔 + 3인치/5인치 쇼츠',
      tip: '러닝하기 쾌적한 온도입니다. 레이스 및 지속주(템포런) 훈련에 좋습니다.',
    };
  }
  if (temp >= 14) {
    return {
      gear: '반팔 티셔츠 + 반바지 (필요 시 암워머)',
      tip: '마라톤 최적의 골든 기온대(10~15°C)입니다. PB 달성 및 인터벌 질주에 매우 이상적입니다.',
    };
  }
  if (temp >= 8) {
    return {
      gear: '얇은 긴팔 티셔츠 또는 반팔 + 바람막이 + 숏타이즈/하프타이즈',
      tip: '웜업 전에는 쌀쌀하지만 달리면 체온이 올라갑니다. 워밍업 10분을 충분히 해주세요.',
    };
  }
  if (temp >= 0) {
    return {
      gear: '방풍 윈드브레이커 + 롱타이즈 + 얇은 장갑',
      tip: '체온 보존이 중요합니다. 근육이 경직되기 쉬우므로 부상 방지 스트레칭을 철저히 해주세요.',
    };
  }
  return {
    gear: '기모 방풍 재킷 + 방풍 롱타이즈 + 비니 + 러닝 장갑 + 넥워머',
    tip: '빙판길 주의 및 동상 예방. 심박이 급격히 상승할 수 있으니 무리한 포인트 훈련은 피하세요.',
  };
}

export function getDailyForecastRunnerAdvice(
  code: number,
  maxTemp: number,
  rainProb: number
): { tag: string; badgeColor: string; tip: string } {
  const isRain =
    rainProb >= 55 ||
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    code >= 95;

  if (isRain) {
    return {
      tag: '🌧️ 우중런 또는 실내 트레드밀',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      tip: '비 예보가 있습니다. 젖은 노면 미끄럼에 유의하고, 실내 트레드밀 또는 방수 바람막이를 추천합니다.',
    };
  }
  if (maxTemp >= 26) {
    return {
      tag: '☀️ 이른 아침/일몰 후 조깅',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      tip: '낮 기온이 높습니다. 탈수 방지를 위해 시원한 시간대에 가벼운 유산소 조깅을 권장합니다.',
    };
  }
  if (maxTemp >= 12 && maxTemp <= 22) {
    return {
      tag: '🏃‍♂️ 포인트(인터벌/지속주) 최적',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      tip: '마라톤 훈련 골든 기온대입니다! 인터벌, 템포런, 주말 LSD 등 강도 높은 훈련을 배치하기에 가장 좋습니다.',
    };
  }
  if (maxTemp < 6) {
    return {
      tag: '❄️ 체온 보온 & 부상 주의',
      badgeColor: 'bg-blue-50 text-blue-900 border-blue-200',
      tip: '기온이 쌀쌀하여 근육이 굳기 쉽습니다. 10분 이상 동적 웜업 후 안전하게 달려주세요.',
    };
  }
  return {
    tag: '👟 안정적인 로드 러닝',
    badgeColor: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    tip: '무난하고 안정적인 기상 조건입니다. 기본 마일리지 적립 조깅 및 빌드업주에 적합합니다.',
  };
}

// Global weather context for shared state between header widget and 3-day forecast summary
const WeatherContext = createContext<WeatherContextValue | null>(null);

export const WeatherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentWeather, setCurrentWeather] = useState<CurrentWeatherData | null>(null);
  const [dailyForecast, setDailyForecast] = useState<DailyForecastItem[]>([]);
  const [locationName, setLocationName] = useState<string>('서울');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchWeather = async () => {
    setIsLoading(true);
    let lat = 37.5665;
    let lon = 126.978;
    let loc = '서울';

    // Try browser geolocation if permitted
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 3500,
            maximumAge: 1000 * 60 * 15,
          });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        loc = '내 위치';
      } catch (e) {
        lat = 37.5665;
        lon = 126.978;
        loc = '서울';
      }
    }

    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(
          4
        )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=auto`
      );
      if (!res.ok) throw new Error('기상청 예보 데이터를 불러오지 못했습니다');
      const data = await res.json();

      if (data.current) {
        setCurrentWeather({
          temp: Math.round(data.current.temperature_2m * 10) / 10,
          feelsLike: Math.round(data.current.apparent_temperature * 10) / 10,
          humidity: Math.round(data.current.relative_humidity_2m),
          weatherCode: data.current.weather_code,
          windSpeed: Math.round(data.current.wind_speed_10m * 10) / 10,
          time: data.current.time,
        });
      }

      if (data.daily && data.daily.time && data.daily.time.length > 0) {
        const dayNames = ['오늘', '내일', '모레'];
        const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

        const forecastList: DailyForecastItem[] = [];
        for (let i = 0; i < Math.min(3, data.daily.time.length); i++) {
          const timeStr = data.daily.time[i];
          const d = new Date(timeStr + 'T00:00:00');
          const dow = daysOfWeek[d.getDay()] || '';
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const date = String(d.getDate()).padStart(2, '0');
          const dayName = dayNames[i] || `${m}.${date}`;
          const dateLabel = `${dayName} (${m}.${date} ${dow})`;

          const code = data.daily.weather_code[i] ?? 0;
          const conf = getWeatherConfig(code);
          const minTemp = Math.round((data.daily.temperature_2m_min[i] ?? 14) * 10) / 10;
          const maxTemp = Math.round((data.daily.temperature_2m_max[i] ?? 22) * 10) / 10;
          const rainProb = Math.round(data.daily.precipitation_probability_max[i] ?? 0);

          const runnerAdvice = getDailyForecastRunnerAdvice(code, maxTemp, rainProb);

          forecastList.push({
            dateStr: timeStr,
            dayName,
            dateLabel,
            dayOfWeek: dow,
            weatherCode: code,
            conditionLabel: conf.label,
            minTemp,
            maxTemp,
            rainProb,
            icon: conf.icon,
            iconColor: conf.iconColor,
            badgeBg: conf.badgeBg,
            runnerAdvice,
          });
        }
        setDailyForecast(forecastList);
      }

      setLocationName(loc);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Weather fetch error:', err);
      // Fallback mock weather if offline
      if (!currentWeather) {
        setCurrentWeather({
          temp: 22.0,
          feelsLike: 22.5,
          humidity: 55,
          weatherCode: 0,
          windSpeed: 2.1,
          time: new Date().toISOString(),
        });
      }
      if (dailyForecast.length === 0) {
        const today = new Date();
        const fallbackDays: DailyForecastItem[] = [
          {
            dateStr: today.toISOString().split('T')[0],
            dayName: '오늘',
            dateLabel: `오늘 (${String(today.getMonth() + 1).padStart(2, '0')}.${String(
              today.getDate()
            ).padStart(2, '0')} 화)`,
            dayOfWeek: '화',
            weatherCode: 0,
            conditionLabel: '맑음',
            minTemp: 14.5,
            maxTemp: 24.0,
            rainProb: 0,
            icon: Sun,
            iconColor: 'text-amber-400',
            badgeBg: 'bg-amber-500/15 border-amber-500/30',
            runnerAdvice: {
              tag: '🏃‍♂️ 포인트(인터벌/지속주) 최적',
              badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
              tip: '마라톤 훈련 골든 기온대입니다! 심폐를 자극하는 인터벌이나 장거리 지속주 훈련에 최적입니다.',
            },
          },
          {
            dateStr: new Date(today.getTime() + 86400000).toISOString().split('T')[0],
            dayName: '내일',
            dateLabel: `내일 (${String(today.getMonth() + 1).padStart(2, '0')}.${String(
              today.getDate() + 1
            ).padStart(2, '0')} 수)`,
            dayOfWeek: '수',
            weatherCode: 61,
            conditionLabel: '비',
            minTemp: 16.0,
            maxTemp: 22.5,
            rainProb: 65,
            icon: CloudRain,
            iconColor: 'text-blue-600',
            badgeBg: 'bg-blue-50 border-blue-200 text-blue-800',
            runnerAdvice: {
              tag: '🌧️ 우중런 또는 실내 트레드밀',
              badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
              tip: '비 예보가 있습니다. 미끄럼 방지 신발 착용 또는 실내 런닝머신 훈련을 권장합니다.',
            },
          },
          {
            dateStr: new Date(today.getTime() + 172800000).toISOString().split('T')[0],
            dayName: '모레',
            dateLabel: `모레 (${String(today.getMonth() + 1).padStart(2, '0')}.${String(
              today.getDate() + 2
            ).padStart(2, '0')} 목)`,
            dayOfWeek: '목',
            weatherCode: 1,
            conditionLabel: '구름 조금',
            minTemp: 12.0,
            maxTemp: 20.0,
            rainProb: 10,
            icon: CloudSun,
            iconColor: 'text-amber-300',
            badgeBg: 'bg-amber-400/15 border-amber-400/30',
            runnerAdvice: {
              tag: '🏃‍♂️ 포인트(인터벌/지속주) 최적',
              badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
              tip: '쾌적하고 선선한 가을 날씨로 목표 페이스 질주 및 빌드업 훈련에 적합합니다.',
            },
          },
        ];
        setDailyForecast(fallbackDays);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <WeatherContext.Provider
      value={{
        currentWeather,
        dailyForecast,
        locationName,
        isLoading,
        lastUpdated,
        fetchWeather,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
};

/**
 * Compact Weather Badge/Pill in Header Highlights
 */
export const WeatherWidget: React.FC = () => {
  const { currentWeather, dailyForecast, locationName, isLoading, lastUpdated, fetchWeather } =
    useWeather();
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPopoverOpen(false);
      }
    };
    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopoverOpen]);

  const config = currentWeather
    ? getWeatherConfig(currentWeather.weatherCode)
    : getWeatherConfig(0);
  const IconComponent = config.icon;
  const gearAdvice = currentWeather ? getRunningGearAdvice(currentWeather.temp) : null;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Compact Header Pill Button */}
      <button
        type="button"
        onClick={() => setIsPopoverOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-50/90 hover:bg-stone-100 border border-stone-200 hover:border-emerald-500/40 text-left transition-all cursor-pointer shadow-xs group"
        title="오늘의 날씨 및 러닝 추천 복장 보기"
        aria-label="오늘의 날씨 정보"
      >
        <div
          className={`p-1.5 rounded-lg flex items-center justify-center ${config.badgeBg} ${config.iconColor} transition-transform group-hover:scale-110`}
        >
          {isLoading && !currentWeather ? (
            <RefreshCw className="w-4 h-4 animate-spin text-stone-400" />
          ) : (
            <IconComponent className="w-4 h-4" />
          )}
        </div>

        <div className="flex flex-col">
          <div className="text-[10px] text-stone-500 font-medium leading-none flex items-center gap-1">
            <span className="truncate max-w-[60px]">{locationName}</span>
            <span>•</span>
            <span>{config.label}</span>
          </div>
          <div className="text-xs sm:text-sm font-black text-stone-900 font-athletic flex items-center gap-1 mt-0.5">
            {currentWeather ? (
              <>
                <span>{currentWeather.temp}°C</span>
                <ChevronDown
                  className={`w-3 h-3 text-stone-400 transition-transform ${
                    isPopoverOpen ? 'rotate-180' : ''
                  }`}
                />
              </>
            ) : (
              <span className="text-xs text-stone-400">날씨 로딩...</span>
            )}
          </div>
        </div>
      </button>

      {/* Popover / Modal: Portaled directly to document.body so backdrop-filter in Header cannot clip it! */}
      {isPopoverOpen && currentWeather && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
            onClick={() => setIsPopoverOpen(false)}
          >
            <div
              className="w-full max-w-sm sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain p-3.5 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xl text-stone-800 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <WeatherPopupCard
                currentWeather={currentWeather}
                dailyForecast={dailyForecast}
                locationName={locationName}
                lastUpdated={lastUpdated}
                isLoading={isLoading}
                fetchWeather={fetchWeather}
                config={config}
                IconComponent={IconComponent}
                gearAdvice={gearAdvice}
                onClose={() => setIsPopoverOpen(false)}
              />
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
};

interface WeatherPopupCardProps {
  currentWeather: CurrentWeatherData;
  dailyForecast: DailyForecastItem[];
  locationName: string;
  lastUpdated: Date | null;
  isLoading: boolean;
  fetchWeather: () => Promise<void>;
  config: WeatherConfig;
  IconComponent: React.ComponentType<{ className?: string }>;
  gearAdvice: { gear: string; tip: string } | null;
  onClose: () => void;
}

const WeatherPopupCard: React.FC<WeatherPopupCardProps> = ({
  currentWeather,
  dailyForecast,
  locationName,
  lastUpdated,
  isLoading,
  fetchWeather,
  config,
  IconComponent,
  gearAdvice,
  onClose,
}) => {
  return (
    <div className="space-y-3 text-xs text-stone-800">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${config.badgeBg} ${config.iconColor}`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1 font-bold text-stone-900 text-sm">
              <MapPin className="w-3.5 h-3.5 text-rose-700" />
              <span>{locationName} 실시간 날씨</span>
            </div>
            <div className="text-[10px] text-stone-500">
              {config.label} •{' '}
              {lastUpdated
                ? lastUpdated.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}{' '}
              기준
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fetchWeather();
            }}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 border border-stone-200 transition-all cursor-pointer"
            title="날씨 새로고침"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 border border-stone-200 transition-all cursor-pointer"
            title="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Current Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 my-2.5">
        <div className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-center">
          <div className="text-[10px] text-stone-500 flex items-center justify-center gap-1">
            <Thermometer className="w-3 h-3 text-rose-700" />
            <span>현재 기온</span>
          </div>
          <div className="text-base font-black text-stone-900 font-athletic mt-0.5">
            {currentWeather.temp}°C
          </div>
        </div>

        <div className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-center">
          <div className="text-[10px] text-stone-500 flex items-center justify-center gap-1">
            <Droplets className="w-3 h-3 text-emerald-700" />
            <span>체감 / 습도</span>
          </div>
          <div className="text-xs font-bold text-emerald-800 font-athletic mt-0.5">
            {currentWeather.feelsLike}°C
            <span className="text-[10px] text-stone-500 font-normal font-sans ml-1">
              ({currentWeather.humidity}%)
            </span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-center">
          <div className="text-[10px] text-stone-500 flex items-center justify-center gap-1">
            <Wind className="w-3 h-3 text-amber-700" />
            <span>풍속</span>
          </div>
          <div className="text-xs font-bold text-amber-800 font-athletic mt-0.5">
            {currentWeather.windSpeed}{' '}
            <span className="text-[10px] text-stone-500 font-normal font-sans">km/h</span>
          </div>
        </div>
      </div>

      {/* Running Gear Advice */}
      {gearAdvice && (
        <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[11px] whitespace-nowrap">
            <span>🏃‍♂️ 오늘의 러닝 복장 가이드</span>
          </div>
          <div className="text-stone-900 font-semibold text-[11px] keep-all">{gearAdvice.gear}</div>
          <p className="text-[10px] text-stone-600 leading-relaxed border-t border-emerald-200/50 pt-1 keep-all">
            💡 {gearAdvice.tip}
          </p>
        </div>
      )}

      {/* Quick 3-Day Forecast mini summary in popover: Shown on both mobile and PC */}
      {dailyForecast.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-stone-200">
          <div className="text-[10px] font-bold text-stone-600 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-emerald-700" />
            <span>향후 3일간 기상 및 훈련 환경</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {dailyForecast.map((day, idx) => {
              const DayIcon = day.icon;
              return (
                <div
                  key={idx}
                  className="p-1.5 rounded-lg bg-stone-50 border border-stone-200 text-center flex flex-col justify-between gap-1"
                >
                  <div className="text-[10px] font-bold text-stone-700">{day.dayName}</div>
                  <div className="flex items-center justify-center gap-1 my-0.5">
                    <DayIcon className={`w-3.5 h-3.5 ${day.iconColor}`} />
                    <span className="text-[10px] text-stone-900 font-medium">
                      {day.conditionLabel}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono font-bold">
                    <span className="text-emerald-800">{day.minTemp}°</span> ~{' '}
                    <span className="text-rose-900">{day.maxTemp}°</span>
                  </div>
                  {day.rainProb > 0 && (
                    <div className="text-[9px] text-blue-700 font-medium">
                      강수 {day.rainProb}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 3-Day Weather Forecast Summary Component
 * Rendered below the current weather condition in the header to help runners plan their training
 */
export const ThreeDayWeatherForecast: React.FC = () => {
  const { dailyForecast, locationName, isLoading } = useWeather();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (dailyForecast.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="mt-3.5 pt-3 border-t border-stone-200">
      {/* Header bar of 3-Day Forecast */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-rose-100 text-rose-900 border border-rose-200 flex-shrink-0">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5 flex-wrap">
            <span className="whitespace-nowrap">주간 훈련 계획을 위한 3일 기상 예보</span>
            <span className="text-[10px] font-normal text-stone-500 font-mono whitespace-nowrap">
              ({locationName} 기준)
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs flex-shrink-0">
          <span className="text-[11px] text-stone-500 hidden md:inline keep-all">
            💡 일별 기온과 강수 확률에 맞추어 조깅/포인트 훈련 일정을 배치하세요.
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-[11px] text-stone-600 hover:text-stone-900 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-all cursor-pointer whitespace-nowrap"
          >
            <span>{isExpanded ? '예보 접기' : '3일 예보 펼치기'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 3-Day Forecast Cards */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {dailyForecast.map((item, idx) => {
            const ItemIcon = item.icon;
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 shadow-2xs ${
                  idx === 0
                    ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400/20'
                    : 'bg-stone-50/90 hover:bg-stone-100/90 border-stone-200'
                }`}
              >
                {/* Top Row: Date, Day badge & Weather Icon */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                        idx === 0
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-200 text-stone-800'
                      }`}
                    >
                      {item.dayName}
                    </span>
                    <span className="text-xs font-bold text-stone-900">{item.dateLabel}</span>
                  </div>

                  <div className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
                    <div
                      className={`p-1 rounded-md flex items-center justify-center ${item.badgeBg} ${item.iconColor}`}
                    >
                      <ItemIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-stone-800">
                      {item.conditionLabel}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Temperature & Rain */}
                <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-stone-200 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 font-athletic">
                    <span className="text-[10px] text-stone-500 font-sans">기온:</span>
                    <span className="text-emerald-800 font-bold">{item.minTemp}°C</span>
                    <span className="text-stone-400">~</span>
                    <span className="text-rose-900 font-bold">{item.maxTemp}°C</span>
                  </div>

                  <div className="flex items-center gap-1 font-mono text-[11px] flex-shrink-0">
                    <Umbrella
                      className={`w-3 h-3 ${
                        item.rainProb >= 50
                          ? 'text-blue-600 animate-pulse'
                          : item.rainProb > 0
                          ? 'text-blue-500'
                          : 'text-stone-400'
                      }`}
                    />
                    <span
                      className={
                        item.rainProb >= 50
                          ? 'text-blue-700 font-bold'
                          : item.rainProb > 0
                          ? 'text-stone-700'
                          : 'text-stone-400'
                      }
                    >
                      강수 {item.rainProb}%
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Runner Training Recommendation Badge & Tip */}
                <div className="space-y-1">
                  <div className="flex items-center">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold border whitespace-nowrap ${item.runnerAdvice.badgeColor}`}
                    >
                      {item.runnerAdvice.tag}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-600 leading-relaxed keep-all">
                    {item.runnerAdvice.tip}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
