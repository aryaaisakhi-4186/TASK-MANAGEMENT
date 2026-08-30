import React, { useState, useEffect } from 'react';

export const AnalogClock: React.FC<{ size?: number }> = ({ size = 110 }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours() % 12;

  const secDeg = (seconds / 60) * 360;
  const minDeg = ((minutes + seconds / 60) / 60) * 360;
  const hourDeg = ((hours + minutes / 60) / 12) * 360;

  const r = size / 2;

  return (
    <div 
      className="relative flex items-center justify-center rounded-full shadow-2xl transition-all select-none"
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 35% 35%, #5a3314, #2a1506 70%, #150a02)',
        border: '3px solid #DAA520',
        boxShadow: 'inset 0 2px 6px rgba(255,215,0,0.3), 0 8px 20px rgba(0,0,0,0.6)'
      }}
    >
      {/* Clock Face Inner Ring */}
      <div 
        className="absolute rounded-full border border-amber-500/20"
        style={{ width: size * 0.85, height: size * 0.85 }}
      />

      {/* Hour Markers (12, 3, 6, 9 Roman Numerals) */}
      <span className="absolute top-1.5 font-serif text-[10px] font-bold text-amber-200 tracking-wider">XII</span>
      <span className="absolute right-2 font-serif text-[10px] font-bold text-amber-200">III</span>
      <span className="absolute bottom-1.5 font-serif text-[10px] font-bold text-amber-200">VI</span>
      <span className="absolute left-2 font-serif text-[10px] font-bold text-amber-200">IX</span>

      {/* Hour Hand */}
      <div
        className="absolute bottom-1/2 left-1/2 origin-bottom rounded-full"
        style={{
          width: 3,
          height: size * 0.26,
          backgroundColor: '#FFD700',
          transform: `translateX(-50%) rotate(${hourDeg}deg)`,
          transition: 'transform 0.1s cubic-bezier(0.4, 2, 0.55, 0.44)',
          boxShadow: '0 0 4px rgba(0,0,0,0.8)'
        }}
      />

      {/* Minute Hand */}
      <div
        className="absolute bottom-1/2 left-1/2 origin-bottom rounded-full"
        style={{
          width: 2,
          height: size * 0.36,
          backgroundColor: '#FFF8DC',
          transform: `translateX(-50%) rotate(${minDeg}deg)`,
          transition: 'transform 0.1s cubic-bezier(0.4, 2, 0.55, 0.44)',
          boxShadow: '0 0 4px rgba(0,0,0,0.8)'
        }}
      />

      {/* Second Hand (Saffron/Ruby Accent) */}
      <div
        className="absolute bottom-1/2 left-1/2 origin-bottom"
        style={{
          width: 1.5,
          height: size * 0.42,
          backgroundColor: '#FF5722',
          transform: `translateX(-50%) rotate(${secDeg}deg)`,
          boxShadow: '0 0 6px #FF5722'
        }}
      />

      {/* Center Pivot Brass Pin */}
      <div 
        className="absolute rounded-full z-10"
        style={{
          width: 7,
          height: 7,
          backgroundColor: '#FFD700',
          border: '1.5px solid #2a1506',
          boxShadow: '0 0 4px rgba(0,0,0,0.6)'
        }}
      />
    </div>
  );
};
