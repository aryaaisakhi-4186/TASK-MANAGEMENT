import React, { useState, useEffect } from 'react';
import { Sun, Moon, Sunrise, Sunset, Sparkles } from 'lucide-react';

export const IndianGreeting: React.FC<{ userName?: string }> = ({ userName }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();

  let greeting = 'Welcome';
  let Icon = Sun;

  if (hours >= 4 && hours < 12) {
    greeting = 'Good Morning';
    Icon = Sunrise;
  } else if (hours >= 12 && hours < 17) {
    greeting = 'Good Afternoon';
    Icon = Sun;
  } else if (hours >= 17 && hours < 21) {
    greeting = 'Good Evening';
    Icon = Sunset;
  } else {
    greeting = 'Good Night';
    Icon = Moon;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
        <Icon size={24} className="animate-pulse" />
      </div>
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <span className="text-amber-600 dark:text-amber-400 font-serif">{greeting}</span>, {userName || 'Associate'}
          <Sparkles size={16} className="text-amber-500 inline" />
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-2">
          <span className="font-serif text-amber-700 dark:text-amber-400 font-bold tracking-wide">योगः कर्मसु कौशलम्</span>
        </p>
      </div>
    </div>
  );
};
