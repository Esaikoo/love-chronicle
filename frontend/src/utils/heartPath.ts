export function getHeartPoint(t: number, scale: number) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);

  return {
    x: x * scale,
    y: -y * scale
  };
}

export function getHeartPoints(count: number, scale: number) {
  return Array.from({ length: count }, (_, index) => {
    const t = (index / count) * Math.PI * 2;
    return getHeartPoint(t, scale);
  });
}
