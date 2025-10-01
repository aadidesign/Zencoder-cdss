import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  decimals = 0,
  duration = 1000,
  className,
  prefix = '',
  suffix = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const spring = useSpring(displayValue, { damping: 50, stiffness: 100 });
  const transform = useTransform(spring, (latest) => 
    (prefix + latest.toFixed(decimals) + suffix)
  );

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  useEffect(() => {
    spring.set(displayValue);
  }, [displayValue, spring]);

  return (
    <motion.span className={className}>
      {transform}
    </motion.span>
  );
};